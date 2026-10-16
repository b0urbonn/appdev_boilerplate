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

export async function authenticateWithDevice() {
  const LocalAuthentication = await getLocalAuthentication();
  return LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Maalam',
    promptSubtitle: 'Verify your identity to continue',
    promptDescription: 'Use biometrics or your device screen lock.',
    biometricsSecurityLevel: 'weak',
  });
}
