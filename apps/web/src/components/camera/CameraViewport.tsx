import { CameraOff, LoaderCircle, RotateCcw } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "../../lib/cn";
import type { CameraState, TrackingState } from "../../lib/camera/useSignalCamera";
import { Button } from "../ui";

const cameraMessages: Record<Exclude<CameraState, "live" | "starting">, string> = {
  blocked: "Camera blocked. Allow camera access in your browser settings, then try again.",
  missing: "No camera found. Connect a webcam, then try again.",
  busy: "The camera is in use by another app. Close that app, then try again.",
  insecure: "Camera access needs a secure connection. Open this page over https or on localhost.",
  error: "The camera could not start. Try again.",
};

export interface CameraViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  camera: CameraState;
  tracking: TrackingState;
  onRetryCamera: () => void;
  onRetryTracking: () => void;
  className?: string;
}

export function CameraViewport({
  videoRef,
  canvasRef,
  camera,
  tracking,
  onRetryCamera,
  onRetryTracking,
  className,
}: CameraViewportProps) {
  const failed = camera !== "live" && camera !== "starting";
  const loading = camera === "starting" || (camera === "live" && tracking === "loading");
  const trackingFailed = camera === "live" && tracking === "error";

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-ink", className)}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Live camera preview, shown mirrored"
        className="h-full w-full -scale-x-100 object-contain"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-contain"
      />

      {loading && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/80 px-4 py-2 text-sm text-on-accent">
          <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
          {camera === "starting" ? "Starting camera" : "Loading hand tracking"}
        </div>
      )}

      {(failed || trackingFailed) && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-on-accent"
        >
          <CameraOff size={20} aria-hidden="true" />
          <p className="max-w-sm text-sm">
            {failed
              ? cameraMessages[camera as keyof typeof cameraMessages]
              : "Hand tracking could not load. Check the connection, then try again."}
          </p>
          <Button icon={RotateCcw} onClick={failed ? onRetryCamera : onRetryTracking}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
