import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BellRing,
  BookOpen,
  Camera,
  Check,
  Hand,
  LayoutGrid,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router";
import { useSignalLoop } from "../components/signal/SignalHand";
import { SignalStage } from "../components/signal/SignalStage";
import {
  Card,
  CheckBadge,
  Chip,
  CountUp,
  Dashes,
  Deck,
  IconTile,
  PageHead,
} from "../components/ui";
import { isOpen } from "../lib/alerts";
import { useAppState } from "../lib/appState";
import { cn } from "../lib/cn";
import { formatLongDate } from "../lib/format";
import { useDocumentTitle, useNow } from "../lib/hooks";
import { useTilt } from "../lib/motion";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Hand,
    title: "She makes the signal",
    body: "Palm to the camera with the thumb tucked in, then fingers folded over it. No phone, no words.",
  },
  {
    icon: BellRing,
    title: "The camera alerts security",
    body: "The camera recognises the two shapes in order and sends one snapshot with its location.",
  },
  {
    icon: UserCheck,
    title: "A guard confirms",
    body: "Guards are rung one at a time, nearest first, until one taps “I’m going”. Then they check in calmly.",
  },
];

const SCREENS: { to: string; icon: LucideIcon; title: string; body: string; who: string }[] = [
  {
    to: "/eye",
    icon: Camera,
    title: "Ishaara Eye",
    body: "Watches a camera for the signal.",
    who: "Any camera device",
  },
  {
    to: "/command",
    icon: LayoutGrid,
    title: "Ishaara Command",
    body: "Campus map, live alerts and who is responding.",
    who: "Security room",
  },
  {
    to: "/guard",
    icon: Smartphone,
    title: "Guard app",
    body: "Rings on an alert. One tap to confirm.",
    who: "Guards, on a phone",
  },
  {
    to: "/learn",
    icon: BookOpen,
    title: "Learn",
    body: "The signal in three steps, with practice.",
    who: "Students",
  },
];

const PRIVACY = [
  "No faces are identified. The model only finds hand points.",
  "No video is recorded. One snapshot is sent, only after the signal.",
  "Police are never called automatically. A person always decides.",
];

