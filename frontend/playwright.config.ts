import { defineConfig } from '@playwright/test';
import path from 'node:path';

// PC-505 — golden-path end-to-end test.
//
// Playwright owns the full stack for the duration of the run: it boots the
// FastAPI backend (in-memory store, no Supabase env needed) and the Next.js
// frontend, waits for both to be ready, then drives a real Chromium browser
// through upload -> build graph -> run -> download. The same command works
// locally (`npm run e2e`) and in CI.
//
// We pin the frontend to a dedicated port (not the default 3000) and never
// reuse an existing server, so the suite is hermetic even on a dev machine that
// already has *another* app squatting on :3000. The frontend talks to the
// backend cross-origin (run.ts -> http://localhost:8001), so the backend is
// started with a CORS allowlist that includes our port.

const BACKEND_DIR = path.resolve(__dirname, '..', 'backend');
const isCI = !!process.env.CI;

const FRONTEND_PORT = 3100;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
const CORS_ORIGINS = `http://localhost:3000,${BASE_URL},http://localhost:5173`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // One source of truth (the in-memory backend), so never parallelise.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // First `next dev` compile + the 3s status poll cadence need headroom.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1600, height: 900 },
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'python main.py',
      cwd: BACKEND_DIR,
      url: 'http://localhost:8001/docs',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { CORS_ORIGINS },
    },
    {
      command: isCI
        ? `npm run build && npm run start -- --port ${FRONTEND_PORT}`
        : `npm run dev -- --port ${FRONTEND_PORT}`,
      cwd: __dirname,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: isCI ? 240_000 : 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
