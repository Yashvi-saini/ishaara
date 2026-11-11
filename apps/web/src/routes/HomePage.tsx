import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Camera,
  Check,
  Hand,
  LayoutDashboard,
  Smartphone,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router";
import { Card, PageHeader } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";

const steps: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: Hand,
    title: "She makes the signal",
    detail:
      "Palm to the camera with the thumb tucked in, then fingers folded over it. No phone, no words.",
  },
  {
    icon: BellRing,
    title: "The camera alerts security",
    detail:
      "The camera recognises the two shapes in order and sends one snapshot with its location.",
  },
  {
    icon: UserCheck,
    title: "A guard confirms",
    detail:
      "Guards are rung one at a time, nearest first, until one taps “I’m going”. Then they check in calmly.",
  },
];

const surfaces: { to: string; icon: LucideIcon; name: string; who: string; detail: string }[] = [
  {
    to: "/eye",
    icon: Camera,
    name: "Ishaara Eye",
    who: "Any camera device",
    detail: "Watches a camera for the signal.",
  },
  {
    to: "/command",
    icon: LayoutDashboard,
    name: "Ishaara Command",
    who: "Security room",
    detail: "Campus map, live alerts and who is responding.",
  },
  {
    to: "/guard",
    icon: Smartphone,
    name: "Guard app",
    who: "Guards, on a phone",
    detail: "Rings on an alert. One tap to confirm.",
  },
  {
    to: "/learn",
    icon: BookOpen,
    name: "Learn",
    who: "Students",
    detail: "The signal in three steps, with practice.",
  },
];

const promises = [
  "No faces are identified. The model only finds hand points.",
  "No video is recorded. One snapshot is sent, only after the signal.",
  "Police are never called automatically. A person always decides.",
];

export function HomePage() {
  useDocumentTitle("Ishaara");
  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader title="Ishaara" description="Help without saying a word." />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
        <p className="max-w-3xl text-base text-ink">
          Ishaara lets a woman ask for help silently, with one hand sign made towards a camera that
          is already there. The camera recognises the international Signal for Help, and campus
          security keeps ringing guards until one confirms they are on the way.
        </p>

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-base font-semibold text-ink">
            How it works
          </h2>
          <ol className="mt-3 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <step.icon size={18} aria-hidden="true" className="text-accent" />
                    <span className="tabular-nums">Step {index + 1}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{step.detail}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="open-heading">
          <h2 id="open-heading" className="text-base font-semibold text-ink">
            Open a screen
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {surfaces.map((surface) => (
              <li key={surface.to}>
                <Link
                  to={surface.to}
                  className="group flex h-full flex-col rounded-md border border-line bg-surface p-4 hover:border-accent"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-base font-semibold text-ink">
                      <surface.icon size={18} aria-hidden="true" className="text-accent" />
                      {surface.name}
                    </span>
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="text-ink-faint group-hover:text-accent"
                    />
                  </span>
                  <span className="mt-1 text-sm text-ink-muted">{surface.detail}</span>
                  <span className="mt-3 text-sm text-ink-faint">{surface.who}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privacy-heading">
          <Card title={<span id="privacy-heading">Privacy and safety</span>}>
            <ul className="flex flex-col gap-2">
              {promises.map((promise) => (
                <li key={promise} className="flex items-start gap-2 text-sm text-ink">
                  <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ok" />
                  {promise}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <footer className="border-t border-line pt-4 pb-8 text-sm text-ink-muted">
          Built for HerHack 2026. The Signal for Help was created by the{" "}
          <a
            href="https://canadianwomen.org/signal-for-help/"
            target="_blank"
            rel="noreferrer"
            className="rounded-md text-accent underline underline-offset-2"
          >
            Canadian Women’s Foundation
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
