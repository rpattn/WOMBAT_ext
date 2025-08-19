# PR: UI layout cleanup and saved libraries UX polish

## Summary
Streamlines page chrome and consolidates project controls into the sidebar. Introduces a global sidebar toggle, simplifies `PageWithLibrary` header, and polishes saved libraries UX with inline actions that only appear when relevant. Includes CHANGELOG update to v0.11.8.

## Rationale
- Reduce visual clutter by removing the header “Project” section.
- Make sidebar behavior consistent across pages via a global control.
- Clarify saved libraries actions and avoid showing destructive actions when they don’t apply (working session).

## Changes
- `client/src/App.tsx`
  - Adds global "Toggle Sidebar" control next to Theme Selector; dispatches `wombat:toggle-sidebar`.
- `client/src/components/PageWithLibrary.tsx`
  - Removes header "Project" box; listens to global toggle events (`wombat:toggle-sidebar`, `wombat:show-sidebar`, `wombat:hide-sidebar`).
  - When `projectPlacement="sidebar"`, renders project selector and related actions inline within the sidebar panel.
  - Moves optional `projectActions` under the main content area when `projectPlacement!=='sidebar'`.
- `client/src/components/SavedLibrariesDropdown.tsx`
  - Accepts inline `children` actions; only rendered when `value` (a saved library) is selected.
  - Minor layout tweaks for better wrapping on small widths.
- `client/src/pages/SimulationManager.tsx`
  - Integrates with new sidebar project placement; shows inline Delete Saved ("X") only when a saved library is selected.
- `client/src/pages/ResultsCompare.tsx`
  - Opts in to `projectPlacement="sidebar"` for consistent layout.
- `client/src/App.css`
  - Tweaks `.saved-libs*` styles for responsive inline layout.
- `CHANGELOG.md`
  - Adds v0.11.8 entry covering these UI and UX updates.

## Testing
- Unit/Integration: `npm run test` — all tests passing locally.
- Manual:
  - Use the global toggle to collapse/expand the sidebar; verify it affects pages using `PageWithLibrary`.
  - In `Simulation Manager`, select a saved library; confirm inline Delete (X) shows, performs delete, and hides for working session.
  - Confirm no header project box appears and that controls render inside the sidebar when `projectPlacement="sidebar"`.

## Risks / Rollout
- Low risk. Changes are UI-only and backwards compatible.
- Pages not opting into `projectPlacement="sidebar"` continue to render `projectActions` below main content.

## Follow-ups (Optional)
- Consider keyboard shortcut for sidebar toggle.
- Add e2e snapshot(s) to cover presence/absence of inline actions for saved vs working sessions.

## Changelog
- Updated `CHANGELOG.md` to v0.11.8.
