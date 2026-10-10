const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveMode } = require('../../src/mode');

describe('Feature: Mode selection', () => {
  let repoRoot;
  let configPath;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-mode-'));
    configPath = path.join(repoRoot, 'blog.config.json');
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: No mode given', () => {
    it('Given no mode input, When the mode is resolved, Then it generates a post exactly like today', () => {
      expect(resolveMode('', configPath)).toBe('generate');
    });
  });

  describe('Scenario: Explicit modes', () => {
    it('Given mode "setup", When the mode is resolved, Then it runs setup', () => {
      expect(resolveMode('setup', configPath)).toBe('setup');
    });

    it('Given mode "generate", When the mode is resolved, Then it generates a post', () => {
      expect(resolveMode('generate', configPath)).toBe('generate');
    });

    it('Given an unknown mode, When the mode is resolved, Then it fails naming the mode', () => {
      expect(() => resolveMode('publish', configPath)).toThrow('Invalid mode: publish');
    });
  });

  describe('Scenario: Auto mode', () => {
    it('Given mode "auto" and no config yet, When the mode is resolved, Then it runs setup', () => {
      expect(resolveMode('auto', configPath)).toBe('setup');
    });

    it('Given mode "auto" and an existing config, When the mode is resolved, Then it generates a post', () => {
      fs.writeFileSync(configPath, '{}', 'utf8');
      expect(resolveMode('auto', configPath)).toBe('generate');
    });
  });
});
