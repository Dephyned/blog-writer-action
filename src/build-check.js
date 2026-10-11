const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const { runClaude } = require('./claude');
const { commitFiles } = require('./commit');
const { FIX_BUILD_PROMPT_TEMPLATE } = require('./fix-build-prompt-template');
const { FIX_POST_PROMPT_TEMPLATE } = require('./fix-post-prompt-template');
const {
  BUILD_ENV_OVERRIDES,
  BUILD_OUTPUT_TAIL_LINES,
  FIX_ALLOWED_TOOLS,
  FIX_BUILD_MAX_TURNS,
  FIX_POST_MAX_TURNS,
  POST_STASH_MESSAGE,
  BUILD_REPAIR_COMMIT_MESSAGE,
  BUILD_DISABLE_COMMIT_MESSAGE,
  BUILD_CHECK_NONE,
  BUILD_CHECK_PASSED,
  BUILD_CHECK_FIXED,
  BUILD_CHECK_DISABLED,
  BUILD_CHECK_REPAIRED,
  BUILD_CHECK_POST_FIXED,
  PLACEHOLDER_CONFIG_PATH,
  PLACEHOLDER_BUILD_COMMAND,
  PLACEHOLDER_BUILD_OUTPUT,
  PLACEHOLDER_POST_FILES,
  ERROR_POST_BROKE_BUILD,
  CLAUDE_LABEL_BUILD_FIX,
  CLAUDE_LABEL_POST_FIX,
} = require('./constants');

/**
 * Every repo builds differently (monorepos, secrets, services CI lacks), so the
 * configured build command can't be trusted blindly. These checks run the build,
 * and when it fails work out whether the command or the new post is to blame.
 * Claude never runs commands here: it only reads the error and edits files.
 */

function tail(text) {
  return text.split('\n').slice(-BUILD_OUTPUT_TAIL_LINES).join('\n');
}

/**
 * @returns {Promise<{ok: boolean, output: string}>}
 */
async function tryBuild(repoRoot, buildCommand) {
  core.info('Running build: ' + buildCommand);
  const { exitCode, stdout, stderr } = await exec.getExecOutput('bash', ['-c', buildCommand], {
    cwd: repoRoot,
    ignoreReturnCode: true,
    env: { ...process.env, ...BUILD_ENV_OVERRIDES },
  });
  return { ok: exitCode === 0, output: tail(`${stdout}\n${stderr}`.trim()) };
}

function readConfigFile(repoRoot, configPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, configPath), 'utf8'));
}

