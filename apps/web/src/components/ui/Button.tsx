import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "ink" | "accent" | "ghost" | "glass" | "light" | "outline-inverse";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const variants: Record<ButtonVariant, string> = {
  ink: "bg-ink text-shell hover:bg-ink/85",
  accent:
    "bg-accent-fill text-white hover:bg-accent-fill-hover shadow-[0_10px_30px_-12px_var(--accent)]",
  ghost: "bg-sunken text-ink hover:bg-ink/10",
  glass: "glass-chip text-white hover:bg-white/25",
  light: "bg-white text-on-light hover:bg-white/90",
  "outline-inverse": "bg-white/[0.06] text-inverse-ink ring-1 ring-white/12 hover:bg-white/12",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[14px] gap-2",
  lg: "h-13 px-6 text-[15px] gap-2.5",
  xl: "h-16 px-8 text-[17px] gap-3",
};

export function buttonClasses(
  options: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {},
): string {
  const { variant = "ink", size = "md", fullWidth = false } = options;
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,scale] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
    sizes[size],
    variants[variant],
    fullWidth && "w-full",
  );
}

export interface ButtonProps extends ComponentProps<"button"> {
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
      {Icon && (
        <Icon
          aria-hidden="true"
          className={size === "xl" ? "size-5" : "size-4"}
          strokeWidth={2.2}
        />
      )}
      {children}
    </button>
  );
}
