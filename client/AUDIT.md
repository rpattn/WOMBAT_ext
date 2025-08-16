# Client Audit (React/TypeScript)

## Overview
- App type: Vite + React + TypeScript
- Key areas reviewed:
  - `client/src/pages/SimulationManager.tsx` (~262 LOC)
  - `client/src/context/ApiContext.tsx` (~404 LOC)
  - `client/src/components/RestClient.tsx` (~124 LOC)
  - `client/src/context/WebSocketContext.tsx` (~120 LOC)
  - Configs: `package.json`, `eslint.config.js`, `tsconfig*.json`

## Findings
- __Large/complex files__
  - `src/context/ApiContext.tsx` is a single, central abstraction for REST calls, session handling, file/library state, previews, and results. At ~400 LOC it’s a complexity hotspot.
  - `src/pages/SimulationManager.tsx` bundles many UI concerns (file selection, editor, previews, save/load, run simulation, toasts). ~260 LOC suggests splitting.
- __Potentially unused/underused code__
  - `src/context/WebSocketContext.tsx` appears unused in `src/App.tsx`, which exclusively uses `ApiProvider` from `ApiContext`. If the WebSocket path is deprecated, this may be legacy.
- __UI/State coupling__
  - `SimulationManager.tsx` directly calls many `ApiContext` functions and handles numerous responsibilities, making it harder to test.
- __Testing coverage__
  - Minimal: only a basic test exists under `src/__tests__/WebSocketClient.test.tsx` and some tests in `src/test/`.
- __Config & Linting__
  - ESLint/TS strictness is good: `strict`, `noUnused*` on, `eslint.config.js` uses modern flat config.
  - TS `skipLibCheck` enabled (OK for speed; verify types where needed).
- __Dependencies__
  - React 19, React Router 7, Vite 7, TS ~5.8.3. Modern stack; verify compatibility of `react-toastify` and testing libs with React 19.

## Inconsistencies & Smells
- __REST vs WebSocket__
  - Presence of `WebSocketContext` while UI wiring uses REST-only (`ApiProvider`). Confirm intended direction. Duplication of data types (e.g., LibraryFiles) across contexts.
- __Error handling UX__
  - Toast patterns are spread across components (`SimulationManager`, `RestClient`). Centralizing would standardize UX.
- __Result/preview handling__
  - B64/binary preview and CSV preview logic is partly in context and partly at page-level; consider a single preview facility.

## Opportunities for Refactoring
- __Split `ApiContext.tsx`__ into smaller modules/hooks:
  - `useSession()` (base URL, session lifecycle)
  - `useLibrary()` (list/read/add/replace/delete files + saved libraries)
  - `useSimulation()` (run, results)
  - `useTempMaintenance()` (sweep/clear temp)
  - Keep a thin `ApiProvider` composing these hooks and exposing a tidy interface.
- __Decompose `SimulationManager.tsx`__:
  - Extract: File actions toolbar, Library explorer, Editor pane, Preview pane, Saved libraries panel.
- __Unify notifications__
  - Create a `useToasts()` wrapper and standardize messages and error mapping.
- __Type consolidation__
  - Extract common types (e.g., LibraryFiles, Results) into `src/types/` to avoid duplication and drift.
- __Testing__
  - Add tests for `ApiContext` methods via MSW/fetch mocks.
  - Add component tests for `SimulationManager` child components when split.

## Potential Legacy/Dead Code
- `src/context/WebSocketContext.tsx` may be legacy. If WebSocket features are intentionally removed in favor of REST, mark deprecated or remove after verification.

## TODOs (Incremental)
- [ ] Decide on strategy: REST-only vs WebSocket. If REST-only, deprecate/remove `WebSocketContext` and related UI.
- [ ] Extract `src/types/` and move shared types from `ApiContext` and components.
- [ ] Refactor `ApiContext.tsx` into smaller hooks (session/library/simulation/temp). Keep external API stable initially.
- [ ] Split `SimulationManager.tsx` into subcomponents (Explorer, Editor, Preview, Toolbar, SavedLibraries).
- [ ] Centralize toast handling via `useToasts()` and error utilities.
- [ ] Add tests for `ApiContext` functions (init session, list files, read/replace/add/delete, save/load libraries, run simulation).
- [ ] Add component tests for the new subcomponents of `SimulationManager`.
- [ ] Verify package compatibility with React 19; pin versions if needed in `package.json`.
- [ ] Consider adding Prettier config (if formatting inconsistencies emerge) and ensure ESLint+Prettier play well.

## Notes
- No code changes made. This document summarizes observations and suggested improvements for maintainability, testability, and UX consistency.
