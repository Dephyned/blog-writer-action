const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  GIT_USER_NAME,
  GIT_USER_EMAIL,
  CO_AUTHOR,
  ERROR_COMMIT_FAILED,
} = require('./constants');

/**
 * Commits and pushes changes to the repository.
 * @param {object} options
 * @param {string[]} options.filesToCommit - Specific files to stage (empty = stage all)
 * @param {string} options.commitMessage - Commit message template with {topic} and {location}
 * @param {string} options.topic - Resolved topic
 * @param {string} options.location - Resolved location
 * @param {string} options.date - Resolved date
 * @param {string} options.branch - Branch to push to
 * @returns {Promise<boolean>} True if changes were committed, false if no changes
 */
async function commitAndPush({ filesToCommit, commitMessage, topic, location, date, branch }) {
  try {
    // Configure git identity
    await exec.exec('git', ['config', 'user.name', GIT_USER_NAME]);
    await exec.exec('git', ['config', 'user.email', GIT_USER_EMAIL]);

    // Stage files
    if (filesToCommit && filesToCommit.length > 0) {
      for (const file of filesToCommit) {
        await exec.exec('git', ['add', file]);
      }
    } else {
      core.info('No filesToCommit configured, staging all changes.');
      await exec.exec('git', ['add', '-A']);
    }

    // Check if there are staged changes
    const diffOutput = await exec.getExecOutput('git', ['diff', '--cached', '--name-only']);
    if (!diffOutput.stdout.trim()) {
      core.info('No changes to commit.');
      return false;
    }

    // Build commit message from template
    const message = commitMessage
      .replace(/\{topic\}/g, topic)
      .replace(/\{location\}/g, location);

    const fullMessage = `${message}\n\nAuto-generated blog post for ${date}\nTopic: ${topic}\nLocation: ${location}\n\n${CO_AUTHOR}`;

    await exec.exec('git', ['commit', '-m', fullMessage]);

    // Pull with rebase then push
    await exec.exec('git', ['pull', '--rebase', 'origin', branch]);
    await exec.exec('git', ['push', 'origin', branch]);

    core.info('Changes committed and pushed successfully.');
    return true;
  } catch (err) {
    throw new Error(ERROR_COMMIT_FAILED + ': ' + err.message);
  }
}

module.exports = { commitAndPush };
