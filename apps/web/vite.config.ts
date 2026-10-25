import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vercel Dev assigns a dynamic PORT and waits for the framework dev server
// to bind to it. Vite does not consume PORT automatically, so explicitly use it.
const requestedPort = Number.parseInt(process.env.PORT ?? '', 10);
const isValidPort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535;

// --- Local dev architecture -------------------------------------------------
// There are two supported, non-conflicting local workflows:
//
//   A) `vercel dev` (single command, full stack). Vercel's own dev router owns
//      the public port (default 3000) and already proxies both static assets
//      (to the Vite child dev server it spawns) and /api/* (to the serverless
//      functions) through that one port. The browser only ever talks to
//      Vercel's router, never to Vite's internal dev port directly, so Vite
//      does NOT need its own /api proxy in this workflow.
//
//   B) `npm run dev` (plain Vite, frontend only) run alongside a SEPARATE
//      `vercel dev --listen <API_DEV_PORT>` in another terminal that serves
//      only the API functions. Vite proxies /api/* to that dedicated port.
//
// Previously this toggled on `process.env.VERCEL`, assuming Vercel CLI
// reliably sets VERCEL=1 in the spawned Vite child process. That assumption
// is not safe in an npm-workspaces monorepo (`npm run dev -w apps/web`): when
// the env var was not visible, Vite re-added a proxy pointing at port 3000 -
// the SAME port Vercel Dev's own router listens on - creating a self-referential
// loop (ECONNRESET on the HMR websocket upgrade) under `vercel dev`, and a
// plain ECONNREFUSED under bare `npm run dev` when nothing was listening on
// 3000 at all. Both symptoms are the same underlying bug: guessing instead of
// using an explicit, fixed target.
//
// Fix: never guess. The proxy, when enabled, always points at an explicit
// port supplied via API_DEV_PORT (defaulting to 3001 - deliberately NOT
// Vercel Dev's default 3000) and is only turned on when VITE_USE_API_PROXY=1
// is set (i.e. explicitly, for workflow B). Workflow A needs no flag and no
// proxy at all.
const apiDevPort = Number.parseInt(process.env.API_DEV_PORT ?? '', 10) || 3001;
const useApiProxy = process.env.VITE_USE_API_PROXY === '1';

// --- HMR under `vercel dev` --------------------------------------------------
// Vite's dev server normally runs a WebSocket for Hot Module Replacement (HMR).
// When Vite runs as a child process spawned by `vercel dev`, the browser only
// ever talks to Vercel's own router (see workflow A above); the HMR websocket
// upgrade request has to be proxied through that router to reach Vite's actual
// (dynamically assigned) internal port. Observed in practice with Vercel CLI
// 65.2.0: that proxied upgrade fails the handshake (HTTP 500), and the failure
// doesn't just drop HMR - it brings down the whole `vercel dev` process with
// read ECONNRESET, killing the API functions along with it.
//
// Root-caused to the HMR websocket specifically (not the /api proxying, which
// is already disabled under this workflow - see above). The reliable fix,
// given this CLI/Vite combination, is to not run the HMR websocket at all
// under `vercel dev`: that workflow exists to test the real API/payment flow,
// not for live-editing the UI, so losing hot-reload there is an acceptable
// trade-off for not crashing. `npm run dev` (workflow B) is unaffected and
// keeps full HMR, since nothing proxies its websocket.
//
// Wired through package.json's "dev:vercel" script + vercel.json's
// "devCommand", NOT a guessed env var: `vercel dev` always runs "dev:vercel",
// which sets VITE_DISABLE_HMR=1 explicitly. Plain `npm run dev` runs the
// ordinary "dev" script and never sets it, so HMR stays on there.
const disableHmr = process.env.VITE_DISABLE_HMR === '1';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: isValidPort ? requestedPort : 5173,
    strictPort: true,
    hmr: disableHmr ? false : undefined,
    ...(useApiProxy ? { proxy: { '/api': `http://localhost:${apiDevPort}` } } : {}),
  },
});
