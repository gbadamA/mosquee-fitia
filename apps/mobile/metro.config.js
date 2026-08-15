// Metro config — Expo SDK 54 + NativeWind.
// Depuis SDK 52+, Expo détecte et configure les monorepos automatiquement :
// PAS de watchFolders / nodeModulesPaths / disableHierarchicalLookup manuels
// (ils cassent la résolution des modules internes de react-native).
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
