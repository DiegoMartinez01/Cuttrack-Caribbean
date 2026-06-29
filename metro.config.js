const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    os: require.resolve('react-native/Libraries/Utilities/Platform'),
  },
};

module.exports = config;