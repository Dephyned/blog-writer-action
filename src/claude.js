const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  CLAUDE_CLI_PACKAGE,
  ERROR_CLAUDE_CLI_INSTALL_FAILED,
  ERROR_CLAUDE_CLI_RUN_FAILED,
} = require('./constants');

/**
 * Installs the Claude Code CLI globally via npm.
 */
async function installClaudeCli() {
  try {
    await exec.exec('npm', ['install', '-g', CLAUDE_CLI_PACKAGE]);
    core.info('Claude Code CLI installed successfully.');
  } catch (err) {
    throw new Error(ERROR_CLAUDE_CLI_INSTALL_FAILED + ': ' + err.message);
  }
}

/**
 * Runs the Claude Code CLI with the given prompt and configuration.
 * @param {string} prompt - The full prompt to send to Claude
 * @param {object} claudeConfig - Config with allowedTools and maxTurns
 */
async function runClaude(prompt, claudeConfig) {
  const args = [
    '-p',
    prompt,
    '--allowedTools',
    claudeConfig.allowedTools,
    '--max-turns',
    String(claudeConfig.maxTurns),
  ];

  try {
    await exec.exec('claude', args, {
      env: { ...process.env },
    });
  } catch (err) {
    throw new Error(ERROR_CLAUDE_CLI_RUN_FAILED + ': ' + err.message);
  }
}

module.exports = { installClaudeCli, runClaude };
