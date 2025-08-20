# CHANGELOG

## v0.11.11 - 20 August 2025

### Client (UI)

- Operations (`client/src/pages/Operations.tsx`):
  - Plot now reflects exactly the subset shown in the embedded CSV Preview; removed internal repair-request and reason-based filtering.
  - Hooked plotting to CSV Preview’s `onFilteredChange` so filtering (global or per-column) updates the chart immediately.
  - Fixed Maximum update depth exceeded by memoizing the handler and using stable emissions from CSV Preview.
  - Simplified UI: reason dropdown removed; toggle now labeled “Plot events”.
- CSV Preview (`client/src/components/CsvPreview.tsx`):
  - Added per-column filter popovers (gear icon in header) with All/None and value checkboxes (capped to 200 unique values).
  - Global text filter is now debounced (300ms).
  - Emits filtered subset to parent without causing render loops (callback stored in ref; emits only when headers/rows references change).

### Notes

- Plot autoscaling remains enabled for both axes and respects theme variables.

## v0.11.10 - 20 August 2025

### Client (UI)

- Gantt (`client/src/pages/Gantt.tsx`):
  - Added filters: vessel multi-select, minimum duration (hours), date range, and text search across vessel/part/system/request.
  - Added chart variants selector with three modes:
    - CTV by vessel (timeline grouped by vessel).
    - CTV duration (repairs) with duration-based color scale (short→green, long→red).
    - Repair request durations (aggregated request windows, colored by duration).
  - Theme-aware Plotly styling via CSS variables continues to apply.
  - Render stability: switched to `Plotly.react` and avoided purging/clearing on transient empty data to prevent initial flicker/disappearance.

### Notes

- The duration color scale uses `RdYlGn_r` to match server examples (short→green, long→red).

## v0.11.9 - 20 August 2025

### Client (UI)

- Results Compare (`client/src/pages/ResultsCompare.tsx`):
  - Compare results across multiple saved libraries without loading them into the working session.
  - New checklist to include saved projects; merged `results/` trees are shown with `libName/` prefixes.
  - File selection and default expansion updated to handle prefixed paths. Run labels include the library name.

### Client API

- `client/src/api/index.ts`:
  - Added `listSavedFiles(apiBaseUrl, name)` to list files inside a saved library.
  - Added `readSavedFile(apiBaseUrl, name, path, raw?)` to read a file from a saved library (supports raw text for YAML/CSV/HTML and base64 for binary where applicable).
  - Both functions include transparent mock-worker fallbacks.

### Server

- Saved-libraries read-only endpoints:
  - `GET /api/saved/{name}/files` returns the file listing for a saved library.
  - `GET /api/saved/{name}/file?path=&raw=` returns the file contents (YAML parsed when not raw; text/html/csv or base64 for binary when raw).
  - Path resolution guarded against traversal; mirrors shapes used by existing file APIs.

### Mock API Worker

- `client/src/workers/mockApiWorker.ts`:
  - Implemented handlers for `GET /api/saved/{name}/files` and `GET /api/saved/{name}/file` using `templateLibrary(name)` to provide deterministic content.
  - Accepts POSIX/Windows path separators and returns structures consistent with server endpoints.

## v0.11.8 - 20 August 2025

### Client (UI)

- Page layout (`client/src/components/PageWithLibrary.tsx`):
  - Removed the header "Project" box entirely for a cleaner layout.
  - Moved the Hide/Show Sidebar control to a global toolbar and wired it via window events (`wombat:toggle-sidebar`).
  - When `projectPlacement="sidebar"`, the project selector and actions render on the same row within the sidebar panel.
- Global toolbar (`client/src/App.tsx`):
  - Added a global "Toggle Sidebar" button next to the Theme Selector.
- Saved libraries dropdown (`client/src/components/SavedLibrariesDropdown.tsx`):
  - Now accepts inline `children` actions that appear to the right of the selector.
  - Shows these actions only when a saved library is selected (working session hides them).
  - Minor layout adjustments for responsive wrapping; CSS updated in `client/src/App.css`.
- Simulation Manager (`client/src/pages/SimulationManager.tsx`):
  - "Delete Saved" action moved next to the project selector (as an inline X button) and only appears when a saved library is selected.

Notes: These changes apply across all pages using `PageWithLibrary` and improve consistency of sidebar behavior and project actions.

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