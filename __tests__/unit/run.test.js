const core = require('@actions/core');
const exec = require('@actions/exec');
const { readConfig } = require('../../src/config');
const { resolveMode } = require('../../src/mode');
const { runSetup } = require('../../src/setup');
const { refreshBrief } = require('../../src/brief');
const { runClaude } = require('../../src/claude');
const { commitAndPush } = require('../../src/commit');
const { installDependencies } = require('../../src/dependencies');
const { verifyPostBuild } = require('../../src/build-check');
const { run } = require('../../src/run');

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setSecret: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
}));
jest.mock('@actions/exec', () => ({ exec: jest.fn(), getExecOutput: jest.fn() }));
jest.mock('../../src/config', () => ({ readConfig: jest.fn() }));
jest.mock('../../src/mode', () => ({ resolveMode: jest.fn() }));
jest.mock('../../src/setup', () => ({ runSetup: jest.fn() }));
jest.mock('../../src/brief', () => ({ refreshBrief: jest.fn() }));
jest.mock('../../src/claude', () => ({ installClaudeCli: jest.fn(), runClaude: jest.fn() }));
jest.mock('../../src/parameters', () => ({
  resolveParameters: jest.fn(async () => ({ topic: 'general', location: '', date: '2026-10-10' })),
}));
jest.mock('../../src/prompt', () => ({ buildPrompt: jest.fn(() => 'the prompt') }));
jest.mock('../../src/validate', () => ({ runValidation: jest.fn() }));
jest.mock('../../src/build-check', () => ({ verifyPostBuild: jest.fn(async () => 'passed') }));
jest.mock('../../src/commit', () => ({ commitAndPush: jest.fn(async () => true) }));
jest.mock('../../src/dependencies', () => ({ installDependencies: jest.fn(async () => 'skipped') }));

const BRIEF_CONFIG = { path: '.blog/product-brief.md', maxAgeDays: 30, model: 'claude-haiku-4-5-20251001', maxTurns: 30 };
const SERVICE_CONFIG = {
  claude: { allowedTools: 'Read,Edit,Glob,Grep', maxTurns: 25 },
  productBrief: null,
  filesToCommit: ['src/data/posts.ts'],
  commitMessage: 'feat(blog): add post',
};
const PRODUCT_CONFIG = {
  ...SERVICE_CONFIG,
  claude: { allowedTools: 'Read,Edit,Glob,Grep', maxTurns: 25, model: 'claude-sonnet-5' },
  productBrief: BRIEF_CONFIG,
};

describe('Feature: Running the action', () => {
  const inputs = {};
  const callOrder = [];
  const track = (name, impl) => async (...args) => {
    callOrder.push(name);
    return impl ? impl(...args) : undefined;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    callOrder.length = 0;
    Object.assign(inputs, { 'anthropic-api-key': 'sk-ant-x', mode: 'auto', 'install-dependencies': '' });
    core.getInput.mockImplementation((name) => inputs[name] || '');
    exec.exec.mockResolvedValue(0);
    runSetup.mockImplementation(track('setup', async () => 'completed'));
    refreshBrief.mockImplementation(track('brief', async () => 'refreshed'));
    runClaude.mockImplementation(track('post'));
    commitAndPush.mockImplementation(track('commit', async () => true));
  });

  describe('Scenario: First run on a new repo', () => {
    it('Given auto mode and no config, When the action runs, Then it sets up, builds the brief, and writes the first post in the same run', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      readConfig.mockReturnValue(PRODUCT_CONFIG);

      // When
      await run();

      // Then
      expect(callOrder).toEqual(['setup', 'brief', 'post', 'commit']);
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('Given setup mode chosen explicitly, When the action runs, Then it only sets up and writes no post', async () => {
      // Given
      inputs.mode = 'setup';
      resolveMode.mockReturnValue('setup');

      // When
      await run();

      // Then
      expect(callOrder).toEqual(['setup']);
      expect(runClaude).not.toHaveBeenCalled();
    });

    it('Given setup fails, When the action runs, Then the run fails and no post is written', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      runSetup.mockRejectedValue(new Error('Setup stopped, no blog found in this repo: none'));

      // When
      await run();

      // Then
      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('no blog found'));
      expect(runClaude).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Daily runs', () => {
    it('Given a product repo, When a post is generated, Then the brief is refreshed before writing and the configured model writes the post', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(PRODUCT_CONFIG);

      // When
      await run();

      // Then
      expect(callOrder).toEqual(['brief', 'post', 'commit']);
      expect(refreshBrief).toHaveBeenCalledWith(expect.objectContaining({ briefConfig: BRIEF_CONFIG, branch: 'main' }));
      expect(runClaude).toHaveBeenCalledWith('the prompt', PRODUCT_CONFIG.claude);
    });

    it('Given a local service repo with no brief configured, When a post is generated, Then no brief is built', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);

      // When
      await run();

      // Then
      expect(refreshBrief).not.toHaveBeenCalled();
      expect(callOrder).toEqual(['post', 'commit']);
    });

    it('Given the brief refresh fails, When a post is generated, Then the run fails and no post is written', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(PRODUCT_CONFIG);
      refreshBrief.mockRejectedValue(new Error('Claude did not write the product brief'));

      // When
      await run();

      // Then
      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('product brief'));
      expect(runClaude).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Installing dependencies', () => {
    it('Given install-dependencies is not turned off, When a post is generated, Then dependencies are installed after the config is read so the install can depend on it', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);

      // When
      await run();

      // Then
      expect(installDependencies).toHaveBeenCalledWith({ repoRoot: process.cwd(), config: SERVICE_CONFIG });
      expect(exec.exec).not.toHaveBeenCalledWith('npm', ['ci']);
    });

    it('Given install-dependencies is false, When a post is generated, Then nothing is installed', async () => {
      inputs['install-dependencies'] = 'false';
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);
      await run();
      expect(installDependencies).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Checking the build after the post', () => {
    it('Given a post was written, When the build is checked, Then it is checked before committing with the config and push branch', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);
      verifyPostBuild.mockImplementation(track('build-check', async () => 'passed'));

      // When
      await run();

      // Then
      expect(callOrder).toEqual(['post', 'build-check', 'commit']);
      expect(verifyPostBuild).toHaveBeenCalledWith({
        repoRoot: process.cwd(),
        configPath: 'blog.config.json',
        config: SERVICE_CONFIG,
        branch: 'main',
      });
    });

    it('Given the post broke the build and could not be fixed, When the action runs, Then it fails without committing', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);
      verifyPostBuild.mockRejectedValue(new Error('The new post broke the build'));

      // When
      await run();

      // Then
      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('broke the build'));
      expect(commitAndPush).not.toHaveBeenCalled();
    });
  });
});
