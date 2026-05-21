# Round 6：聚合入口包迁移记录

## 当前状态

Round 6 已新增聚合入口包 `@fps-games/editor`，提供 `createBabylonForgePlayEditor(...)`。

该入口组合以下已迁移包：

- `@fps-games/editor-core`
- `@fps-games/editor-browser`
- `@fps-games/editor-babylon`
- `@fps-games/editor-forge-play`
- `@fps-games/editor-protocol`

本轮没有修改 `lumber_order` 运行路径，也没有把项目 schema 放入聚合包。

## 新增包

| 项 | 当前值 |
| --- | --- |
| Package path | `packages/editor` |
| Package name | `@fps-games/editor` |
| Main API | `createBabylonForgePlayEditor(...)` |
| Source comparison | `lumber_order/src/editor-package/runtime.ts` + `index.ts` 的通用注册/组合职责 |
| Project schema dependency | 无 |

## 入口能力

`createBabylonForgePlayEditor(...)` 当前负责：

- 创建/复用 `BrowserHost`
- 组合 `createEditorRuntimeShell`
- 组合 `createEditorEditSession`
- 组合 `createEditorSelectionController`
- 组合 `createEditorInspectorHost`
- 组合 `createEditorRuntimeMonitor`
- 注册 Forge Play editor runtime
- 将 `document.export`、`document.commit`、`mode.ready`、`context:change` 等事件接到 Forge Play bridge
- 将 transform/material/outline canonical change 交给项目 `documentAdapter` callback
- 在 edit enter/exit 时启动/停止 runtime monitor
- 在 export/commit/undo/redo/Inspector flush 前 flush runtime monitor
- 为 `document.export` 空结果发送 `document.exported` 失败事件
- 为 `selection.duplicate` 发送 `selection.duplicate.result`
- 默认安装 Forge Play legacy runtime proxy / bypass 兼容层，可通过 options 关闭

## 项目侧必须提供的 adapter

| adapter | 当前职责 |
| --- | --- |
| `documentAdapter` | 提供 document load/export/commit/undo/redo/dirty，以及 transform/material/outline 持久化 callback |
| `sceneAdapter` | 提供 selection normalize、selected entities、duplicate selected、selection committed callback |
| `persistentBindingAdapter` | 将 Babylon runtime node 映射为稳定 persistent binding |
| `lifecycleAdapter` | 提供可选模式变化、tool、focus、duplicate、Inspector override hook |
| `assetAdapter` | 提供可选 platform command handler；具体资产注册规则仍由项目实现 |

## Review 修正状态

Round 6 首轮 Review 发现的 P1 已在本轮内修正：

- monitor 生命周期已接入 `lifecycle.enter/exit`
- direct runtime API 与 core shell 均会在 document 操作前 flush monitor
- keyboard undo/redo 已接入 `createEditorEditSession`
- `document.export` 空结果会发 `document.exported` 失败事件
- `selection.duplicate` 会发 `selection.duplicate.result`
- 主入口默认安装 legacy command bypass；legacy proxy 只在 bridge 已 ready 时注册，避免覆盖 pending project runtime

## 边界状态

`@fps-games/editor` 当前不包含以下项目专属依赖：

- `lumber_order` config
- `SceneJsonV2Validator`
- `scene-json-v2-rules.json`
- `configService`
- concrete `SceneBuilder`
- concrete `AssetManager`
- gameplay systems

聚合入口只组合通用包并调用外部 adapters。项目 authored config、资产注册策略和 runtime binding 仍属于项目 adapter。

## 验证

已执行：

```bash
npm run check
git diff --check
```

结果：

- package boundary static check 通过
- TypeScript typecheck 通过
- whitespace diff check 通过

## Review 状态

Round 6 已通过独立 Review Agent 审查，允许进入 Round 7。最终复审确认 legacy proxy 不再覆盖 pending project runtime，且未发现新的 P0/P1。
