import { Compass } from "lucide-react";
import { Link, Route, Routes } from "react-router";
import { buttonClasses, Card, EmptyState, PageHeader } from "./components/ui";
import { useDocumentTitle } from "./lib/hooks";
import { CommandPage } from "./routes/CommandPage";
import { EyePage } from "./routes/EyePage";
import { GuardPage } from "./routes/GuardPage";
import { HomePage } from "./routes/HomePage";
import { LearnPage } from "./routes/LearnPage";

function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader title="Page not found" />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Card>
          <EmptyState
            icon={Compass}
            title="There is no page at this address."
            description="Check the link, or go back to the home page to open a screen."
            action={
              <Link to="/" className={buttonClasses({ variant: "primary" })}>
                Go to the home page
              </Link>
            }
          />
        </Card>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/eye" element={<EyePage />} />
      <Route path="/command" element={<CommandPage />} />
      <Route path="/guard" element={<GuardPage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
