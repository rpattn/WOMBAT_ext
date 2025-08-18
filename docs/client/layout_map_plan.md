# Layout Map Page Plan

Goal: Add a new client page that renders the project's `layout.csv` on an interactive map with markers at latitude/longitude and labels (names). The page should be a subpage of Simulation Manager and appear in the navbar. Use a free map API (OpenStreetMap via Leaflet).

## Tasks

- [ ] Create `client/src/pages/LayoutMap.tsx` using Leaflet + OpenStreetMap tiles
- [ ] Add route `/simulation/layout` and lazy-load the page in `client/src/App.tsx`
- [ ] Convert "Simulation Manager" navbar entry into a dropdown with:
  - [ ] Overview → `/` (existing Simulation Manager)
  - [ ] Layout Map → `/simulation/layout`
- [ ] Fetch `layout.csv` via existing REST helpers (`listFiles`, `readFile`)
- [ ] Parse CSV, extract columns: name, latitude, longitude (support common variants)
- [ ] Plot markers with labels, auto-fit bounds
- [ ] Handle empty/missing `layout.csv` gracefully with status message
- [ ] Add dependencies: `leaflet`, `react-leaflet` and import Leaflet CSS
- [ ] Basic smoke test: load a saved library and verify markers render

## Notes

- Prefer `project\\plant\\layout.csv` if present; otherwise search any CSV paths containing `layout.csv`.
- Use `useApiContext()` to obtain `apiBaseUrl`, `sessionId`, `initSession` similar to `Gantt.tsx`.
- Keep styling consistent with existing containers, titles, and theme.
- Tile source: OpenStreetMap standard tiles `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with proper attribution.
