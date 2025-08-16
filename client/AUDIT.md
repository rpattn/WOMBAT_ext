# Client Audit (React/TypeScript)

## Overview
- App type: Vite + React + TypeScript
- Key areas reviewed:
  - `client/src/pages/SimulationManager.tsx` (~262 LOC)
  - `client/src/context/ApiContext.tsx` (now composed from hooks; slimmer)
  - `client/src/components/RestClient.tsx` (~124 LOC)
  - `client/src/context/WebSocketContext.tsx` (~120 LOC)
  - Configs: `package.json`, `eslint.config.js`, `tsconfig*.json`

## Findings
- __Large/complex files__
  - `src/context/ApiContext.tsx` was a single, central abstraction for REST calls, session handling, file/library state, previews, and results. It has now been modularized via hooks to reduce complexity.
  - `src/pages/SimulationManager.tsx` bundles many UI concerns (file selection, editor, previews, save/load, run simulation, toasts). ~260 LOC suggests splitting.
- __Potentially unused/underused code__
  - WebSocket path: no `src/context/WebSocketContext.tsx` present in the current tree. App uses REST-only `ApiProvider`.
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
  - `useTemp()` (sweep/clear temp)
  - `ApiProvider` now composes these hooks and exposes the same public API.
- __Decompose `SimulationManager.tsx`__:
  - Extract: Saved libraries panel, Library explorer, Editor pane (initial pass completed; further splits optional).
- __Unify notifications__
  - Create a `useToasts()` wrapper and standardize messages and error mapping (completed).
- __Type consolidation__
  - Extract common types (e.g., LibraryFiles, Results) into `src/types/` to avoid duplication and drift.
- __Testing__
  - Add tests for `ApiContext` methods via MSW/fetch mocks.
  - Add component tests for `SimulationManager` child components when split.

## Potential Legacy/Dead Code
- WebSocket context not present; codebase appears REST-only.

## TODOs (Incremental)
- [x] Decide on strategy: REST-only vs WebSocket. Status: REST-only; no WebSocket context present.
- [x] Extract `src/types/` and move shared types from `ApiContext` and components. Status: added `src/types/index.ts`; `ApiContext` now uses `LibraryFiles` and `JsonDict`.
- [x] Refactor `ApiContext.tsx` into smaller hooks (session/library/simulation/temp). Public API preserved.
- [x] Split `SimulationManager.tsx` into subcomponents (initial pass: `SavedLibrariesBar`, `LibraryPanel`, `EditorPanel`).
- [x] Centralize toast handling via `useToasts()` and error utilities.
- [x] Add tests for `ApiContext` functions (init session, list files, get config, add/replace/delete, simulate). Status: `src/__tests__/apiContext.test.tsx` extended to cover these flows.
- [ ] Add component tests for the new subcomponents of `SimulationManager`.
- [ ] Verify package compatibility with React 19; pin versions if needed in `package.json`.
- [ ] Consider adding Prettier config (if formatting inconsistencies emerge) and ensure ESLint+Prettier play well.

## Notes
- Code changes applied:
  - Created `src/types/index.ts` and updated `src/context/ApiContext.tsx` to consume shared types.
  - Added hooks: `src/hooks/useSession.ts`, `src/hooks/useLibrary.ts`, `src/hooks/useSimulation.ts`, `src/hooks/useTemp.ts`.
  - `ApiProvider` composes these hooks; external API and tests remain intact.
  - Decomposed `src/pages/SimulationManager.tsx` to use:
    - `src/components/SavedLibrariesBar.tsx`
    - `src/components/LibraryPanel.tsx` (wraps `FileSelector` + `SelectedFileInfo`)
    - `src/components/EditorPanel.tsx` (wraps `JsonEditor`)
  - Centralized notifications via `src/hooks/useToasts.ts`; `SimulationManager` refactored to use it. Only `ToastManager` imports `react-toastify` directly.
