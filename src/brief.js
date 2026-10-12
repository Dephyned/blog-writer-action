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
  BRIEF_THIS_REPO_HEADING,
  BRIEF_SOURCE_HEADING,
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

async function gitOutput(cwd, args) {
  const { stdout } = await exec.getExecOutput('git', args, { cwd, silent: true });
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

/**
 * One section per repo. Source repo files use full paths so Claude can open
 * them in their read-only copies. The total is capped across all repos.
 * @param {Array<{heading: string|null, files: string[]}>} groups
 */
function formatFileList(groups) {
  const lines = [];
  let remaining = BRIEF_MAX_LISTED_FILES;
  let truncated = false;
  for (const { heading, files } of groups) {
    if (files.length === 0) continue;
    if (heading) lines.push(heading);
    const shown = files.slice(0, Math.max(remaining, 0));
    lines.push(...shown.map((file) => `- ${file}`), '');
    remaining -= shown.length;
    if (shown.length < files.length) truncated = true;
  }
  if (truncated) lines.push(BRIEF_FILE_LIST_TRUNCATED);
  return lines.join('\n').trim();
}

function buildBriefPrompt({ briefPath, groups, task }) {
  return BRIEF_PROMPT_TEMPLATE
    .split(PLACEHOLDER_BRIEF_TASK).join(task)
    .split(PLACEHOLDER_FILE_LIST).join(formatFileList(groups))
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
 * @param {string[]} [options.sourceNames] - Other repos the brief also covers
 * @param {Function} [options.getSources] - Downloads them; only called when a refresh is needed
 * @returns {Promise<string>} "fresh", "unchanged" or "refreshed"
 */
async function refreshBrief({ repoRoot, briefConfig, branch, now = new Date(), sourceNames = [], getSources = async () => [] }) {
  const briefPath = briefConfig.path;
  const statePath = statePathFor(briefPath);
  const fullBriefPath = path.join(repoRoot, briefPath);
  const briefExists = fs.existsSync(fullBriefPath);
  const state = briefExists ? readState(repoRoot, statePath) : null;
  const coveredSources = (state && state.sources) || {};
  const hasNewSource = sourceNames.some((name) => !coveredSources[name]);

  if (!isBriefStale(state, briefConfig.maxAgeDays, now) && !hasNewSource) {
    core.info('Product brief is fresh, skipping refresh.');
    return BRIEF_RESULT_FRESH;
  }

  // Source repos are only downloaded once a refresh is actually needed
  const sources = sourceNames.length > 0 ? await getSources() : [];

  const [headCommit] = await gitOutput(repoRoot, ['rev-parse', 'HEAD']);
  const sourceHeads = {};
  for (const source of sources) {
    [sourceHeads[source.name]] = await gitOutput(source.dir, ['rev-parse', 'HEAD']);
  }
  const newState = {
    generatedAt: now.toISOString(),
    commit: headCommit,
    ...(sources.length > 0 ? { sources: sourceHeads } : {}),
  };

  const allFiles = async (dir) => filterSourceFiles(await gitOutput(dir, ['ls-files']), briefPath);
  const blogChanged = state && state.commit ? await changedSourceFiles(repoRoot, state.commit, briefPath) : null;
  const isUpdate = blogChanged !== null;

  // With no usable history the brief is rebuilt from every repo; otherwise each
  // repo contributes only what changed, and a newly added repo all its files
  const groups = [{ heading: sources.length > 0 ? BRIEF_THIS_REPO_HEADING : null, files: isUpdate ? blogChanged : await allFiles(repoRoot) }];
  for (const source of sources) {
    const since = isUpdate ? coveredSources[source.name] : null;
    const changed = since ? await changedSourceFiles(source.dir, since, briefPath) : null;
    const files = changed !== null ? changed : await allFiles(source.dir);
    groups.push({
      heading: BRIEF_SOURCE_HEADING.replace('{repo}', source.name),
      files: files.map((file) => `${source.dir}/${file}`),
    });
  }

  const fileCount = groups.reduce((sum, group) => sum + group.files.length, 0);
  if (isUpdate && fileCount === 0) {
    core.info('No source files changed since the last brief, only bumping its date.');
    writeState(repoRoot, statePath, newState);
    await commitFiles({ repoRoot, files: [statePath], message: BRIEF_COMMIT_MESSAGE, branch });
    return BRIEF_RESULT_UNCHANGED;
  }

  core.info(`${isUpdate ? 'Updating' : 'Writing'} product brief from ${fileCount} candidate files...`);

  await installClaudeCli();
  await runClaude(
    buildBriefPrompt({ briefPath, groups, task: isUpdate ? BRIEF_TASK_UPDATE : BRIEF_TASK_CREATE }),
    {
      allowedTools: BRIEF_ALLOWED_TOOLS,
      maxTurns: briefConfig.maxTurns,
      model: briefConfig.model,
      ...(sources.length > 0 ? { addDirs: sources.map((source) => source.dir) } : {}),
    },
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
