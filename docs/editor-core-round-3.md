# Round 3 Editor Core Migration Record

Date: 2026-05-15

## Scope

Round 3 introduces `@fps-games/editor-core` as the generic runtime shell layer.

This round intentionally does not migrate `lumber_order/src/editor-package/document.ts` Scene JSON V2 logic. Project document persistence remains behind `DocumentAdapter`.

## Implemented Package Surface

| New export | Source equivalent | Notes |
|---|---|---|
| `DocumentAdapter` | `ensureProjectEditorDocumentLoaded`, `isProjectEditorDocumentDirty`, `exportProjectEditorDocument`, `commitProjectEditorDocumentSave`, `undoProjectEditorDocumentChange`, `redoProjectEditorDocumentChange` | Generic adapter contract only. No Scene JSON V2 implementation. |
| `LifecycleAdapter` | `projectEditSession.enter/exit`, inspector show/hide, tool/focus helpers in `runtime.ts` | Generic lifecycle contract only. |
| `RuntimeSelectionAdapter` | `projectSelection.getSelectedEntity/selectEntity` | Generic selection bridge. |
| `RuntimeEventSink` | `emitBridgeEvent`, `emitContextChange`, `publishDocumentStatus` | Generic event sink for platform-specific adapters. |
| `CommandDispatcher` | `handleCommand(...)` switch in `runtime.ts` | Generic command registry with default command handlers. |
| `CapabilityRegistry` | capability design consensus | Stores feature flags/capabilities. |
| `EditorRuntimeShell` | `createProjectEditorRuntimeBridge()` runtime shell responsibilities | Coordinates adapters for mode change, undo/redo, export/commit, inspector flush, duplicate. |
| `createEditorRuntimeShell` | factory equivalent | Convenience constructor. |

## Default Commands Covered

- `mode.change`
- `history.undo`
- `history.redo`
- `document.export`
- `document.commit`
- `inspector.flush`
- `selection.duplicate`

Asset registration/import/remove and scene node create/patch/remove are not implemented in core. They remain project adapter or later extension commands.

## Boundary Status

`@fps-games/editor-core` imports only `@fps-games/editor-protocol`. It does not import or reference project schema, concrete `SceneBuilder`, concrete `AssetManager`, or gameplay systems.

## Verification Commands

Run from `/Users/admin/work/UGIT/fps-game-editor`:

- `npm run check:boundaries`
- `npm run typecheck`
- `npm run check`
