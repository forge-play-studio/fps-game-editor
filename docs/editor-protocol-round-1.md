# Round 1 Protocol Migration Record

Date: 2026-05-15

## Scope

Round 1 introduces the first generic package in `fps-game-editor`:

- Package: `@fps-games/editor-protocol`
- Path: `packages/editor-protocol`
- Source comparison: `/Users/admin/work/UGIT/lumber_order/src/editor-package/types.ts`

This round does not modify `lumber_order` and does not change any runtime registration path.

## Implemented Package Surface

| New export | Source equivalent | Notes |
|---|---|---|
| `Vec3` | `Position3D` / `Scale3D` shape from project config | Generic base vector type owned by protocol. |
| `ColorRGB` | `ColorRGB` from project config | Generic base color type owned by protocol. |
| `PersistentBinding` | `ProjectPersistentBinding` | Same `sceneNode` binding shape, with `unknown` runtime node. |
| `PersistentBindingSnapshot` | `ProjectPersistentBindingSnapshot` | Same snapshot shape. |
| `RuntimeProp` | `ProjectRuntimeProp` | `position / rotation / scaling`. |
| `MaterialRuntimeKind` | `ProjectMaterialRuntimeKind` | `pbr / standard / unknown`. |
| `MaterialProp` | `ProjectMaterialProp` | Same material canonical property union. |
| `MaterialValue` | `ProjectMaterialValue` | Same value union, using protocol `ColorRGB`. |
| `OutlineProp` | `ProjectOutlineProp` | Same outline canonical property union. |
| `OutlineValue` | `ProjectOutlineValue` | Same value union, using protocol `ColorRGB`. |
| `EditorDocumentExport` | `ProjectEditorDocumentExport` | Same export payload shape. |
| `EditorDocumentCommitArgs` | `ProjectEditorDocumentCommitArgs` | Same commit payload shape. |
| `EditorDuplicateResult` | `ProjectEditorDuplicateResult` | Same duplicate result shape. |
| `EditorRuntimeApi` | `ProjectEditorRuntimeApi` | Same runtime API shape with generic `unknown`. |
| `EditRuntimeApi` | `ProjectEditRuntimeApi` | Same edit-mode API shape. |
| `EditorRuntime` | `ProjectEditorRuntime` | Same runtime container shape. |
| `SelectionController` | `ProjectSelectionController` | Same selection controller shape. |
| `EditorRuntimeChange` | `ProjectEditorRuntimeChange` | Same transform/material/outline/selection change union. |
| `EditorPluginContext` | `ProjectEditorPluginContext` | Same `scene/game` context shape with `unknown`. |
| `EditorPlugin` | `ProjectEditorPlugin` | Same plugin hooks. |
| `EditorBridgeLike` | `Window.__bridge` shape in `types.ts` | Bridge shape moved out of global declaration. |
| `EDITOR_COMMAND_NAME` | `runtime.ts` command constants | Shared command name constants. |
| `EDITOR_EVENT_NAME` | `runtime.ts` event constants | Shared event name constants. |
| `EDITOR_POST_MESSAGE` | `runtime.ts` post message constants | Shared postMessage constants. |
| `EDITOR_CAPABILITY` | Design consensus | Capability names for version/capability handshake. |

## Migration Aliases

The package also exports `Project*` type aliases matching the current project-side names. They exist only to make later migration rounds mechanically safer; generic packages should prefer the `Editor*` names.

## Boundary Status

`@fps-games/editor-protocol` intentionally has no imports and contains no project schema dependency. It must not reference:

- `SceneJsonV2Validator`
- `scene-json-v2-rules.json`
- `configService`
- concrete `SceneBuilder`
- concrete `AssetManager`
- gameplay systems

The static boundary check is `npm run check:boundaries`.

## Verification Commands

Run from `/Users/admin/work/UGIT/fps-game-editor`:

- `npm run check:boundaries`
- `npm run typecheck`

For the current local environment, `npm run typecheck` requires TypeScript to be installed in this repository or available through the workspace install. During this round, the same check can also be run with the `tsc` binary from `lumber_order` if dependencies have not been installed here yet.
