import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  hint?: ReactNode;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Select({ label, hint, value, options, onChange, disabled = false }: SelectProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={hint !== undefined ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-line-strong bg-surface pr-9 pl-3 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
        />
      </div>
      {hint !== undefined && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
