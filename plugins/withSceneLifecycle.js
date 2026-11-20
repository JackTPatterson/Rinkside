// iOS 27 asserts at launch unless the app adopts the UIScene life cycle. The Expo template
// predates that, so wire up expo's ExpoAppSceneDelegate here (see
// node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift).
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  return withAppDelegate(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
      // The scene delegate now creates the window and starts React Native.
      src = src.replace(
        /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n\n?/,
        ''
      );
    }
    c.modResults.contents = src;
    return c;
  });
};

module.exports = withSceneLifecycle;
