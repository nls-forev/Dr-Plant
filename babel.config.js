module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Add this 'plugins' array
      "react-native-reanimated/plugin", // Add this line for the Reanimated plugin
    ],
  };
};
