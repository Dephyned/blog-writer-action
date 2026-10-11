const fs = require('fs');
const os = require('os');
const path = require('path');
const exec = require('@actions/exec');
const { installClaudeCli, runClaude } = require('../../src/claude');
const { filterSourceFiles, isBriefStale, refreshBrief } = require('../../src/brief');

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

const BRIEF_PATH = '.blog/product-brief.md';
const STATE_PATH = '.blog/product-brief.state.json';
const HAIKU = 'claude-haiku-4-5-20251001';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-10T08:00:00Z');
const HEAD_SHA = 'headsha123';
const OLD_SHA = 'oldsha456';

const BRIEF_CONFIG = { path: BRIEF_PATH, maxAgeDays: 30, model: HAIKU, maxTurns: 30 };

const SOURCE_FILES = [
  'src/routes/appointments.js',
  'src/components/InvoiceForm.tsx',
  'README.md',
  'src/__tests__/appointments.test.js',
  'src/utils/date.spec.ts',
  'package-lock.json',
  'node_modules/react/index.js',
  'dist/bundle.js',
  'public/logo.png',
  'build/static/app.min.js',
  '.github/workflows/daily-blog-post.yml',
  'coverage/lcov.info',
  BRIEF_PATH,
  STATE_PATH,
];

describe('Feature: Product brief', () => {
  let repoRoot;

  const write = (relativePath, contents) => {
    const fullPath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents, 'utf8');
  };

  const writeState = (generatedAt, commit = OLD_SHA) =>
    write(STATE_PATH, JSON.stringify({ generatedAt: generatedAt.toISOString(), commit }));

  const mockGit = ({ files = SOURCE_FILES, changed = [], diffFails = false } = {}) => {
    exec.getExecOutput.mockImplementation(async (cmd, args) => {
      if (args[0] === 'ls-files') return { stdout: files.join('\n'), exitCode: 0 };
      if (args[0] === 'rev-parse') return { stdout: `${HEAD_SHA}\n`, exitCode: 0 };
      if (args[0] === 'diff') {
        if (diffFails) throw new Error('bad revision');
        return { stdout: changed.join('\n'), exitCode: 0 };
      }
      throw new Error(`unexpected git ${args.join(' ')}`);
    });
  };

  const claudeWritesBrief = (contents = '# Product brief\n\n## Features\n- Appointments') => {
    runClaude.mockImplementation(async () => write(BRIEF_PATH, contents));
  };

  const gitCalls = () => exec.exec.mock.calls.filter(([cmd]) => cmd === 'git').map(([, args]) => args);
  const commits = () => gitCalls().filter((args) => args[0] === 'commit');
  const prompt = () => runClaude.mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-brief-'));
    exec.exec.mockResolvedValue(0);
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: Choosing which files are worth reading', () => {
    it('Given a full repo file list, When it is filtered, Then tests, lock files, dependencies, build output, media, CI files and the brief itself are dropped', () => {
      // When
      const files = filterSourceFiles(SOURCE_FILES, BRIEF_PATH);

      // Then
      expect(files).toEqual(['src/routes/appointments.js', 'src/components/InvoiceForm.tsx', 'README.md']);
    });
  });

  describe('Scenario: Deciding when the brief is stale', () => {
    it('Given no brief state, When staleness is checked, Then it is stale', () => {
      expect(isBriefStale(null, 30, NOW)).toBe(true);
    });

    it('Given a brief made 10 days ago, When staleness is checked with a 30 day limit, Then it is fresh', () => {
      const state = { generatedAt: new Date(NOW - 10 * DAY_MS).toISOString(), commit: OLD_SHA };
      expect(isBriefStale(state, 30, NOW)).toBe(false);
    });

    it('Given a brief made 31 days ago, When staleness is checked with a 30 day limit, Then it is stale', () => {
      const state = { generatedAt: new Date(NOW - 31 * DAY_MS).toISOString(), commit: OLD_SHA };
      expect(isBriefStale(state, 30, NOW)).toBe(true);
    });
  });

  describe('Scenario: Brief is fresh', () => {
    it('Given a brief made last week, When the brief is refreshed, Then nothing is read and nothing is committed', async () => {
      // Given
      write(BRIEF_PATH, '# brief');
      writeState(new Date(NOW - 7 * DAY_MS));
      mockGit();

      // When
      const result = await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(result).toBe('fresh');
      expect(installClaudeCli).not.toHaveBeenCalled();
      expect(runClaude).not.toHaveBeenCalled();
      expect(commits()).toHaveLength(0);
    });
  });

  describe('Scenario: First brief', () => {
    it('Given no brief yet, When the brief is refreshed, Then Haiku gets the filtered file list and writes the brief', async () => {
      // Given
      mockGit();
      claudeWritesBrief();

      // When
      const result = await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(result).toBe('refreshed');
      expect(runClaude).toHaveBeenCalledWith(expect.any(String), {
        allowedTools: 'Read,Write,Edit,Glob,Grep',
        maxTurns: 30,
        model: HAIKU,
      }, 'product brief');
      expect(prompt()).toContain('src/routes/appointments.js');
      expect(prompt()).toContain(BRIEF_PATH);
      expect(prompt()).not.toContain('appointments.test.js');
      expect(prompt()).not.toContain('node_modules');
      expect(prompt()).not.toContain('package-lock.json');
    });

    it('Given Haiku writes the brief, When it finishes, Then the brief and its state are committed together with the current commit and date', async () => {
      // Given
      mockGit();
      claudeWritesBrief();

      // When
      await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      const state = JSON.parse(fs.readFileSync(path.join(repoRoot, STATE_PATH), 'utf8'));
      expect(state).toEqual({ generatedAt: NOW.toISOString(), commit: HEAD_SHA });
      expect(gitCalls()).toContainEqual(['add', BRIEF_PATH]);
      expect(gitCalls()).toContainEqual(['add', STATE_PATH]);
      expect(commits()).toHaveLength(1);
      expect(gitCalls()).toContainEqual(['push', 'origin', 'main']);
    });

    it('Given a repo with more files than the prompt limit, When the brief is refreshed, Then the list is cut off and Claude is told to use Glob for the rest', async () => {
      // Given
      const many = Array.from({ length: 2500 }, (_, i) => `src/file${i}.js`);
      mockGit({ files: many });
      claudeWritesBrief();

      // When
      await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(prompt()).toContain('src/file0.js');
      expect(prompt()).not.toContain('src/file2499.js');
      expect(prompt()).toMatch(/Glob/);
    });
  });

  describe('Scenario: Monthly refresh', () => {
    it('Given a stale brief and changed source files, When the brief is refreshed, Then Haiku is pointed only at the changed files and the existing brief', async () => {
      // Given
      write(BRIEF_PATH, '# Existing brief');
      writeState(new Date(NOW - 40 * DAY_MS));
      mockGit({ changed: ['src/routes/appointments.js', 'src/__tests__/appointments.test.js', 'package-lock.json'] });
      claudeWritesBrief('# Updated brief');

      // When
      const result = await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(result).toBe('refreshed');
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'git',
        ['diff', '--name-only', `${OLD_SHA}..HEAD`],
        expect.anything()
      );
      expect(prompt()).toContain('src/routes/appointments.js');
      expect(prompt()).not.toContain('src/components/InvoiceForm.tsx');
      expect(prompt()).not.toContain('appointments.test.js');
      expect(prompt()).toMatch(/update/i);
    });

    it('Given a stale brief and no source changes, When the brief is refreshed, Then Claude is not called and only the state date is bumped', async () => {
      // Given
      write(BRIEF_PATH, '# Existing brief');
      writeState(new Date(NOW - 40 * DAY_MS));
      mockGit({ changed: ['src/__tests__/appointments.test.js', 'README.png'] });

      // When
      const result = await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(result).toBe('unchanged');
      expect(runClaude).not.toHaveBeenCalled();
      const state = JSON.parse(fs.readFileSync(path.join(repoRoot, STATE_PATH), 'utf8'));
      expect(state).toEqual({ generatedAt: NOW.toISOString(), commit: HEAD_SHA });
      expect(gitCalls()).toContainEqual(['add', STATE_PATH]);
      expect(commits()).toHaveLength(1);
    });

    it('Given the last brief commit is no longer in history, When the brief is refreshed, Then it falls back to the full file list', async () => {
      // Given
      write(BRIEF_PATH, '# Existing brief');
      writeState(new Date(NOW - 40 * DAY_MS));
      mockGit({ diffFails: true });
      claudeWritesBrief();

      // When
      await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(prompt()).toContain('src/routes/appointments.js');
      expect(prompt()).toContain('src/components/InvoiceForm.tsx');
    });

    it('Given a brief file with no state file, When the brief is refreshed, Then it is rebuilt from the full file list', async () => {
      // Given
      write(BRIEF_PATH, '# Orphan brief');
      mockGit();
      claudeWritesBrief();

      // When
      const result = await refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW });

      // Then
      expect(result).toBe('refreshed');
      expect(prompt()).toContain('src/components/InvoiceForm.tsx');
    });
  });

  describe('Scenario: Haiku fails to write the brief', () => {
    it('Given Claude never writes the brief, When the brief is refreshed, Then it fails and commits nothing', async () => {
      // Given
      mockGit();
      runClaude.mockResolvedValue();

      // When / Then
      await expect(
        refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW })
      ).rejects.toThrow('did not write the product brief');
      expect(commits()).toHaveLength(0);
    });

    it('Given Claude writes an empty brief, When the brief is refreshed, Then it fails and commits nothing', async () => {
      // Given
      mockGit();
      claudeWritesBrief('   ');

      // When / Then
      await expect(
        refreshBrief({ repoRoot, briefConfig: BRIEF_CONFIG, branch: 'main', now: NOW })
      ).rejects.toThrow('did not write the product brief');
      expect(commits()).toHaveLength(0);
    });
  });
});
