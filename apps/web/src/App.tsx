import { Link, Route, Routes } from "react-router";
import { CommandPage } from "./routes/CommandPage";
import { EyePage } from "./routes/EyePage";
import { GuardPage } from "./routes/GuardPage";

const surfaces = [
  { path: "/eye", name: "Ishaara Eye", summary: "Camera page that watches for the signal." },
  { path: "/command", name: "Ishaara Command", summary: "Security dashboard." },
  { path: "/guard", name: "Guard app", summary: "Rings a guard and takes their confirmation." },
  { path: "/learn", name: "Learn", summary: "Teaches the signal, with practice." },
];

function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Ishaara</h1>
      <p className="mt-2 text-ink-muted">
        Help without saying a word. This is the project skeleton; each surface is built in a later
        phase.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {surfaces.map((surface) => (
          <li key={surface.path} className="py-3">
            <Link to={surface.path} className="font-medium text-accent underline">
              {surface.name}
            </Link>
            <p className="text-sm text-ink-muted">{surface.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

function NotBuiltYet({ name }: { name: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="mt-2 text-ink-muted">This page is not built yet.</p>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        Back to home
      </Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/eye" element={<EyePage />} />
      <Route path="/command" element={<CommandPage />} />
      <Route path="/guard" element={<GuardPage />} />
      <Route path="/learn" element={<NotBuiltYet name="Learn" />} />
      <Route path="*" element={<NotBuiltYet name="Page not found" />} />
    </Routes>
  );
}
