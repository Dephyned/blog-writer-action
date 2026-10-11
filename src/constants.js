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
  { lockfile: 'yarn.lock', commands: [['corepack', ['enable']], ['yarn', ['install']]] },
];
// pnpm: without a pinned "packageManager", corepack would fetch the newest pnpm,
// which may not read the repo's settings. Use the major that wrote the lockfile.
const PNPM_LOCKFILE = 'pnpm-lock.yaml';
const PNPM_INSTALL = ['pnpm', ['install', '--frozen-lockfile']];
const PNPM_MAJOR_BY_LOCKFILE_VERSION = { '9.0': '10', '6.0': '8', '5.4': '7' };
const PNPM_DEFAULT_MAJOR = '10';
const COREPACK_ENABLE = ['corepack', ['enable']];
const DEPENDENCY_INSTALL_NO_LOCKFILE = [['npm', ['install', '--no-audit', '--no-fund']]];
const DEPENDENCIES_SKIPPED = 'skipped';
const DEPENDENCIES_INSTALLED = 'installed';

// Build check: the action runs the build; Claude only reads the error and edits
// the config (to fix the command) or the new post (to fix the post)
const BUILD_ENV_OVERRIDES = { CI: 'false' };
const BUILD_OUTPUT_TAIL_LINES = 120;
const FIX_ALLOWED_TOOLS = 'Read,Edit,Glob,Grep';
const FIX_BUILD_MAX_TURNS = 15;
const FIX_POST_MAX_TURNS = 10;
const POST_STASH_MESSAGE = 'blog-writer-post';
const BUILD_REPAIR_COMMIT_MESSAGE = 'fix(blog): repair blog build command';
const BUILD_DISABLE_COMMIT_MESSAGE = 'fix(blog): turn off blog build check that cannot run in CI';
const BUILD_CHECK_NONE = 'none';
const BUILD_CHECK_PASSED = 'passed';
const BUILD_CHECK_FIXED = 'fixed';
const BUILD_CHECK_DISABLED = 'disabled';
const BUILD_CHECK_REPAIRED = 'repaired';
const BUILD_CHECK_POST_FIXED = 'post-fixed';
const PLACEHOLDER_BUILD_COMMAND = '{{BUILD_COMMAND}}';
const PLACEHOLDER_BUILD_OUTPUT = '{{BUILD_OUTPUT}}';
const PLACEHOLDER_POST_FILES = '{{POST_FILES}}';
const ERROR_POST_BROKE_BUILD = 'The new post broke the build and could not be fixed, so it was discarded';

// Cost reporting: labels for each kind of Claude call
const CLAUDE_LABEL_SETUP = 'setup';
const CLAUDE_LABEL_BRIEF = 'product brief';
const CLAUDE_LABEL_POST = 'post';
const CLAUDE_LABEL_BUILD_FIX = 'build command fix';
const CLAUDE_LABEL_POST_FIX = 'post fix';
const CLAUDE_OUTPUT_FORMAT = 'json';
const COST_DECIMALS = 4;

// Target keywords: an optional list in the config, used one per post in order
const KEYWORDS_STATE_PATH = '.blog/keywords-used.json';
const KEYWORD_PROMPT_SECTION = [
  '',
  '## Target Keyword',
  '',
  'Build this post around the search keyword "{{KEYWORD}}". Use it naturally in the title, the slug, the first paragraph, at least one H2 heading, and the meta description. Pick an angle that answers what someone searching for it wants to know. Every other instruction above still applies, including only stating facts you can support.',
].join('\n');
const PLACEHOLDER_KEYWORD = '{{KEYWORD}}';

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
  KEYWORDS_STATE_PATH,
  KEYWORD_PROMPT_SECTION,
  PLACEHOLDER_KEYWORD,
  CLAUDE_LABEL_SETUP,
  CLAUDE_LABEL_BRIEF,
  CLAUDE_LABEL_POST,
  CLAUDE_LABEL_BUILD_FIX,
  CLAUDE_LABEL_POST_FIX,
  CLAUDE_OUTPUT_FORMAT,
  COST_DECIMALS,
  BUILD_ENV_OVERRIDES,
  BUILD_OUTPUT_TAIL_LINES,
  FIX_ALLOWED_TOOLS,
  FIX_BUILD_MAX_TURNS,
  FIX_POST_MAX_TURNS,
  POST_STASH_MESSAGE,
  BUILD_REPAIR_COMMIT_MESSAGE,
  BUILD_DISABLE_COMMIT_MESSAGE,
  BUILD_CHECK_NONE,
  BUILD_CHECK_PASSED,
  BUILD_CHECK_FIXED,
  BUILD_CHECK_DISABLED,
  BUILD_CHECK_REPAIRED,
  BUILD_CHECK_POST_FIXED,
  PLACEHOLDER_BUILD_COMMAND,
  PLACEHOLDER_BUILD_OUTPUT,
  PLACEHOLDER_POST_FILES,
  ERROR_POST_BROKE_BUILD,
  PACKAGE_JSON,
  DEPENDENCY_INSTALLERS,
  DEPENDENCY_INSTALL_NO_LOCKFILE,
  PNPM_LOCKFILE,
  PNPM_INSTALL,
  PNPM_MAJOR_BY_LOCKFILE_VERSION,
  PNPM_DEFAULT_MAJOR,
  COREPACK_ENABLE,
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
