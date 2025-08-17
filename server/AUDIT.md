# Server Audit (FastAPI/Python)

## Overview
- Stack: FastAPI, Pydantic, Python 3, file-based project data per session.
- Current structure (post-refactor):
  - `server/rest_api.py` — mounts modular routers under `/api`.
  - `server/routers/` — `session.py`, `library.py`, `saved.py`, `temp.py`, `simulations.py`.
  - `server/services/` — `libraries.py`, `saved_libraries.py`.
  - `server/utils/paths.py` — shared path helpers.
  - `server/library_manager.py` — deprecated thin compatibility layer delegating to services.
  - `server/client_manager.py` — session and temp-dir management.
  - `server/event_handlers.py` — legacy WS handlers (not present in repo; REST-only currently).

## Findings
- __Modularization achieved__
  - Routing split into focused modules under `server/routers/` and included from `server/rest_api.py`.
  - Business logic extracted to `server/services/` with clear boundaries.
- __Session/project model__
  - `server/client_manager.py` provisions per-session temp project dirs under `server/temp/client_<id>` and saved libraries under `server/client_library`. Good isolation; sweeping utilities provided.
- __Path safety__
  - Centralized in `server/utils/paths.py` and used by services; raw reads validate resolved paths.
- __Synchronous long-running work__
  - `/{client_id}/simulate` is synchronous; consider BackgroundTasks or async/polling.

## Bugs / Defects
- __RESOLVED: undefined variable in delete flow__
  - Previous: `server/library_manager.py` referenced `safe_rel` in `delete_client_library_file()`.
  - Now: Deletion is delegated to `server/services/libraries.py::delete_client_library_file()` with consistent handling and path safety.
- __Duplicate except blocks (syntax/logic issue)__
  - Originally noted in `server/event_handlers.py` but this file is not present. Consider this resolved/not applicable in current REST-only codebase.
- __RESOLVED: inconsistent return shapes__
  - `get_client_library_file()` now returns `None` on missing; YAML returns dict, others return str.

## Inconsistencies & Smells
- __Duplication between REST and WS__
  - Saved library list/load/delete and file CRUD appear in both layers with slightly different responses. Standardize core operations in a shared service module and thin REST/WS adapters.
- __Error propagation__
  - Some handlers send plain strings on error, others send structured JSON. Adopt a consistent error schema.
- __Logging__
  - Logging generally good, but error logs sometimes swallow context; include client_id, file_path, and base/abs paths consistently.

## Opportunities for Refactoring
- __DONE: Extract service layer__
  - Implemented `server/services/libraries.py` and `server/services/saved_libraries.py`.
- __DONE: Path utilities__
  - Implemented `server/utils/paths.py`; used throughout services and raw reads.
- __Response schemas__
  - Request models centralized in `server/models.py`. Response models ADDED: standardized `OperationOkResponse`, file responses, and simulation responses. Routers updated to use `response_model`.
- __Background execution__
  - Implemented lightweight background simulation runner with in-memory task store and polling endpoints.

## Security Considerations
- __Path traversal__
  - Good checks in places (`startswith(base + os.sep)`), but ensure all file operations consistently normalize and validate paths.
- __Temp sweeping__
  - `ClientManager.sweep_*` functions operate within `server/temp`. Ensure no external paths are removed; they currently gate by prefix, which is good.

## Testing
- __Server tests coverage__
  - REST tests present under `tests/server_tests/test_rest_api.py` covering session lifecycle, file CRUD, config fallback/override, and simulation run.
  - TODO: add error cases and path traversal protections, saved library save/load/delete edge cases, and background job polling endpoints.
  - WS tests not applicable (REST-only).

## Potential Legacy/Dead Code
- If moving toward REST-only, `event_handlers.py` may become legacy. Conversely, if WS is primary, consider trimming REST or ensuring parity via shared services.

## TODOs (Incremental)
- [x] Extract path safety helpers into `server/utils/paths.py` and use in services.
- [x] Create a service layer for library operations; make REST/WS thin wrappers.
- [x] Normalize `get_client_library_file()` return contract to `None` on missing.
- [x] Modularize REST endpoints into routers under `server/routers/` and include from `rest_api.py`.
- [n/a] Fix duplicate `except` blocks in `server/event_handlers.py` `handle_delete_saved_library()` — file not present.
- [x] Define Pydantic response models for REST and align response shapes.
- [x] Add background job for `run_simulation` with progress updates via polling endpoints.
- [~] Add server-side tests for REST endpoints (success + error cases) and for path traversal protections. Status: initial coverage added in `tests/server_tests/test_rest_api.py`; expand to error and security cases.

## Notes
- No code changes made. This document records issues and recommended refactors to improve reliability, maintainability, and consistency across interfaces.

## Client Frontend Audit (React/Vite)

