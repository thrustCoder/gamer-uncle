const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-web 0.21+ removed the requireNativeComponent export.
// Some packages (e.g., @react-native-masked-view/masked-view) import it from
// 'react-native' at module initialization, which crashes the web app.
//
// This resolver redirects 'react-native' imports on web to a shim module that
// re-exports everything from react-native-web and adds a polyfill for
// requireNativeComponent.
const rnWebShimPath = path.resolve(__dirname, 'shims', 'requireNativeComponent.web.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, redirect 'react-native' to our shim (which re-exports react-native-web
  // plus the missing requireNativeComponent polyfill).
  // Exclude our shim itself and react-native-web internals to avoid circular imports.
  if (
    platform === 'web' &&
    moduleName === 'react-native' &&
    context.originModulePath &&
    !context.originModulePath.includes('requireNativeComponent.web') &&
    !context.originModulePath.includes('react-native-web')
  ) {
    return {
      type: 'sourceFile',
      filePath: rnWebShimPath,
    };
  }

  // Fall back to the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
