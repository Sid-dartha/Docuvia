# AI Document Analyzer — Frontend

A standalone React + Vite frontend for the AI Document Analyzer RAG backend.
This folder does not touch or depend on backend source files — it only talks
to the backend over HTTP through a Vite dev proxy.

## Requirements

- Node.js 18+ and npm
- The backend running at `http://127.0.0.1:8000`

## Setup

```bash
cd AI-Document-Analyzer/frontend
npm install
npm run dev
```

The app runs at **http://localhost:5173**.

Keep your backend running separately (e.g. `uvicorn main:app --reload` from
`AI-Document-Analyzer/backend`, on port 8000) — the frontend does not start
or manage it.

## How the proxy works

`vite.config.js` forwards any request to `/health` or `/documents/*` from
`localhost:5173` to `http://127.0.0.1:8000`. The browser only ever calls the
frontend's own origin, so the backend's CORS settings never need to change.

## Build for production

```bash
npm run build
npm run preview
```

Note: `vite preview` does not apply the dev proxy. For a production deploy,
put a reverse proxy (nginx, Caddy, etc.) in front of the built `dist/`
folder and the backend, or set `VITE_API_BASE` and adjust `src/api.js` to
point at an absolute backend URL.

## Project structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── vault-icon.svg
└── src/
    ├── main.jsx        # React entry point
    ├── App.jsx         # All UI: upload panel, conversation panel, status
    ├── api.js          # fetch/XHR wrappers for /health, /documents/*
    └── index.css       # Full theme (dark glass, gradients, animations)
```
