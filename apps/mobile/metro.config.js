const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ── Monorepo support ──────────────────────────────────────────
// Watch all files in the workspace (needed for workspace: packages)
config.watchFolders = [workspaceRoot];

// Resolve modules from workspace root first, then project root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve workspace package symlinks correctly
config.resolver.disableHierarchicalLookup = true;

// Add webm support for local video assets
config.resolver.assetExts.push('webm');

module.exports = config;
