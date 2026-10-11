const exec = require('@actions/exec');
const core = require('@actions/core');
const { installClaudeCli, runClaude } = require('../../src/claude');
const { getCostSummary, resetCosts } = require('../../src/cost');

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

  describe('Scenario: Run Claude and record its cost', () => {
    const JSON_RESULT = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'Wrote the post.',
      total_cost_usd: 0.1234,
      num_turns: 7,
      modelUsage: { 'claude-sonnet-5': { costUSD: 0.1234 } },
    });

    beforeEach(() => resetCosts());

    it('Given a prompt and claude config, When runClaude is called, Then it asks the CLI for JSON output without streaming it raw', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: JSON_RESULT, stderr: '' });

      // When
      await runClaude('Write a blog post', { allowedTools: 'Read,Edit,Glob,Grep', maxTurns: 25 }, 'post');

      // Then
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'claude',
        ['-p', 'Write a blog post', '--allowedTools', 'Read,Edit,Glob,Grep', '--max-turns', '25', '--output-format', 'json'],
        expect.objectContaining({ silent: true, ignoreReturnCode: true })
      );
    });

    it('Given Claude finishes, When runClaude returns, Then its answer and cost are logged and the cost is recorded under the label', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: JSON_RESULT, stderr: '' });

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 }, 'post');

      // Then
      expect(core.info).toHaveBeenCalledWith('Wrote the post.');
      expect(core.info).toHaveBeenCalledWith('Claude cost for post: $0.1234 (7 turns, claude-sonnet-5)');
      expect(getCostSummary().totalUsd).toBeCloseTo(0.1234, 4);
    });

    it('Given the CLI prints something that is not JSON, When runClaude returns, Then the output is still logged and the cost is recorded as unknown', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: 'plain text answer', stderr: '' });

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 }, 'post');

      // Then
      expect(core.info).toHaveBeenCalledWith('plain text answer');
      expect(getCostSummary().lines).toContain('post: cost unknown');
    });
  });

  describe('Scenario: Claude CLI exits with error', () => {
    it('Given Claude CLI exits non-zero after spending money, When runClaude is called, Then the cost is still recorded and it throws', async () => {
      // Given
      resetCosts();
      const failed = JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, total_cost_usd: 0.5, num_turns: 25 });
      exec.getExecOutput.mockResolvedValue({ exitCode: 1, stdout: failed, stderr: '' });

      // When / Then
      await expect(runClaude('prompt', { allowedTools: 'Read', maxTurns: 25 }, 'post')).rejects.toThrow(
        'Claude Code CLI exited with a non-zero status'
      );
      expect(getCostSummary().totalUsd).toBeCloseTo(0.5, 4);
    });

    it('Given the CLI cannot be started, When runClaude is called, Then it throws', async () => {
      exec.getExecOutput.mockRejectedValue(new Error('spawn claude ENOENT'));
      await expect(runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 }, 'post')).rejects.toThrow(
        'Claude Code CLI exited with a non-zero status'
      );
    });
  });

  describe('Scenario: Run Claude with a specific model', () => {
    it('Given a claude config with a model, When runClaude is called, Then it passes --model to the CLI', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: '{}', stderr: '' });

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10, model: 'claude-haiku-4-5-20251001' }, 'brief');

      // Then
      const args = exec.getExecOutput.mock.calls[0][1];
      expect(args).toEqual(expect.arrayContaining(['--model', 'claude-haiku-4-5-20251001']));
    });

    it('Given a claude config without a model, When runClaude is called, Then no --model flag is passed', async () => {
      // Given
      exec.getExecOutput.mockResolvedValue({ exitCode: 0, stdout: '{}', stderr: '' });

      // When
      await runClaude('prompt', { allowedTools: 'Read', maxTurns: 10 }, 'post');

      // Then
      expect(exec.getExecOutput.mock.calls[0][1]).not.toContain('--model');
    });
  });
});
