const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { installClaudeCli, runClaude } = require('./claude');
const { commitFiles } = require('./commit');
const { DEFAULT_PROMPT_TEMPLATE } = require('./default-prompt');
const { SETUP_PROMPT_TEMPLATE } = require('./setup-prompt-template');
const {
  DEFAULT_PROMPT_TEMPLATE_PATH,
  SETUP_ALLOWED_TOOLS,
  SETUP_MAX_TURNS,
  SETUP_RESULT_PATH,
  SETUP_STATUS_NO_BLOG,
  SETUP_COMMIT_MESSAGE,
  SETUP_REQUIRED_CONFIG_FIELDS,
  SETUP_PRODUCT_REQUIRED_CONFIG_FIELDS,
  SETUP_RESULT_SKIPPED,
  SETUP_RESULT_COMPLETED,
  PLACEHOLDER_CONFIG_PATH,
  PLACEHOLDER_PROMPT_TEMPLATE_PATH,
  PLACEHOLDER_SETUP_RESULT_PATH,
  PLACEHOLDER_DEFAULT_BLOG_PROMPT,
  ERROR_SETUP_NO_BLOG,
  ERROR_SETUP_CONFIG_MISSING,
  ERROR_SETUP_CONFIG_INVALID,
  ERROR_SETUP_CONFIG_UNPARSEABLE,
  ERROR_SETUP_PROMPT_MISSING,
} = require('./constants');

/**
 * Fills in the setup prompt with this repo's paths and the reference blog prompt.
 * @param {string} configPath - Repo-relative path Claude should write the config to
 * @returns {string} The setup prompt
 */
function buildSetupPrompt(configPath) {
  return SETUP_PROMPT_TEMPLATE
    .split(PLACEHOLDER_CONFIG_PATH).join(configPath)
    .split(PLACEHOLDER_PROMPT_TEMPLATE_PATH).join(DEFAULT_PROMPT_TEMPLATE_PATH)
    .split(PLACEHOLDER_SETUP_RESULT_PATH).join(SETUP_RESULT_PATH)
    .split(PLACEHOLDER_DEFAULT_BLOG_PROMPT).join(DEFAULT_PROMPT_TEMPLATE);
}

/**
 * Throws if Claude reported that the repo has no blog to post to.
 * The result file is removed either way so it never gets committed.
 * @param {string} repoRoot - Repo root directory
 */
function checkForNoBlog(repoRoot) {
  const resultPath = path.join(repoRoot, SETUP_RESULT_PATH);
  if (!fs.existsSync(resultPath)) return;

  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  fs.rmSync(resultPath);

  if (result.status === SETUP_STATUS_NO_BLOG) {
    throw new Error(ERROR_SETUP_NO_BLOG + result.reason);
  }
}

function isMissing(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return !value;
}

/**
 * Checks the config and prompt Claude wrote, and returns the prompt template path.
 * @param {string} repoRoot - Repo root directory
 * @param {string} configPath - Repo-relative config path
 * @returns {string} Repo-relative prompt template path
 */
function validateSetupOutput(repoRoot, configPath) {
  const fullConfigPath = path.join(repoRoot, configPath);
  if (!fs.existsSync(fullConfigPath)) {
    throw new Error(ERROR_SETUP_CONFIG_MISSING + configPath);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(fullConfigPath, 'utf8'));
  } catch (err) {
    throw new Error(ERROR_SETUP_CONFIG_UNPARSEABLE + err.message);
  }

  // Software products rotate through brief article ideas instead of topics and cities
  const requiredFields = config.productBrief ? SETUP_PRODUCT_REQUIRED_CONFIG_FIELDS : SETUP_REQUIRED_CONFIG_FIELDS;
  const missingFields = requiredFields.filter((field) => isMissing(config[field]));
  if (missingFields.length > 0) {
    throw new Error(ERROR_SETUP_CONFIG_INVALID + missingFields.join(', '));
  }

  const promptTemplatePath = config.promptTemplatePath || DEFAULT_PROMPT_TEMPLATE_PATH;
  if (!fs.existsSync(path.join(repoRoot, promptTemplatePath))) {
    throw new Error(ERROR_SETUP_PROMPT_MISSING + promptTemplatePath);
  }

  return promptTemplatePath;
}

/**
 * Has Claude inspect the repo and write the blog config and prompt, then commits them.
 * Skips entirely if the repo already has a config.
 * @param {object} options
 * @param {string} options.repoRoot - Repo root directory
 * @param {string} options.configPath - Repo-relative config path
 * @param {string} options.branch - Branch to push to
 * @returns {Promise<string>} "completed" or "skipped"
 */
async function runSetup({ repoRoot, configPath, branch }) {
  if (fs.existsSync(path.join(repoRoot, configPath))) {
    core.info(`${configPath} already exists, skipping setup.`);
    return SETUP_RESULT_SKIPPED;
  }

  core.info('Installing Claude Code CLI...');
  await installClaudeCli();

  core.info('Running Claude to set up the blog writer...');
  await runClaude(buildSetupPrompt(configPath), {
    allowedTools: SETUP_ALLOWED_TOOLS,
    maxTurns: SETUP_MAX_TURNS,
  });

  checkForNoBlog(repoRoot);
  const promptTemplatePath = validateSetupOutput(repoRoot, configPath);

  core.info('Committing setup files...');
  await commitFiles({ repoRoot, files: [configPath, promptTemplatePath], message: SETUP_COMMIT_MESSAGE, branch });

  core.info('Blog writer setup complete!');
  return SETUP_RESULT_COMPLETED;
}

module.exports = { runSetup };
