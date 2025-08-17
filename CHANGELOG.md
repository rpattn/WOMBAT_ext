# CHANGELOG

## v0.11.4 - 17 August 2025

### Client (UI)

- Route-level code splitting with React.lazy + Suspense in `client/src/App.tsx` for `SimulationManager`, `Results`, `RestClient`, and `ThemeSelector` to reduce initial bundle/parse cost.
- Deferred loading of heavy editor code: `EditorPanel` is lazy-loaded in `pages/SimulationManager.tsx` and only rendered when configuration data is present.
- Reduced re-renders: wrapped `LibraryPanel` and `FileSelector` with `React.memo`; stabilized handlers/derived data with `useCallback`/`useMemo` in `FileSelector`.
- Eliminated initial theme flash by applying persisted theme in `client/index.html` before React mounts; added `<meta name="color-scheme" content="light dark">` to align native UI elements with theme.

Notes: Production build reflects new split chunks for the above pages and components.

## See WOMBAT parent project changelog for older updates