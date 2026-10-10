const fs = require('fs');
const core = require('@actions/core');
const { DEFAULT_PROMPT_TEMPLATE } = require('./default-prompt');
const { PLACEHOLDER_PRODUCT_BRIEF_PATH } = require('./constants');

/**
 * Builds the final prompt string by loading a template and substituting placeholders.
 * @param {object} options
 * @param {object} options.config - Parsed blog config
 * @param {string} options.topic - Resolved topic
 * @param {string} options.location - Resolved location
 * @param {string} options.date - Resolved date (YYYY-MM-DD)
 * @returns {string} The fully substituted prompt
 */
function buildPrompt({ config, topic, location, date }) {
  let template;

  if (config.promptTemplatePath && fs.existsSync(config.promptTemplatePath)) {
    template = fs.readFileSync(config.promptTemplatePath, 'utf8');
  } else {
    core.info('Custom prompt template not found, using default template.');
    template = DEFAULT_PROMPT_TEMPLATE;
  }

  // Substitute built-in placeholders
  let prompt = template
    .replace(/\{\{TOPIC\}\}/g, topic)
    .replace(/\{\{LOCATION\}\}/g, location)
    .replace(/\{\{DATE\}\}/g, date);

  if (config.productBrief) {
    prompt = prompt.split(PLACEHOLDER_PRODUCT_BRIEF_PATH).join(config.productBrief.path);
  }

  // Substitute custom placeholders from config
  const placeholders = config.placeholders || {};
  for (const [key, value] of Object.entries(placeholders)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(pattern, value);
  }

  return prompt;
}

module.exports = { buildPrompt };
