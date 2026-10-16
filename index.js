import { AppRegistry, Platform } from 'react-native';

// Headless task started by MaalamScanTaskService for each captured frame
// (Android only; react-native-web has no headless tasks).
if (Platform.OS !== 'web') {
  AppRegistry.registerHeadlessTask(
    'MaalamScan',
    () => require('./src/detection/task').default
  );
}

import 'expo-router/entry';
