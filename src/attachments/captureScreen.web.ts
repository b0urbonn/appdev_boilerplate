/** Browser-owned chooser; tracks stop immediately after taking one frame. */
export async function captureScreen(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen capture is not supported in this browser. Attach a screenshot instead.');
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const video = document.createElement('video');
  try {
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!video.videoWidth || !video.videoHeight) throw new Error('No screen frame was returned. Try again.');
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screen capture is unavailable. Attach a screenshot instead.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { video.pause(); video.srcObject = null; stream.getTracks().forEach(track => track.stop()); }
}
