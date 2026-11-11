import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";
export type ButtonSize = "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-on-accent hover:border-accent-strong hover:bg-accent-strong",
  secondary: "border-line-strong bg-surface text-ink hover:bg-sunken",
  danger: "border-alert bg-alert text-on-accent hover:border-alert-strong hover:bg-alert-strong",
  quiet: "border-transparent bg-transparent text-accent hover:bg-accent-soft",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-9 px-3 text-sm",
  lg: "h-11 px-4 text-base",
  xl: "h-16 px-6 text-xl",
};

const iconSizes: Record<ButtonSize, number> = { md: 16, lg: 18, xl: 20 };

export function buttonClasses(
  options: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {},
): string {
  const { variant = "secondary", size = "md", fullWidth = false } = options;
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export function Button({
  variant,
  size = "md",
  icon: Icon,
  fullWidth,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {Icon && <Icon size={iconSizes[size]} aria-hidden="true" />}
      {children}
    </button>
  );
}
