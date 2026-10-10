const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  PACKAGE_JSON,
  DEPENDENCY_INSTALLERS,
  DEPENDENCY_INSTALL_NO_LOCKFILE,
  PNPM_LOCKFILE,
  PNPM_INSTALL,
  PNPM_MAJOR_BY_LOCKFILE_VERSION,
  PNPM_DEFAULT_MAJOR,
  COREPACK_ENABLE,
  DEPENDENCIES_SKIPPED,
  DEPENDENCIES_INSTALLED,
} = require('./constants');

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * pnpm commands that use the repo's pinned pnpm, or else the major version that
 * wrote its lockfile.
 */
function pnpmCommands(repoRoot) {
  let packageManager = '';
  try {
    packageManager = JSON.parse(readText(path.join(repoRoot, PACKAGE_JSON))).packageManager || '';
  } catch {
    packageManager = '';
  }
  if (packageManager.startsWith('pnpm@')) {
    return [COREPACK_ENABLE, PNPM_INSTALL];
  }

  const match = readText(path.join(repoRoot, PNPM_LOCKFILE)).match(/lockfileVersion:\s*'?([\d.]+)'?/);
  const major = (match && PNPM_MAJOR_BY_LOCKFILE_VERSION[match[1]]) || PNPM_DEFAULT_MAJOR;
  return [['npm', ['install', '-g', `pnpm@${major}`]], PNPM_INSTALL];
}

// A first run installs during setup and again before the post; once is enough
const installedRoots = new Set();

/**
 * Installs the repo's packages, but only when a build or validation command will
 * use them. The package manager is picked from the lockfile at the repo root.
 * @param {object} options
 * @param {string} options.repoRoot - Repo root directory
 * @param {object} options.config - Parsed blog config
 * @returns {Promise<string>} "installed" or "skipped"
 */
async function installDependencies({ repoRoot, config }) {
  if (!config.buildCommand && !config.validationCommand) {
    core.info('No build or validation command, skipping dependency install.');
    return DEPENDENCIES_SKIPPED;
  }

  const exists = (file) => fs.existsSync(path.join(repoRoot, file));
  if (!exists(PACKAGE_JSON)) {
    core.info('No package.json at the repo root, skipping dependency install.');
    return DEPENDENCIES_SKIPPED;
  }

  if (installedRoots.has(repoRoot)) return DEPENDENCIES_INSTALLED;

  const installer = DEPENDENCY_INSTALLERS.find(({ lockfile }) => exists(lockfile));
  let commands = DEPENDENCY_INSTALL_NO_LOCKFILE;
  if (installer) {
    commands = installer.commands;
  } else if (exists(PNPM_LOCKFILE)) {
    commands = pnpmCommands(repoRoot);
  }

  core.info('Installing project dependencies...');
  for (const [command, args] of commands) {
    await exec.exec(command, args, { cwd: repoRoot });
  }
  installedRoots.add(repoRoot);
  return DEPENDENCIES_INSTALLED;
}

module.exports = { installDependencies };
