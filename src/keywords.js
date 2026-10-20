const fs = require('fs');
const path = require('path');
const {
  KEYWORDS_STATE_PATH,
  KEYWORD_PROMPT_SECTION,
  PLACEHOLDER_KEYWORD,
  CONTENT_KEYWORDS_PROMPT_SECTION,
  PLACEHOLDER_CONTENT_KEYWORDS,
} = require('./constants');

const normalize = (keyword) => keyword.trim().toLowerCase();

function readState(repoRoot) {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(repoRoot, KEYWORDS_STATE_PATH), 'utf8'));
    return Array.isArray(state.used) ? state : { used: [] };
  } catch {
    return { used: [] };
  }
}

/**
 * The first configured keyword no post has used yet, or null when there are
 * none left, in which case posts fall back to their usual topic choice.
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {string[]} options.keywords - From the config, in priority order
 * @returns {string|null}
 */
function pickKeyword({ repoRoot, keywords }) {
  if (!keywords || keywords.length === 0) return null;
  const used = new Set(readState(repoRoot).used.map((entry) => normalize(String(entry.keyword))));
  return keywords.find((keyword) => !used.has(normalize(keyword))) || null;
}

/**
 * Records a keyword as used so later posts move on to the next one.
 * @returns {string} Repo-relative path of the state file, to commit with the post
 */
function markKeywordUsed({ repoRoot, keyword, date }) {
  const state = readState(repoRoot);
  state.used.push({ keyword, date });
  const fullPath = path.join(repoRoot, KEYWORDS_STATE_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return KEYWORDS_STATE_PATH;
}

/**
 * Appends keyword instructions to any repo's prompt, so prompts written before
 * keywords existed need no changes.
 */
function addKeywordToPrompt(prompt, keyword) {
  if (!keyword) return prompt;
  return prompt + '\n' + KEYWORD_PROMPT_SECTION.split(PLACEHOLDER_KEYWORD).join(keyword);
}

/**
 * Appends the content keyword list, which every post may draw on where it fits.
 * Unlike target keywords, these are never used up.
 */
function addContentKeywordsToPrompt(prompt, keywords) {
  if (!keywords || keywords.length === 0) return prompt;
  const list = keywords.map((keyword) => '"' + keyword + '"').join(', ');
  return prompt + '\n' + CONTENT_KEYWORDS_PROMPT_SECTION.split(PLACEHOLDER_CONTENT_KEYWORDS).join(list);
}

module.exports = { pickKeyword, markKeywordUsed, addKeywordToPrompt, addContentKeywordsToPrompt };