function writeConfigFile(repoRoot, configPath, config) {
  fs.writeFileSync(path.join(repoRoot, configPath), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Gives Claude one chance to correct the build command. Keeps the new command
 * only if it builds; otherwise turns the build check off.
 * @returns {Promise<{status: string, buildCommand: string}>}
 */
async function repairBuildCommand({ repoRoot, configPath, buildCommand, output }) {
  core.warning('The build fails even without a new post, asking Claude to fix the build command.');
  const prompt = FIX_BUILD_PROMPT_TEMPLATE
    .split(PLACEHOLDER_CONFIG_PATH).join(configPath)
    .split(PLACEHOLDER_BUILD_COMMAND).join(buildCommand)
    .split(PLACEHOLDER_BUILD_OUTPUT).join(output);
  await runClaude(prompt, { allowedTools: FIX_ALLOWED_TOOLS, maxTurns: FIX_BUILD_MAX_TURNS }, CLAUDE_LABEL_BUILD_FIX);

  const proposed = readConfigFile(repoRoot, configPath).buildCommand;
  if (proposed && proposed !== buildCommand && (await tryBuild(repoRoot, proposed)).ok) {
    core.info('Build command fixed: ' + proposed);
    return { status: BUILD_CHECK_FIXED, buildCommand: proposed };
  }

  core.warning('Could not find a build command that works in CI, turning the build check off for this repo.');
  writeConfigFile(repoRoot, configPath, { ...readConfigFile(repoRoot, configPath), buildCommand: '' });
  return { status: BUILD_CHECK_DISABLED, buildCommand: '' };
}

/**
 * Setup: confirms the configured build works, fixing or turning it off if not.
 * Leaves any config change uncommitted for setup to commit.
 * @returns {Promise<string>} "none", "passed", "fixed" or "disabled"
 */
async function ensureWorkingBuild({ repoRoot, configPath, config }) {
  if (!config.buildCommand) return BUILD_CHECK_NONE;

  const first = await tryBuild(repoRoot, config.buildCommand);
  if (first.ok) return BUILD_CHECK_PASSED;

  const { status } = await repairBuildCommand({
    repoRoot,
    configPath,
    buildCommand: config.buildCommand,
    output: first.output,
  });
  return status;
}

async function git(repoRoot, args) {
  await exec.exec('git', args, { cwd: repoRoot });
}

async function fixPost({ repoRoot, config, postFiles, output }) {
  core.warning('The new post broke the build, asking Claude to fix it.');
  const prompt = FIX_POST_PROMPT_TEMPLATE
    .split(PLACEHOLDER_POST_FILES).join(postFiles.map((file) => `- ${file}`).join('\n'))
    .split(PLACEHOLDER_BUILD_OUTPUT).join(output);
  const model = config.claude && config.claude.model;
  await runClaude(prompt, {
    allowedTools: FIX_ALLOWED_TOOLS,
    maxTurns: FIX_POST_MAX_TURNS,
    ...(model ? { model } : {}),
  }, CLAUDE_LABEL_POST_FIX);

  const retry = await tryBuild(repoRoot, config.buildCommand);
  if (retry.ok) return BUILD_CHECK_POST_FIXED;

  await git(repoRoot, ['checkout', '--', ...postFiles]);
  await git(repoRoot, ['clean', '-fd', '--', ...postFiles]);
  throw new Error(ERROR_POST_BROKE_BUILD);
}

/**
 * Daily run: checks the site still builds with the new post. If not, rebuilds
 * without the post to see who is to blame. A broken command is fixed (or the
 * check turned off) and committed, and the post is kept. A broken post gets one
 * fix attempt and is discarded if it still fails.
 * @returns {Promise<string>} "none", "passed", "repaired", "disabled" or "post-fixed"
 */
async function verifyPostBuild({ repoRoot, configPath, config, branch }) {
  if (!config.buildCommand) return BUILD_CHECK_NONE;

  const withPost = await tryBuild(repoRoot, config.buildCommand);
  if (withPost.ok) return BUILD_CHECK_PASSED;

  const postFiles = config.filesToCommit;
  await git(repoRoot, ['stash', 'push', '--include-untracked', '--message', POST_STASH_MESSAGE, '--', ...postFiles]);

  let baseline;
  let repair = null;
  try {
    baseline = await tryBuild(repoRoot, config.buildCommand);
    if (!baseline.ok) {
      repair = await repairBuildCommand({
        repoRoot,
        configPath,
        buildCommand: config.buildCommand,
        output: baseline.output,
      });
      const message = repair.status === BUILD_CHECK_FIXED ? BUILD_REPAIR_COMMIT_MESSAGE : BUILD_DISABLE_COMMIT_MESSAGE;
      await commitFiles({ repoRoot, files: [configPath], message, branch });
    }
  } finally {
    await git(repoRoot, ['stash', 'pop']);
  }

  if (!repair) {
    return fixPost({ repoRoot, config, postFiles, output: withPost.output });
  }

  if (repair.status === BUILD_CHECK_DISABLED) return BUILD_CHECK_DISABLED;

  const repairedConfig = { ...config, buildCommand: repair.buildCommand };
  const withFixedCommand = await tryBuild(repoRoot, repair.buildCommand);
  if (withFixedCommand.ok) return BUILD_CHECK_REPAIRED;

  return fixPost({ repoRoot, config: repairedConfig, postFiles, output: withFixedCommand.output });
}

module.exports = { ensureWorkingBuild, verifyPostBuild };
