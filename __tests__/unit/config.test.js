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
});