__Scope__: `client/src/components/JsonEditor.tsx` (~500 LOC), `client/src/components/FileSelector.tsx` (~280 LOC), plus their CSS and usage in `client/src/components/LibraryPanel.tsx`.

### Findings — JsonEditor (`client/src/components/JsonEditor.tsx`)
- __Monolithic component__: Single file handles state sync, schema resolution, validation, and recursive rendering via `renderField()`. Difficult to test in isolation and to optimize.
- __Validation logic inline__: Custom validators (`validateNumber`, `validateString`, `validateArray`, `validateObject`, `validateEnum`, `validateOneOf`, `validateValue`) live inside the component. This prevents reuse and hampers memoization and unit testing.
- __Schema traversal each render__: `getSchemaForPath()` walks the schema per field (with oneOf handling) without caching. On large documents this can be O(N·depth) per change.
- __Anonymous closures in arrays__: Array item rendering uses inline IIFEs and per-item closures; creates many re-renders and unstable function identities.
- __State sync complexity__: Tracks `didMountRef` and `skipNextOnChangeRef` to avoid echoing external prop updates via `onChange`. Works, but raises cognitive load.
- __Mixed responsibilities__: UI concerns (labels, badges, errors) intertwined with data logic (paths, schema type labels, deep set updates).
- __Accessibility gaps__: Error messages are visually shown but not referenced via `aria-describedby`. Checkbox not explicitly associated with label via `htmlFor`/`id`.
- __Performance risk__: For large arrays/objects, recursive render + validation on every `formData` change may be costly. No debouncing nor virtualization options.

### Recommendations — JsonEditor
- __Decompose into subcomponents__ under `client/src/components/json-editor/`:
  - `ObjectField.tsx`, `ArrayField.tsx`, `PrimitiveField.tsx`, `FieldLabel.tsx`, `ErrorList.tsx`.
  - Keep a thin container `JsonEditor.tsx` that wires props, state, and callbacks.
- __Extract pure utilities__ under `client/src/components/json-editor/utils/`:
  - `validate.ts` (export `validateValue`, `validateForm`), `schema.ts` (export `getSchemaForPath`, `typeLabelFromSchema`), `path.ts` (path helpers, `setDeepValue`).
  - Add unit tests for these pure modules.
- __Memoization & caching__:
  - Cache `getSchemaForPath()` results by path string using a `Map<string, any>` invalidated when `schema` changes.
  - Wrap field components with `React.memo`; use `useCallback` for `handleChangeAtPath` and per-item handlers to keep stable identities.
- __Validation scheduling__:
  - Debounce validation (e.g., 150–300ms) or validate on blur for primitives; always validate on save.
  - Compute `hasErrors` from a memoized error map rather than recreating objects each render.
- __Enum and number UX__:
  - Preserve empty string vs zero distinction. For numeric fields allow empty input and validate on blur to avoid coercing to 0.
- __Accessibility__:
  - Generate stable `id`s for inputs and set `aria-invalid`, `aria-describedby` with error list IDs; make labels clickable via `htmlFor`.
- __Large arrays__:
  - Consider optional virtualization for arrays with many items (simple windowing via `react-window` or a manual slice + pagination).
- __Types__:
  - Introduce basic JSON Schema typings for the subset we support and avoid pervasive `any`.

### Findings — FileSelector (`client/src/components/FileSelector.tsx`)
- __Tree builder OK__: `buildTreeStructure` is memoized and sorts folders first. Good separation of derive-vs-state.
- __Expansion state design__: Uses `expandedFolders: Set<string>` with keys like `${rootLabel}/path`. Supports switching projects via `rootLabel`. Good.
- __Dead field__: `TreeNode.isExpanded` is set but unused; expansion is tracked in state. Keep the source of truth singular.
- __Path separator coupling__: Assumes `\\`-separated file paths. If server ever returns POSIX-style, UI would mis-group. No normalization utility.
- __Rendering closures__: `renderTreeNode` recreates per render; many inline lambdas inside. Fine for small trees, but can add overhead for large ones.
- __UX modals__: Uses `window.prompt`/`window.confirm` for add/delete; inconsistent with the rest of UI and not stylable.
- __Accessibility__: Lacks tree semantics (no `role="tree"/"treeitem"`), `aria-expanded`, keyboard navigation.
- __Scalability__: No filter/search. No virtualization for very large libraries.

### Recommendations — FileSelector
- __Split into components__ under `client/src/components/file-tree/`:
  - `Tree.tsx` (container with role, keyboard nav), `TreeFolder.tsx`, `TreeFile.tsx`.
  - Lift action buttons into child components; keep `FileSelector.tsx` as a thin wrapper that provides data and callbacks.
