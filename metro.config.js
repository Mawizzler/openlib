const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Avoid resolving React (and other deps) from parent directories in nested/monorepo setups.
config.resolver = config.resolver ?? {};
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = withNativeWind(config, { input: './global.css' });
