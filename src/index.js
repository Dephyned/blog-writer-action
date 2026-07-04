const core = require('@actions/core');
const exec = require('@actions/exec');
const { readConfig } = require('./config');
const { resolveParameters } = require('./parameters');
const { buildPrompt } = require('./prompt');
const { installClaudeCli, runClaude } = require('./claude');
const { runValidation } = require('./validate');
const { runBuild } = require('./build');
const { commitAndPush } = require('./commit');
const { DEFAULT_CONFIG_PATH, DEFAULT_COMMIT_PUSH_BRANCH } = require('./constants');

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
    const installDependencies = core.getInput('install-dependencies') !== 'false';

    // 2. Install project dependencies (if enabled)
    if (installDependencies) {
      core.info('Installing project dependencies...');
      await exec.exec('npm', ['ci']);
    }

    // 3. Read blog config
    core.info('Reading config from: ' + configPath);
    const config = readConfig(configPath);

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

    // 8. Run build (if configured)
    await runBuild(config.buildCommand);

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

run();
