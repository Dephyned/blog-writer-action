const os = require('os');
const path = require('path');
const core = require('@actions/core');
const { readConfig } = require('./config');
const { resolveParameters } = require('./parameters');
const { buildPrompt } = require('./prompt');
const { installClaudeCli, runClaude } = require('./claude');
const { runValidation } = require('./validate');
const { verifyPostBuild } = require('./build-check');
const { commitAndPush } = require('./commit');
const { resolveMode } = require('./mode');
const { runSetup } = require('./setup');
const { refreshBrief } = require('./brief');
const { installDependencies } = require('./dependencies');
const { getCostSummary } = require('./cost');
const { pickKeyword, markKeywordUsed, addKeywordToPrompt, addContentKeywordsToPrompt } = require('./keywords');
const {
  resolvePublishMode,
  findOpenBlogPullRequest,
  startPullRequestBranch,
  finishPullRequest,
  abandonPullRequestBranch,
} = require('./publish');
const { parseSourceRepos, fetchSourceRepos } = require('./sources');
const {
  DEFAULT_CONFIG_PATH,
  DEFAULT_COMMIT_PUSH_BRANCH,
  MODE_SETUP,
  MODE_AUTO,
  CLAUDE_LABEL_POST,
  COST_DECIMALS,
  PUBLISH_PULL_REQUEST,
  PR_TITLE_POST,
  PR_TITLE_KEYWORD,
  DEFAULT_SOURCE_TOKEN_URL,
  SOURCES_WORK_DIR_NAME,
  WARNING_SOURCES_IGNORED,
} = require('./constants');

const today = () => new Date().toISOString().split('T')[0];

function connectGitHub(token) {
  const { getOctokit, context } = require('@actions/github');
  return { octokit: getOctokit(token), ...context.repo };
}

function pullRequestTitle({ date, keyword }) {
  const title = PR_TITLE_POST.replace('{date}', date);
  return keyword ? title + PR_TITLE_KEYWORD.replace('{keyword}', keyword) : title;
}

/**
 * Runs the action. In auto mode a repo's first run sets it up and then writes
 * the first post straight away; later runs just write a post. With
 * publish: pull-request, everything the run commits goes on its own branch and
 * one pull request is opened at the end instead of pushing to the branch.
 */
async function run() {
  let prBranch = null;
  try {
    // 1. Read inputs and mask API key
    const apiKey = core.getInput('anthropic-api-key', { required: true });
    core.setSecret(apiKey);
    process.env.ANTHROPIC_API_KEY = apiKey;

    const configPath = core.getInput('config-path') || DEFAULT_CONFIG_PATH;
    const commitPushBranch = core.getInput('commit-push-branch') || DEFAULT_COMMIT_PUSH_BRANCH;
    const publishMode = resolvePublishMode(core.getInput('publish'));

    let github = null;
    let branch = commitPushBranch;
    if (publishMode === PUBLISH_PULL_REQUEST) {
      github = connectGitHub(core.getInput('github-token'));
      const open = await findOpenBlogPullRequest(github);
      if (open) {
        core.info(`Blog writer pull request ${open.url} is still open. Merge or close it to resume posting.`);
        core.setOutput('skipped', 'true');
        core.setOutput('pr-url', open.url);
        return;
      }
      prBranch = await startPullRequestBranch({
        repoRoot: process.cwd(),
        date: today(),
        runId: process.env.GITHUB_RUN_ID || String(Date.now()),
      });
      branch = prBranch;
    }

    const result = await writePost({ configPath, branch });

    if (prBranch) {
      const url = await finishPullRequest({
        github,
        repoRoot: process.cwd(),
        baseBranch: commitPushBranch,
        branch: prBranch,
        title: pullRequestTitle(result),
        details: getCostSummary().lines,
      });
      core.setOutput('pr-url', url || '');
    }
  } catch (error) {
    core.setFailed(error.message);
    if (prBranch) {
      await abandonPullRequestBranch({ repoRoot: process.cwd(), branch: prBranch });
    }
  } finally {
    reportCost();
  }
}

/**
 * Sets the repo up if needed, then writes, checks and commits one post.
 * @param {object} options
 * @param {string} options.configPath
 * @param {string} options.branch - Where every commit in the run is pushed
 * @returns {Promise<{date: string, keyword: string|null}>}
 */
