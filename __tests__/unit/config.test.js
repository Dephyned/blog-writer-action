const fs = require('fs');
const path = require('path');
const { readConfig } = require('../../src/config');

jest.mock('fs');

describe('Feature: Config Loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Successfully read a valid config file', () => {
    it('Given a valid blog.config.json, When readConfig is called, Then it should return the parsed config with defaults applied', () => {
      // Given
      const configContent = JSON.stringify({
        promptTemplatePath: '.github/prompts/my-prompt.md',
        placeholders: { COMPANY_NAME: 'Acme' },
        topicSchedule: { '1': 'topic-a' },
        locations: ['City A'],
        postCountCommand: 'echo 5',
        claude: { allowedTools: 'Read,Edit', maxTurns: 20 },
        validationCommand: 'npm run validate',
        buildCommand: 'npm run build',
        filesToCommit: ['src/posts.ts'],
        commitMessage: 'feat: new post - {topic}',
      });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);

      // When
      const config = readConfig('blog.config.json');

      // Then
      expect(config.promptTemplatePath).toBe('.github/prompts/my-prompt.md');
      expect(config.placeholders).toEqual({ COMPANY_NAME: 'Acme' });
      expect(config.topicSchedule).toEqual({ '1': 'topic-a' });
      expect(config.locations).toEqual(['City A']);
      expect(config.postCountCommand).toBe('echo 5');
      expect(config.claude.allowedTools).toBe('Read,Edit');
      expect(config.claude.maxTurns).toBe(20);
      expect(config.validationCommand).toBe('npm run validate');
      expect(config.buildCommand).toBe('npm run build');
      expect(config.filesToCommit).toEqual(['src/posts.ts']);
      expect(config.commitMessage).toBe('feat: new post - {topic}');
    });
  });

  describe('Scenario: Config file with missing optional fields', () => {
    it('Given a minimal config, When readConfig is called, Then it should apply default values', () => {
      // Given
      const configContent = JSON.stringify({});
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);

      // When
      const config = readConfig('blog.config.json');

      // Then
      expect(config.promptTemplatePath).toBe('.github/prompts/generate-blog-post.md');
      expect(config.placeholders).toEqual({});
      expect(config.topicSchedule).toEqual({});
      expect(config.locations).toEqual([]);
      expect(config.postCountCommand).toBe('echo 0');
      expect(config.claude.allowedTools).toBe('Read,Edit,Glob,Grep');
      expect(config.claude.maxTurns).toBe(15);
      expect(config.validationCommand).toBe('');
      expect(config.buildCommand).toBe('');
      expect(config.filesToCommit).toEqual([]);
      expect(config.commitMessage).toBe('feat(blog): add blog post - {topic} ({location})');
    });
  });

  describe('Scenario: Config file does not exist', () => {
    it('Given no config file at the path, When readConfig is called, Then it should throw an error', () => {
      // Given
      fs.existsSync.mockReturnValue(false);

      // When/Then
      expect(() => readConfig('missing.json')).toThrow('Config file not found at: missing.json');
    });
  });

  describe('Scenario: Config file contains invalid JSON', () => {
    it('Given a malformed config file, When readConfig is called, Then it should throw an error', () => {
      // Given
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid json }');

      // When/Then
      expect(() => readConfig('bad.json')).toThrow();
    });
  });

  describe('Scenario: Config with partial claude settings', () => {
    it('Given a config with only claude.maxTurns, When readConfig is called, Then allowedTools should use default', () => {
      // Given
      const configContent = JSON.stringify({
        claude: { maxTurns: 30 },
      });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(configContent);

      // When
      const config = readConfig('blog.config.json');

      // Then
      expect(config.claude.allowedTools).toBe('Read,Edit,Glob,Grep');
      expect(config.claude.maxTurns).toBe(30);
    });
  });

  describe('Scenario: Product brief settings', () => {
    it('Given a config with an empty productBrief block, When readConfig is called, Then the brief defaults to a monthly Haiku scan', () => {
      // Given
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ productBrief: {} }));

      // When
      const config = readConfig('blog.config.json');

      // Then
      expect(config.productBrief).toEqual({
        path: '.blog/product-brief.md',
        maxAgeDays: 30,
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 30,
      });
    });

    it('Given a config with custom productBrief values, When readConfig is called, Then they override the defaults', () => {
      // Given
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ productBrief: { path: 'docs/brief.md', maxAgeDays: 7 } }));

      // When
      const config = readConfig('blog.config.json');

      // Then
      expect(config.productBrief.path).toBe('docs/brief.md');
      expect(config.productBrief.maxAgeDays).toBe(7);
      expect(config.productBrief.model).toBe('claude-haiku-4-5-20251001');
    });

    it('Given a config without productBrief, When readConfig is called, Then no brief is configured', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({}));
      expect(readConfig('blog.config.json').productBrief).toBeNull();
    });

    it('Given a config with a claude model, When readConfig is called, Then the model is kept', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ claude: { model: 'claude-sonnet-5' } }));
      expect(readConfig('blog.config.json').claude.model).toBe('claude-sonnet-5');
    });
  });

  describe('Scenario: Target keywords', () => {
    it('Given a config without keywords, When readConfig is called, Then keywords default to an empty list', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({}));
      expect(readConfig('blog.config.json').keywords).toEqual([]);
    });

    it('Given keywords with blanks, extra spaces and duplicates, When readConfig is called, Then they are cleaned up in order', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ keywords: [' commit to tweet ', '', 'Commit to Tweet', 'autopilot', 42] }));
      expect(readConfig('blog.config.json').keywords).toEqual(['commit to tweet', 'autopilot']);
    });
  });
});
