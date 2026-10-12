const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  SOURCE_TOKEN_AUDIENCE,
  SOURCE_CLONE_URL,
  SOURCE_DIR_SEPARATOR,
  SOURCE_REPOS_SPLIT,
  EMPTY_INPUT_QUOTES,
  ERROR_NO_ID_TOKEN,
  ERROR_SOURCE_TOKEN,
} = require('./constants');

/**
 * @param {string} input - The source-repos input, e.g. "owner/a, owner/b"
 * @returns {string[]} Each repo once, in order
 */
function parseSourceRepos(input) {
  const repos = String(input || '')
    .split(SOURCE_REPOS_SPLIT)
    .map((repo) => repo.trim())
    .filter((repo) => repo && !EMPTY_INPUT_QUOTES.test(repo));
  return [...new Set(repos)];
}

async function requestReadOnlyKey({ repos, tokenUrl }) {
  let idToken;
  try {
    idToken = await core.getIDToken(SOURCE_TOKEN_AUDIENCE);
  } catch (err) {
    throw new Error(ERROR_NO_ID_TOKEN + err.message);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: repos }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) {
    throw new Error(ERROR_SOURCE_TOKEN + (body.message || `HTTP ${response.status}`));
  }
  return body.token;
}

/**
 * Gets a read-only key for the source repos from the blog writer backend, then
 * clones each one outside the blog repo so nothing from them can be committed.
 * Clones skip file contents until they're read, keeping them fast.
 * @param {object} options
 * @param {string[]} options.repos - owner/name of each source repo
 * @param {string} options.tokenUrl - The backend's source-token endpoint
 * @param {string} options.workDir - Folder to clone into
 * @returns {Promise<Array<{name: string, dir: string}>>}
 */
async function fetchSourceRepos({ repos, tokenUrl, workDir }) {
  if (!repos || repos.length === 0) return [];

  const token = await requestReadOnlyKey({ repos, tokenUrl });
  core.setSecret(token);

  const sources = [];
  for (const repo of repos) {
    const dir = path.join(workDir, repo.split('/').join(SOURCE_DIR_SEPARATOR));
    const url = SOURCE_CLONE_URL.replace('{token}', token).replace('{repo}', repo);
    core.info('Downloading source repo ' + repo);
    await exec.exec('git', ['clone', '--filter=blob:none', '--quiet', url, dir], { silent: true });
    sources.push({ name: repo, dir });
  }
  return sources;
}

module.exports = { parseSourceRepos, fetchSourceRepos };