export function HomePage() {
  useDocumentTitle("Ishaara");
  const now = useNow(60_000);
  const pose = useSignalLoop();
  const tilt = useTilt<HTMLElement>(5);

  return (
    <>
      <PageHead title="Overview" chip={<Chip>{formatLongDate(now)}</Chip>} />

      <div className="stagger grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card
          ref={tilt}
          tone="hero"
          className="tilt grid min-h-0 grid-cols-1 gap-6 p-6 sm:grid-cols-12 sm:p-7 lg:col-span-7"
        >
          <span aria-hidden="true" className="tilt-sheen" />
          <div className="tilt-layer flex flex-col justify-between gap-6 [--depth:6px] sm:col-span-7">
            <div>
              <Chip tone="glass">International Signal for Help</Chip>
              <h2 className="mt-5 max-w-[13ch] text-[38px] leading-[1.03] font-medium tracking-[-0.05em] text-balance sm:text-[46px]">
                Help without saying a word.
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-pretty text-white/90">
                Ishaara lets a woman ask for help silently, with one hand sign made towards a camera
                that is already there. The camera recognises the international Signal for Help, and
                campus security keeps ringing guards until one confirms they are on the way.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                to="/learn"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold whitespace-nowrap text-on-light transition hover:bg-white/90"
              >
                Learn the signal <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                to="/command"
                className="glass-chip inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold whitespace-nowrap text-white transition hover:bg-white/25"
              >
                Open Command
              </Link>
            </div>
          </div>

          <SignalStage pose={pose} className="sm:col-span-5" />
        </Card>

        <Deck className="lg:col-span-5">
          <Card tone="inverse" className="flex h-full flex-col p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-medium tracking-[-0.035em]">Open a screen</h2>
              <Chip tone="gold">4 screens</Chip>
            </div>
            <ul className="mt-5 flex flex-1 flex-col">
              {SCREENS.map((screen) => (
                <li
                  key={screen.to}
                  className="flex flex-1 items-center border-t border-white/[0.07] first:border-t-0"
                >
                  <Link
                    to={screen.to}
                    className="group flex w-full items-center gap-4 rounded-md py-4"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.07] text-inverse-ink transition-colors group-hover:bg-accent-fill group-hover:text-white">
                      <screen.icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold tracking-[-0.02em]">
                        {screen.title}
                      </span>
                      <span className="block text-[13px] text-pretty text-inverse-ink-2">
                        {screen.body}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-[12px] font-medium text-inverse-ink-2 sm:block">
                      {screen.who}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-inverse-ink-2 transition-[translate,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Deck>

        <CampusNow />

        <Card className="p-6 lg:col-span-7">
          <div className="flex items-center gap-3">
            <IconTile icon={ShieldCheck} size="sm" />
            <h2 className="text-[19px] font-medium tracking-[-0.03em]">Privacy and safety</h2>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {PRIVACY.map((promise) => (
              <li key={promise} className="flex items-center gap-3.5 py-3.5">
                <CheckBadge>
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </CheckBadge>
                <span className="text-[14px] font-medium">{promise}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-6 flex items-end justify-between lg:col-span-12">
          <h2 className="text-[24px] font-medium tracking-[-0.04em]">How it works</h2>
          <span className="text-[13px] text-ink-3">One movement, three moments</span>
        </div>
        {STEPS.map((step, index) => (
          <Card
            key={step.title}
            as="article"
            tab={false}
            notch={
              <Chip tone="outline" size="sm" className="bg-card">
                Step {index + 1}
              </Chip>
            }
            className="flex min-h-[230px] flex-col p-6 lg:col-span-4"
          >
            <IconTile icon={step.icon} />
            <h3 className="mt-5 text-[20px] font-medium tracking-[-0.035em]">{step.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-pretty text-ink-2">{step.body}</p>
            <div className="mt-auto flex items-end justify-end pt-6">
              <Dashes filled={index + 1} />
            </div>
          </Card>
        ))}
      </div>

      <footer className="mt-10 px-2 text-[13px] text-ink-3">
        Built for HerHack 2026. The Signal for Help was created by the{" "}
        <a
          href="https://canadianwomen.org/signal-for-help/"
          target="_blank"
          rel="noreferrer"
          className="rounded-md font-semibold text-ink-2 underline underline-offset-4 hover:text-accent-ink"
        >
          Canadian Women’s Foundation
        </a>
        .
      </footer>
    </>
  );
}

function CampusNow() {
  const app = useAppState();
  const data = app.data;
  const cameras = data?.cameras ?? [];
  const online = data?.camerasOnline ?? [];
  const active = data?.alerts.filter(isOpen).length ?? 0;
  const resolved = data?.alerts.filter((alert) => alert.status === "resolved").length ?? 0;
  const metrics = [
    { label: "Cameras watching", value: online.length, of: `/${cameras.length}`, hot: false },
    {
      label: "Guards on shift",
      value: data?.guardsOnShift.length ?? 0,
      of: `/${data?.guards.length ?? 0}`,
      hot: false,
    },
    {
      label: active ? "Active alerts" : "Resolved",
      value: active || resolved,
      of: "",
      hot: active > 0,
    },
  ];

  return (
    <Card className="p-6 lg:col-span-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-medium tracking-[-0.03em]">Campus right now</h2>
        <Link
          to="/command"
          className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-ink-2 hover:text-accent-ink"
        >
          Command <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      {data ? (
        <>
          <dl className="mt-6 grid grid-cols-3 divide-x divide-line">
            {metrics.map((metric) => (
              <div key={metric.label} className="px-4 first:pl-0">
                <dt className="text-[12px] font-medium text-ink-2">{metric.label}</dt>
                <dd
                  className={cn(
                    "mt-3 text-[32px] leading-none font-bold tracking-[-0.05em] tabular",
                    metric.hot && "text-accent-ink",
                  )}
                >
                  <CountUp value={metric.value} />
                  <span className="text-[16px] font-semibold text-ink-3">{metric.of}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden="true">
            {cameras.map((camera) => (
              <span
                key={camera.id}
                className={cn(
                  "flex-1 rounded-full",
                  online.includes(camera.id) ? "bg-accent" : "bg-ink/10 dark:bg-white/10",
                )}
              />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-3">Each bar is one help-point camera.</p>
        </>
      ) : (
        <p className="mt-6 rounded-[18px] bg-sunken px-4 py-6 text-center text-[13px] text-ink-2">
          {app.status === "error"
            ? "Cannot reach the Ishaara server right now."
            : "Loading the campus status"}
        </p>
      )}
    </Card>
  );
}
