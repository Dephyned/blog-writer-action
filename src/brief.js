const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const { installClaudeCli, runClaude } = require('./claude');
const { commitFiles } = require('./commit');
const { BRIEF_PROMPT_TEMPLATE } = require('./brief-prompt-template');
const {
  BRIEF_STATE_SUFFIX,
  BRIEF_ALLOWED_TOOLS,
  BRIEF_MAX_LISTED_FILES,
  BRIEF_COMMIT_MESSAGE,
  BRIEF_RESULT_FRESH,
  BRIEF_RESULT_REFRESHED,
  BRIEF_RESULT_UNCHANGED,
  BRIEF_EXCLUDED_PATTERNS,
  BRIEF_TASK_CREATE,
  BRIEF_TASK_UPDATE,
  BRIEF_FILE_LIST_TRUNCATED,
  DAY_MS,
  PLACEHOLDER_PRODUCT_BRIEF_PATH,
  PLACEHOLDER_FILE_LIST,
  PLACEHOLDER_BRIEF_TASK,
  ERROR_BRIEF_NOT_WRITTEN,
  CLAUDE_LABEL_BRIEF,
} = require('./constants');

/**
 * Drops files that never explain what a product does (tests, dependencies,
 * build output, lock files, media, CI config) and the brief itself.
 * @param {string[]} files - Repo-relative paths
 * @param {string} briefPath - Repo-relative brief path
 * @returns {string[]}
 */
function filterSourceFiles(files, briefPath) {
  return files.filter(
    (file) => file && file !== briefPath && !BRIEF_EXCLUDED_PATTERNS.some((pattern) => pattern.test(file))
  );
}

/**
 * @param {{generatedAt: string}|null} state - Saved brief state
 * @param {number} maxAgeDays
 * @param {Date} now
 * @returns {boolean}
 */
function isBriefStale(state, maxAgeDays, now) {
  if (!state || !state.generatedAt) return true;
  return now.getTime() - new Date(state.generatedAt).getTime() > maxAgeDays * DAY_MS;
}

function statePathFor(briefPath) {
  return briefPath.replace(/\.[^/.]+$/, '') + BRIEF_STATE_SUFFIX;
}

function readState(repoRoot, statePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, statePath), 'utf8'));
  } catch {
    return null;
  }
}

async function gitOutput(repoRoot, args) {
  const { stdout } = await exec.getExecOutput('git', args, { cwd: repoRoot, silent: true });
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

/**
 * Source files changed since the brief's commit, or null if that commit is gone
 * (e.g. history was rewritten), in which case the brief is rebuilt.
 */
async function changedSourceFiles(repoRoot, sinceCommit, briefPath) {
  try {
    const changed = await gitOutput(repoRoot, ['diff', '--name-only', `${sinceCommit}..HEAD`]);
    return filterSourceFiles(changed, briefPath);
  } catch {
    return null;
  }
}

function buildBriefPrompt({ briefPath, files, task }) {
  const listed = files.slice(0, BRIEF_MAX_LISTED_FILES).map((file) => `- ${file}`);
  if (files.length > BRIEF_MAX_LISTED_FILES) {
    listed.push('', BRIEF_FILE_LIST_TRUNCATED);
  }
  return BRIEF_PROMPT_TEMPLATE
    .split(PLACEHOLDER_BRIEF_TASK).join(task)
    .split(PLACEHOLDER_FILE_LIST).join(listed.join('\n'))
    .split(PLACEHOLDER_PRODUCT_BRIEF_PATH).join(briefPath);
}

function writeState(repoRoot, statePath, state) {
  const fullPath = path.join(repoRoot, statePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Keeps the product brief current. Does nothing while it is fresh. When it goes
 * stale, a cheap model updates it from only the source files that changed since
 * it was written; if none changed, only the date is bumped.
 * @param {object} options
 * @param {string} options.repoRoot - Repo root directory
 * @param {object} options.briefConfig - config.productBrief
 * @param {string} options.branch - Branch to push to
 * @param {Date} [options.now]
 * @returns {Promise<string>} "fresh", "unchanged" or "refreshed"
 */
async function refreshBrief({ repoRoot, briefConfig, branch, now = new Date() }) {
  const briefPath = briefConfig.path;
  const statePath = statePathFor(briefPath);
  const fullBriefPath = path.join(repoRoot, briefPath);
  const briefExists = fs.existsSync(fullBriefPath);
  const state = briefExists ? readState(repoRoot, statePath) : null;

  if (!isBriefStale(state, briefConfig.maxAgeDays, now)) {
    core.info('Product brief is fresh, skipping refresh.');
    return BRIEF_RESULT_FRESH;
  }

  const [headCommit] = await gitOutput(repoRoot, ['rev-parse', 'HEAD']);
  const newState = { generatedAt: now.toISOString(), commit: headCommit };

  const changed = state && state.commit ? await changedSourceFiles(repoRoot, state.commit, briefPath) : null;

  if (changed && changed.length === 0) {
    core.info('No source files changed since the last brief, only bumping its date.');
    writeState(repoRoot, statePath, newState);
    await commitFiles({ repoRoot, files: [statePath], message: BRIEF_COMMIT_MESSAGE, branch });
    return BRIEF_RESULT_UNCHANGED;
  }

  const isUpdate = Boolean(changed);
  const files = isUpdate ? changed : filterSourceFiles(await gitOutput(repoRoot, ['ls-files']), briefPath);
  core.info(`${isUpdate ? 'Updating' : 'Writing'} product brief from ${files.length} candidate files...`);

  await installClaudeCli();
  await runClaude(
    buildBriefPrompt({ briefPath, files, task: isUpdate ? BRIEF_TASK_UPDATE : BRIEF_TASK_CREATE }),
    { allowedTools: BRIEF_ALLOWED_TOOLS, maxTurns: briefConfig.maxTurns, model: briefConfig.model },
    CLAUDE_LABEL_BRIEF
  );

  if (!fs.existsSync(fullBriefPath) || !fs.readFileSync(fullBriefPath, 'utf8').trim()) {
    throw new Error(ERROR_BRIEF_NOT_WRITTEN + briefPath);
  }

  writeState(repoRoot, statePath, newState);
  await commitFiles({ repoRoot, files: [briefPath, statePath], message: BRIEF_COMMIT_MESSAGE, branch });
  return BRIEF_RESULT_REFRESHED;
}

module.exports = { filterSourceFiles, isBriefStale, refreshBrief };
