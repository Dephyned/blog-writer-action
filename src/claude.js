const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  CLAUDE_CLI_PACKAGE,
  ERROR_CLAUDE_CLI_INSTALL_FAILED,
  ERROR_CLAUDE_CLI_RUN_FAILED,
  CLAUDE_OUTPUT_FORMAT,
} = require('./constants');
const { recordCost, formatUsd } = require('./cost');

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

function parseResult(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * Runs the Claude Code CLI with the given prompt and configuration, and records
 * what the call cost from the CLI's JSON result.
 * @param {string} prompt - The full prompt to send to Claude
 * @param {object} claudeConfig - Config with allowedTools, maxTurns and an optional model
 * @param {string} label - What the call is for, used in the cost report
 */
async function runClaude(prompt, claudeConfig, label) {
  const args = [
    '-p',
    prompt,
    '--allowedTools',
    claudeConfig.allowedTools,
    '--max-turns',
    String(claudeConfig.maxTurns),
  ];

  if (claudeConfig.model) {
    args.push('--model', claudeConfig.model);
  }

  for (const dir of claudeConfig.addDirs || []) {
    args.push('--add-dir', dir);
  }

  args.push('--output-format', CLAUDE_OUTPUT_FORMAT);

  let output;
  try {
    output = await exec.getExecOutput('claude', args, {
      env: { ...process.env },
      silent: true,
      ignoreReturnCode: true,
    });
  } catch (err) {
    throw new Error(ERROR_CLAUDE_CLI_RUN_FAILED + ': ' + err.message);
  }

  const result = parseResult(output.stdout);
  core.info(result && typeof result.result === 'string' ? result.result : output.stdout);

  const model = result && result.modelUsage ? Object.keys(result.modelUsage).join(', ') : claudeConfig.model || null;
  const costUsd = result && typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null;
  const turns = result && typeof result.num_turns === 'number' ? result.num_turns : null;
  recordCost({ label, costUsd, turns, model });
  if (costUsd !== null) {
    core.info(`Claude cost for ${label}: ${formatUsd(costUsd)} (${turns} turns, ${model})`);
  }

  if (output.exitCode !== 0) {
    const reason = (result && result.subtype) || output.stderr.trim() || `exit code ${output.exitCode}`;
    throw new Error(ERROR_CLAUDE_CLI_RUN_FAILED + ': ' + reason);
  }
}

module.exports = { installClaudeCli, runClaude };
