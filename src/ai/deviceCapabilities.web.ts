export type { LocalDeviceCheck, LocalDeviceReport, DeviceResources } from './deviceCapabilities';

export async function scanLocalDevice(): Promise<never> {
  throw new Error('Requires the Android app.');
}

export async function refreshLocalDeviceResources(): Promise<never> {
  throw new Error('Requires the Android app.');
}
