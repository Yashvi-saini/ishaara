import { useId, type ReactNode } from "react";

export interface ToggleProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, hint, checked, onChange, disabled = false }: ToggleProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint !== undefined && (
          <p id={hintId} className="text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>
      <span className="relative mt-0.5 inline-flex h-6 w-10 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint !== undefined ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full border border-line-strong bg-sunken transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 left-1 size-4 rounded-full border border-line-strong bg-surface transition-transform peer-checked:translate-x-4 peer-checked:border-surface"
        />
      </span>
    </div>
  );
}
