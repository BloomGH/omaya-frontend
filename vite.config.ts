// defineConfig from vitest/config (not vite) so the `test` block below typechecks.
import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Sentry release = portal@<vercel-sha>, injected as the build-time constant
// __SENTRY_RELEASE__ so the runtime SDK and the uploaded source maps agree.
// VERCEL_GIT_COMMIT_SHA is exposed by Vercel at build (NOT VITE_-prefixed, so
// it never reaches the bundle on its own).
const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'
const release = `portal@${sha}`

// Source-map upload only runs when SENTRY_AUTH_TOKEN is present (Vercel prod
// build). Local/preview builds without the token still build cleanly, and we
// only emit maps when we're going to upload+delete them — so dist/*.map is
// never served publicly.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __SENTRY_RELEASE__: JSON.stringify(release),
  },
  // Strip chatty/PHI-prone console output + debugger from production bundles so
  // PHI can never leak to a clinic-workstation console. Keep console.error/warn
  // so Sentry's runtime console breadcrumbs (warn/error) still fire — `pure`
  // lets the minifier drop log/debug/info (return value always unused). Dev
  // (vite serve) keeps everything.
  esbuild:
    command === 'build'
      ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] }
      : {},
  build: {
    sourcemap: Boolean(sentryAuthToken),
  },
  plugins: [
    react(),
    sentryAuthToken
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: sentryAuthToken,
          release: { name: release },
          // Delete maps after upload so Vercel never serves them publicly.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })
      : undefined,
  ],
  test: {
    // jsdom, not node: the response interceptor reads window.location and
    // clearSession() touches localStorage.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // The Sentry plugin is build-only and needs no token here; excluding e2e-ish
    // dirs keeps `pnpm test` to unit scope.
    exclude: ['node_modules', 'dist'],
  },
}))
