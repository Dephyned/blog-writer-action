const exec = require('@actions/exec');
const {
  resolvePublishMode,
  findOpenBlogPullRequest,
  startPullRequestBranch,
  finishPullRequest,
  abandonPullRequestBranch,
} = require('../../src/publish');

jest.mock('@actions/exec', () => ({ exec: jest.fn(), getExecOutput: jest.fn() }));
jest.mock('@actions/core', () => ({ info: jest.fn(), warning: jest.fn() }));

const REPO = { owner: 'MarketMee', repo: 'app' };
const BRANCH = 'blog-writer/2026-10-12-12345';

describe('Feature: Publishing as a pull request or straight to main', () => {
  let octokit;
  const github = () => ({ octokit, ...REPO });
  const gitCalls = () => exec.exec.mock.calls.filter(([cmd]) => cmd === 'git').map(([, args]) => args);

  beforeEach(() => {
    jest.clearAllMocks();
    exec.exec.mockResolvedValue(0);
    octokit = {
      rest: {
        pulls: {
          list: jest.fn(async () => ({ data: [] })),
          create: jest.fn(async () => ({ data: { number: 64, html_url: 'https://github.com/MarketMee/app/pull/64' } })),
        },
      },
    };
  });

  describe('Scenario: Choosing how to publish', () => {
    it('Given no publish setting, When the mode is resolved, Then it pushes straight to the branch like before', () => {
      expect(resolvePublishMode('')).toBe('push');
    });

    it('Given publish set to pull-request, When the mode is resolved, Then it opens a pull request', () => {
      expect(resolvePublishMode('pull-request')).toBe('pull-request');
    });

    it('Given an unknown publish setting, When the mode is resolved, Then it fails naming the valid options', () => {
      expect(() => resolvePublishMode('merge')).toThrow(/push.*pull-request/);
    });
  });

  describe('Scenario: Only one blog pull request at a time', () => {
    it('Given an open blog writer pull request, When open pull requests are checked, Then it is returned', async () => {
      // Given
      octokit.rest.pulls.list.mockResolvedValue({
        data: [
          { number: 10, html_url: 'u10', head: { ref: 'feature/login' } },
          { number: 63, html_url: 'u63', head: { ref: 'blog-writer/2026-10-11-999' } },
        ],
      });

      // When
      const open = await findOpenBlogPullRequest(github());

      // Then
      expect(open).toEqual({ number: 63, url: 'u63' });
      expect(octokit.rest.pulls.list).toHaveBeenCalledWith(expect.objectContaining({ ...REPO, state: 'open' }));
    });

    it('Given only other pull requests are open, When open pull requests are checked, Then there is none', async () => {
      octokit.rest.pulls.list.mockResolvedValue({ data: [{ number: 10, html_url: 'u10', head: { ref: 'feature/login' } }] });
      expect(await findOpenBlogPullRequest(github())).toBeNull();
    });
  });

  describe('Scenario: Starting the run branch', () => {
    it('Given a date and run id, When the branch is started, Then it is created from the current commit and pushed so later commits can push to it', async () => {
      // When
      const branch = await startPullRequestBranch({ repoRoot: '/repo', date: '2026-10-12', runId: '12345' });

      // Then
      expect(branch).toBe(BRANCH);
      expect(gitCalls()).toEqual([
        ['checkout', '-b', BRANCH],
        ['push', '-u', 'origin', BRANCH],
      ]);
    });
  });

  describe('Scenario: Opening the pull request', () => {
    const finish = () =>
      finishPullRequest({
        github: github(),
        repoRoot: '/repo',
        baseBranch: 'main',
        branch: BRANCH,
        title: 'Blog post for 2026-10-12',
        details: ['post: $0.1500 (9 turns, claude-sonnet-5)', 'Total: $0.1500'],
      });

    it('Given the run committed to its branch, When it finishes, Then a pull request into the base branch lists the commits and cost', async () => {
      // Given
      exec.getExecOutput.mockImplementation(async (cmd, args) => {
        if (args[0] === 'log') return { exitCode: 0, stdout: 'abc1234 feat(blog): add blog post\ndef5678 docs(blog): refresh product brief\n', stderr: '' };
        throw new Error(`unexpected ${args.join(' ')}`);
      });

      // When
      const url = await finish();

      // Then
      expect(url).toBe('https://github.com/MarketMee/app/pull/64');
      const request = octokit.rest.pulls.create.mock.calls[0][0];
      expect(request).toMatchObject({ ...REPO, head: BRANCH, base: 'main', title: 'Blog post for 2026-10-12' });
      expect(request.body).toContain('feat(blog): add blog post');
      expect(request.body).toContain('docs(blog): refresh product brief');
      expect(request.body).toContain('Total: $0.1500');
      expect(exec.getExecOutput).toHaveBeenCalledWith('git', ['log', '--format=%h %s', 'origin/main..HEAD'], expect.anything());
    });

    it('Given the run committed nothing, When it finishes, Then no pull request is opened and the branch is deleted', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      // When
      const url = await finish();

      // Then
      expect(url).toBeNull();
      expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
      expect(gitCalls()).toContainEqual(['push', 'origin', '--delete', BRANCH]);
    });

    it('Given the repo does not let Actions open pull requests, When it finishes, Then it fails explaining which setting to turn on', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: 'abc1234 feat(blog): add blog post', stderr: '' });
      const forbidden = new Error('GitHub Actions is not permitted to create or approve pull requests.');
      forbidden.status = 403;
      octokit.rest.pulls.create.mockRejectedValue(forbidden);

      // When / Then
      await expect(finish()).rejects.toThrow('Allow GitHub Actions to create and approve pull requests');
    });
  });

  describe('Scenario: The run failed', () => {
    it('Given a failed run, When its branch is abandoned, Then the remote branch is deleted', async () => {
      await abandonPullRequestBranch({ repoRoot: '/repo', branch: BRANCH });
      expect(gitCalls()).toContainEqual(['push', 'origin', '--delete', BRANCH]);
    });

    it('Given deleting the branch fails, When it is abandoned, Then the original failure is not hidden', async () => {
      exec.exec.mockRejectedValue(new Error('remote ref does not exist'));
      await expect(abandonPullRequestBranch({ repoRoot: '/repo', branch: BRANCH })).resolves.toBeUndefined();
    });
  });
});
