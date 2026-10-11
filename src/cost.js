const { COST_DECIMALS } = require('./constants');

/**
 * Collects what each Claude call in a run cost, as reported by the CLI.
 */
const calls = [];

const formatUsd = (usd) => `$${usd.toFixed(COST_DECIMALS)}`;

/**
 * @param {object} call
 * @param {string} call.label - What the call was for (setup, post, ...)
 * @param {number|null} call.costUsd - Null when the CLI didn't report it
 * @param {number|null} call.turns
 * @param {string|null} call.model
 */
function recordCost({ label, costUsd, turns, model }) {
  calls.push({ label, costUsd, turns, model });
}

function describeCall({ label, costUsd, turns, model }) {
  if (typeof costUsd !== 'number') return `${label}: cost unknown`;
  return `${label}: ${formatUsd(costUsd)} (${turns} turns, ${model})`;
}

/**
 * @returns {{totalUsd: number, lines: string[]}}
 */
function getCostSummary() {
  const totalUsd = calls.reduce((sum, call) => sum + (typeof call.costUsd === 'number' ? call.costUsd : 0), 0);
  const someUnknown = calls.some((call) => typeof call.costUsd !== 'number');
  const totalLine = `Total: ${someUnknown ? 'at least ' : ''}${formatUsd(totalUsd)}`;
  return { totalUsd, lines: [...calls.map(describeCall), totalLine] };
}

function resetCosts() {
  calls.length = 0;
}

module.exports = { recordCost, getCostSummary, resetCosts, formatUsd };
