# Documentation Update Plan

Last updated: 2025-08-21 00:02 (local)

This plan audits current server and client implementations against the docs in `docs/API/` and `docs/client/`, identifies gaps, and lists actionable TODOs with precise targets.

## Findings

- __Server REST API undocumented__: No consolidated docs for FastAPI routes implemented under `server/routers/`.
- __Client feature docs are plans, not usage__: `docs/client/layout_map_plan.md` and `docs/client/results_comparison_plan.md` describe intentions, while features are already implemented in `client/src/pages/`.
- __Results artifact contract not documented__: Server persists multiple result files under `results/{timestamp}/` (e.g., `events.csv`, `gantt.html`), but no doc exists.
- __Client routes overview missing__: Implemented routes and navigation are not documented (Splash, Simulation Manager, Results, Compare, Operations, Gantt, Layout Map, Connection Manager).
- __Client API fallback behavior undocumented__: `client/src/api/index.ts` falls back to a mock worker; not covered in docs.
- __Sphinx API pages seem valid__: `docs/API/*.md` point to Python modules/classes that exist in `wombat/*` and `wombat/utilities/*`. No immediate gaps detected, but cross-links could be improved.

## Server Endpoints (source of truth)

From `server/routers/`:
- __Session__ (`server/routers/session.py`)
  - POST `/api/session` → create session `{ client_id }`
  - DELETE `/api/session/{client_id}` → end session
- __Library__ (`server/routers/library.py`)
  - GET `/api/{client_id}/config` → config object (project or default)
  - GET `/api/{client_id}/library/files` → list working library files
  - GET `/api/{client_id}/library/file?path=...&raw=...` → read file (parsed or raw/base64)
  - POST `/api/{client_id}/library/file` → add file
  - PUT `/api/{client_id}/library/file` → replace file
  - DELETE `/api/{client_id}/library/file?file_path=...` → delete file
  - GET `/api/{client_id}/refresh` → files + config + saved dirs
  - POST `/api/{client_id}/library/save` → save working library
- __Saved libraries__ (`server/routers/saved.py`)
  - GET `/api/saved` → list saved library names
  - POST `/api/{client_id}/saved/load` → load saved into working
  - DELETE `/api/saved/{name}` → delete saved
  - POST `/api/{client_id}/working/restore` → restore prior working session
  - GET `/api/saved/{name}/files` → list files in a saved library
  - GET `/api/saved/{name}/file?path=...&raw=...` → read file from a saved library
- __Simulations__ (`server/routers/simulations.py`)
  - POST `/api/{client_id}/simulate` → run sync, persist results
  - POST `/api/{client_id}/simulate/trigger` → run async, returns `{ task_id }`
  - GET `/api/simulate/status/{task_id}` → poll async status
- __Schemas__ (`server/routers/schemas.py`)
  - GET `/api/schemas/` → list available schema names
  - GET `/api/schemas/{name}` → JSON schema by name
  - GET `/api/schemas/service_equipment/variants` → combined variant schemas

Results persisted by `run_simulation` under `results/{ts}/`:
- Always attempts: `summary.yaml`
- When available: `events.csv`, `operations.csv`, `power_potential.csv`, `power_production.csv`, `metrics_input.csv`, `gantt.html`, optional `gantt.png`

## Client Routes (source of truth)

From `client/src/App.tsx` and `client/src/components/Navbar.tsx`:
- `/` → `Splash`
- `/sim` → `SimulationManager`
- `/results` → `Results`
- `/results/compare` → `ResultsCompare`
- `/results/operations` → `Operations`
- `/results/gantt` → `Gantt`
- `/simulation/layout` → `LayoutMap`
- `/connect` → `ConnectionManager`

Key feature specifics:
- __ResultsCompare__ (`client/src/pages/ResultsCompare.tsx`)
  - Uses `plotly.js-dist-min`, `js-yaml`, `papaparse` via dynamic import
  - Reads summaries from current working and selected saved libraries
  - Normalization and table building in `client/src/utils/results.ts`
