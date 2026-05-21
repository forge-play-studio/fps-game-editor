# Round 2 Browser and Forge Play Bridge Migration Record

Date: 2026-05-15

## Scope

Round 2 introduces browser host and Forge Play bridge adapters without changing `lumber_order` runtime registration.

- `@fps-games/editor-browser`: browser/window/document/canvas host abstraction.
- `@fps-games/editor-forge-play`: Forge Play `window.__bridge` registration, messenger helpers, pending runtime/plugin handling, and explicit legacy command bypass helper.

## Source Comparison

| New export | Source equivalent | Notes |
|---|---|---|
| `createBrowserHost` | Browser globals used across `runtime-core/input-controller.ts`, `event-guard.ts`, `monitor.ts` | Centralizes access to `window`, `document`, canvas, focus, events, timers, and iframe detection. |
| `resolveCanvasElement` | Direct canvas access in project runtime code | Generic browser helper with no project schema. |
| `registerForgePlayEditorPlugin` | `registerProjectEditorPlugin()` in `src/editor-package/index.ts` | Sets pending plugin and calls `bridge.registerEditorPlugin` when available. |
| `registerForgePlayEditorRuntime` | `registerProjectEditorRuntime()` in `src/editor-package/index.ts` | Sets pending runtime and calls `bridge.registerEditorRuntime` when available. |
| `registerLegacyRuntimeProxy` | `registerLegacyRuntimeProxy()` in `src/editor-package/index.ts` | Explicit compatibility helper; not part of core runtime. |
| `installLegacyCommandBypass` | `installProjectAssetCommandLegacyBypass()` in `src/editor-package/index.ts` | Explicit compatibility helper with configurable command sets. |
| `emitForgePlayBridgeEvent` | `emitBridgeEvent()` in `src/editor-package/runtime.ts` | Calls `window.__bridge.messenger.event`. |
| `sendForgePlayBridgeMessage` | `emitContextChange()` in `src/editor-package/runtime.ts` | Calls `window.__bridge.messenger.send`. |

## Boundary Status

Round 2 packages do not import from `lumber_order` and do not know Scene JSON V2, concrete `SceneBuilder`, concrete `AssetManager`, or gameplay systems.

Legacy command routing remains isolated in `@fps-games/editor-forge-play`; it is not in `@fps-games/editor-core`.

## Verification Commands

Run from `/Users/admin/work/UGIT/fps-game-editor`:

- `npm run check:boundaries`
- `npm run typecheck`
- `npm run check`
