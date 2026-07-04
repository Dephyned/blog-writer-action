const core = require('@actions/core');
const exec = require('@actions/exec');
const { ERROR_VALIDATION_FAILED } = require('./constants');

/**
 * Runs the validation command if one is configured.
 * @param {string} validationCommand - Shell command to run
 */
async function runValidation(validationCommand) {
  if (!validationCommand) {
    core.info('No validation command configured, skipping.');
    return;
  }

  core.info('Running validation: ' + validationCommand);
  try {
    await exec.exec('bash', ['-c', validationCommand]);
  } catch (err) {
    throw new Error(ERROR_VALIDATION_FAILED + ': ' + err.message);
  }
}

module.exports = { runValidation };
