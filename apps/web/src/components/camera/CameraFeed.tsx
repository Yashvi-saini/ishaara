import { CameraOff, LoaderCircle, RotateCcw } from "lucide-react";
import type { RefObject } from "react";
import type { CameraState, TrackingState } from "../../lib/camera/useSignalCamera";
import { cn } from "../../lib/cn";
import { Button } from "../ui";

const CAMERA_PROBLEMS: Record<Exclude<CameraState, "live" | "starting">, [string, string]> = {
  blocked: [
    "Camera access was blocked",
    "Allow the camera in your browser’s site settings, then try again.",
  ],
  missing: ["No camera found", "Connect a webcam, then try again."],
  busy: ["The camera is in use", "Close the other app that is using the camera, then try again."],
  insecure: [
    "Camera access needs a secure connection",
    "Open this page over https or on localhost.",
  ],
  error: ["The camera could not start", "Check the camera, then try again."],
};

export function CameraFeed({
  videoRef,
  canvasRef,
  camera,
  tracking,
  onRetryCamera,
  onRetryTracking,
  hero = false,
  problemSuffix,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  camera: CameraState;
  tracking: TrackingState;
  onRetryCamera: () => void;
  onRetryTracking: () => void;
  hero?: boolean;
  problemSuffix?: string;
}) {
  const failed = camera !== "live" && camera !== "starting";
  const trackingFailed = camera === "live" && tracking === "error";
  const covered = camera !== "live" || trackingFailed;
  const [title, detail] = failed
    ? CAMERA_PROBLEMS[camera]
    : ["Hand tracking could not load", "Check the connection, then try again."];

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Live camera preview, shown mirrored"
        className={cn(
          "absolute inset-0 size-full -scale-x-100 object-cover transition-opacity duration-500",
          camera === "live" ? "opacity-100" : "opacity-0",
        )}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover"
      />

      {covered && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center p-8 text-center",
            trackingFailed
              ? "bg-black/70 text-white"
              : hero
                ? "hero-gradient"
                : "bg-inverse text-white",
          )}
        >
          {camera === "starting" ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-white/90" />
              <p className="mt-4 text-[18px] font-medium tracking-[-0.03em]">
                Waiting for camera permission
              </p>
              <p className="mt-1.5 max-w-sm text-[13px] text-white/90">
                Your browser will ask to use the camera. Allow it to start watching.
              </p>
            </>
          ) : (
            <div role="alert" className="flex flex-col items-center">
              <CameraOff aria-hidden="true" className="size-7 text-white/90" />
              <p className="mt-4 text-[18px] font-medium tracking-[-0.03em]">{title}</p>
              <p className="mt-1.5 max-w-sm text-[13px] text-white/90">
                {detail}
                {problemSuffix ? ` ${problemSuffix}` : ""}
              </p>
              {camera !== "insecure" && (
                <Button
                  variant="light"
                  icon={RotateCcw}
                  className="mt-5"
                  onClick={failed ? onRetryCamera : onRetryTracking}
                >
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
