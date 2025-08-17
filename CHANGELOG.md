# CHANGELOG

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