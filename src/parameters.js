const core = require('@actions/core');
const exec = require('@actions/exec');
const { DEFAULT_TOPIC, ERROR_POST_COUNT_COMMAND_FAILED } = require('./constants');

/**
 * Resolves topic, location, and date parameters from inputs and config.
 * @param {object} options
 * @param {string} options.topicOverride - Manual topic override (empty string = use schedule)
 * @param {string} options.locationOverride - Manual location override (empty string = use rotation)
 * @param {object} options.config - Parsed blog config
 * @returns {Promise<{topic: string, location: string, date: string}>}
 */
async function resolveParameters({ topicOverride, locationOverride, config }) {
  const topic = resolveTopic(topicOverride, config.topicSchedule);
  const location = await resolveLocation(
    locationOverride,
    config.locations,
    config.postCountCommand
  );
  const date = new Date().toISOString().split('T')[0];

  return { topic, location, date };
}

/**
 * Resolves the topic from override or day-of-week schedule.
 */
function resolveTopic(override, topicSchedule) {
  if (override) {
    return override;
  }

  const dayOfWeek = new Date().getDay().toString();
  const scheduled = topicSchedule[dayOfWeek];

  if (scheduled) {
    return scheduled;
  }

  return DEFAULT_TOPIC;
}

/**
 * Resolves the location from override or rotation based on post count.
 */
async function resolveLocation(override, locations, postCountCommand) {
  if (override) {
    return override;
  }

  if (!locations || locations.length === 0) {
    return '';
  }

  let postCount = 0;
  try {
    const output = await exec.getExecOutput('bash', ['-c', postCountCommand], {
      silent: true,
    });
    postCount = parseInt(output.stdout.trim(), 10) || 0;
  } catch (err) {
    core.warning(ERROR_POST_COUNT_COMMAND_FAILED + ': ' + err.message);
    postCount = 0;
  }

  const index = postCount % locations.length;
  return locations[index];
}

module.exports = { resolveParameters };
