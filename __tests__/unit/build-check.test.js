const fs = require('fs');
const os = require('os');
const path = require('path');
const exec = require('@actions/exec');
const { runClaude } = require('../../src/claude');
const { commitFiles } = require('../../src/commit');
const { ensureWorkingBuild, verifyPostBuild } = require('../../src/build-check');

jest.mock('@actions/exec', () => ({ exec: jest.fn(), getExecOutput: jest.fn() }));
jest.mock('@actions/core', () => ({ info: jest.fn(), warning: jest.fn() }));
jest.mock('../../src/claude', () => ({ installClaudeCli: jest.fn(), runClaude: jest.fn() }));
jest.mock('../../src/commit', () => ({ commitFiles: jest.fn() }));

const CONFIG_PATH = 'blog.config.json';
const POSTS_DIR = 'apps/web/content/blog';
const BROKEN_COMMAND = 'pnpm --filter web build';
const FIXED_COMMAND = 'pnpm --filter web... build';
const BASE_CONFIG = {
  postCountCommand: 'ls apps/web/content/blog/*.mdx | wc -l',
  filesToCommit: [POSTS_DIR],
  buildCommand: BROKEN_COMMAND,
};

describe('Feature: Making sure the build check works', () => {
  let repoRoot;
  let buildResults;
  const timeline = [];

  const readConfigFile = () => JSON.parse(fs.readFileSync(path.join(repoRoot, CONFIG_PATH), 'utf8'));
  const writeConfigFile = (config) =>
    fs.writeFileSync(path.join(repoRoot, CONFIG_PATH), JSON.stringify(config, null, 2), 'utf8');
  const builds = () => exec.getExecOutput.mock.calls.filter(([cmd]) => cmd === 'bash').map(([, args]) => args[1]);
  const gitCalls = () => exec.exec.mock.calls.filter(([cmd]) => cmd === 'git').map(([, args]) => args);
  const claudePrompt = (n = 0) => runClaude.mock.calls[n][0];

  // Each build pops the next result: true = passes, false = fails
  const queueBuilds = (...results) => {
    buildResults = results;
  };

  const claudeSetsBuildCommand = (command) => {
    runClaude.mockImplementationOnce(async () => {
      timeline.push('claude');
      writeConfigFile({ ...readConfigFile(), buildCommand: command });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    timeline.length = 0;
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-build-'));
    writeConfigFile(BASE_CONFIG);
    buildResults = [];
    exec.getExecOutput.mockImplementation(async (cmd, args) => {
      if (cmd !== 'bash') throw new Error(`unexpected ${cmd}`);
      timeline.push(`build:${args[1]}`);
      const ok = buildResults.length ? buildResults.shift() : true;
      return ok
        ? { exitCode: 0, stdout: 'Compiled successfully', stderr: '' }
        : { exitCode: 1, stdout: "Module not found: Can't resolve '@marketmee/shared'", stderr: 'Build failed' };
    });
    exec.exec.mockImplementation(async (cmd, args) => {
      if (cmd === 'git') timeline.push(`git:${args[0]}${args[1] ? ' ' + args[1] : ''}`);
      return 0;
    });
    commitFiles.mockImplementation(async () => timeline.push('commit-config'));
    runClaude.mockImplementation(async () => timeline.push('claude'));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: Checking the build at setup', () => {
    it('Given no build command, When the build is checked, Then nothing runs', async () => {
      const result = await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: { ...BASE_CONFIG, buildCommand: '' } });
      expect(result).toBe('none');
      expect(builds()).toHaveLength(0);
    });

    it('Given a build that works, When the build is checked, Then it passes without asking Claude', async () => {
      // Given
      queueBuilds(true);

      // When
      const result = await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });

      // Then
      expect(result).toBe('passed');
      expect(runClaude).not.toHaveBeenCalled();
    });

    it('Given a broken build command that Claude can fix, When the build is checked, Then Claude gets the command and error and the fixed command is kept', async () => {
      // Given
      queueBuilds(false, true);
      claudeSetsBuildCommand(FIXED_COMMAND);

      // When
      const result = await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });

      // Then
      expect(result).toBe('fixed');
      expect(builds()).toEqual([BROKEN_COMMAND, FIXED_COMMAND]);
      expect(claudePrompt()).toContain(BROKEN_COMMAND);
      expect(claudePrompt()).toContain("Can't resolve '@marketmee/shared'");
      expect(claudePrompt()).toContain(CONFIG_PATH);
      expect(runClaude.mock.calls[0][1]).toMatchObject({ allowedTools: 'Read,Edit,Glob,Grep' });
      expect(readConfigFile().buildCommand).toBe(FIXED_COMMAND);
    });

    it('Given a build Claude cannot fix, When the build is checked, Then the build check is turned off and the rest of the config is kept', async () => {
      // Given
      queueBuilds(false, false);
      claudeSetsBuildCommand('pnpm build');

      // When
      const result = await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });

      // Then
      expect(result).toBe('disabled');
      expect(readConfigFile()).toEqual({ ...BASE_CONFIG, buildCommand: '' });
    });

    it('Given Claude leaves the command unchanged, When the build is checked, Then the same failing build is not run again and the check is turned off', async () => {
      // Given
      queueBuilds(false);

      // When
      const result = await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });

      // Then
      expect(result).toBe('disabled');
      expect(builds()).toEqual([BROKEN_COMMAND]);
      expect(readConfigFile().buildCommand).toBe('');
    });

    it('Given very long build output, When Claude is asked to fix it, Then only the end of the output is sent', async () => {
      // Given
      const lines = Array.from({ length: 1000 }, (_, i) => `line-${i}`);
      exec.getExecOutput.mockResolvedValueOnce({ exitCode: 1, stdout: lines.join('\n'), stderr: '' });

      // When
      await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });

      // Then
      expect(claudePrompt()).toContain('line-999');
      expect(claudePrompt()).not.toContain('line-0\n');
    });

    it('Given a build, When it runs, Then it runs from the repo root with CI turned off', async () => {
      queueBuilds(true);
      await ensureWorkingBuild({ repoRoot, configPath: CONFIG_PATH, config: BASE_CONFIG });
      const options = exec.getExecOutput.mock.calls[0][2];
      expect(options.cwd).toBe(repoRoot);
      expect(options.ignoreReturnCode).toBe(true);
      expect(options.env.CI).toBe('false');
    });
  });

  describe('Scenario: Checking the build after a new post', () => {
    const verify = (config = BASE_CONFIG) =>
      verifyPostBuild({ repoRoot, configPath: CONFIG_PATH, config, branch: 'main' });

    it('Given no build command, When the post is checked, Then nothing runs', async () => {
      const result = await verify({ ...BASE_CONFIG, buildCommand: '' });
      expect(result).toBe('none');
      expect(builds()).toHaveLength(0);
    });

    it('Given the site builds with the new post, When the post is checked, Then it passes without touching git', async () => {
      queueBuilds(true);
      expect(await verify()).toBe('passed');
      expect(gitCalls()).toHaveLength(0);
    });

    it('Given the site is broken even without the post and Claude fixes the command, When the post is checked, Then the config fix is committed and the post is kept', async () => {
      // Given: with post fails, without post fails, fixed command without post passes, fixed command with post passes
      queueBuilds(false, false, true, true);
      claudeSetsBuildCommand(FIXED_COMMAND);

      // When
      const result = await verify();

      // Then
      expect(result).toBe('repaired');
      expect(timeline).toEqual([
        `build:${BROKEN_COMMAND}`,
        'git:stash push',
        `build:${BROKEN_COMMAND}`,
        'claude',
        `build:${FIXED_COMMAND}`,
        'commit-config',
        'git:stash pop',
        `build:${FIXED_COMMAND}`,
      ]);
      expect(gitCalls()[0]).toEqual(['stash', 'push', '--include-untracked', '--message', 'blog-writer-post', '--', POSTS_DIR]);
      expect(commitFiles).toHaveBeenCalledWith(expect.objectContaining({ files: [CONFIG_PATH], branch: 'main' }));
      expect(readConfigFile().buildCommand).toBe(FIXED_COMMAND);
    });

    it('Given the site is broken even without the post and Claude cannot fix it, When the post is checked, Then the build check is turned off and the post is kept', async () => {
      // Given
      queueBuilds(false, false, false);
      claudeSetsBuildCommand('pnpm build');

      // When
      const result = await verify();

      // Then
      expect(result).toBe('disabled');
      expect(readConfigFile().buildCommand).toBe('');
      expect(commitFiles).toHaveBeenCalledWith(expect.objectContaining({ files: [CONFIG_PATH] }));
      expect(gitCalls().map((args) => args.slice(0, 2).join(' '))).toEqual(['stash push', 'stash pop']);
    });

    it('Given the post itself breaks the build and Claude fixes the post, When the post is checked, Then it passes and the config is untouched', async () => {
      // Given: with post fails, without post passes, after post fix passes
      queueBuilds(false, true, true);

      // When
      const result = await verify();

      // Then
      expect(result).toBe('post-fixed');
      expect(claudePrompt()).toContain(POSTS_DIR);
      expect(claudePrompt()).toContain("Can't resolve '@marketmee/shared'");
      expect(commitFiles).not.toHaveBeenCalled();
      expect(readConfigFile().buildCommand).toBe(BROKEN_COMMAND);
    });

    it('Given the post breaks the build and Claude cannot fix it, When the post is checked, Then the post is thrown away and the run fails', async () => {
      // Given
      queueBuilds(false, true, false);

      // When / Then
      await expect(verify()).rejects.toThrow('The new post broke the build');
      expect(gitCalls()).toContainEqual(['checkout', '--', POSTS_DIR]);
      expect(gitCalls()).toContainEqual(['clean', '-fd', '--', POSTS_DIR]);
    });

    it('Given the configured model, When Claude fixes a post, Then that model is used', async () => {
      queueBuilds(false, true, true);
      await verify({ ...BASE_CONFIG, claude: { allowedTools: 'Read,Edit', maxTurns: 25, model: 'claude-sonnet-5' } });
      expect(runClaude.mock.calls[0][1]).toMatchObject({ model: 'claude-sonnet-5' });
    });
  });
});
