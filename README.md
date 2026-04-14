# OpenLib

OpenLib is an Expo + TypeScript app for OPAC-driven library discovery. This repo contains a minimal clean-architecture foundation for ticket #459.

## Setup
### Requirements
- Node.js (tested with Node `v22.22.0`) and npm (tested with npm `10.9.4`).

### Install
1. Install dependencies: `npm install`
   - Do **not** omit devDependencies (`--omit=dev`), since web bundling relies on build-time tooling (e.g. NativeWind/Tailwind).
   - In CI, prefer `npm ci` (not `npm ci --omit=dev`).
   - Note: npm may warn about the `production` config; this repo sets it explicitly to avoid accidental devDependency omission in production-like environments.

### Run (Web)
- Dev server: `npm run web`
  - Non-interactive/CI mode: `CI=1 npm run web`
  - If running in a remote container/VM, pass an explicit port and forward it: `npm run web -- --port 19006`

### Build (Web export)
- Static export: `npx expo export -p web --output-dir dist-web`
- Serve the export locally: `npx http-server dist-web` (or `python3 -m http.server -d dist-web 8080`)

### Host caveats
- **Linux (headless/minimal images):** `expo start` may log an error about installing React Native DevTools due to a missing `libnspr4.so`. Install the OS package (e.g. Debian/Ubuntu: `apt-get install -y libnspr4`) or ignore the message if you only need web bundling.
- **Nested repos / monorepos:** this repo pins Metro resolution to this repo’s `node_modules` (see `metro.config.js`) to avoid accidentally picking up React/React Native from a parent directory.

## Scripts
- `npm run start` - Expo dev server
- `npm run web` - Web dev server
- `npm run ios` - iOS simulator
- `npm run android` - Android emulator
- `npm run build:providers` - Build OPAC provider registry from opacapp-config-files
- `npm run test:providers` - Smoke test provider registry and write status artifacts
- `npm run qa:mvp` - Run MVP smoke checks and write heartbeat artifacts

## Conventions
- Source code lives under `src/`.
- Layers:
  - `src/domain` for stable models and value types.
  - `src/application` for ports/use-cases.
  - `src/infrastructure` for adapters that implement ports.
  - `src/presentation` for navigation + UI composition.
- OPAC models live in `src/domain/models/opac.ts` and the port interface lives in `src/application/ports/OpacAdapter.ts`.
- Navigation skeletons live in `src/presentation/navigation/` and should be replaced with real navigation wiring when screens are ready.

## Reminder MVP Scope (Ticket #463)
- Domain models for loan due reminders, reservation pickup reminders, and user preferences.
- Pure scheduling logic to compute upcoming reminders from account snapshot data.
- Persistence abstraction with an in-memory implementation for reminder preferences/state.
- Placeholder Reminder Settings and Reminder History screens wired into the route map.
- Demo script: `npm run reminders:demo` to print a sample schedule.
- No push notifications or background scheduling yet.

## Notes
- The `AppNavigator` is a placeholder to keep the app running while navigation is wired up.
- Search flows are now wired end-to-end via the simple navigator, with a placeholder record details view.
- Library account login is **Bibliothekskonto scaffolding only** (provider-bound), with no OpenLib account concept.
- Local persistence (AsyncStorage) now stores active library selection, recent searches per library, reminder preferences, and minimal account session metadata (no passwords or raw credentials).
- See `docs/architecture.md` for the current layering and dependency rules.
- See `docs/providers-registry.md` for OPAC provider ingestion details.
- See `docs/opac-adapter-strategy.md` for SISIS/VuFind adapter strategy and TS mapping plan.
- See `docs/ux-navigation-openlib.md` for MVP UX flow and navigation concept.