async function writePost({ configPath, branch }) {
  const topicOverride = core.getInput('topic') || '';
  const locationOverride = core.getInput('location') || '';
  const autoCommit = core.getInput('auto-commit') !== 'false';
  const installDependenciesEnabled = core.getInput('install-dependencies') !== 'false';
  const modeInput = core.getInput('mode');
  const mode = resolveMode(modeInput, configPath);
  core.setOutput('mode', mode);

  if (mode === MODE_SETUP) {
    const setupResult = await runSetup({
      repoRoot: process.cwd(),
      configPath,
      branch,
    });
    core.setOutput('setup-result', setupResult);
    if (modeInput !== MODE_AUTO) return { date: today(), keyword: null };
  }

  // 2. Read blog config
  core.info('Reading config from: ' + configPath);
  const config = readConfig(configPath);

  // 3. Install project dependencies (only when a build or validation command needs them)
  if (installDependenciesEnabled) {
    await installDependencies({ repoRoot: process.cwd(), config });
  }

  // 3b. Keep the product brief current (software products only), including
  // any other repos listed in source-repos
  const sourceNames = parseSourceRepos(core.getInput('source-repos'));
  if (config.productBrief) {
    const briefResult = await refreshBrief({
      repoRoot: process.cwd(),
      briefConfig: config.productBrief,
      branch,
      sourceNames,
      getSources: () => fetchSourceRepos({
        repos: sourceNames,
        tokenUrl: core.getInput('source-token-url') || DEFAULT_SOURCE_TOKEN_URL,
        workDir: path.join(process.env.RUNNER_TEMP || os.tmpdir(), SOURCES_WORK_DIR_NAME),
      }),
    });
    core.setOutput('brief-result', briefResult);
  } else if (sourceNames.length > 0) {
    core.warning(WARNING_SOURCES_IGNORED);
  }

  // 4. Resolve parameters
  core.info('Resolving parameters...');
  const { topic, location, date } = await resolveParameters({
    topicOverride,
    locationOverride,
    config,
  });
  core.info(`Parameters: topic=${topic}, location=${location}, date=${date}`);

  // 5. Build prompt
  core.info('Building prompt...');
  const keyword = pickKeyword({ repoRoot: process.cwd(), keywords: config.keywords });
  if (keyword) core.info('Target keyword: ' + keyword);
  const prompt = addContentKeywordsToPrompt(
    addKeywordToPrompt(buildPrompt({ config, topic, location, date }), keyword),
    config.contentKeywords
  );

  // 6. Install and run Claude Code CLI
  core.info('Installing Claude Code CLI...');
  await installClaudeCli();

  core.info('Running Claude to generate blog post...');
  await runClaude(prompt, config.claude, CLAUDE_LABEL_POST);

  // 7. Run validation (if configured)
  await runValidation(config.validationCommand);

  // 8. Check the site still builds with the post, fixing the command or the post if not
  const buildCheck = await verifyPostBuild({
    repoRoot: process.cwd(),
    configPath,
    config,
    branch,
  });
  core.setOutput('build-check', buildCheck);

  // The keyword is only used up once the post has passed the build check
  const extraFiles = keyword ? [markKeywordUsed({ repoRoot: process.cwd(), keyword, date })] : [];

  // 9. Commit and push (if auto-commit enabled)
  let committed = false;
  if (autoCommit) {
    core.info('Committing and pushing changes...');
    committed = await commitAndPush({
      filesToCommit: config.filesToCommit,
      extraFiles,
      commitMessage: config.commitMessage,
      topic,
      location,
      date,
      branch,
    });
  } else {
    core.info('Auto-commit disabled, skipping commit/push.');
  }

  // 10. Set outputs
  core.setOutput('topic', topic);
  core.setOutput('location', location);
  core.setOutput('date', date);
  core.setOutput('keyword', keyword || '');
  core.setOutput('committed', String(committed));

  // Generate slug and title from topic/location/date for outputs
  const postSlug = `${topic}-${location}-${date}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  core.setOutput('post-slug', postSlug);
  core.setOutput('post-title', `${topic} - ${location}`);

  core.info('Blog post generation complete!');
  return { date, keyword };
}

/**
 * Logs what every Claude call in this run cost, even when the run failed.
 */
function reportCost() {
  const { totalUsd, lines } = getCostSummary();
  core.info('Claude cost for this run:');
  lines.forEach((line) => core.info(line));
  core.setOutput('cost-usd', totalUsd.toFixed(COST_DECIMALS));
}

module.exports = { run };
