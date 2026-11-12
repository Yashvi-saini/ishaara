import { Camera, Check, ExternalLink, Lock, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraFeed } from "../components/camera/CameraFeed";
import { SignalHand, useSignalLoop, type HandPose } from "../components/signal/SignalHand";
import { SignalStage } from "../components/signal/SignalStage";
import { SignalStageBar } from "../components/signal/SignalStageBar";
import { Button, Card, CardHead, Chip, Dashes, Deck, PageHead } from "../components/ui";
import { playChime, unlockAudio } from "../lib/audio";
import { useSignalCamera } from "../lib/camera/useSignalCamera";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/hooks";
import { useTilt } from "../lib/motion";

const PRACTICE_COOLDOWN_MS = 2000;
const FLASH_MS = 2400;

const STEPS: { pose: HandPose; title: string; body: string }[] = [
  {
    pose: 1,
    title: "Show your palm",
    body: "Hold your hand up to the camera, as if for a high-five.",
  },
  { pose: 2, title: "Tuck your thumb in", body: "Fold your thumb across your palm." },
  {
    pose: 3,
    title: "Fold your fingers down",
    body: "Close your fingers over your thumb, trapping it. Do it within two seconds.",
  },
];

const CAMPUS = [
  "A camera at a help point sees the signal.",
  "Security is alerted with the location and one snapshot.",
  "Guards are rung one at a time, nearest first, until one confirms.",
  "The guard checks in calmly. Police are called only if she asks or there is danger.",
];

const BYSTANDER = [
  "Reach out safely, without alerting the person she is with.",
  "Ask yes-or-no questions, such as “Do you want me to call security?”",
  "Call 112 if she asks for police or is in immediate danger.",
];

export function LearnPage() {
  useDocumentTitle("Learn the signal");
  return (
    <>
      <PageHead
        title="Learn the signal"
        chip={<Chip tone="soft">Ten seconds to learn</Chip>}
        lede="One hand movement that asks for help without a phone or a word."
      />

      <ol className="stagger grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <StepCard key={step.title} step={step} index={index} />
        ))}
      </ol>
      <p className="mt-4 px-2 text-[13px] text-ink-2">
        It is one smooth movement, not a held pose. Ishaara looks for the tucked-thumb palm and then
        the closed hand, in that order.
      </p>

      <div className="stagger mt-8 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Practice />

        <div className="stagger flex flex-col gap-3.5 lg:col-span-5">
          <Card className="p-6">
            <CardHead title="What happens on campus" />
            <ol className="mt-5 flex flex-col">
              {CAMPUS.map((text, index) => (
                <li key={text} className="relative flex gap-4 pb-5 last:pb-0">
                  {index < CAMPUS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-9 left-[15px] h-[calc(100%-2.5rem)] w-px bg-line"
                    />
                  )}
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold",
                      index === 0 ? "bg-accent-fill text-white" : "bg-sunken text-ink",
                    )}
                  >
                    {index + 1}
                  </span>
                  <p className="pt-1.5 text-[14px] leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-6">
            <CardHead title="If you see someone make it" />
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {BYSTANDER.map((text) => (
                <li key={text} className="flex gap-3 py-3 text-[14px] leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <p className="mt-8 px-2 text-[13px] text-ink-3">
        The Signal for Help was created by the{" "}
        <a
          href="https://canadianwomen.org/signal-for-help/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md font-semibold text-ink-2 underline underline-offset-4 hover:text-accent-ink"
        >
          Canadian Women’s Foundation
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        .
      </p>
    </>
  );
}

function StepCard({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const dark = index === 2;
  const tilt = useTilt<HTMLElement>(7);
  return (
    <Card
      ref={tilt}
      as="li"
      notch={
        <Chip tone="outline" size="sm" className="bg-card">
          Step {index + 1}
        </Chip>
      }
      className="tilt flex flex-col p-3"
    >
      <div
        className={cn(
          "relative isolate flex aspect-[5/4] items-end justify-center overflow-hidden rounded-[18px]",
          dark
            ? "bg-inverse"
            : "bg-[radial-gradient(circle_at_50%_76%,var(--card)_0%,var(--sunken)_66%)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "tilt-layer absolute inset-x-[14%] bottom-[10%] h-[55%] rounded-full blur-3xl [--depth:-10px]",
            dark ? "bg-accent/20" : "bg-white/70 dark:bg-white/[0.04]",
          )}
        />
        {dark && <span aria-hidden="true" className="tilt-sheen" />}
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-5 left-5 text-[11px] font-bold tracking-[0.14em] uppercase",
            dark ? "text-white/60" : "text-ink-3",
          )}
        >
          Form 0{index + 1}
        </span>
        <span
          aria-hidden="true"
          className={cn("absolute top-5 right-5 h-px w-12", dark ? "bg-white/20" : "bg-ink/15")}
        />
        <SignalHand
          pose={step.pose}
          tone={dark ? "light" : "ink"}
          animate={false}
          className="tilt-layer relative z-10 h-[84%] translate-y-[10%] [--depth:16px]"
        />
      </div>
      <div className="flex flex-1 flex-col p-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium tracking-[-0.035em]">{step.title}</h2>
          <Dashes filled={index + 1} />
        </div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{step.body}</p>
      </div>
    </Card>
  );
}

