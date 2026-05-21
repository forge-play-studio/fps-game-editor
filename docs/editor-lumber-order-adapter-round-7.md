# Round 7：lumber_order adapter 并行接入记录

## 当前状态

Round 7 已在 `lumber_order` 中新增 `fps-game-editor` 并行接入层。旧的 `lumber_order/src/editor-package` 代码没有移动、删除或替换，默认运行路径仍然使用旧 `registerProjectEditorRuntimeBridge()`。

新入口通过 `VITE_USE_FPS_GAME_EDITOR=true` 在开发环境启用：

```ts
const { registerLumberOrderFpsGameEditorRuntimeBridge } =
  await import('./editor-package/fps-game-editor-runtime');
registerLumberOrderFpsGameEditorRuntimeBridge();
```

## 新增项目侧文件

| 文件 | 当前职责 |
| --- | --- |
| `lumber_order/src/editor-package/fps-game-editor-runtime.ts` | 组装 `@fps-games/editor` 聚合入口，并把 `lumber_order` 的 document、scene、binding 能力适配给通用 editor runtime。 |
| `lumber_order/src/editor-package/fps-game-editor-asset-adapter.ts` | 复用现有 `AssetManager`、`SceneAssetPlacement`、`SceneAssetUsage` 和 document scene node API 处理资产注册、导入、删除和 scene node create/patch/remove 命令。 |

## 当前复用关系

| 通用 editor adapter | `lumber_order` 复用源 |
| --- | --- |
| `EditorDocumentAdapter` | `document.ts` 的 `ensure/export/commit/undo/redo/apply transform/material/outline` 函数 |
| `PersistentBindingAdapter` | `adapter.ts` 的 `lumberOrderEditorPlugin.resolvePersistentBinding` |
| `SceneAdapter` | `adapter.ts` 的 `normalizeSelection` 和 `duplicateSelection` |
| `AssetAdapter` | `services/AssetManager`、`services/SceneAssetPlacement`、`services/SceneAssetUsage`、`document.ts` 的 scene node API |
| Forge Play bridge | `@fps-games/editor` 聚合入口和 `@fps-games/editor-forge-play` |

## 配置现状

`lumber_order` 当前通过本地 sibling repo 源码别名接入 `fps-game-editor`：

| 配置文件 | 当前内容 |
| --- | --- |
| `lumber_order/tsconfig.json` | 增加 `@fps-games/editor*` 到 `../fps-game-editor/packages/*/src/index.ts` 的 paths。 |
| `lumber_order/vite.config.ts` | 增加同一组 Vite alias，供开发期动态导入解析；优先使用 `FPS_GAME_EDITOR_ROOT`，再使用 sibling repo。 |
| `lumber_order/scripts/platform-sim/runner.mjs` | dry-run 临时工作区启动 Vite 时注入 `FPS_GAME_EDITOR_ROOT`，避免临时目录下 sibling alias 失效。 |

该配置用于迁移期本地并行验证。正式包发布后，应由包管理器依赖替代 sibling source alias。

## 当前验证

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| `fps-game-editor` | `npm run check` | 通过 |
| `lumber_order` | `npm run typecheck` | 通过 |
| `lumber_order` | `npm run test:asset-manager-boundaries` | 通过 |
| `lumber_order` | `npm run sim:platform` | 通过，dry-run 黄金链路返回 `asset-drop-save-commit` ok |

## 当前 Review 结论

Round 7 已通过独立 Re-Review Agent 审查，允许进入下一轮。复审确认：

- 默认入口仍只静态引用旧 `editor-package` runtime，新 runtime 只通过 `VITE_USE_FPS_GAME_EDITOR=true` 的动态 import 触达。
- 新 runtime 的 undo/redo 已同步 selection 并执行 monitor rebase，覆盖 direct API 和 bridge command path。
- `createBabylonForgePlayEditor(...)` 在 scene resolver 返回空时会回退 `Editor.init(scene)` 保存的 scene。
- Mock Platform dry-run 会显式 reload iframe 来模拟平台刷新，因此不依赖 Vite HMR 侦测 generated registry 文件变更。
- 未发现新的 P0/P1。

## 当前边界

- 通用包仍不依赖 `lumber_order`、`SceneBuilder`、`AssetManager`、`configService` 或 Scene JSON V2 具体实现。
- 项目 schema、资产注册、Scene JSON V2 写入仍停留在 `lumber_order` adapter 层。
- 默认游戏入口未切到新 runtime；只有 `VITE_USE_FPS_GAME_EDITOR=true` 时启用并行路径。
- 默认入口通过 `@vite-ignore` 的动态 import 加载新 runtime，避免未启用时进入 Vite 默认依赖扫描。
- 旧 `src/editor-package` 仍作为基准实现保留。
