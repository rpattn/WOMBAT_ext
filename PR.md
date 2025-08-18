# PR: UI improvements for Results and saved libraries integration

## Summary
This PR enhances the Results viewing experience, introduces a reusable page layout with saved libraries switching, and expands the API context and hooks to support these flows. It also updates the changelog for v0.11.5.

## Changes
- Results page (`client/src/pages/Results.tsx`):
  - Inline HTML preview via sandboxed iframe (`srcDoc`) and "Open in new tab" action.
  - Inline PNG preview using object URLs with loading guard.
  - Added "Refresh Files" button and default expansion of `results/` folder.
- New layout (`client/src/components/PageWithLibrary.tsx`):
  - Collapsible, resizable sidebar with persisted width.
  - Integrated `SavedLibrariesDropdown` for switching between working session and saved libraries.
- New component: `client/src/components/SavedLibrariesDropdown.tsx`.
- API context (`client/src/context/ApiContext.tsx`):
  - Exposes saved libraries state and schema helpers (`listSchemas`, `getSchema`).
  - Unified refresh behavior with mock worker fallbacks.
- Hook updates (`client/src/hooks/useLibrary.ts`):
  - Stronger mock worker fallbacks for saved libraries and file ops.
  - `readFile` supports raw text (HTML/CSV/YAML) and binary (PNG) previews.
  - Helpers for `loadSaved`, `restoreWorking`, and `deleteSaved`.
- Changelog: update `CHANGELOG.md` to v0.11.5 (18 Aug 2025).

## Testing
- All tests pass locally.
- Manual verification:
  - Switch between working session and saved libraries.
  - Preview YAML, CSV, HTML, and PNG in Results.
  - Resize/collapse sidebar persists across reloads.

## Notes
No breaking API changes. UI strings and behaviors are backwards compatible.
