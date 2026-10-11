const { recordCost, getCostSummary, resetCosts } = require('../../src/cost');

describe('Feature: Tracking what a run costs', () => {
  beforeEach(() => resetCosts());

  describe('Scenario: Several Claude calls in one run', () => {
    it('Given setup, brief and post calls, When the summary is read, Then each call and the total are listed', () => {
      // Given
      recordCost({ label: 'setup', costUsd: 0.4123, turns: 18, model: 'claude-sonnet-5' });
      recordCost({ label: 'product brief', costUsd: 0.2891, turns: 17, model: 'claude-haiku-4-5-20251001' });
      recordCost({ label: 'post', costUsd: 0.15, turns: 9, model: 'claude-sonnet-5' });

      // When
      const summary = getCostSummary();

      // Then
      expect(summary.totalUsd).toBeCloseTo(0.8514, 4);
      expect(summary.lines).toEqual([
        'setup: $0.4123 (18 turns, claude-sonnet-5)',
        'product brief: $0.2891 (17 turns, claude-haiku-4-5-20251001)',
        'post: $0.1500 (9 turns, claude-sonnet-5)',
        'Total: $0.8514',
      ]);
    });
  });

  describe('Scenario: Cost could not be read', () => {
    it('Given a call with unknown cost, When the summary is read, Then it is marked unknown and the total says it is a minimum', () => {
      // Given
      recordCost({ label: 'post', costUsd: 0.2, turns: 5, model: 'claude-sonnet-5' });
      recordCost({ label: 'post fix', costUsd: null, turns: null, model: null });

      // When
      const summary = getCostSummary();

      // Then
      expect(summary.totalUsd).toBeCloseTo(0.2, 4);
      expect(summary.lines).toEqual([
        'post: $0.2000 (5 turns, claude-sonnet-5)',
        'post fix: cost unknown',
        'Total: at least $0.2000',
      ]);
    });
  });

  describe('Scenario: No Claude calls', () => {
    it('Given nothing was recorded, When the summary is read, Then the total is zero', () => {
      expect(getCostSummary()).toEqual({ totalUsd: 0, lines: ['Total: $0.0000'] });
    });
  });
});
