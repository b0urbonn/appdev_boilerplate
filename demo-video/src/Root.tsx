import React from 'react';
import { Composition } from 'remotion';
import { Demo, TOTAL_FRAMES, DemoVariant } from './Demo';
import {
  SCENES_60,
  TOTAL_FRAMES_60,
  MUSIC_END_FADE_60,
  MUSIC_SRC_60,
} from './script60';

const VARIANT_60: DemoVariant = {
  scenes: SCENES_60,
  musicSrc: MUSIC_SRC_60,
  totalFrames: TOTAL_FRAMES_60,
  musicEndFade: MUSIC_END_FADE_60,
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="DemoPortrait"
        component={Demo}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Demo60"
        component={Demo}
        durationInFrames={TOTAL_FRAMES_60}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ variant: VARIANT_60 }}
      />
      <Composition
        id="Demo60Portrait"
        component={Demo}
        durationInFrames={TOTAL_FRAMES_60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ variant: VARIANT_60 }}
      />
    </>
  );
};
