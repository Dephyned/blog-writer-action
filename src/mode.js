const fs = require('fs');
const {
  MODE_GENERATE,
  MODE_SETUP,
  MODE_AUTO,
  VALID_MODES,
  ERROR_INVALID_MODE,
} = require('./constants');

/**
 * Resolves which mode the action should run in.
 * "auto" runs setup when the repo has no config yet, and generates a post otherwise.
 * @param {string} modeInput - The raw mode input (empty = generate)
 * @param {string} configPath - Path to blog.config.json
 * @returns {string} Either "generate" or "setup"
 */
function resolveMode(modeInput, configPath) {
  const mode = modeInput || MODE_GENERATE;

  if (!VALID_MODES.includes(mode)) {
    throw new Error(ERROR_INVALID_MODE + mode);
  }

  if (mode === MODE_AUTO) {
    return fs.existsSync(configPath) ? MODE_GENERATE : MODE_SETUP;
  }

  return mode;
}

module.exports = { resolveMode };
