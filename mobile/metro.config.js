const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-svg ships .svg assets that Metro should treat as source.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
