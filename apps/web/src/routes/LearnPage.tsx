import { Camera, ExternalLink } from "lucide-react";
import { useState } from "react";
import { HandIllustration, type HandStep } from "../components/learn/HandIllustration";
import { PracticeCamera } from "../components/learn/PracticeCamera";
import { Button, Card, PageHeader } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";

const STEPS: { step: HandStep; title: string; detail: string }[] = [
  {
    step: 1,
    title: "Show your palm",
    detail: "Hold your hand up to the camera, as if for a high-five.",
  },
  { step: 2, title: "Tuck your thumb in", detail: "Fold your thumb across your palm." },
  {
    step: 3,
    title: "Fold your fingers down",
    detail: "Close your fingers over your thumb, trapping it. Do it within two seconds.",
  },
];

export function LearnPage() {
  useDocumentTitle("Learn the signal");
  const [practising, setPractising] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader
        title="Learn the Signal for Help"
        description="One hand movement that asks for help without a phone or a word. It takes ten seconds to learn."
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex max-w-4xl flex-col gap-6">
          <section aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="sr-only">
              The three steps
            </h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((item) => (
                <li key={item.step}>
                  <Card className="h-full">
                    <div className="mx-auto w-32 sm:w-36">
                      <HandIllustration step={item.step} />
                    </div>
                    <p className="mt-4 text-sm text-ink-muted tabular-nums">Step {item.step}</p>
                    <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
                  </Card>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-muted">
              It is one smooth movement, not a held pose. Ishaara looks for the tucked-thumb palm
              and then the closed hand, in that order.
            </p>
          </section>

          <Card
            title="Practise with your camera"
            description="Practice stays on this device. Nothing is sent to security."
            padded={!practising}
          >
            {practising ? (
              <PracticeCamera />
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-ink-muted">
                  Your browser will ask to use the camera. Make the signal and the page will say
                  “Recognised” when it sees it.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  icon={Camera}
                  onClick={() => setPractising(true)}
                >
                  Start practice
                </Button>
              </div>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="What happens on campus">
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink">
                <li>A camera at a help point sees the signal.</li>
                <li>Security is alerted with the location and one snapshot.</li>
                <li>Guards are rung until one confirms they are on the way.</li>
                <li>
                  The guard checks in calmly. Police are called if you ask or there is danger.
                </li>
              </ol>
            </Card>
            <Card title="If you see someone make it">
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
                <li>Reach out safely, without alerting the person she is with.</li>
                <li>Ask yes-or-no questions, such as “Do you want me to call 112?”</li>
                <li>Let her lead. Call 112 if she asks or you see danger.</li>
              </ul>
            </Card>
          </div>

          <p className="text-sm text-ink-muted">
            The Signal for Help was created by the{" "}
            <a
              href="https://canadianwomen.org/signal-for-help/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md text-accent underline underline-offset-2"
            >
              Canadian Women’s Foundation
              <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
