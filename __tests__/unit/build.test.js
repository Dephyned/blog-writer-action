const exec = require('@actions/exec');
const { runBuild } = require('../../src/build');

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

describe('Feature: Build', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Run a configured build command', () => {
    it('Given a buildCommand in config, When runBuild is called, Then it should execute the command', async () => {
      // Given
      exec.exec.mockResolvedValue(0);

      // When
      await runBuild('npm run build');

      // Then
      expect(exec.exec).toHaveBeenCalledWith('bash', ['-c', 'npm run build'], expect.any(Object));
    });
  });

  describe('Scenario: No build command configured', () => {
    it('Given an empty buildCommand, When runBuild is called, Then it should skip without error', async () => {
      // When
      await runBuild('');

      // Then
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Build command fails', () => {
    it('Given a build command that exits non-zero, When runBuild is called, Then it should throw an error', async () => {
      // Given
      exec.exec.mockRejectedValue(new Error('exit code 1'));

      // When/Then
      await expect(runBuild('npm run build')).rejects.toThrow('Build command failed');
    });
  });
});
