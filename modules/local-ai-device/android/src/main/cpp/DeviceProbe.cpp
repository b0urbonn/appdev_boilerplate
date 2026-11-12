#include <jni.h>
#include <dlfcn.h>
#include <cstdint>
#include <string>
#include <vector>

struct ANeuralNetworksDevice;

// Resolve NNAPI dynamically so Android 26–28 can still use the CPU path.
extern "C" JNIEXPORT jobjectArray JNICALL
Java_expo_modules_localaidevice_LocalAiDeviceModule_readNeuralDevices(JNIEnv* env, jobject) {
  std::vector<std::string> devices;
  void* library = dlopen("libneuralnetworks.so", RTLD_NOW | RTLD_LOCAL);
  if (library != nullptr) {
    auto countDevices = reinterpret_cast<int (*)(uint32_t*)>(dlsym(library, "ANeuralNetworks_getDeviceCount"));
    auto getDevice = reinterpret_cast<int (*)(uint32_t, ANeuralNetworksDevice**)>(dlsym(library, "ANeuralNetworks_getDevice"));
    auto getType = reinterpret_cast<int (*)(const ANeuralNetworksDevice*, int32_t*)>(dlsym(library, "ANeuralNetworksDevice_getType"));
    auto getName = reinterpret_cast<int (*)(const ANeuralNetworksDevice*, const char**)>(dlsym(library, "ANeuralNetworksDevice_getName"));
    uint32_t count = 0;
    if (countDevices && getDevice && getType && getName && countDevices(&count) == 0) {
      for (uint32_t i = 0; i < count; ++i) {
        ANeuralNetworksDevice* device = nullptr;
        int32_t type = 0;
        const char* name = nullptr;
        if (getDevice(i, &device) == 0 && getType(device, &type) == 0 && getName(device, &name) == 0 && name) {
          devices.push_back(std::to_string(type) + "|" + name);
        }
      }
    }
    dlclose(library);
  }
  jclass stringClass = env->FindClass("java/lang/String");
  jobjectArray result = env->NewObjectArray(static_cast<jsize>(devices.size()), stringClass, nullptr);
  for (size_t i = 0; i < devices.size(); ++i) {
    jstring value = env->NewStringUTF(devices[i].c_str());
    env->SetObjectArrayElement(result, static_cast<jsize>(i), value);
    env->DeleteLocalRef(value);
  }
  env->DeleteLocalRef(stringClass);
  return result;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_expo_modules_localaidevice_LocalAiDeviceModule_canLoadOpenCl(JNIEnv*, jobject) {
  void* library = dlopen("libOpenCL.so", RTLD_NOW | RTLD_LOCAL);
  if (!library) return JNI_FALSE;
  // A library alone isn't proof that this app can use a GPU. Enumerate actual
  // OpenCL GPU devices and verify that the driver marks one available.
  auto platforms = reinterpret_cast<int (*)(uint32_t, void**, uint32_t*)>(dlsym(library, "clGetPlatformIDs"));
  auto devices = reinterpret_cast<int (*)(void*, uint64_t, uint32_t, void**, uint32_t*)>(dlsym(library, "clGetDeviceIDs"));
  auto info = reinterpret_cast<int (*)(void*, uint32_t, size_t, void*, size_t*)>(dlsym(library, "clGetDeviceInfo"));
  uint32_t count = 0;
  bool available = false;
  if (platforms && devices && info && platforms(0, nullptr, &count) == 0 && count > 0 && count <= 64) {
    std::vector<void*> ids(count);
    if (platforms(count, ids.data(), nullptr) == 0) {
      for (void* platform : ids) {
        uint32_t deviceCount = 0;
        constexpr uint64_t gpuType = 1u << 2;
        if (devices(platform, gpuType, 0, nullptr, &deviceCount) != 0 || deviceCount == 0 || deviceCount > 64) continue;
        std::vector<void*> gpuIds(deviceCount);
        if (devices(platform, gpuType, deviceCount, gpuIds.data(), nullptr) != 0) continue;
        for (void* gpu : gpuIds) {
          uint32_t enabled = 0;
          constexpr uint32_t deviceAvailable = 0x1027;
          if (info(gpu, deviceAvailable, sizeof(enabled), &enabled, nullptr) == 0 && enabled != 0) available = true;
        }
      }
    }
  }
  dlclose(library);
  return available ? JNI_TRUE : JNI_FALSE;
}
