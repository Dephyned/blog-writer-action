const exec = require('@actions/exec');
const { installClaudeCli, runClaude } = require('../../src/claude');

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
  getExecOutput: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  setFailed: jest.fn(),
}));

describe('Feature: Claude Code CLI Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Install Claude Code CLI', () => {
    it('Given a clean environment, When installClaudeCli is called, Then it should run npm install -g @anthropic-ai/claude-code', async () => {
      // Given
      exec.exec.mockResolvedValue(0);

      // When
      await installClaudeCli();

      // Then
      expect(exec.exec).toHaveBeenCalledWith('npm', [
        'install',
        '-g',
        '@anthropic-ai/claude-code',
      ]);
    });
  });

  describe('Scenario: Install fails', () => {
    it('Given npm install fails, When installClaudeCli is called, Then it should throw an error', async () => {
      // Given
      exec.exec.mockRejectedValue(new Error('npm install failed'));

      // When/Then
      await expect(installClaudeCli()).rejects.toThrow('Failed to install Claude Code CLI');
    });
  });

  describe('Scenario: Run Claude with prompt and options', () => {
    it('Given a prompt and claude config, When runClaude is called, Then it should invoke claude -p with correct arguments', async () => {
      // Given
      exec.exec.mockResolvedValue(0);
      const prompt = 'Write a blog post about window cleaning';
      const claudeConfig = { allowedTools: 'Read,Edit,Glob,Grep', maxTurns: 25 };

      // When
      await runClaude(prompt, claudeConfig);

      // Then
      expect(exec.exec).toHaveBeenCalledWith(
        'claude',
        [
          '-p',
          prompt,
          '--allowedTools',
          'Read,Edit,Glob,Grep',
          '--max-turns',
          '25',
        ],
        expect.any(Object)
      );
    });
  });

  describe('Scenario: Claude CLI exits with error', () => {
    it('Given Claude CLI returns non-zero, When runClaude is called, Then it should throw an error', async () => {
      // Given
      exec.exec.mockRejectedValue(new Error('Process exited with code 1'));

      // When/Then
      await expect(
        runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 })
      ).rejects.toThrow('Claude Code CLI exited with a non-zero status');
    });
  });

  describe('Scenario: Run Claude with a specific model', () => {
    it('Given a claude config with a model, When runClaude is called, Then it passes --model to the CLI', async () => {
      // Given
      exec.exec.mockResolvedValue(0);

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10, model: 'claude-haiku-4-5-20251001' });

      // Then
      const args = exec.exec.mock.calls[0][1];
      expect(args).toEqual(expect.arrayContaining(['--model', 'claude-haiku-4-5-20251001']));
    });

    it('Given a claude config without a model, When runClaude is called, Then no --model flag is passed', async () => {
      // Given
      exec.exec.mockResolvedValue(0);

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 });

      // Then
      expect(exec.exec.mock.calls[0][1]).not.toContain('--model');
    });
  });
});
