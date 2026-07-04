const exec = require('@actions/exec');
const { runValidation } = require('../../src/validate');

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

describe('Feature: Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Run a configured validation command', () => {
    it('Given a validationCommand in config, When runValidation is called, Then it should execute the command', async () => {
      // Given
      exec.exec.mockResolvedValue(0);

      // When
      await runValidation('node scripts/validate.js');

      // Then
      expect(exec.exec).toHaveBeenCalledWith('bash', ['-c', 'node scripts/validate.js']);
    });
  });

  describe('Scenario: No validation command configured', () => {
    it('Given an empty validationCommand, When runValidation is called, Then it should skip without error', async () => {
      // When
      await runValidation('');

      // Then
      expect(exec.exec).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Validation command fails', () => {
    it('Given a validation command that exits non-zero, When runValidation is called, Then it should throw an error', async () => {
      // Given
      exec.exec.mockRejectedValue(new Error('exit code 1'));

      // When/Then
      await expect(runValidation('false')).rejects.toThrow('Validation command failed');
    });
  });
});
