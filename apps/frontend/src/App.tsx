import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            <span className="text-brand">AIVid</span>Forge
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-zinc-300 hover:text-white">
              Projects
            </Link>
            <Link
              to="/new"
              className="rounded-md bg-brand px-3 py-1.5 font-medium text-brand-fg hover:opacity-90"
            >
              New project
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
        AIVidForge · Phase 1
      </footer>
    </div>
  );
}