- __LayoutMap__ (`client/src/pages/LayoutMap.tsx`)
  - Uses Leaflet directly (no `react-leaflet`) and loads Leaflet CSS from CDN
  - Parses `project/plant/layout.csv` and variants; draws markers, per-string polylines, convex hull
  - Enriches tooltips with per-turbine energy (from `summary.yaml`) and maintenance stats (from `events.csv`) when present
- __Client API layer__ (`client/src/api/index.ts`)
  - Wraps server endpoints and falls back to `workers/mockApiClient` when offline or `sessionId` starts with `mock-`

## TODOs (checkboxes are for the docs PR work)

- [ ] __Create server REST docs__ under `docs/server/` (or `docs/API/server.md`) with endpoint tables and examples.
  - [ ] File: `docs/server/index.md` (overview + auth/session model)
  - [ ] File: `docs/server/library.md` (file CRUD, refresh, save)
  - [ ] File: `docs/server/saved.md` (saved libs list/load/delete/read-only)
  - [ ] File: `docs/server/simulations.md` (sync/async runs, result artifacts)
  - [ ] File: `docs/server/schemas.md` (list/get/variants)
  - [ ] Link from `docs/API/index.md`
- [ ] __Document results artifact structure__ extracted by server
  - [ ] File: `docs/examples/results_artifacts.md` with the folder layout and file semantics
  - [ ] Cross-link from `docs/client/Results.md` and `docs/server/simulations.md`
- [ ] __Replace client “plan” docs with implementation & usage__
  - [ ] Replace `docs/client/layout_map_plan.md` → `docs/client/layout_map.md` describing current `LayoutMap.tsx` behavior and route `/simulation/layout` (vanilla Leaflet, CSV variants, polylines, hull, result enrichment)
  - [ ] Replace `docs/client/results_comparison_plan.md` → `docs/client/results_compare.md` with usage, supported metrics discovery, saved library inclusion, normalization, and dependencies
- [ ] __Add client feature pages__ (routes, screenshots, quickstart)
  - [ ] `docs/client/simulation_manager.md` (edit/save files, run simulations, saved library actions)
  - [ ] `docs/client/results.md` (overview landing, linking to subpages)
  - [ ] `docs/client/operations.md` (CSV preview, quick charts)
  - [ ] `docs/client/gantt.md` (HTML/PNG viewing, theme styling)
  - [ ] `docs/client/connection_manager.md` (configure API base URL, sessions)
  - [ ] `docs/client/splash.md` (capabilities overview)
  - [ ] Update `docs/examples/index.md` to link these
- [ ] __Document client API fallback__ behavior
  - [ ] Add section to `docs/client/connection_manager.md` detailing `mock-` session and worker fallbacks from `client/src/api/index.ts`
- [ ] __Sphinx API cross-links__
  - [ ] In `docs/API/types.md`, add links to examples or client pages where these configs are edited
  - [ ] In `docs/API/utilities.md`, verify autodoc renders for `wombat.utilities.plot`, `logging`, `time`, `utilities`; add short descriptions

## Acceptance Criteria

- Server REST endpoints are fully documented with routes, params, responses, and curl examples.
- Client docs reflect actual routes/components, with at least one screenshot per main page.
- Results artifact structure is explained and aligns with `server/routers/simulations.py` behavior.
- “Plan” docs are replaced with implementation docs; all internal links updated.
- API reference pages build without autodoc errors.

## Suggested Ordering

1) Server REST docs + results artifact doc
2) Replace client plan docs with implemented guides (Layout Map, Results Compare)
3) Add remaining client pages
4) Cross-linking and polishing

## Notes

- Keep routes and file names consistent with the code cited above.
- Update `mkdocs.yml` navigation to include new pages under “Server” and “Client”.
