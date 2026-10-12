const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  PUBLISH_PUSH,
  VALID_PUBLISH_MODES,
  PR_BRANCH_PREFIX,
  PR_LIST_PAGE_SIZE,
  HTTP_FORBIDDEN,
  PR_BODY_INTRO,
  PR_BODY_COMMITS_HEADING,
  PR_BODY_COST_HEADING,
  ERROR_INVALID_PUBLISH_MODE,
  ERROR_PR_NOT_ALLOWED,
} = require('./constants');

/**
 * In pull-request mode each run commits to its own branch and opens one pull
 * request at the end. Only one is kept open at a time, so unmerged setups are
 * not repeated and parallel runs never fight over the brief or keyword state.
 */

/**
 * @param {string} input - The publish input (empty = push)
 * @returns {string} "push" or "pull-request"
 */
function resolvePublishMode(input) {
  const mode = input || PUBLISH_PUSH;
  if (!VALID_PUBLISH_MODES.includes(mode)) {
    throw new Error(ERROR_INVALID_PUBLISH_MODE + mode);
  }
  return mode;
}

/**
 * @param {{octokit: object, owner: string, repo: string}} github
 * @returns {Promise<{number: number, url: string}|null>}
 */
async function findOpenBlogPullRequest({ octokit, owner, repo }) {
  const { data } = await octokit.rest.pulls.list({ owner, repo, state: 'open', per_page: PR_LIST_PAGE_SIZE });
  const open = data.find((pr) => pr.head && pr.head.ref.startsWith(PR_BRANCH_PREFIX));
  return open ? { number: open.number, url: open.html_url } : null;
}

/**
 * Creates the run's branch and pushes it, so every later commit in the run can
 * pull and push it exactly like the base branch.
 * @returns {Promise<string>} The branch name
 */
async function startPullRequestBranch({ repoRoot, date, runId }) {
  const branch = `${PR_BRANCH_PREFIX}${date}-${runId}`;
  await exec.exec('git', ['checkout', '-b', branch], { cwd: repoRoot });
  await exec.exec('git', ['push', '-u', 'origin', branch], { cwd: repoRoot });
  return branch;
}

async function deleteRemoteBranch(repoRoot, branch) {
  await exec.exec('git', ['push', 'origin', '--delete', branch], { cwd: repoRoot });
}

/**
 * Opens a pull request for the run's commits, or deletes the branch if there
 * are none.
 * @param {object} options
 * @param {string[]} options.details - Extra lines for the description (the cost report)
 * @returns {Promise<string|null>} The pull request URL, or null when nothing was committed
 */
async function finishPullRequest({ github, repoRoot, baseBranch, branch, title, details }) {
  const { stdout } = await exec.getExecOutput('git', ['log', '--format=%h %s', `origin/${baseBranch}..HEAD`], {
    cwd: repoRoot,
    silent: true,
  });
  const commits = stdout.split('\n').map((line) => line.trim()).filter(Boolean);

  if (commits.length === 0) {
    core.info('Nothing was committed, deleting the run branch.');
    await deleteRemoteBranch(repoRoot, branch);
    return null;
  }

  const body = [
    PR_BODY_INTRO,
    '',
    PR_BODY_COMMITS_HEADING,
    ...commits.map((commit) => `- ${commit}`),
    '',
    PR_BODY_COST_HEADING,
    ...details.map((line) => `- ${line}`),
  ].join('\n');

  try {
    const { data } = await github.octokit.rest.pulls.create({
      owner: github.owner,
      repo: github.repo,
      title,
      body,
      head: branch,
      base: baseBranch,
    });
    core.info('Opened pull request: ' + data.html_url);
    return data.html_url;
  } catch (err) {
    if (err.status === HTTP_FORBIDDEN) throw new Error(ERROR_PR_NOT_ALLOWED);
    throw err;
  }
}

/**
 * Deletes a failed run's branch. Never throws, so the original failure is what
 * gets reported.
 */
async function abandonPullRequestBranch({ repoRoot, branch }) {
  try {
    await deleteRemoteBranch(repoRoot, branch);
  } catch (err) {
    core.warning(`Could not delete branch ${branch}: ${err.message}`);
  }
}

module.exports = {
  resolvePublishMode,
  findOpenBlogPullRequest,
  startPullRequestBranch,
  finishPullRequest,
  abandonPullRequestBranch,
};
