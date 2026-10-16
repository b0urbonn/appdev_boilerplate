import React from 'react';
import {
  Series,
  Sequence,
  Audio,
  AbsoluteFill,
  staticFile,
} from 'remotion';
import { SCENES, TOTAL_FRAMES, MUSIC_END_FADE, SceneDef } from './script';
import { Caption } from './components/Caption';
import { Hook } from './scenes/Hook';
import { Intro } from './scenes/Intro';
import { Scan } from './scenes/Scan';
import { Detect } from './scenes/Detect';
import { Verdict } from './scenes/Verdict';
import { Monitor } from './scenes/Monitor';
import { Learn } from './scenes/Learn';
import { OnDevice } from './scenes/OnDevice';
import { Chat } from './scenes/Chat';
import { Trust } from './scenes/Trust';
import { Outro } from './scenes/Outro';

const SCENE_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  intro: Intro,
  scan: Scan,
  detect: Detect,
  verdict: Verdict,
  monitor: Monitor,
  learn: Learn,
  engine: OnDevice,
  chat: Chat,
  trust: Trust,
  outro: Outro,
};

export interface DemoVariant {
  scenes: SceneDef[];
  musicSrc: string;
  totalFrames: number;
  musicEndFade: number;
}

const DEFAULT_VARIANT: DemoVariant = {
  scenes: SCENES,
  musicSrc: 'audio/music.wav',
  totalFrames: TOTAL_FRAMES,
  musicEndFade: MUSIC_END_FADE,
};

export const Demo: React.FC<{ variant?: DemoVariant }> = ({
  variant = DEFAULT_VARIANT,
}) => {
  const { scenes, musicSrc, totalFrames, musicEndFade } = variant;
  return (
    <AbsoluteFill style={{ background: '#0E0E12' }}>
      {/* music bed — ducks under narration, swells at the outro, fades out */}
      <Audio
        src={staticFile(musicSrc)}
        volume={(f) => {
          const fadeIn = Math.min(1, f / 12);
          const fadeOut =
            f > musicEndFade ? Math.max(0, 1 - (f - musicEndFade) / 34) : 1;
          const outroLift = f > totalFrames - 150 ? 0.42 : 0.3;
          return outroLift * fadeIn * fadeOut;
        }}
      />
      <Series>
        {scenes.map((scene) => {
          const SceneComp = SCENE_COMPONENTS[scene.id];
          return (
            <Series.Sequence key={scene.id} durationInFrames={scene.frames}>
              <AbsoluteFill>
                <SceneComp />
                {/* narration */}
                <Sequence
                  from={scene.audioDelay}
                  durationInFrames={scene.frames - scene.audioDelay}
                >
                  <Audio src={staticFile(scene.audio)} volume={1} />
                </Sequence>
                {/* synced captions */}
                {scene.captions.map((cap, i) => (
                  <Caption key={i} text={cap.text} from={cap.from} to={cap.to} />
                ))}
              </AbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

export { TOTAL_FRAMES };
