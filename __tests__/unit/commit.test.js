const exec = require('@actions/exec');
const { commitAndPush } = require('../../src/commit');

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
  getExecOutput: jest.fn(),
}));

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

describe('Feature: Git Commit and Push', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exec.exec.mockResolvedValue(0);
    exec.getExecOutput.mockResolvedValue({ stdout: '', exitCode: 0 });
  });

  describe('Scenario: Commit specific files with templated message', () => {
    it('Given filesToCommit and a commit message template, When commitAndPush is called, Then it should stage the files and commit with substituted message', async () => {
      // Given
      const options = {
        filesToCommit: ['src/data/posts.ts'],
        commitMessage: 'feat(blog): add post - {topic} ({location})',
        topic: 'window-cleaning',
        location: 'Las Vegas',
        date: '2025-01-15',
        branch: 'main',
      };

      // Mock git diff --cached to show changes exist
      exec.getExecOutput.mockResolvedValueOnce({ stdout: 'M src/data/posts.ts', exitCode: 0 });

      // When
      const committed = await commitAndPush(options);

      // Then
      expect(committed).toBe(true);

      // Should configure git
      expect(exec.exec).toHaveBeenCalledWith('git', [
        'config',
        'user.name',
        'github-actions[bot]',
      ]);
      expect(exec.exec).toHaveBeenCalledWith('git', [
        'config',
        'user.email',
        'github-actions[bot]@users.noreply.github.com',
      ]);

      // Should stage specific files
      expect(exec.exec).toHaveBeenCalledWith('git', ['add', 'src/data/posts.ts']);
    });
  });

  describe('Scenario: Commit all changes when no filesToCommit specified', () => {
    it('Given empty filesToCommit, When commitAndPush is called, Then it should stage all changes with git add -A', async () => {
      // Given
      const options = {
        filesToCommit: [],
        commitMessage: 'feat: new post',
        topic: 'general',
        location: '',
        date: '2025-01-15',
        branch: 'main',
      };
      exec.getExecOutput.mockResolvedValueOnce({ stdout: 'M file.txt', exitCode: 0 });

      // When
      await commitAndPush(options);

      // Then
      expect(exec.exec).toHaveBeenCalledWith('git', ['add', '-A']);
    });
  });

  describe('Scenario: No changes to commit', () => {
    it('Given no staged changes after git add, When commitAndPush is called, Then it should return false without committing', async () => {
      // Given
      const options = {
        filesToCommit: ['src/data/posts.ts'],
        commitMessage: 'feat: new post',
        topic: 'general',
        location: '',
        date: '2025-01-15',
        branch: 'main',
      };
      // git diff --cached returns empty (no changes)
      exec.getExecOutput.mockResolvedValueOnce({ stdout: '', exitCode: 0 });

      // When
      const committed = await commitAndPush(options);

      // Then
      expect(committed).toBe(false);
    });
  });

  describe('Scenario: Commit message placeholder substitution', () => {
    it('Given a commit message with {topic} and {location}, When commitAndPush is called, Then both should be substituted', async () => {
      // Given
      const options = {
        filesToCommit: [],
        commitMessage: 'feat(blog): add daily blog post - {topic} ({location})',
        topic: 'solar-screens',
        location: 'Henderson',
        date: '2025-06-01',
        branch: 'main',
      };
      exec.getExecOutput.mockResolvedValueOnce({ stdout: 'M file.txt', exitCode: 0 });

      // When
      await commitAndPush(options);

      // Then
      const commitCall = exec.exec.mock.calls.find(
        (call) => call[0] === 'git' && call[1][0] === 'commit'
      );
      expect(commitCall).toBeDefined();
      expect(commitCall[1][2]).toContain('solar-screens');
      expect(commitCall[1][2]).toContain('Henderson');
    });
  });

  describe('Scenario: Push to specified branch', () => {
    it('Given branch "main", When commitAndPush is called, Then it should push to origin main', async () => {
      // Given
      const options = {
        filesToCommit: [],
        commitMessage: 'feat: post',
        topic: 'general',
        location: '',
        date: '2025-01-15',
        branch: 'main',
      };
      exec.getExecOutput.mockResolvedValueOnce({ stdout: 'M file.txt', exitCode: 0 });

      // When
      await commitAndPush(options);

      // Then
      expect(exec.exec).toHaveBeenCalledWith('git', ['push', 'origin', 'main']);
    });
  });

  describe('Scenario: Extra files that only go along with a post', () => {
    it('Given a new post and an extra file, When commitAndPush is called, Then both are staged and committed', async () => {
      // Given
      exec.getExecOutput.mockResolvedValueOnce({ stdout: 'src/data/posts.ts', exitCode: 0 });

      // When
      const committed = await commitAndPush({
        filesToCommit: ['src/data/posts.ts'],
        extraFiles: ['.blog/keywords-used.json'],
        commitMessage: 'feat(blog): add post',
        topic: 'general',
        location: '',
        date: '2026-10-11',
        branch: 'main',
      });

      // Then
      expect(committed).toBe(true);
      expect(exec.exec).toHaveBeenCalledWith('git', ['add', '.blog/keywords-used.json']);
    });

    it('Given no post was written, When commitAndPush is called with an extra file, Then the extra file is not committed on its own', async () => {
      // Given
      exec.getExecOutput.mockResolvedValueOnce({ stdout: '', exitCode: 0 });

      // When
      const committed = await commitAndPush({
        filesToCommit: ['src/data/posts.ts'],
        extraFiles: ['.blog/keywords-used.json'],
        commitMessage: 'feat(blog): add post',
        topic: 'general',
        location: '',
        date: '2026-10-11',
        branch: 'main',
      });

      // Then
      expect(committed).toBe(false);
      expect(exec.exec).not.toHaveBeenCalledWith('git', ['add', '.blog/keywords-used.json']);
      expect(exec.exec).not.toHaveBeenCalledWith('git', expect.arrayContaining(['commit']));
    });
  });
});
