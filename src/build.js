const core = require('@actions/core');
const exec = require('@actions/exec');
const { ERROR_BUILD_FAILED } = require('./constants');

/**
 * Runs the build command if one is configured.
 * @param {string} buildCommand - Shell command to run
 */
async function runBuild(buildCommand) {
  if (!buildCommand) {
    core.info('No build command configured, skipping.');
    return;
  }

  core.info('Running build: ' + buildCommand);
  try {
    await exec.exec('bash', ['-c', buildCommand], {
      env: { ...process.env, CI: 'false' },
    });
  } catch (err) {
    throw new Error(ERROR_BUILD_FAILED + ': ' + err.message);
  }
}

module.exports = { runBuild };
