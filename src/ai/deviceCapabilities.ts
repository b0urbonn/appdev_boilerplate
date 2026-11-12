import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { estimateMemory, type Backend } from 'react-native-litert-lm';
import { LOCAL_MODEL_FILENAME, LOCAL_MODEL_SIZE_BYTES } from './modelInfo';

export interface DeviceResources {
  model: string;
  soc: string;
  androidApi: number;
  arm64: boolean;
  totalRamBytes: number;
  availableRamBytes: number;
  lowMemory: boolean;
  freeStorageBytes: number;
  npuDetected: boolean;
  npuSource: 'nnapi' | 'vendor_driver' | 'chipset' | 'unknown';
  neuralDevices: string[];
  gpuAvailable: boolean;
  updatedAt: number;
}

export interface LocalDeviceReport extends DeviceResources {
  compatible: boolean;
  memoryReady: boolean;
  storageReady: boolean;
  requiredStorageBytes: number;
  requiredRamBytes: number;
  recommendedBackend: Backend;
}

export type LocalDeviceCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ready'; report: LocalDeviceReport; refreshing?: boolean; refreshError?: string }
  | { state: 'error'; message: string };

type LiveResources = Pick<DeviceResources, 'totalRamBytes' | 'availableRamBytes' | 'lowMemory' | 'freeStorageBytes' | 'updatedAt'>;

function nativeProbe() {
  if (Platform.OS !== 'android') throw new Error('Requires the Android app.');
  const native = requireOptionalNativeModule<{
    scan: () => Promise<DeviceResources>;
    getResources?: () => Promise<LiveResources>;
  }>('LocalAiDevice');
  if (!native) throw new Error('Update the app to enable hardware detection.');
  return native;
}

export async function scanLocalDevice(): Promise<LocalDeviceReport> {
  return evaluateResources(await nativeProbe().scan());
}

/** Cheap live sample: reuses chip/driver results without reopening GPU drivers. */
export async function refreshLocalDeviceResources(previous: LocalDeviceReport): Promise<LocalDeviceReport> {
  const native = nativeProbe();
  const resources = native.getResources ? await native.getResources() : await native.scan();
  return evaluateResources({ ...previous, ...resources });
}

async function evaluateResources(device: DeviceResources): Promise<LocalDeviceReport> {
  const path = `${FileSystem.documentDirectory}models/${LOCAL_MODEL_FILENAME}`;
  const [model, partial] = await Promise.all([
    FileSystem.getInfoAsync(path),
    FileSystem.getInfoAsync(`${path}.download`),
  ]);
  const fileSize = model.exists ? model.size || LOCAL_MODEL_SIZE_BYTES : LOCAL_MODEL_SIZE_BYTES;
  const estimate = (backend: Backend) => estimateMemory({
    modelFileSizeBytes: fileSize,
    availableMemoryBytes: device.totalRamBytes,
    config: { backend, maxContextTokens: 4096 },
  });
  const cpu = estimate('cpu');
  const acceleratorFits = estimate('npu').verdict !== 'critical';
  const recommendedBackend: Backend = acceleratorFits && device.npuDetected
    ? 'npu'
    : acceleratorFits && device.gpuAvailable ? 'gpu' : 'cpu';
  const requiredStorageBytes = model.exists
    ? 0
    : Math.max(0, LOCAL_MODEL_SIZE_BYTES - (partial.exists ? partial.size || 0 : 0)) + 32 * 1024 * 1024;
  return {
    ...device,
    compatible: device.arm64 && device.androidApi >= 26,
    memoryReady: cpu.verdict !== 'critical',
    storageReady: device.freeStorageBytes >= requiredStorageBytes,
    requiredStorageBytes,
    requiredRamBytes: cpu.totalEstimatedBytes,
    recommendedBackend,
  };
}
