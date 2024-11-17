import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.nativescript.recipeassistant',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  },
  ios: {
    discardUncaughtJsExceptions: false
  }
} as NativeScriptConfig;