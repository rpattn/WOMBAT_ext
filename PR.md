# PR: Simulation progress bar, responsive panels, and layout polish

## Summary
Improves the Run Simulation experience with a themed progress bar and toast notifications, makes resizable panels responsive on small screens, and refines dark-mode and container layout styling. Updates CHANGELOG to v0.11.12.

## Rationale
- Provide clear, accessible feedback while simulations run.
- Prevent horizontal overflow and awkward layouts on mobile by disabling resize and using full-width containers.
- Unify styling across light/dark themes with CSS variables.

## Changes
- `client/src/pages/RunSimulation.tsx`
  - Added progress UI using `.progress`/`.progress-bar` classes with ARIA attributes and animated stripes while active.
  - Integrated toasts via `useToasts()` for run, fetch config, clear temp, refresh files, and save project.
  - After run, auto-open the latest `results/<DATE>/summary.yaml` with success/warn feedback.
  - Passed `disableBelow={768}` to `ResizeWrapper` to disable resizing on small screens.
- `client/src/components/ResizeWrapper.tsx`
  - Added `disableBelow?: number`. When `window.innerWidth < disableBelow`, hide the resizer and filler, and expand aside to 100% width.
- `client/src/index.css`
  - Introduced progress variables (`--progress-track`, `--progress-fill`) and styles for `.progress` and `.progress-bar` with reduced-motion support.
- `client/src/App.css`
  - Small-screen rules to force `.app-container`, `.app-container-slim`, `.app-full`, and side panes to 100% width and avoid overflow; adjusted `.row` for mobile.
- Minor UI cleanups:
  - `client/src/components/SimulationControls.tsx`: simplified container wrappers.
  - `client/src/components/ResultsSummary.tsx`: trimmed noisy fields in Simulation section.

## Testing
- Run page: start a simulation and verify the progress bar animates and percent/now labels update; toasts show on run success/failure and auxiliary actions.
- Theme: toggle dark/light (via `ThemeSelector`) and verify the progress track/fill adapt with sufficient contrast.
- Responsive: narrow viewport <768px and confirm the resizer disappears, the sidebar/content fit the screen, and no horizontal scrolling occurs.
- Accessibility: inspect progressbar element for ARIA attributes and ensure reduced-motion users do not see stripes animation.

## Risks / Rollout
- Low risk; client-only.
- New prop in `ResizeWrapper` is optional and defaults to existing behavior on large screens.

## Follow-ups
- Consider showing ETA if available from progress payload.
- Optionally add a compact progress widget to Navbar.

## Changelog
- Updated `CHANGELOG.md` to v0.11.12.
