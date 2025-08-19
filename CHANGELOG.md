# CHANGELOG

## v0.11.7 - 19 August 2025

### Client (UI)

- Results Compare (`client/src/pages/ResultsCompare.tsx`):
  - Plot now shows raw values only; removed percent-difference and baseline selector.
  - Dark mode styling for Plotly using CSS variables; re-renders on theme change.
  - Value labels displayed on top of each bar with compact formatting.
  - Y-axis label auto-derives from the last segment of the metric when a single metric is selected.
  - File browser filtered to only `results/` paths; YAML-only for this page.
  - Collapsible sections: Preview Table and Metrics; metric keys textbox moved under an "advanced" collapsible.
  - TypeScript fix: `readFile(..., true)` used to fetch raw text for `parseSummaryYaml()`.

### Mock API Worker

- `client/src/workers/mockApiWorker.ts`:
  - Added `stats.maintenance.average_requests_per_month` to `results/summary.yaml` in both the template and simulated summaries so the metric is discoverable and plottable in mock mode.

## v0.11.6 - 19 August 2025

### Client (UI)

- __Centralized mock fallbacks__: `client/src/api/index.ts` now transparently uses the mock web worker when the session ID starts with `mock-` or when HTTP fails. Applies to `listFiles()` and `readFile()`; prevents failing requests to `/api/mock-*` in no-server scenarios.
- __New page: Layout Map__ (`client/src/pages/LayoutMap.tsx`), available via __Simulation Manager → Layout Map__ at route `/simulation/layout`.
  - Interactive Leaflet map rendering coordinates from `project/plant/layout.csv` (or any selected `layout.csv`).
  - File picker in sidebar, auto-fit bounds, optional polylines grouped by `string`, and farm boundary (convex hull).
  - Uses `PageWithLibrary` and `FileSelector` fed by `libraryFiles` from context.
  - Keeps CSV parsing and polyline grouping by `string` column.
  - No direct mock calls in the page; all environment logic lives in the API layer.
- __Layout Map labels__: labels now show on hover (non-permanent tooltips) and are slightly offset left for readability.
- __Realistic mock layout__: `client/src/workers/mockApiWorker.ts` updated `project/plant/layout.csv` with provided coordinates and explicit `string` values for grouping; includes a substation row and 20 turbines (T02–T21) across strings 0 and 1.
- __Navbar CSS__: small alignment tweak to dropdown and hover border cleanup.
- __TypeScript types__: added `@types/leaflet` for Leaflet type support during development.

### Server

- __CORS__: added GitHub Pages origins to `server/main.py` CORS allowlist.

## v0.11.5 - 18 August 2025

### Client (UI)

- Results page (`client/src/pages/Results.tsx`):
  - Inline preview for HTML via sandboxed `<iframe srcDoc>` with "Open in new tab" action.
  - Inline preview for PNG using generated object URLs; guarded loading state.
  - Added "Refresh Files" button and default expansion of `results/` folder.
- New shared page layout: `client/src/components/PageWithLibrary.tsx`.
  - Collapsible, resizable sidebar with persisted width.
  - Integrated `SavedLibrariesDropdown` for switching between working session and saved libraries.
- New `SavedLibrariesDropdown` component (`client/src/components/SavedLibrariesDropdown.tsx`).
- API context (`client/src/context/ApiContext.tsx`) now exposes saved libraries state and schema helpers (`listSchemas`, `getSchema`), unifying session refresh and mock worker fallbacks.
- `useLibrary` hook enhancements (`client/src/hooks/useLibrary.ts`):
  - Robust mock worker fallbacks for saved libraries and file operations.
  - `readFile` supports raw HTML/CSV/YAML text and binary previews (e.g., PNG) with appropriate state updates.
  - Added helpers for `loadSaved`, `restoreWorking`, and `deleteSaved` flows.

Notes: All tests pass.

## v0.11.4 - 17 August 2025

### Client (UI)

- Route-level code splitting with React.lazy + Suspense in `client/src/App.tsx` for `SimulationManager`, `Results`, `RestClient`, and `ThemeSelector` to reduce initial bundle/parse cost.
- Deferred loading of heavy editor code: `EditorPanel` is lazy-loaded in `pages/SimulationManager.tsx` and only rendered when configuration data is present.
- Reduced re-renders: wrapped `LibraryPanel` and `FileSelector` with `React.memo`; stabilized handlers/derived data with `useCallback`/`useMemo` in `FileSelector`.
- Eliminated initial theme flash by applying persisted theme in `client/index.html` before React mounts; added `<meta name="color-scheme" content="light dark">` to align native UI elements with theme.

- FileSelector improvements in `client/src/components/FileSelector.tsx`:
  - Auto-expands `results/` and its first subfolder on initial load and project switch via `defaultExpandFolders`.
  - Supports multi-selection highlighting with optional `selectedFiles` prop.
  - Tree uses ARIA roles; counts moved into `.file-count` for robust querying.

- Results pages:
  - `client/src/pages/ResultsCompare.tsx`: YAML-only file view for results; multi-select of YAML summaries; nested default expansion; “Load Selected” and “Clear” controls.
  - `client/src/pages/Gantt.tsx`: CSV-only file view for results; nested default expansion; guarded Plotly import/render when no segments to avoid jsdom `URL.createObjectURL` in tests; theme-aware Plotly styling.

Notes: Production build reflects new split chunks for the above pages and components. New tests added for FileSelector enhancements, ResultsCompare/Gantt filters, and Plotly guard.

## See WOMBAT parent project changelog for older updates