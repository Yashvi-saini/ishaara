import { Download, Moon, Sun } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { needsResponder } from "../../lib/alerts";
import { useAppState } from "../../lib/appState";
import { cn } from "../../lib/cn";
import { useInstallPrompt } from "../../lib/pwa";
import { useTheme } from "../../lib/theme";
import { Button, Mark } from "../ui";

const NAV = [
  { to: "/eye", label: "Eye" },
  { to: "/command", label: "Command" },
  { to: "/guard", label: "Guard" },
  { to: "/learn", label: "Learn" },
];

const iconMotion =
  "absolute inset-0 size-[18px] transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";

export function AppShell() {
  const { pathname } = useLocation();
  const [theme, setTheme] = useTheme();
  const { canInstall, install } = useInstallPrompt();
  const app = useAppState();
  const unanswered = app.data?.alerts.filter(needsResponder).length ?? 0;
  const lostConnection = app.data !== null && !app.connected;

  return (
    <div className="min-h-dvh p-0 sm:p-4 lg:p-7">
      <div
        data-alarm={unanswered > 0 ? "true" : undefined}
        className="frame mx-auto min-h-dvh max-w-[1480px] overflow-hidden sm:min-h-[calc(100dvh-2rem)] sm:rounded-[26px] lg:min-h-[calc(100dvh-3.5rem)]"
      >
        <div className="px-4 pt-4 pb-10 sm:px-7 sm:pt-6 lg:px-10">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-label="Main">
            <Link
              to="/"
              className="group flex items-center gap-2 rounded-full pr-1"
              aria-label="Ishaara home"
            >
              <Mark className="size-8 text-ink transition-transform duration-300 group-hover:-rotate-6" />
              <span className="text-[21px] font-semibold tracking-[-0.055em]">ishaara</span>
            </Link>

            <div className="order-3 -mx-1 flex w-full overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:px-0">
              <div className="flex items-center gap-0.5 rounded-full bg-card p-1 shadow-[inset_0_0_0_1px_var(--line)]">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "relative rounded-full px-4 py-2 text-[14px] font-semibold transition-colors",
                        isActive ? "text-accent-ink" : "text-ink-3 hover:text-ink",
                      )
                    }
                  >
                    {item.label}
                    {item.to === "/command" && unanswered > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent"
                        />
                        <span className="sr-only">
                          {` (${unanswered} unconfirmed ${unanswered === 1 ? "alert" : "alerts"})`}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {canInstall && (
                <Button variant="ink" icon={Download} onClick={() => void install()}>
                  Install app
                </Button>
              )}
              <button
                type="button"
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  setTheme(theme === "light" ? "dark" : "light", {
                    x: box.left + box.width / 2,
                    y: box.top + box.height / 2,
                  });
                }}
                aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                className="inline-flex size-11 items-center justify-center rounded-full bg-card text-ink shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-sunken"
              >
                <span className="relative block size-[18px]" aria-hidden="true">
                  <Moon
                    className={cn(
                      iconMotion,
                      theme === "light"
                        ? "blur-0 scale-100 opacity-100"
                        : "scale-[0.25] opacity-0 blur-[4px]",
                    )}
                  />
                  <Sun
                    className={cn(
                      iconMotion,
                      theme === "light"
                        ? "scale-[0.25] opacity-0 blur-[4px]"
                        : "blur-0 scale-100 opacity-100",
                    )}
                  />
                </span>
              </button>
            </div>
          </nav>

          {lostConnection && (
            <p
              role="status"
              className="mt-6 rounded-[18px] bg-gold/20 px-5 py-3 text-[14px] font-semibold"
            >
              Connection to the server lost. Reconnecting. New alerts may be delayed.
            </p>
          )}

          <main className="mt-8" key={pathname}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
