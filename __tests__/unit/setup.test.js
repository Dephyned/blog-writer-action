const fs = require('fs');
const os = require('os');
const path = require('path');
const exec = require('@actions/exec');
const { installClaudeCli, runClaude } = require('../../src/claude');
const { installDependencies } = require('../../src/dependencies');
const { ensureWorkingBuild } = require('../../src/build-check');
const { runSetup } = require('../../src/setup');

jest.mock('../../src/dependencies', () => ({ installDependencies: jest.fn() }));
jest.mock('../../src/build-check', () => ({ ensureWorkingBuild: jest.fn() }));

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
  getExecOutput: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

jest.mock('../../src/claude', () => ({
  installClaudeCli: jest.fn(),
  runClaude: jest.fn(),
}));

const CONFIG_PATH = 'blog.config.json';
const PROMPT_PATH = '.github/prompts/generate-blog-post.md';

const VALID_CONFIG = {
  promptTemplatePath: PROMPT_PATH,
  placeholders: { COMPANY_NAME: 'Acme Window Cleaning' },
  topicSchedule: { 1: 'window-cleaning' },
  locations: ['Las Vegas'],
  postCountCommand: 'grep -c "slug:" src/data/posts.ts || echo 0',
  filesToCommit: ['src/data/posts.ts'],
};

function writeRepoFile(repoRoot, relativePath, contents) {
  const fullPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, 'utf8');
}

function claudeWrites(repoRoot, files) {
  runClaude.mockImplementation(async () => {
    for (const [relativePath, contents] of Object.entries(files)) {
      writeRepoFile(repoRoot, relativePath, contents);
    }
  });
}

function gitCalls() {
  return exec.exec.mock.calls.filter(([cmd]) => cmd === 'git').map(([, args]) => args);
}