function Practice() {
  const [running, setRunning] = useState(false);
  const [recognised, setRecognised] = useState(0);
  const pose = useSignalLoop(!running);

  return (
    <Deck className="lg:col-span-7">
      <Card tone="inverse" className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-medium tracking-[-0.04em]">
              Practise with your camera
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-inverse-ink-2">
              <Lock aria-hidden="true" className="size-3.5" /> Practice stays on this device.
              Nothing is sent to security.
            </p>
          </div>
          {recognised > 0 && (
            <Chip tone="gold">
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> Recognised{" "}
              {recognised}×
            </Chip>
          )}
        </div>

        <div className="relative mt-6 aspect-[16/10] overflow-hidden rounded-[18px] bg-white/[0.04]">
          {running ? (
            <PracticeFeed onRecognised={() => setRecognised((count) => count + 1)} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center sm:p-8">
              <SignalHand pose={pose} tone="light" className="h-24 sm:hidden" />
              <div className="hidden w-full max-w-[380px] sm:block">
                <SignalStage pose={pose} frame={false} />
              </div>
              <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-inverse-ink-2 sm:text-[14px]">
                Your browser will ask to use the camera. Make the signal and the page will say
                “Recognised” when it sees it.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {running ? (
            <Button
              variant="outline-inverse"
              icon={Square}
              size="lg"
              onClick={() => setRunning(false)}
            >
              Stop practice
            </Button>
          ) : (
            <Button
              variant="accent"
              icon={Camera}
              size="lg"
              onClick={() => {
                void unlockAudio();
                setRunning(true);
              }}
            >
              Start practice
            </Button>
          )}
          <span className="text-[12px] text-inverse-ink-2">
            Palm, thumb in, fingers down. One smooth movement.
          </span>
        </div>
      </Card>
    </Deck>
  );
}

function PracticeFeed({ onRecognised }: { onRecognised: () => void }) {
  const [flash, setFlash] = useState(false);
  const timer = useRef(0);

  const onSignal = useCallback(() => {
    onRecognised();
    setFlash(true);
    playChime();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(false), FLASH_MS);
  }, [onRecognised]);

  const camera = useSignalCamera({
    cooldownMs: PRACTICE_COOLDOWN_MS,
    showTracking: true,
    onSignal,
  });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <CameraFeed
        videoRef={camera.videoRef}
        canvasRef={camera.canvasRef}
        camera={camera.camera}
        tracking={camera.tracking}
        onRetryCamera={camera.retryCamera}
        onRetryTracking={camera.retryTracking}
      />
      {camera.camera === "live" && camera.tracking === "loading" && (
        <span className="glass-dark absolute top-4 left-4 inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white">
          Loading hand model
        </span>
      )}
      {camera.camera === "live" && camera.tracking === "ready" && (
        <SignalStageBar
          status={camera.view.status}
          handsInView={camera.view.handsInView}
          doneText="Recognised"
          className="absolute inset-x-4 bottom-4"
        />
      )}
      {flash && (
        <div
          role="status"
          className="hero-gradient absolute inset-0 flex animate-rise flex-col items-center justify-center p-6 text-center"
        >
          <span className="flex size-16 animate-burst items-center justify-center rounded-full bg-white text-accent-ink">
            <Check aria-hidden="true" className="size-8" strokeWidth={3} />
          </span>
          <p className="mt-5 text-[30px] font-medium tracking-[-0.045em]">Recognised</p>
          <p className="mt-1 text-[14px] text-white/90">
            That is the Signal for Help. Nothing was sent.
          </p>
          <Button
            variant="glass"
            size="sm"
            icon={RotateCcw}
            className="mt-5"
            onClick={() => {
              window.clearTimeout(timer.current);
              camera.resetDetector();
              setFlash(false);
            }}
          >
            Practise again
          </Button>
        </div>
      )}
    </>
  );
}
