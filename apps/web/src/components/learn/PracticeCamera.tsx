import { CheckCircle2, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { useSignalCamera } from "../../lib/camera/useSignalCamera";
import { cn } from "../../lib/cn";
import { useStoredFlag } from "../../lib/storage";
import { CameraViewport } from "../camera/CameraViewport";
import { Button, StatusDot, Toggle } from "../ui";

const PRACTICE_COOLDOWN_MS = 2000;

export function PracticeCamera() {
  const [showTracking, setShowTracking] = useStoredFlag("ishaara.learn.showTracking", true);
  const [recognisedCount, setRecognisedCount] = useState(0);
  const [recognised, setRecognised] = useState(false);

  const onSignal = useCallback(() => {
    setRecognised(true);
    setRecognisedCount((count) => count + 1);
  }, []);

  const camera = useSignalCamera({
    cooldownMs: PRACTICE_COOLDOWN_MS,
    showTracking,
    onSignal,
  });

  function again() {
    camera.resetDetector();
    setRecognised(false);
  }

  function prompt() {
    if (camera.camera !== "live" || camera.tracking !== "ready") {
      return <StatusDot tone="neutral">Getting the camera ready</StatusDot>;
    }
    if (camera.view.status === "step1") {
      return (
        <StatusDot tone="ringing" strong>
          Step 1 seen. Now fold your fingers down over your thumb
        </StatusDot>
      );
    }
    if (camera.view.handsInView === 0) {
      return <StatusDot tone="accent">Hold one hand up to the camera</StatusDot>;
    }
    return <StatusDot tone="accent">Show your palm with your thumb tucked in</StatusDot>;
  }

  return (
    <div className="flex flex-col">
      <div className="relative">
        <CameraViewport
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
          camera={camera.camera}
          tracking={camera.tracking}
          onRetryCamera={camera.retryCamera}
          onRetryTracking={camera.retryTracking}
        />
        {recognised && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/95 px-6 text-center"
          >
            <CheckCircle2 size={20} aria-hidden="true" className="text-ok" />
            <p className="text-2xl font-semibold text-ok">Recognised</p>
            <p className="max-w-sm text-sm text-ink-muted">
              That is the Signal for Help. On campus, a camera like this one would now alert
              security.
            </p>
            <Button icon={RotateCcw} onClick={again}>
              Practise again
            </Button>
          </div>
        )}
      </div>
      <div
        aria-live="polite"
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm",
          recognised && "invisible",
        )}
      >
        {prompt()}
        {recognisedCount > 0 && (
          <span className="text-ink-muted tabular-nums">Recognised {recognisedCount} times</span>
        )}
      </div>
      <div className="border-t border-line px-4 py-3">
        <Toggle
          label="Show tracking"
          hint="Draws the hand points the camera sees."
          checked={showTracking}
          onChange={setShowTracking}
        />
      </div>
    </div>
  );
}
