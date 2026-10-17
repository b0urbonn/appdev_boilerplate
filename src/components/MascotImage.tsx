import { Asset } from 'expo-asset';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MASCOT_POSTER } from '@/generated/mascotPoster';
import { useReduceMotion } from '@/components/AccessibilityPreferences';

const ANIMATION = require('../../assets/images/mascot-animation.webp');
const animationAsset = Asset.fromModule(ANIMATION);

let animationDownload: Promise<ImageSourcePropType> | null = null;
let webAnimationReady = false;

function getReadyAnimationSource(): ImageSourcePropType | null {
  if (Platform.OS === 'web') return webAnimationReady ? ANIMATION : null;
  if (Platform.OS !== 'android') return ANIMATION;
  if (animationAsset.localUri) return { uri: animationAsset.localUri };
  if (animationAsset.uri.startsWith('file:///android_res/')) return ANIMATION;
  return null;
}

function preloadAnimation(): Promise<ImageSourcePropType> {
  const readySource = getReadyAnimationSource();
  if (readySource) return Promise.resolve(readySource);

  animationDownload ??= (Platform.OS === 'web'
    ? Image.prefetch(animationAsset.uri).then(() => {
      webAnimationReady = true;
      return ANIMATION;
    })
    : animationAsset.downloadAsync().then(() => getReadyAnimationSource() ?? ANIMATION))
    .catch((error) => {
      animationDownload = null;
      console.warn('Unable to preload the mascot animation:', error);
      throw error;
    });
  return animationDownload;
}

/** Cache the animation during startup; the first pose is already in the bundle. */
export function preloadMascotAssets(): void {
  void preloadAnimation().catch(() => {});
}

function MascotAnimation({ source }: { source: ImageSourcePropType }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <Image source={MASCOT_POSTER} style={styles.image} resizeMode="contain" accessible={false} fadeDuration={0} />
      )}
      <Image
        source={source}
        style={[styles.image, { opacity: loaded ? 1 : 0 }]}
        resizeMode="contain"
        accessible={false}
        fadeDuration={0}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </>
  );
}

/** Draw the first pose immediately and decode animation only on the active Home screen. */
export function MascotImage({
  style,
  accessibilityLabel,
}: {
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}) {
  const [animationSource, setAnimationSource] = useState<ImageSourcePropType | null>(getReadyAnimationSource);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const reduceMotion = useReduceMotion();
  const shouldAnimate = focused && foreground && !reduceMotion;

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!shouldAnimate) return;
    let mounted = true;
    void preloadAnimation()
      .then((source) => {
        if (mounted) setAnimationSource(source);
      })
      .catch(() => {
        // Keep the bundled first pose visible if the tunnel is unavailable.
      });
    return () => { mounted = false; };
  }, [shouldAnimate]);

  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {shouldAnimate && animationSource ? (
        <MascotAnimation source={animationSource} />
      ) : (
        <Image
          source={MASCOT_POSTER}
          style={styles.image}
          resizeMode="contain"
          accessible={false}
          fadeDuration={0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Override Image's intrinsic asset dimensions on web and native.
    width: '100%',
    height: '100%',
  },
});
