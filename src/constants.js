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

// Dependency install: the first lockfile found picks the package manager
const PACKAGE_JSON = 'package.json';
const DEPENDENCY_INSTALLERS = [
  { lockfile: 'package-lock.json', commands: [['npm', ['ci']]] },
  { lockfile: 'npm-shrinkwrap.json', commands: [['npm', ['ci']]] },
  { lockfile: 'pnpm-lock.yaml', commands: [['corepack', ['enable']], ['pnpm', ['install', '--frozen-lockfile']]] },
  { lockfile: 'yarn.lock', commands: [['corepack', ['enable']], ['yarn', ['install']]] },
];
const DEPENDENCY_INSTALL_NO_LOCKFILE = [['npm', ['install', '--no-audit', '--no-fund']]];
const DEPENDENCIES_SKIPPED = 'skipped';
const DEPENDENCIES_INSTALLED = 'installed';

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
const SETUP_PRODUCT_REQUIRED_CONFIG_FIELDS = ['postCountCommand', 'filesToCommit'];

// Product brief: a summary of what a software product actually does, written by a
// cheap model from the repo's code and refreshed monthly, so posts describe the
// real app instead of generic advice.
const DEFAULT_BRIEF_PATH = '.blog/product-brief.md';
const BRIEF_STATE_SUFFIX = '.state.json';
const DEFAULT_BRIEF_MAX_AGE_DAYS = 30;
const DEFAULT_BRIEF_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_BRIEF_MAX_TURNS = 30;
const BRIEF_ALLOWED_TOOLS = 'Read,Write,Edit,Glob,Grep';
const BRIEF_MAX_LISTED_FILES = 2000;
const BRIEF_COMMIT_MESSAGE = 'docs(blog): refresh product brief';
const BRIEF_RESULT_FRESH = 'fresh';
const BRIEF_RESULT_REFRESHED = 'refreshed';
const BRIEF_RESULT_UNCHANGED = 'unchanged';
const DAY_MS = 24 * 60 * 60 * 1000;
const PLACEHOLDER_PRODUCT_BRIEF_PATH = '{{PRODUCT_BRIEF_PATH}}';
const PLACEHOLDER_FILE_LIST = '{{FILE_LIST}}';
const PLACEHOLDER_BRIEF_TASK = '{{BRIEF_TASK}}';
const ERROR_BRIEF_NOT_WRITTEN = 'Claude did not write the product brief at: ';
const BRIEF_TASK_CREATE = 'There is no brief yet. Write it from scratch using the files listed below.';
const BRIEF_TASK_UPDATE = 'A brief already exists. Read it first, then update only what changed. The files listed below are the only source files that changed since it was written; read the ones that affect features and leave the rest of the brief as it is.';
const BRIEF_FILE_LIST_TRUNCATED = 'The list above is cut off. Use Glob to find other files only if a feature you need is missing from it.';

// Files that never explain what a product does: tests, dependencies, build
// output, lock files, media, editor and CI config.
const BRIEF_EXCLUDED_PATTERNS = [
  /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.next|\.nuxt|\.turbo|\.cache|tmp)\//,
  /(^|\/)(__tests__|__mocks__|__snapshots__|tests?|spec|specs|e2e|cypress|fixtures|mocks)\//,
  /(^|\/)\.(github|husky|vscode|idea|git|claude)\//,
  /\.(test|spec|stories)\.[cm]?[jt]sx?$/,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|poetry\.lock|Cargo\.lock|composer\.lock|Podfile\.lock)$/,
  /\.(png|jpe?g|gif|svg|ico|webp|avif|bmp|tiff?|mp4|mov|webm|mp3|wav|ogg|woff2?|ttf|eot|otf|pdf|zip|gz|tgz|jar|exe|dll|so|dylib)$/i,
  /\.(min\.js|min\.css|map|snap|lcov|log)$/,
  /(^|\/)\.blog\//,
];

module.exports = {
  PACKAGE_JSON,
  DEPENDENCY_INSTALLERS,
  DEPENDENCY_INSTALL_NO_LOCKFILE,
  DEPENDENCIES_SKIPPED,
  DEPENDENCIES_INSTALLED,
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
  SETUP_PRODUCT_REQUIRED_CONFIG_FIELDS,
  DEFAULT_BRIEF_PATH,
  BRIEF_STATE_SUFFIX,
  DEFAULT_BRIEF_MAX_AGE_DAYS,
  DEFAULT_BRIEF_MODEL,
  DEFAULT_BRIEF_MAX_TURNS,
  BRIEF_ALLOWED_TOOLS,
  BRIEF_MAX_LISTED_FILES,
  BRIEF_COMMIT_MESSAGE,
  BRIEF_RESULT_FRESH,
  BRIEF_RESULT_REFRESHED,
  BRIEF_RESULT_UNCHANGED,
  DAY_MS,
  PLACEHOLDER_PRODUCT_BRIEF_PATH,
  PLACEHOLDER_FILE_LIST,
  PLACEHOLDER_BRIEF_TASK,
  ERROR_BRIEF_NOT_WRITTEN,
  BRIEF_TASK_CREATE,
  BRIEF_TASK_UPDATE,
  BRIEF_FILE_LIST_TRUNCATED,
  BRIEF_EXCLUDED_PATTERNS,
};
