# PR: UI layout cleanup and saved libraries UX polish

## Summary
This PR streamlines the app layout and improves saved libraries UX. The sidebar toggle is now global (next to the theme selector), the header "Project" box is removed, and `SavedLibrariesDropdown` supports inline actions (e.g., Delete Saved) shown only when a saved library is selected. Changelog updated to v0.11.8.

## Changes
- `client/src/App.tsx`:
  - Added global "Toggle Sidebar" button next to Theme Selector; dispatches `wombat:toggle-sidebar`.
- `client/src/components/PageWithLibrary.tsx`:
  - Removed header "Project" box; simplified page chrome.
  - Listens for global sidebar toggle events; removed in-content toggle button.
  - When `projectPlacement="sidebar"`, renders project selector and actions on the same row in the sidebar.
- `client/src/components/SavedLibrariesDropdown.tsx`:
  - Accepts inline `children` actions to render to the right of the selector.
  - Shows actions only when a saved library is selected (working session hides them).
- `client/src/pages/SimulationManager.tsx`:
  - Provides inline Delete Saved action (X) via `projectActions`; visible only when a saved library is selected.
- `client/src/App.css`:
  - Tweaks to `.saved-libs*` classes for responsive inline layout.
- `CHANGELOG.md`: updated to v0.11.8.

## Testing
- Manual:
  - Toggle sidebar using the global button; verify all pages using `PageWithLibrary` respond.
  - Saved libraries selector shows inline X only when a saved library is selected; confirm delete flow.
  - Sidebar resizes/collapses and persists width; no header project box remains.

## Notes
- No breaking API changes.
- UI changes are backwards compatible; `projectPlacement` remains supported.
