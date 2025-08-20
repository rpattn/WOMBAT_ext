# PR: Client Gantt filtering, chart variants, and render stability

## Summary
Enhances the client Gantt page with powerful filtering and multiple chart variants aligned with server examples. Stabilizes Plotly rendering to avoid initial flicker/disappearance. Updates CHANGELOG to v0.11.10.

## Rationale
- Better explore results by filtering vessels, time ranges, and text.
- Provide alternate visualizations (duration-colored CTV repairs and aggregated repair request windows) inspired by `examples/dinwoodie_gantt_chart_plotly.py`.
- Improve UX by switching to `Plotly.react` and preventing transient clears.

## Changes
- `client/src/pages/Gantt.tsx`
  - Added filters: vessel multi-select, min duration (h), date range, text search.
  - Added chart selector with three modes: `ctv_vessel`, `ctv_duration`, `repair_requests`.
  - Extended `Segment` to include `action` (maintenance|repair) for variant filtering.
  - Implemented `buildPlotlyTimeline(segments, chartType)` generating traces/layout per variant.
  - Duration color scale set to `RdYlGn_r` (short→green, long→red) for consistency with examples.
  - Switched to `Plotly.react` and kept existing plot when filtered data is empty to avoid flicker.
- `CHANGELOG.md`
  - Added v0.11.10 entry describing the above.

## Testing
- Manual:
  - Load a results CSV containing events; verify segments appear.
  - Toggle chart selector across the three modes; ensure plot updates without disappearing.
  - Apply filters (vessels, min duration, date range, text) and confirm traces update accordingly; observe counter "filtered of total".
  - Toggle theme; verify axis/grid/text colors adapt (CSS variables).

## Risks / Rollout
- Low risk; changes are client-only. Uses existing CSV data and does not alter server APIs.
- The aggregated “repair requests” view approximates durations by span of events per request_id; acceptable for client visualization.

## Follow-ups
- Optionally add a "detailed" tasks chart equivalent to `create_detailed_gantt_chart_plotly()` server example.
- Persist filter selections via URL or localStorage.

## Changelog
- Updated `CHANGELOG.md` to v0.11.10.
