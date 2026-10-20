const fs = require('fs');
const {
  DEFAULT_PROMPT_TEMPLATE_PATH,
  DEFAULT_ALLOWED_TOOLS,
  DEFAULT_MAX_TURNS,
  DEFAULT_COMMIT_MESSAGE,
  ERROR_CONFIG_NOT_FOUND,
  DEFAULT_BRIEF_PATH,
  DEFAULT_BRIEF_MAX_AGE_DAYS,
  DEFAULT_BRIEF_MODEL,
  DEFAULT_BRIEF_MAX_TURNS,
} = require('./constants');

/**
 * Applies defaults to the productBrief block. A config without one is a local
 * service business and gets no brief.
 */
function readProductBrief(productBrief) {
  if (!productBrief) return null;
  return {
    path: productBrief.path || DEFAULT_BRIEF_PATH,
    maxAgeDays: productBrief.maxAgeDays || DEFAULT_BRIEF_MAX_AGE_DAYS,
    model: productBrief.model || DEFAULT_BRIEF_MODEL,
    maxTurns: productBrief.maxTurns || DEFAULT_BRIEF_MAX_TURNS,
  };
}

/**
 * Trims keywords and drops blanks, non-strings and case-insensitive duplicates.
 */
function readKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const keyword of keywords) {
    if (typeof keyword !== 'string') continue;
    const trimmed = keyword.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }
  return cleaned;
}

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
      ...(parsed.claude && parsed.claude.model ? { model: parsed.claude.model } : {}),
    },
    productBrief: readProductBrief(parsed.productBrief),
    keywords: readKeywords(parsed.keywords),
    contentKeywords: readKeywords(parsed.contentKeywords),
    validationCommand: parsed.validationCommand || '',
    buildCommand: parsed.buildCommand || '',
    filesToCommit: parsed.filesToCommit || [],
    commitMessage: parsed.commitMessage || DEFAULT_COMMIT_MESSAGE,
  };
}

module.exports = { readConfig };
