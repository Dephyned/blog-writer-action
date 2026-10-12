const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const { parseSourceRepos, fetchSourceRepos } = require('../../src/sources');

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  setSecret: jest.fn(),
  getIDToken: jest.fn(),
}));
jest.mock('@actions/exec', () => ({ exec: jest.fn() }));

const TOKEN_URL = 'https://api.thedefinedcrm.com/blog-writer/source-token';
const WORK_DIR = '/tmp/blog-sources';

describe('Feature: Reading code from other repos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    core.getIDToken.mockResolvedValue('oidc-token');
    exec.exec.mockResolvedValue(0);
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: 'ghs_readonly', expiresAt: '2026-10-12T09:00:00Z' }),
    }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  describe('Scenario: Reading the source-repos setting', () => {
    it('Given repos separated by commas, spaces and new lines, When it is parsed, Then each repo is listed once', () => {
      expect(parseSourceRepos('MarketMee/server, MarketMee/mobile\n MarketMee/server ')).toEqual(['MarketMee/server', 'MarketMee/mobile']);
    });

    it('Given an empty setting, When it is parsed, Then there are no source repos', () => {
      expect(parseSourceRepos('')).toEqual([]);
      expect(parseSourceRepos("''")).toEqual([]);
    });
  });

  describe('Scenario: Downloading the source repos', () => {
    it('Given source repos, When they are fetched, Then the run proves who it is, gets a read-only key, and clones each repo', async () => {
      // When
      const sources = await fetchSourceRepos({
        repos: ['MarketMee/server', 'MarketMee/mobile'],
        tokenUrl: TOKEN_URL,
        workDir: WORK_DIR,
      });

      // Then
      expect(core.getIDToken).toHaveBeenCalledWith('dephyned-blog-writer');
      const [url, request] = global.fetch.mock.calls[0];
      expect(url).toBe(TOKEN_URL);
      expect(request.method).toBe('POST');
      expect(request.headers.Authorization).toBe('Bearer oidc-token');
      expect(JSON.parse(request.body)).toEqual({ sources: ['MarketMee/server', 'MarketMee/mobile'] });
      expect(core.setSecret).toHaveBeenCalledWith('ghs_readonly');
      expect(sources).toEqual([
        { name: 'MarketMee/server', dir: path.join(WORK_DIR, 'MarketMee__server') },
        { name: 'MarketMee/mobile', dir: path.join(WORK_DIR, 'MarketMee__mobile') },
      ]);
      const clone = exec.exec.mock.calls[0];
      expect(clone[0]).toBe('git');
      expect(clone[1]).toEqual([
        'clone',
        '--filter=blob:none',
        '--quiet',
        'https://x-access-token:ghs_readonly@github.com/MarketMee/server.git',
        path.join(WORK_DIR, 'MarketMee__server'),
      ]);
      expect(clone[2]).toMatchObject({ silent: true });
    });

    it('Given no source repos, When they are fetched, Then nothing is requested', async () => {
      expect(await fetchSourceRepos({ repos: [], tokenUrl: TOKEN_URL, workDir: WORK_DIR })).toEqual([]);
      expect(core.getIDToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Given the workflow cannot get an identity token, When sources are fetched, Then it fails explaining the missing permission', async () => {
      core.getIDToken.mockRejectedValue(new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable'));
      await expect(
        fetchSourceRepos({ repos: ['MarketMee/server'], tokenUrl: TOKEN_URL, workDir: WORK_DIR })
      ).rejects.toThrow('id-token: write');
    });

    it('Given the backend refuses the key, When sources are fetched, Then it fails with the reason and clones nothing', async () => {
      // Given
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'error', message: 'Source repos must belong to the same account as the blog repo.' }),
      });

      // When / Then
      await expect(
        fetchSourceRepos({ repos: ['someone/else'], tokenUrl: TOKEN_URL, workDir: WORK_DIR })
      ).rejects.toThrow('same account');
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });
});
