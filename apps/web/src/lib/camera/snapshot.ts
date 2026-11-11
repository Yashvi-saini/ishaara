const MAX_WIDTH = 640;
const QUALITY = 0.75;

export function captureSnapshot(video: HTMLVideoElement | null): string | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  return dataUrl.startsWith("data:image/jpeg") ? dataUrl : null;
}
