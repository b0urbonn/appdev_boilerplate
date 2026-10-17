const { withGradleProperties } = require('expo/config-plugins');

/**
 * Enables Fresco's WebP decoders in the generated Android project so the
 * stock React Native <Image> can render mascot.webp (animated WebP).
 * android/app/build.gradle reads these in the `dependencies` block:
 *   expo.webp.enabled  -> com.facebook.fresco:webpsupport
 *   expo.webp.animated -> com.facebook.fresco:animated-webp
 */
const PROPERTIES = {
  'expo.webp.enabled': 'true',
  'expo.webp.animated': 'true',
};

module.exports = function withFrescoAnimatedWebp(config) {
  return withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = config.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        config.modResults.push({ type: 'property', key, value });
      }
    }
    return config;
  });
};
