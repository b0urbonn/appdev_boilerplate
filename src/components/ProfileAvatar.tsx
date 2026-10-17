import { createAvatar } from '@dicebear/core';
import * as micah from '@dicebear/micah';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface AvatarOption {
  id: string;
  name: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'kai', name: 'Kai' },
  { id: 'felix', name: 'Felix' },
  { id: 'aneka', name: 'Aneka' },
  { id: 'oliver', name: 'Oliver' },
  { id: 'luna', name: 'Luna' },
  { id: 'milo', name: 'Milo' },
  { id: 'maya', name: 'Maya' },
  { id: 'leo', name: 'Leo' },
  { id: 'zoe', name: 'Zoe' },
  { id: 'jasper', name: 'Jasper' },
  { id: 'nala', name: 'Nala' },
  { id: 'oscar', name: 'Oscar' },
  { id: 'bella', name: 'Bella' },
  { id: 'charlie', name: 'Charlie' },
  { id: 'daisy', name: 'Daisy' },
  { id: 'sam', name: 'Sam' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'cleo', name: 'Cleo' },
  { id: 'archie', name: 'Archie' },
  { id: 'willow', name: 'Willow' },
  { id: 'toby', name: 'Toby' },
  { id: 'sasha', name: 'Sasha' },
  { id: 'elena', name: 'Elena' },
  { id: 'mateo', name: 'Mateo' },
  { id: 'amara', name: 'Amara' },
  { id: 'ezra', name: 'Ezra' },
  { id: 'kiran', name: 'Kiran' },
  { id: 'yuki', name: 'Yuki' },
  { id: 'harper', name: 'Harper' },
  { id: 'dante', name: 'Dante' },
  { id: 'quinn', name: 'Quinn' },
  { id: 'rowan', name: 'Rowan' },
];

export function getAvatarOption(id?: string): AvatarOption {
  if (!id) return AVATAR_OPTIONS[0];
  const found = AVATAR_OPTIONS.find((option) => option.id === id);
  if (found) return found;
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
  };
}

const PASTEL_BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];
const svgCache = new Map<string, string>();

/** Generates clean, offline DiceBear Micah avatar SVG markup */
export function generateMicahSvg(seed: string): string {
  const cacheKey = seed || 'felix';
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const avatar = createAvatar(micah, {
    seed: cacheKey,
    backgroundColor: PASTEL_BACKGROUNDS,
  });

  const svg = avatar
    .toString()
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/style="mix-blend-mode:multiply"/gi, 'opacity="0.18"')
    .replace(/<svg\b([^>]*)>/i, '<svg$1 width="100%" height="100%">');

  svgCache.set(cacheKey, svg);
  return svg;
}

/**
 * Micah avatar profile icon from DiceBear (https://www.dicebear.com/styles/micah/).
 * Generated fully offline; SvgXml renders it on both native and web.
 */
export function ProfileAvatar({
  avatarId,
  size = 64,
}: {
  avatarId?: string;
  size?: number;
}) {
  const seed = avatarId || 'kai';
  const svgXml = useMemo(() => generateMicahSvg(seed), [seed]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {Platform.OS === 'web' ? (
        <svg
          aria-hidden="true"
          width={size}
          height={size}
          viewBox="0 0 360 360"
          dangerouslySetInnerHTML={{ __html: svgXml.replace(/<svg\b[^>]*>|<\/svg>/gi, '') }}
        />
      ) : (
        <SvgXml
          xml={svgXml}
          width={size}
          height={size}
          fallback={
            <View
              style={[
                styles.fallback,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                },
              ]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: '#d1d4f9',
  },
});
