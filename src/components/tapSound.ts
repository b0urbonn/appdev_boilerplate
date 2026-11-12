import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let enabled = true;
let pendingTap = false;

function playLoadedTap() {
  if (!player) return;
  if (!player.isLoaded) {
    pendingTap = true;
    return;
  }

  pendingTap = false;
  void player.seekTo(0)
    .then(() => player?.play())
    .catch(error => console.warn('Unable to play tap sound:', error));
}

export function setTapSoundEnabled(value: boolean) {
  enabled = value;
}

export function playTapSound() {
  if (!enabled) return;

  try {
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/tap.wav'));
      player.volume = 0.16;
      player.addListener('playbackStatusUpdate', status => {
        if (status.isLoaded && pendingTap) playLoadedTap();
        if (status.error) console.warn('Tap sound playback error:', status.error);
      });
    }

    playLoadedTap();
  } catch (error) {
    console.warn('Unable to initialize tap sound:', error);
  }
}
