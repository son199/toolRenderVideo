# AIVidForge Frontend

React 19 + Vite + TypeScript + Tailwind UI for AIVidForge.

## Run

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:5173 and proxies `/api/*` and `/ws/*` to the FastAPI backend on http://localhost:8000.

## Structure

```
src/
├── main.tsx              # React Router + TanStack Query bootstrap
├── App.tsx               # Layout shell
├── pages/
│   ├── NewProject.tsx
│   ├── ProjectList.tsx
│   └── ProjectDetail.tsx
└── lib/
    └── api.ts            # Typed REST client
```
