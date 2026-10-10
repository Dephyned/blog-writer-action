const fs = require('fs');
const os = require('os');
const path = require('path');
const exec = require('@actions/exec');
const { installDependencies } = require('../../src/dependencies');

jest.mock('@actions/exec', () => ({ exec: jest.fn() }));
jest.mock('@actions/core', () => ({ info: jest.fn() }));

const BUILD_CONFIG = { buildCommand: 'npm run build', validationCommand: '' };

describe('Feature: Installing project dependencies', () => {
  let repoRoot;

  const write = (file) => fs.writeFileSync(path.join(repoRoot, file), '{}', 'utf8');
  const commands = () => exec.exec.mock.calls.map(([cmd, args]) => [cmd, ...args].join(' '));

  beforeEach(() => {
    jest.clearAllMocks();
    exec.exec.mockResolvedValue(0);
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-deps-'));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('Scenario: Nothing needs the dependencies', () => {
    it('Given no build or validation command, When dependencies are installed, Then nothing is installed even with a lockfile', async () => {
      // Given
      write('package.json');
      write('package-lock.json');

      // When
      const result = await installDependencies({ repoRoot, config: { buildCommand: '', validationCommand: '' } });

      // Then
      expect(result).toBe('skipped');
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('Given a build command but no package.json at the root, When dependencies are installed, Then nothing is installed', async () => {
      const result = await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(result).toBe('skipped');
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Picking the package manager from the lockfile', () => {
    it('Given a package-lock.json, When dependencies are installed, Then npm ci is used', async () => {
      write('package.json');
      write('package-lock.json');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(commands()).toEqual(['npm ci']);
    });

    it('Given an npm-shrinkwrap.json, When dependencies are installed, Then npm ci is used', async () => {
      write('package.json');
      write('npm-shrinkwrap.json');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(commands()).toEqual(['npm ci']);
    });

    it('Given a yarn.lock, When dependencies are installed, Then yarn is enabled through corepack and installs', async () => {
      write('package.json');
      write('yarn.lock');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(commands()).toEqual(['corepack enable', 'yarn install']);
    });

    it('Given a pnpm-lock.yaml, When dependencies are installed, Then pnpm is enabled through corepack and installs from the lockfile', async () => {
      write('package.json');
      write('pnpm-lock.yaml');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(commands()).toEqual(['corepack enable', 'pnpm install --frozen-lockfile']);
    });

    it('Given a package.json with no lockfile, When dependencies are installed, Then npm install is used', async () => {
      write('package.json');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(commands()).toEqual(['npm install --no-audit --no-fund']);
    });

    it('Given only a validation command, When dependencies are installed, Then they are installed', async () => {
      write('package.json');
      write('package-lock.json');
      const result = await installDependencies({ repoRoot, config: { buildCommand: '', validationCommand: 'node check.js' } });
      expect(result).toBe('installed');
      expect(commands()).toEqual(['npm ci']);
    });
  });

  describe('Scenario: Install runs in the repo', () => {
    it('Given a repo root, When dependencies are installed, Then the command runs from that directory', async () => {
      write('package.json');
      write('package-lock.json');
      await installDependencies({ repoRoot, config: BUILD_CONFIG });
      expect(exec.exec.mock.calls[0][2]).toEqual({ cwd: repoRoot });
    });
  });
});
