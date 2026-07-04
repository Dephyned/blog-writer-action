const fs = require('fs');
const {
  DEFAULT_PROMPT_TEMPLATE_PATH,
  DEFAULT_ALLOWED_TOOLS,
  DEFAULT_MAX_TURNS,
  DEFAULT_COMMIT_MESSAGE,
  ERROR_CONFIG_NOT_FOUND,
} = require('./constants');

/**
 * Reads and parses the blog config file, applying defaults for missing fields.
 * @param {string} configPath - Path to the blog.config.json file
 * @returns {object} Parsed config with defaults applied
 */
function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(ERROR_CONFIG_NOT_FOUND + configPath);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    promptTemplatePath: parsed.promptTemplatePath || DEFAULT_PROMPT_TEMPLATE_PATH,
    placeholders: parsed.placeholders || {},
    topicSchedule: parsed.topicSchedule || {},
    locations: parsed.locations || [],
    postCountCommand: parsed.postCountCommand || 'echo 0',
    claude: {
      allowedTools: (parsed.claude && parsed.claude.allowedTools) || DEFAULT_ALLOWED_TOOLS,
      maxTurns: (parsed.claude && parsed.claude.maxTurns) || DEFAULT_MAX_TURNS,
    },
    validationCommand: parsed.validationCommand || '',
    buildCommand: parsed.buildCommand || '',
    filesToCommit: parsed.filesToCommit || [],
    commitMessage: parsed.commitMessage || DEFAULT_COMMIT_MESSAGE,
  };
}

module.exports = { readConfig };
