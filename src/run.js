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
const { DEFAULT_CONFIG_PATH, DEFAULT_COMMIT_PUSH_BRANCH, MODE_SETUP, MODE_AUTO } = require('./constants');

/**
 * Runs the action. In auto mode a repo's first run sets it up and then writes
 * the first post straight away; later runs just write a post.
 */
async function run() {
  try {
    // 1. Read inputs and mask API key
    const apiKey = core.getInput('anthropic-api-key', { required: true });
    core.setSecret(apiKey);
    process.env.ANTHROPIC_API_KEY = apiKey;

    const configPath = core.getInput('config-path') || DEFAULT_CONFIG_PATH;
    const topicOverride = core.getInput('topic') || '';
    const locationOverride = core.getInput('location') || '';
    const autoCommit = core.getInput('auto-commit') !== 'false';
    const commitPushBranch = core.getInput('commit-push-branch') || DEFAULT_COMMIT_PUSH_BRANCH;
    const installDependenciesEnabled = core.getInput('install-dependencies') !== 'false';
    const modeInput = core.getInput('mode');
    const mode = resolveMode(modeInput, configPath);
    core.setOutput('mode', mode);

    if (mode === MODE_SETUP) {
      const setupResult = await runSetup({
        repoRoot: process.cwd(),
        configPath,
        branch: commitPushBranch,
      });
      core.setOutput('setup-result', setupResult);
      if (modeInput !== MODE_AUTO) return;
    }

    // 2. Read blog config
    core.info('Reading config from: ' + configPath);
    const config = readConfig(configPath);

    // 3. Install project dependencies (only when a build or validation command needs them)
    if (installDependenciesEnabled) {
      await installDependencies({ repoRoot: process.cwd(), config });
    }

    // 3b. Keep the product brief current (software products only)
    if (config.productBrief) {
      const briefResult = await refreshBrief({
        repoRoot: process.cwd(),
        briefConfig: config.productBrief,
        branch: commitPushBranch,
      });
      core.setOutput('brief-result', briefResult);
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
    const prompt = buildPrompt({ config, topic, location, date });

    // 6. Install and run Claude Code CLI
    core.info('Installing Claude Code CLI...');
    await installClaudeCli();

    core.info('Running Claude to generate blog post...');
    await runClaude(prompt, config.claude);

    // 7. Run validation (if configured)
    await runValidation(config.validationCommand);

    // 8. Check the site still builds with the post, fixing the command or the post if not
    const buildCheck = await verifyPostBuild({
      repoRoot: process.cwd(),
      configPath,
      config,
      branch: commitPushBranch,
    });
    core.setOutput('build-check', buildCheck);

    // 9. Commit and push (if auto-commit enabled)
    let committed = false;
    if (autoCommit) {
      core.info('Committing and pushing changes...');
      committed = await commitAndPush({
        filesToCommit: config.filesToCommit,
        commitMessage: config.commitMessage,
        topic,
        location,
        date,
        branch: commitPushBranch,
      });
    } else {
      core.info('Auto-commit disabled, skipping commit/push.');
    }

    // 10. Set outputs
    core.setOutput('topic', topic);
    core.setOutput('location', location);
    core.setOutput('date', date);
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
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run };
