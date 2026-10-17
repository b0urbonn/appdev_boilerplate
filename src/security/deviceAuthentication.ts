import { requireOptionalNativeModule } from 'expo';

/** Check before importing: the package throws during import on older native builds. */
async function getLocalAuthentication() {
  if (!requireOptionalNativeModule('ExpoLocalAuthentication')) {
    throw new Error('Update Maalam to the latest Android build to use app lock.');
  }
  return import('expo-local-authentication');
}

export async function getDeviceSecurityLevel() {
  const LocalAuthentication = await getLocalAuthentication();
  return LocalAuthentication.getEnrolledLevelAsync();
}

export async function authenticateWithDevice(purpose: 'unlock' | 'enable' = 'unlock') {
  const LocalAuthentication = await getLocalAuthentication();
  return LocalAuthentication.authenticateAsync({
    promptMessage: purpose === 'enable' ? 'Enable Maalam app lock' : 'Unlock Maalam',
    promptSubtitle: purpose === 'enable' ? 'Confirm your identity to enable app lock' : 'Verify your identity to continue',
    promptDescription: 'Use biometrics or your device screen lock.',
    biometricsSecurityLevel: 'weak',
    disableDeviceFallback: false,
    requireConfirmation: true,
  });
}
