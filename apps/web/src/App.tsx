import { ArrowRight } from "lucide-react";
import { Link, Route, Routes } from "react-router";
import { AppShell } from "./components/shell/AppShell";
import { Card } from "./components/ui";
import { useDocumentTitle } from "./lib/hooks";
import { CommandPage } from "./routes/CommandPage";
import { EyePage } from "./routes/EyePage";
import { GuardPage } from "./routes/GuardPage";
import { HomePage } from "./routes/HomePage";
import { LearnPage } from "./routes/LearnPage";

function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <Card className="mx-auto mt-10 max-w-lg p-10 text-center">
      <p className="text-[64px] leading-none font-bold tracking-[-0.06em] text-accent-ink tabular">
        404
      </p>
      <h1 className="mt-4 text-[22px] font-medium tracking-[-0.03em]">
        This screen does not exist.
      </h1>
      <p className="mt-2 text-[14px] text-ink-2">
        Check the link, or go back to the home page to open a screen.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md text-[14px] font-semibold text-ink hover:text-accent-ink"
      >
        Back to Ishaara <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Card>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/eye" element={<EyePage />} />
        <Route path="/command" element={<CommandPage />} />
        <Route path="/guard" element={<GuardPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
