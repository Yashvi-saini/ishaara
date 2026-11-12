import { LoaderCircle, RotateCcw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { Card } from "./Card";

export function Notice({
  tone = "neutral",
  children,
  action,
  className,
}: {
  tone?: "neutral" | "accent" | "gold";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "accent" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] px-5 py-3.5 text-[14px] font-semibold",
        tone === "accent" && "bg-accent/12 text-accent-deep ring-1 ring-accent/30 dark:text-peach",
        tone === "gold" && "bg-gold/20 text-ink",
        tone === "neutral" && "bg-card text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]",
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function ServerProblem({
  loading,
  loadingText,
  error,
  onRetry,
}: {
  loading: boolean;
  loadingText: string;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      {loading ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-ink-3" />
          <p className="mt-4 text-[15px] font-semibold">{loadingText}</p>
        </>
      ) : (
        <div role="alert" className="flex flex-col items-center">
          <WifiOff aria-hidden="true" className="size-6 text-accent-ink" />
          <p className="mt-4 text-[19px] font-medium tracking-[-0.03em]">
            Cannot reach the Ishaara server
          </p>
          {error && <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">{error}</p>}
          <Button icon={RotateCcw} variant="ink" className="mt-5" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}
