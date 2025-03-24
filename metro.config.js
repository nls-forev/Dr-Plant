const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add custom extensions
config.resolver.assetExts = [...config.resolver.assetExts, "bin", "json"];

// Point to the correct assets folder inside your project root
config.watchFolders = [path.resolve(__dirname, "assets")];

// Add custom source extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "js",
  "json",
  "jsx",
  "ts",
  "tsx",
];

module.exports = config;
