// Default values
const DEFAULT_CONFIG_PATH = 'blog.config.json';
const DEFAULT_PROMPT_TEMPLATE_PATH = '.github/prompts/generate-blog-post.md';
const DEFAULT_ALLOWED_TOOLS = 'Read,Edit,Glob,Grep';
const DEFAULT_MAX_TURNS = 15;
const DEFAULT_TOPIC = 'general';
const DEFAULT_COMMIT_MESSAGE = 'feat(blog): add blog post - {topic} ({location})';
const DEFAULT_COMMIT_PUSH_BRANCH = 'main';

// Git constants
const GIT_USER_NAME = 'github-actions[bot]';
const GIT_USER_EMAIL = 'github-actions[bot]@users.noreply.github.com';
const CO_AUTHOR = 'Co-Authored-By: Claude <noreply@anthropic.com>';

// Built-in placeholder names
const PLACEHOLDER_TOPIC = '{{TOPIC}}';
const PLACEHOLDER_LOCATION = '{{LOCATION}}';
const PLACEHOLDER_DATE = '{{DATE}}';

// Error messages
const ERROR_CONFIG_NOT_FOUND = 'Config file not found at: ';
const ERROR_PROMPT_TEMPLATE_NOT_FOUND = 'Prompt template not found at: ';
const ERROR_ANTHROPIC_API_KEY_REQUIRED = 'anthropic-api-key input is required';
const ERROR_CLAUDE_CLI_INSTALL_FAILED = 'Failed to install Claude Code CLI';
const ERROR_CLAUDE_CLI_RUN_FAILED = 'Claude Code CLI exited with a non-zero status';
const ERROR_VALIDATION_FAILED = 'Validation command failed';
const ERROR_BUILD_FAILED = 'Build command failed';
const ERROR_COMMIT_FAILED = 'Git commit/push failed';
const ERROR_POST_COUNT_COMMAND_FAILED = 'Post count command failed, defaulting to 0';

// Claude Code CLI
const CLAUDE_CLI_PACKAGE = '@anthropic-ai/claude-code';

// Action modes
const MODE_GENERATE = 'generate';
const MODE_SETUP = 'setup';
const MODE_AUTO = 'auto';
const VALID_MODES = [MODE_GENERATE, MODE_SETUP, MODE_AUTO];

// Setup mode
const SETUP_ALLOWED_TOOLS = 'Read,Write,Edit,Glob,Grep';
const SETUP_MAX_TURNS = 40;
const SETUP_RESULT_PATH = '.blog-setup-result.json';
const SETUP_STATUS_NO_BLOG = 'no-blog';
const SETUP_COMMIT_MESSAGE = 'chore(blog): set up blog writer';
const SETUP_REQUIRED_CONFIG_FIELDS = ['locations', 'topicSchedule', 'postCountCommand', 'filesToCommit'];
const SETUP_RESULT_SKIPPED = 'skipped';
const SETUP_RESULT_COMPLETED = 'completed';
const PLACEHOLDER_CONFIG_PATH = '{{CONFIG_PATH}}';
const PLACEHOLDER_PROMPT_TEMPLATE_PATH = '{{PROMPT_TEMPLATE_PATH}}';
const PLACEHOLDER_SETUP_RESULT_PATH = '{{SETUP_RESULT_PATH}}';
const PLACEHOLDER_DEFAULT_BLOG_PROMPT = '{{DEFAULT_BLOG_PROMPT}}';

const ERROR_INVALID_MODE = 'Invalid mode: ';
const ERROR_SETUP_NO_BLOG = 'Setup stopped, no blog found in this repo: ';
const ERROR_SETUP_CONFIG_MISSING = 'Setup failed, Claude did not write a config file at: ';
const ERROR_SETUP_CONFIG_INVALID = 'Setup failed, config is missing required fields: ';
const ERROR_SETUP_CONFIG_UNPARSEABLE = 'Setup failed, config is not valid JSON: ';
const ERROR_SETUP_PROMPT_MISSING = 'Setup failed, Claude did not write a prompt template at: ';

module.exports = {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PROMPT_TEMPLATE_PATH,
  DEFAULT_ALLOWED_TOOLS,
  DEFAULT_MAX_TURNS,
  DEFAULT_TOPIC,
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_COMMIT_PUSH_BRANCH,
  GIT_USER_NAME,
  GIT_USER_EMAIL,
  CO_AUTHOR,
  PLACEHOLDER_TOPIC,
  PLACEHOLDER_LOCATION,
  PLACEHOLDER_DATE,
  ERROR_CONFIG_NOT_FOUND,
  ERROR_PROMPT_TEMPLATE_NOT_FOUND,
  ERROR_ANTHROPIC_API_KEY_REQUIRED,
  ERROR_CLAUDE_CLI_INSTALL_FAILED,
  ERROR_CLAUDE_CLI_RUN_FAILED,
  ERROR_VALIDATION_FAILED,
  ERROR_BUILD_FAILED,
  ERROR_COMMIT_FAILED,
  ERROR_POST_COUNT_COMMAND_FAILED,
  CLAUDE_CLI_PACKAGE,
  MODE_GENERATE,
  MODE_SETUP,
  MODE_AUTO,
  VALID_MODES,
  SETUP_ALLOWED_TOOLS,
  SETUP_MAX_TURNS,
  SETUP_RESULT_PATH,
  SETUP_STATUS_NO_BLOG,
  SETUP_COMMIT_MESSAGE,
  SETUP_REQUIRED_CONFIG_FIELDS,
  SETUP_RESULT_SKIPPED,
  SETUP_RESULT_COMPLETED,
  PLACEHOLDER_CONFIG_PATH,
  PLACEHOLDER_PROMPT_TEMPLATE_PATH,
  PLACEHOLDER_SETUP_RESULT_PATH,
  PLACEHOLDER_DEFAULT_BLOG_PROMPT,
  ERROR_INVALID_MODE,
  ERROR_SETUP_NO_BLOG,
  ERROR_SETUP_CONFIG_MISSING,
  ERROR_SETUP_CONFIG_INVALID,
  ERROR_SETUP_CONFIG_UNPARSEABLE,
  ERROR_SETUP_PROMPT_MISSING,
};
