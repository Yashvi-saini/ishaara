import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { cn } from "../../lib/cn";

const links = [
  { to: "/eye", label: "Eye" },
  { to: "/command", label: "Command" },
  { to: "/guard", label: "Guard" },
  { to: "/learn", label: "Learn" },
];

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}

export function PageHeader({ title, description, actions, wide = false }: PageHeaderProps) {
  const width = wide ? "max-w-[90rem]" : "max-w-6xl";
  return (
    <header className="border-b border-line bg-surface">
      <div className={cn("mx-auto flex h-12 items-center gap-6 px-4 sm:px-6", width)}>
        <Link to="/" className="rounded-md text-base font-semibold text-ink">
          Ishaara
        </Link>
        <nav aria-label="Main" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2 py-1 text-sm",
                  isActive
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-muted hover:bg-sunken hover:text-ink",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div
        className={cn(
          "mx-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-4 pb-5 sm:px-6",
          width,
        )}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {description !== undefined && (
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </header>
  );
}
