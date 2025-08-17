# Client Feature Plan: Simulation Results and Event Comparison (Plotly)

Last updated: 2025-08-17 15:47 (local)

## Goals

- Provide a new client page to explore simulation results and compare multiple runs.
- Reuse existing server endpoints for listing and fetching result/event files.
- Visualize with Plotly (interactive charts + export).

## Server Endpoints to Reuse (no new API)

- `POST /{client_id}/simulate` → run sync; saves `results/{timestamp}_summary.yaml`.
- `POST /{client_id}/simulate/trigger` and `GET /simulate/status/{task_id}` → async.
- `GET /{client_id}/library/files` → list all files in the client library.
- `GET /{client_id}/library/file?path=...&raw=...` → read parsed YAML/JSON or raw file.

These cover listing, fetching, and generating results. No new endpoints required.

## New Client Route/Page

- Route: `/results/compare` (lazy-loaded)
- Page: `ResultsCompare` with subcomponents below.

## Components

- RunSelector
  - Lists available run result files (e.g., `results/*.yaml`) and event files.
  - Multi-select; optional toggles: “Include events”, “Summary only”.
- MetricPicker
  - Shows metrics derived from summary YAML keys and event columns.
  - Searchable; supports pinning a baseline metric group.
- PlotArea
  - Plotly charts: line, bar/stacked, histogram/box, scatter.
  - Supports layout presets, legend toggles, and image export.
- ResultsTable
  - Tabular comparison of selected metrics across runs.
  - Sortable; CSV export.
- RunBadges
  - Quick stats (min/median/max, sums, deltas vs baseline).

## Client Data Layer (lib/api.ts)

- listFiles(clientId): GET `/{client_id}/library/files`
- readFile(clientId, path, { raw? }): GET `/{client_id}/library/file?path=...&raw=...`
- triggerRun(clientId) [optional]: POST `/{client_id}/simulate`

## Processing Utilities (utils/results.ts)

- parseSummaryYaml(yamlText): object (via js-yaml)
- parseCsvEvents(csvText): rows[] (via PapaParse)
- normalizeForPlotly({ summary, events }) →
  - Canonical keys:
    - Summary: energy_mwh, total_cost_usd, downtime_hours, etc.
    - Events: timestamp, event_type, subsystem, duration_h, cost_usd, etc.
  - Outputs Plotly-ready traces: { x, y, name, type }[] and derived tables.

## Plot Types and Mappings

- Summary comparison: bar/line per run for chosen metrics.
- Event time series: line/stacked area over time (group by type/subsystem).
- Distributions: histograms/box plots for durations/costs.
- Category aggregations: stacked bars by event type/subsystem (counts or totals).

## Performance

- Virtualize long file lists in RunSelector.
- Cache parsed files in-memory by `path` (and `mtime` if available).
- Incremental fetch: only load files when selected.
- Memoize derived datasets with useMemo.

## UX Details

- Baseline pinning (Run A) and % deltas in ResultsTable.
- Persist UI selections in localStorage per `client_id`.
- Graceful handling of large CSV (PapaParse streaming if needed).

## Dependencies

- Plotly: `plotly.js-dist-min`
- YAML: `js-yaml`
- CSV: `papaparse`

## Data Flow

1. ResultsCompare mounts → list files via `/{client_id}/library/files`.
2. User selects runs/events → fetch files via `/{client_id}/library/file`.
3. Parse + normalize → build Plotly traces and table rows.
4. Render charts and table; enable export actions.

## Open Questions

- Event file locations/names: currently only summaries are known (`results/{ts}_summary.yaml`).
  - If event logs are not yet produced, ship summary comparison first, add events when available.

## Implementation Steps

- Create `client/src/lib/api.ts` wrappers.
- Create `client/src/pages/ResultsCompare.tsx` with components:
  - RunSelector, MetricPicker, PlotArea, ResultsTable, RunBadges.
- Create `client/src/utils/results.ts` for parsers and normalizers.
- Add lazy route in `client/src/App.tsx`.
- Add minimal tests and docs.

## Testing

- Unit: `normalizeForPlotly`, `parseSummaryYaml`, `parseCsvEvents`.
- Component: RunSelector, MetricPicker with mocked API.

## Documentation

- Link this plan from `docs/examples/index.md` or `docs/examples/how_to.md`.
- Add a short “How to compare runs” guide with screenshots once the feature is live.
