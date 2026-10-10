const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const {
  PACKAGE_JSON,
  DEPENDENCY_INSTALLERS,
  DEPENDENCY_INSTALL_NO_LOCKFILE,
  DEPENDENCIES_SKIPPED,
  DEPENDENCIES_INSTALLED,
} = require('./constants');

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

  const installer = DEPENDENCY_INSTALLERS.find(({ lockfile }) => exists(lockfile));
  const commands = installer ? installer.commands : DEPENDENCY_INSTALL_NO_LOCKFILE;

  core.info('Installing project dependencies...');
  for (const [command, args] of commands) {
    await exec.exec(command, args, { cwd: repoRoot });
  }
  return DEPENDENCIES_INSTALLED;
}

module.exports = { installDependencies };
