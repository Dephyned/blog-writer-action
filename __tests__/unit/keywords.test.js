const fs = require('fs');
const os = require('os');
const path = require('path');
const { pickKeyword, markKeywordUsed, addKeywordToPrompt, addContentKeywordsToPrompt } = require('../../src/keywords');

const STATE_PATH = '.blog/keywords-used.json';

describe('Feature: Target keywords', () => {
  let repoRoot;

  const writeState = (state) => {
    fs.mkdirSync(path.join(repoRoot, '.blog'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, STATE_PATH), JSON.stringify(state), 'utf8');
  };
  const readState = () => JSON.parse(fs.readFileSync(path.join(repoRoot, STATE_PATH), 'utf8'));

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-keywords-'));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: Picking the next keyword', () => {
    it('Given no keywords configured, When a keyword is picked, Then there is none', () => {
      expect(pickKeyword({ repoRoot, keywords: [] })).toBeNull();
    });

    it('Given keywords and none used yet, When a keyword is picked, Then the first one is chosen', () => {
      expect(pickKeyword({ repoRoot, keywords: ['social media autopilot', 'commit to tweet'] })).toBe('social media autopilot');
    });

    it('Given the first keyword was used, When a keyword is picked, Then the next unused one is chosen, ignoring case and spacing', () => {
      // Given
      writeState({ used: [{ keyword: 'Social Media Autopilot ', date: '2026-10-10' }] });

      // When / Then
      expect(pickKeyword({ repoRoot, keywords: ['social media autopilot', 'commit to tweet'] })).toBe('commit to tweet');
    });

    it('Given every keyword was used, When a keyword is picked, Then there is none so the post falls back to the usual behavior', () => {
      writeState({ used: [{ keyword: 'a', date: '2026-10-09' }, { keyword: 'b', date: '2026-10-10' }] });
      expect(pickKeyword({ repoRoot, keywords: ['a', 'b'] })).toBeNull();
    });

    it('Given all keywords were used and a new one is added later, When a keyword is picked, Then the new one is chosen', () => {
      writeState({ used: [{ keyword: 'a', date: '2026-10-09' }] });
      expect(pickKeyword({ repoRoot, keywords: ['a', 'b'] })).toBe('b');
    });

    it('Given a corrupt state file, When a keyword is picked, Then it is treated as nothing used', () => {
      fs.mkdirSync(path.join(repoRoot, '.blog'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, STATE_PATH), '{ nope', 'utf8');
      expect(pickKeyword({ repoRoot, keywords: ['a'] })).toBe('a');
    });
  });

  describe('Scenario: Recording a used keyword', () => {
    it('Given a keyword was used for a post, When it is recorded, Then it is added to the state file with the date and the path is returned', () => {
      // Given
      writeState({ used: [{ keyword: 'a', date: '2026-10-09' }] });

      // When
      const statePath = markKeywordUsed({ repoRoot, keyword: 'b', date: '2026-10-11' });

      // Then
      expect(statePath).toBe(STATE_PATH);
      expect(readState()).toEqual({
        used: [
          { keyword: 'a', date: '2026-10-09' },
          { keyword: 'b', date: '2026-10-11' },
        ],
      });
    });

    it('Given no state file yet, When a keyword is recorded, Then the file and folder are created', () => {
      markKeywordUsed({ repoRoot, keyword: 'a', date: '2026-10-11' });
      expect(readState()).toEqual({ used: [{ keyword: 'a', date: '2026-10-11' }] });
    });
  });

  describe('Scenario: Telling Claude about the keyword', () => {
    it('Given a keyword, When it is added to the prompt, Then the prompt asks for the keyword in the title, slug, opening, a heading and the meta description', () => {
      // When
      const prompt = addKeywordToPrompt('Write a post.', 'commit to tweet');

      // Then
      expect(prompt.startsWith('Write a post.')).toBe(true);
      expect(prompt).toContain('"commit to tweet"');
      expect(prompt).toMatch(/title/i);
      expect(prompt).toMatch(/slug/i);
      expect(prompt).toMatch(/meta description/i);
    });

    it('Given no keyword, When the prompt is prepared, Then it is unchanged', () => {
      expect(addKeywordToPrompt('Write a post.', null)).toBe('Write a post.');
    });
  });

  describe('Scenario: Adding content keywords to the prompt', () => {
    it('Given no content keywords, When the prompt is built, Then it is unchanged', () => {
      expect(addContentKeywordsToPrompt('Write a post.', [])).toBe('Write a post.');
      expect(addContentKeywordsToPrompt('Write a post.', undefined)).toBe('Write a post.');
    });

    it('Given content keywords, When the prompt is built, Then every keyword is listed after the original prompt', () => {
      // When
      const prompt = addContentKeywordsToPrompt('Write a post.', ['drain cleaning', 'water heater repair']);

      // Then
      expect(prompt.startsWith('Write a post.')).toBe(true);
      expect(prompt).toContain('"drain cleaning"');
      expect(prompt).toContain('"water heater repair"');
    });

    it('Given content keywords, When the prompt is built, Then it says to use only the ones that fit, keep titles and headings optional, and avoid repeating them', () => {
      const prompt = addContentKeywordsToPrompt('Write a post.', ['drain cleaning']);
      expect(prompt).toMatch(/naturally/i);
      expect(prompt).toMatch(/skip/i);
      expect(prompt).toMatch(/title or heading only when/i);
      expect(prompt).toMatch(/variation/i);
      expect(prompt).toMatch(/do not repeat/i);
    });

    it('Given content keywords, When the prompt is built, Then no keyword is marked as used', () => {
      addContentKeywordsToPrompt('Write a post.', ['drain cleaning']);
      expect(fs.existsSync(path.join(repoRoot, STATE_PATH))).toBe(false);
    });

    it('Given both a target keyword and content keywords, When the prompt is built, Then both sections are included', () => {
      const prompt = addContentKeywordsToPrompt(addKeywordToPrompt('Write a post.', 'commit to tweet'), ['autopilot']);
      expect(prompt).toContain('"commit to tweet"');
      expect(prompt).toContain('"autopilot"');
    });
  });
});