describe('Feature: Setup mode', () => {
  let repoRoot;

  beforeEach(() => {
    jest.clearAllMocks();
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-setup-'));
    exec.exec.mockResolvedValue(0);
    exec.getExecOutput.mockResolvedValue({ stdout: `${CONFIG_PATH}\n${PROMPT_PATH}`, exitCode: 0 });
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: Repo with an existing blog', () => {
    it('Given a repo with a blog, When setup runs, Then Claude writes the config and prompt and both are pushed to main in one commit', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# Write a post about {{TOPIC}} in {{LOCATION}}',
      });

      // When
      const result = await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });

      // Then
      expect(result).toBe('completed');
      expect(installClaudeCli).toHaveBeenCalled();
      expect(runClaude).toHaveBeenCalledWith(
        expect.stringContaining(CONFIG_PATH),
        { allowedTools: 'Read,Write,Edit,Glob,Grep', maxTurns: 40 },
        'setup'
      );

      const calls = gitCalls();
      expect(calls).toContainEqual(['add', CONFIG_PATH]);
      expect(calls).toContainEqual(['add', PROMPT_PATH]);
      expect(calls.filter((args) => args[0] === 'commit')).toHaveLength(1);
      expect(calls).toContainEqual(['push', 'origin', 'main']);
    });

    it('Given Claude finishes, When the files are checked, Then a config with locations, a topic schedule, a post count command and files to commit is accepted', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).resolves.toBe('completed');
    });

    it('Given the setup prompt, When it is sent to Claude, Then it tells Claude where to write the prompt template and how to report a missing blog', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });

      // When
      await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });

      // Then
      const prompt = runClaude.mock.calls[0][0];
      expect(prompt).toContain(PROMPT_PATH);
      expect(prompt).toContain('.blog-setup-result.json');
      expect(prompt).not.toContain('{{CONFIG_PATH}}');
    });
  });

  describe('Scenario: Repo with no blog', () => {
    it('Given Claude reports there is no blog to post to, When setup runs, Then it fails with that reason and commits nothing', async () => {
      // Given
      claudeWrites(repoRoot, {
        '.blog-setup-result.json': JSON.stringify({ status: 'no-blog', reason: 'No blog page or posts file exists' }),
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        'No blog page or posts file exists'
      );
      expect(gitCalls().filter((args) => args[0] === 'commit')).toHaveLength(0);
      expect(fs.existsSync(path.join(repoRoot, '.blog-setup-result.json'))).toBe(false);
    });
  });

  describe('Scenario: Bad output from Claude', () => {
    it('Given Claude writes a config missing required fields, When setup checks it, Then it fails naming the missing fields and commits nothing', async () => {
      // Given
      const { locations, filesToCommit, ...incomplete } = VALID_CONFIG;
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(incomplete),
        [PROMPT_PATH]: '# prompt',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        /locations.*filesToCommit/
      );
      expect(gitCalls().filter((args) => args[0] === 'commit')).toHaveLength(0);
    });

    it('Given Claude writes empty values for required fields, When setup checks it, Then it fails', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify({ ...VALID_CONFIG, locations: [], topicSchedule: {} }),
        [PROMPT_PATH]: '# prompt',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        /locations.*topicSchedule/
      );
    });

    it('Given Claude writes a config that is not valid JSON, When setup checks it, Then it fails and commits nothing', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: '{ not json',
        [PROMPT_PATH]: '# prompt',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        'not valid JSON'
      );
      expect(gitCalls().filter((args) => args[0] === 'commit')).toHaveLength(0);
    });

    it('Given Claude never writes the config, When setup checks it, Then it fails and commits nothing', async () => {
      // Given
      claudeWrites(repoRoot, { [PROMPT_PATH]: '# prompt' });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        'did not write a config file'
      );
      expect(gitCalls().filter((args) => args[0] === 'commit')).toHaveLength(0);
    });

    it('Given Claude never writes the prompt file, When setup checks it, Then it fails and commits nothing', async () => {
      // Given
      claudeWrites(repoRoot, { [CONFIG_PATH]: JSON.stringify(VALID_CONFIG) });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow(
        'did not write a prompt template'
      );
      expect(gitCalls().filter((args) => args[0] === 'commit')).toHaveLength(0);
    });
  });

  describe('Scenario: Already set up', () => {
    it('Given blog.config.json already exists, When setup runs, Then it skips without calling Claude or committing', async () => {
      // Given
      writeRepoFile(repoRoot, CONFIG_PATH, JSON.stringify(VALID_CONFIG));

      // When
      const result = await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });

      // Then
      expect(result).toBe('skipped');
      expect(installClaudeCli).not.toHaveBeenCalled();
      expect(runClaude).not.toHaveBeenCalled();
      expect(gitCalls()).toHaveLength(0);
    });
  });

  describe('Scenario: Software product repo', () => {
    const PRODUCT_CONFIG = {
      promptTemplatePath: PROMPT_PATH,
      productBrief: {},
      postCountCommand: 'ls content/blog/*.md | wc -l',
      filesToCommit: ['content/blog'],
    };

    it('Given Claude writes a product config with a brief and no cities or topic schedule, When setup checks it, Then it is accepted', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(PRODUCT_CONFIG),
        [PROMPT_PATH]: '# Read {{PRODUCT_BRIEF_PATH}}',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).resolves.toBe('completed');
    });

    it('Given a product config missing filesToCommit, When setup checks it, Then it fails naming the field', async () => {
      // Given
      const { filesToCommit, ...incomplete } = PRODUCT_CONFIG;
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(incomplete),
        [PROMPT_PATH]: '# prompt',
      });

      // When / Then
      await expect(runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' })).rejects.toThrow('filesToCommit');
    });

    it('Given the setup prompt, When it is sent to Claude, Then it explains both local service and software product repos', async () => {
      // Given
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(PRODUCT_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });

      // When
      await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });

      // Then
      const prompt = runClaude.mock.calls[0][0];
      expect(prompt).toContain('productBrief');
      expect(prompt).toContain('{{PRODUCT_BRIEF_PATH}}');
    });
  });

  describe('Scenario: Checking the build before saving the setup', () => {
    it('Given Claude wrote a config, When setup finishes, Then dependencies are installed and the build is checked before anything is committed', async () => {
      // Given
      const order = [];
      installDependencies.mockImplementation(async () => order.push('install'));
      ensureWorkingBuild.mockImplementation(async () => order.push('build-check'));
      exec.exec.mockImplementation(async (cmd, args) => {
        if (args[0] === 'commit') order.push('commit');
        return 0;
      });
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });

      // When
      await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });

      // Then
      expect(order).toEqual(['install', 'build-check', 'commit']);
      expect(installDependencies).toHaveBeenCalledWith({ repoRoot, config: expect.objectContaining(VALID_CONFIG) });
      expect(ensureWorkingBuild).toHaveBeenCalledWith({
        repoRoot,
        configPath: CONFIG_PATH,
        config: expect.objectContaining({ filesToCommit: VALID_CONFIG.filesToCommit }),
      });
    });
  });

  describe('Scenario: Keywords option', () => {
    it('Given the setup prompt, When it is sent to Claude, Then it asks for an empty keywords list so the option is there to fill in later', async () => {
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });
      await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });
      expect(runClaude.mock.calls[0][0]).toContain('"keywords": []');
    });
  });

  describe('Scenario: Content keywords option', () => {
    it('Given the setup prompt, When it is sent to Claude, Then it asks for an empty contentKeywords list so the option is there to fill in later', async () => {
      claudeWrites(repoRoot, {
        [CONFIG_PATH]: JSON.stringify(VALID_CONFIG),
        [PROMPT_PATH]: '# prompt',
      });
      await runSetup({ repoRoot, configPath: CONFIG_PATH, branch: 'main' });
      expect(runClaude.mock.calls[0][0]).toContain('"contentKeywords": []');
    });
  });
});