- __Introduce `useTree` hook__:
  - Manages expansion Set and provides memoized `toggle`, `isExpanded`, and `expandTo(path)` helpers.
- __Normalize paths__:
  - Utility `normalizePath(filePath: string): string[]` that splits on both `\\` and `/`, ensuring cross-platform grouping.
- __Remove `TreeNode.isExpanded`__:
  - Rely exclusively on `expandedFolders` state to avoid drift.
- __Accessibility__:
  - Add `role="tree"`, `role="group"`, `role="treeitem"`, `aria-expanded`, `aria-selected`. Implement basic keyboard navigation (Up/Down, Left/Right, Enter).
- __Search/filter (optional)__:
  - Add a lightweight filter input to narrow visible nodes.
- __Virtualization (optional)__:
  - For very large file counts, window the rendered nodes.
- __Modal prompts__:
  - Replace `window.prompt/confirm` with callback props or a shared Modal component so the host page controls UX.

### Quick Wins (Low Risk)
- __JsonEditor__: extract `setDeepValue`, `typeLabelFromSchema`, `getSchemaForPath` into utils; wrap primitive/array/object blocks into dedicated memoized components without altering external props.
- __FileSelector__: remove unused `isExpanded` from `TreeNode`; introduce path normalization; add ARIA roles and `aria-expanded` attributes; convert inline handler creators to `useCallback` where possible.

### Suggested Task List (Incremental)
1) Extract json-editor utilities and add unit tests.
2) Split JsonEditor into subcomponents; keep current visual/behavioral parity.
3) Add validation debounce and schema cache; profile on a large JSON.
4) Factor FileSelector into Tree components and remove dead field; add ARIA roles.
5) Add path normalization + optional search.
6) Replace prompt/confirm with modal-driven UX hooks.

### Bundle Size & Code Splitting — TODOs (status)

- [x] Route-level code splitting in `client/src/App.tsx`:
  - Implemented `React.lazy` + `Suspense` for pages/panels: `SimulationManager`, `Results`, `RestClient`, `ThemeSelector`.
- [x] Defer editor-heavy code until needed:
  - `EditorPanel` is lazy-loaded in `pages/SimulationManager.tsx` and rendered only when configuration data is present.
  - Note: Further splitting inside `JsonEditor` is optional; current deferral yields the main win.
- [x] Memoization to reduce re-renders:
  - `LibraryPanel` and `FileSelector` wrapped with `React.memo`. Handlers/derived data stabilized with `useCallback`/`useMemo`.
- [ ] Split utilities used only at runtime interaction:
  - Consider dynamic import for rarely-used schema helpers if further reduction needed.
- [ ] Audit external deps loaded in the client bundle:
  - Verify no heavyweight libs are eagerly imported (charts, monaco, yaml). Prefer dynamic import.
- [ ] Create a lightweight Results view shell:
  - Lazy-load detailed results panels/tables on demand (expand/click).
- [ ] Asset/code hygiene:
  - Remove unused exports/dead code. Exclude large test fixtures from prod builds.
- [ ] Build-time verification:
  - Add `rollup-plugin-visualizer` to inspect chunks and CI check for bundle deltas.

#### Pseudocode examples (for future PRs)

- App route lazy loading:
  ```tsx
  // client/src/App.tsx
  import { lazy, Suspense } from 'react';
  const SimulationManager = lazy(() => import('./pages/SimulationManager'));
  const Results = lazy(() => import('./pages/Results'));
  const RestClient = lazy(() => import('./components/RestClient'));
  const ThemeSelector = lazy(() => import('./components/ThemeSelector'));
  
  // ...
  <Suspense fallback={null}>
    <Routes>
      <Route path="/" element={<SimulationManager />} />
      <Route path="/results" element={<Results />} />
      <Route path="/connect" element={<RestClient />} />
    </Routes>
    <ThemeSelector />
  </Suspense>
  ```

- Defer EditorPanel until needed:
  ```tsx
  // client/src/pages/SimulationManager.tsx
  const EditorPanel = lazy(() => import('../components/EditorPanel'));
  // render EditorPanel only when configData has keys
  {Object.keys(configData || {}).length > 0 && (
    <Suspense fallback={null}>
      <EditorPanel ... />
    </Suspense>
  )}
  ```

#### Build snapshot (post-splitting)

- Notable output from `npm run build`:
  - Main app chunk `dist/assets/index-*.js`: 271.69 kB (gzip ~85.56 kB)
  - Split chunks present: `SimulationManager-*.js` (~10.16 kB), `Results-*.js` (~9.70 kB), `EditorPanel-*.js` (~7.04 kB), `RestClient-*.js` (~4.16 kB), `ThemeSelector-*.js` (~1.16 kB).
  - CSS split accordingly.
  - Conclusion: initial route payload reduced; heavy editor now deferred.
