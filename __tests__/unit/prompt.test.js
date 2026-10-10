const fs = require('fs');

jest.mock('fs');
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

const { buildPrompt } = require('../../src/prompt');

describe('Feature: Prompt Building', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Load custom prompt template and substitute placeholders', () => {
    it('Given a custom prompt template with built-in and custom placeholders, When buildPrompt is called, Then all placeholders should be substituted', () => {
      // Given
      const templateContent =
        'Write about {{TOPIC}} in {{LOCATION}} on {{DATE}}. Company: {{COMPANY_NAME}}, Phone: {{PHONE}}.';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const config = {
        promptTemplatePath: '.github/prompts/my-prompt.md',
        placeholders: { COMPANY_NAME: 'Acme Corp', PHONE: '555-1234' },
      };

      // When
      const prompt = buildPrompt({
        config,
        topic: 'window-cleaning',
        location: 'Las Vegas',
        date: '2025-01-15',
      });

      // Then
      expect(prompt).toBe(
        'Write about window-cleaning in Las Vegas on 2025-01-15. Company: Acme Corp, Phone: 555-1234.'
      );
    });
  });

  describe('Scenario: Fall back to default prompt when template file not found', () => {
    it('Given no custom prompt template file exists, When buildPrompt is called, Then it should use the embedded default template', () => {
      // Given
      fs.existsSync.mockReturnValue(false);

      const config = {
        promptTemplatePath: '.github/prompts/missing.md',
        placeholders: {},
      };

      // When
      const prompt = buildPrompt({
        config,
        topic: 'general',
        location: 'New York',
        date: '2025-06-01',
      });

      // Then
      expect(prompt).toContain('general');
      expect(prompt).toContain('New York');
      expect(prompt).toContain('2025-06-01');
      expect(prompt).not.toContain('{{TOPIC}}');
      expect(prompt).not.toContain('{{LOCATION}}');
      expect(prompt).not.toContain('{{DATE}}');
    });
  });

  describe('Scenario: Substitute only built-in placeholders when no custom ones defined', () => {
    it('Given a template with only TOPIC, LOCATION, DATE, When buildPrompt is called with empty placeholders, Then built-in placeholders are substituted', () => {
      // Given
      const templateContent = 'Topic: {{TOPIC}}, Location: {{LOCATION}}, Date: {{DATE}}.';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const config = {
        promptTemplatePath: 'prompt.md',
        placeholders: {},
      };

      // When
      const prompt = buildPrompt({
        config,
        topic: 'solar-screens',
        location: 'Henderson',
        date: '2025-03-10',
      });

      // Then
      expect(prompt).toBe('Topic: solar-screens, Location: Henderson, Date: 2025-03-10.');
    });
  });

  describe('Scenario: Multiple occurrences of same placeholder', () => {
    it('Given a template with TOPIC appearing multiple times, When buildPrompt is called, Then all occurrences should be substituted', () => {
      // Given
      const templateContent = '{{TOPIC}} is great. Learn more about {{TOPIC}}.';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const config = {
        promptTemplatePath: 'prompt.md',
        placeholders: {},
      };

      // When
      const prompt = buildPrompt({
        config,
        topic: 'pressure-washing',
        location: '',
        date: '2025-01-01',
      });

      // Then
      expect(prompt).toBe('pressure-washing is great. Learn more about pressure-washing.');
    });
  });

  describe('Scenario: Unused placeholders remain as-is', () => {
    it('Given a template with an undefined custom placeholder, When buildPrompt is called, Then the undefined placeholder remains in the output', () => {
      // Given
      const templateContent = 'Company: {{COMPANY_NAME}}, Unknown: {{UNKNOWN}}.';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const config = {
        promptTemplatePath: 'prompt.md',
        placeholders: { COMPANY_NAME: 'Acme' },
      };

      // When
      const prompt = buildPrompt({
        config,
        topic: 'general',
        location: '',
        date: '2025-01-01',
      });

      // Then
      expect(prompt).toContain('Company: Acme');
      expect(prompt).toContain('{{UNKNOWN}}');
    });
  });

  describe('Scenario: Product brief path', () => {
    it('Given a template referencing the product brief and a config with a brief, When buildPrompt is called, Then the brief path is filled in', () => {
      // Given
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('Read {{PRODUCT_BRIEF_PATH}} first.');
      const config = {
        promptTemplatePath: 'p.md',
        placeholders: {},
        productBrief: { path: '.blog/product-brief.md' },
      };

      // When
      const prompt = buildPrompt({ config, topic: 'general', location: '', date: '2026-10-10' });

      // Then
      expect(prompt).toBe('Read .blog/product-brief.md first.');
    });
  });
});
