const { resolveParameters } = require('../../src/parameters');

// Mock @actions/exec for postCountCommand
jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn(),
}));

const exec = require('@actions/exec');

describe('Feature: Parameter Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Manual topic override', () => {
    it('Given a topic override input, When resolveParameters is called, Then it should use the override', async () => {
      // Given
      const config = {
        topicSchedule: { '1': 'window-cleaning', '2': 'solar-screens' },
        locations: ['Las Vegas'],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: 'pressure-washing',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.topic).toBe('pressure-washing');
    });
  });

  describe('Scenario: Topic from schedule (day of week)', () => {
    it('Given no topic override and a topicSchedule, When resolveParameters is called, Then it should select topic by day of week', async () => {
      // Given
      const dayOfWeek = new Date().getDay().toString();
      const config = {
        topicSchedule: { [dayOfWeek]: 'scheduled-topic' },
        locations: [],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.topic).toBe('scheduled-topic');
    });
  });

  describe('Scenario: Default topic when no schedule match', () => {
    it('Given no topic override and no matching day in schedule, When resolveParameters is called, Then it should default to "general"', async () => {
      // Given
      const config = {
        topicSchedule: { '99': 'never-matches' },
        locations: [],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.topic).toBe('general');
    });
  });

  describe('Scenario: Manual location override', () => {
    it('Given a location override input, When resolveParameters is called, Then it should use the override', async () => {
      // Given
      const config = {
        topicSchedule: {},
        locations: ['Las Vegas', 'Summerlin', 'Henderson'],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: 'Henderson',
        config,
      });

      // Then
      expect(result.location).toBe('Henderson');
    });
  });

  describe('Scenario: Location rotation based on post count', () => {
    it('Given no location override and 3 locations, When post count is 4, Then it should select location at index 4 % 3 = 1', async () => {
      // Given
      const config = {
        topicSchedule: {},
        locations: ['Las Vegas', 'Summerlin', 'Henderson'],
        postCountCommand: 'echo 4',
      };
      exec.getExecOutput.mockResolvedValue({ stdout: '4\n', exitCode: 0 });

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.location).toBe('Summerlin');
    });
  });

  describe('Scenario: No locations configured', () => {
    it('Given an empty locations array, When resolveParameters is called, Then location should be empty string', async () => {
      // Given
      const config = {
        topicSchedule: {},
        locations: [],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.location).toBe('');
    });
  });

  describe('Scenario: Post count command fails', () => {
    it('Given a failing postCountCommand, When resolveParameters is called, Then it should default post count to 0', async () => {
      // Given
      const config = {
        topicSchedule: {},
        locations: ['Las Vegas', 'Summerlin'],
        postCountCommand: 'bad-command',
      };
      exec.getExecOutput.mockRejectedValue(new Error('command not found'));

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      expect(result.location).toBe('Las Vegas');
    });
  });

  describe('Scenario: Date is always today', () => {
    it('Given any inputs, When resolveParameters is called, Then date should be today in YYYY-MM-DD format', async () => {
      // Given
      const config = {
        topicSchedule: {},
        locations: [],
        postCountCommand: 'echo 0',
      };

      // When
      const result = await resolveParameters({
        topicOverride: '',
        locationOverride: '',
        config,
      });

      // Then
      const today = new Date().toISOString().split('T')[0];
      expect(result.date).toBe(today);
    });
  });
});
