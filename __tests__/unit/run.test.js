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
const { pickKeyword, markKeywordUsed } = require('../../src/keywords');
const {
  findOpenBlogPullRequest,
  startPullRequestBranch,
  finishPullRequest,
  abandonPullRequestBranch,
} = require('../../src/publish');
const { getOctokit } = require('@actions/github');
const { recordCost, resetCosts } = require('../../src/cost');
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
jest.mock('../../src/publish', () => ({
  resolvePublishMode: jest.fn((value) => value || 'push'),
  findOpenBlogPullRequest: jest.fn(async () => null),
  startPullRequestBranch: jest.fn(async () => 'blog-writer/2026-10-12-777'),
  finishPullRequest: jest.fn(async () => 'https://github.com/MarketMee/app/pull/64'),
  abandonPullRequestBranch: jest.fn(async () => {}),
}));
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(() => ({ rest: {} })),
  context: { repo: { owner: 'MarketMee', repo: 'app' } },
}));
jest.mock('../../src/keywords', () => ({
  pickKeyword: jest.fn(() => null),
  markKeywordUsed: jest.fn(() => '.blog/keywords-used.json'),
  addKeywordToPrompt: jest.fn((prompt, keyword) => (keyword ? `${prompt} [keyword: ${keyword}]` : prompt)),
}));
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
    resetCosts();
    runClaude.mockImplementation(track('post'));
    commitAndPush.mockImplementation(track('commit', async () => true));
    verifyPostBuild.mockResolvedValue('passed');
    pickKeyword.mockReturnValue(null);
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
      expect(runClaude).toHaveBeenCalledWith('the prompt', PRODUCT_CONFIG.claude, 'post');
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

  describe('Scenario: Reporting what the run cost', () => {
    it('Given Claude calls cost money, When the run finishes, Then each call and the total are logged and the total is an output', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      readConfig.mockReturnValue(PRODUCT_CONFIG);
      runSetup.mockImplementation(async () => {
        recordCost({ label: 'setup', costUsd: 0.4, turns: 18, model: 'claude-sonnet-5' });
        return 'completed';
      });
      runClaude.mockImplementation(async () => recordCost({ label: 'post', costUsd: 0.15, turns: 9, model: 'claude-sonnet-5' }));

      // When
      await run();

      // Then
      expect(core.info).toHaveBeenCalledWith('setup: $0.4000 (18 turns, claude-sonnet-5)');
      expect(core.info).toHaveBeenCalledWith('post: $0.1500 (9 turns, claude-sonnet-5)');
      expect(core.info).toHaveBeenCalledWith('Total: $0.5500');
      expect(core.setOutput).toHaveBeenCalledWith('cost-usd', '0.5500');
    });

    it('Given the run fails after spending money, When it ends, Then the cost so far is still logged', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      runSetup.mockImplementation(async () => {
        recordCost({ label: 'setup', costUsd: 0.3, turns: 40, model: 'claude-sonnet-5' });
        throw new Error('Setup failed, config is missing required fields: filesToCommit');
      });

      // When
      await run();

      // Then
      expect(core.setFailed).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith('Total: $0.3000');
      expect(core.setOutput).toHaveBeenCalledWith('cost-usd', '0.3000');
    });
  });

  describe('Scenario: Target keywords', () => {
    const KEYWORD_CONFIG = { ...SERVICE_CONFIG, keywords: ['commit to tweet'] };

    it('Given an unused keyword, When a post is generated, Then the post is written around it and the keyword is recorded with the post', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(KEYWORD_CONFIG);
      pickKeyword.mockReturnValue('commit to tweet');

      // When
      await run();

      // Then
      expect(pickKeyword).toHaveBeenCalledWith({ repoRoot: process.cwd(), keywords: ['commit to tweet'] });
      expect(runClaude).toHaveBeenCalledWith('the prompt [keyword: commit to tweet]', KEYWORD_CONFIG.claude, 'post');
      expect(markKeywordUsed).toHaveBeenCalledWith({ repoRoot: process.cwd(), keyword: 'commit to tweet', date: '2026-10-10' });
      expect(commitAndPush).toHaveBeenCalledWith(expect.objectContaining({ extraFiles: ['.blog/keywords-used.json'] }));
      expect(core.setOutput).toHaveBeenCalledWith('keyword', 'commit to tweet');
    });

    it('Given no unused keyword, When a post is generated, Then the prompt is unchanged and nothing is recorded', async () => {
      // Given
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(KEYWORD_CONFIG);
      pickKeyword.mockReturnValue(null);

      // When
      await run();

      // Then
      expect(runClaude).toHaveBeenCalledWith('the prompt', KEYWORD_CONFIG.claude, 'post');
      expect(markKeywordUsed).not.toHaveBeenCalled();
      expect(commitAndPush).toHaveBeenCalledWith(expect.objectContaining({ extraFiles: [] }));
    });

    it('Given the post broke the build, When the run fails, Then the keyword is not used up', async () => {
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(KEYWORD_CONFIG);
      pickKeyword.mockReturnValue('commit to tweet');
      verifyPostBuild.mockRejectedValue(new Error('The new post broke the build'));
      await run();
      expect(markKeywordUsed).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Publishing as a pull request', () => {
    const PR_BRANCH = 'blog-writer/2026-10-12-777';

    beforeEach(() => {
      inputs.publish = 'pull-request';
      inputs['github-token'] = 'ghs_token';
      process.env.GITHUB_RUN_ID = '777';
      findOpenBlogPullRequest.mockResolvedValue(null);
      runSetup.mockImplementation(track('setup', async () => 'completed'));
    });

    afterEach(() => {
      delete inputs.publish;
      delete inputs['github-token'];
      delete process.env.GITHUB_RUN_ID;
    });

    it('Given a blog writer pull request is already open, When the action runs, Then it skips without spending anything', async () => {
      // Given
      findOpenBlogPullRequest.mockResolvedValue({ number: 63, url: 'https://github.com/MarketMee/app/pull/63' });
      resolveMode.mockReturnValue('setup');

      // When
      await run();

      // Then
      expect(runSetup).not.toHaveBeenCalled();
      expect(runClaude).not.toHaveBeenCalled();
      expect(startPullRequestBranch).not.toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalledWith('skipped', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('pr-url', 'https://github.com/MarketMee/app/pull/63');
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('Given a new repo, When the action runs, Then setup, brief, build fixes and the post all commit to the run branch and one pull request is opened into main', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      readConfig.mockReturnValue(PRODUCT_CONFIG);

      // When
      await run();

      // Then
      expect(getOctokit).toHaveBeenCalledWith('ghs_token');
      expect(startPullRequestBranch).toHaveBeenCalledWith(expect.objectContaining({ repoRoot: process.cwd(), runId: '777' }));
      expect(runSetup).toHaveBeenCalledWith(expect.objectContaining({ branch: PR_BRANCH }));
      expect(refreshBrief).toHaveBeenCalledWith(expect.objectContaining({ branch: PR_BRANCH }));
      expect(verifyPostBuild).toHaveBeenCalledWith(expect.objectContaining({ branch: PR_BRANCH }));
      expect(commitAndPush).toHaveBeenCalledWith(expect.objectContaining({ branch: PR_BRANCH }));
      expect(finishPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ baseBranch: 'main', branch: PR_BRANCH, details: expect.arrayContaining([expect.stringMatching(/^Total:/)]) })
      );
      expect(core.setOutput).toHaveBeenCalledWith('pr-url', 'https://github.com/MarketMee/app/pull/64');
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('Given a target keyword, When the pull request is opened, Then its title names the keyword', async () => {
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue({ ...SERVICE_CONFIG, keywords: ['commit to tweet'] });
      pickKeyword.mockReturnValue('commit to tweet');
      await run();
      expect(finishPullRequest.mock.calls[0][0].title).toContain('commit to tweet');
    });

    it('Given the run fails, When it ends, Then no pull request is opened and the run branch is deleted', async () => {
      // Given
      resolveMode.mockReturnValue('setup');
      runSetup.mockRejectedValue(new Error('Setup stopped, no blog found in this repo: none'));

      // When
      await run();

      // Then
      expect(core.setFailed).toHaveBeenCalled();
      expect(finishPullRequest).not.toHaveBeenCalled();
      expect(abandonPullRequestBranch).toHaveBeenCalledWith({ repoRoot: process.cwd(), branch: PR_BRANCH });
    });
  });

  describe('Scenario: Publishing straight to main', () => {
    it('Given no publish setting, When a post is generated, Then it commits to the push branch and opens no pull request', async () => {
      resolveMode.mockReturnValue('generate');
      readConfig.mockReturnValue(SERVICE_CONFIG);
      await run();
      expect(startPullRequestBranch).not.toHaveBeenCalled();
      expect(findOpenBlogPullRequest).not.toHaveBeenCalled();
      expect(commitAndPush).toHaveBeenCalledWith(expect.objectContaining({ branch: 'main' }));
      expect(finishPullRequest).not.toHaveBeenCalled();
    });
  });
});
