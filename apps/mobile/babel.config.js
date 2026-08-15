module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 : le plugin a migré vers react-native-worklets.
    // ⚠️ Doit rester en DERNIER dans la liste des plugins.
    plugins: ["react-native-worklets/plugin"],
  };
};
