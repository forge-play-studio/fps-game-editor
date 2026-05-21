# Round 5：Inspector、Monitor、Material、Outline 迁移记录

## 当前状态

Round 5 在 `@fps-games/editor-babylon` 内新增 Inspector、runtime monitor、material adapter、outline adapter 的通用 Babylon 运行时层。

本轮只处理 runtime object 观测、Inspector UI 对接、canonical change 归一化和 runtime value 应用；不直接写项目 document，不理解项目 scene schema。

## 新增/更新文件

| 文件 | 当前职责 |
| --- | --- |
| `src/inspector-adapter.ts` | 读取 Inspector DOM、同步 transform tool button、控制 picking toggle |
| `src/inspector-host.ts` | show/hide Inspector、注入样式、绑定 property changed observable、selection bridge、context selection callback |
| `src/monitor.ts` | 观测 selected runtime node 的 transform/material/outline 变化，产生 canonical change |
| `src/material-property-adapter.ts` | 归一化 Babylon material property change，支持 runtime material value apply |
| `src/outline-adapter.ts` | 归一化 outline property change，处理 Mesh/InstancedMesh outline target |

## 行为边界

| 能力 | 当前实现 |
| --- | --- |
| Inspector show/hide | 通过 `createEditorInspectorHost()` 管理；优先使用页面注入的 `ensureInspectorReady()`，再 fallback 到全局 `INSPECTOR` 或 Inspector script url |
| Inspector selection bridge | 使用外部 `SelectionController.createV2SelectionBridge()`，不在 Inspector host 内定义项目选择语义 |
| Inspector property changed | material change 转成 `CanonicalMaterialChange`；outline change 只修正 runtime target，后续由 monitor 观测 |
| Monitor transform | 观测 selected node transform，支持多选 follower delta，并通过 `onTransformChange` 回调交给外部持久化层 |
| Monitor material | 观测 material canonical paths，并通过 `onMaterialChange` 回调交给外部持久化层 |
| Monitor outline | 观测 outline canonical paths，并通过 `onOutlineChange` 回调交给外部持久化层 |
| Runtime apply helpers | `applyMaterialValueToRuntimeNode()`、`applyOutlineValueToRuntimeNode()` 只修改 Babylon runtime object |

## 与旧实现的关键差异

| 原实现 | 新实现 |
| --- | --- |
| `runtime-core/monitor.ts` 直接调用 `document.ts` 的 apply/change/batch 函数 | `editor-babylon/src/monitor.ts` 只调用外部 callback，不依赖具体 document |
| `inspector-host.ts` 直接通过 `window.__bridge.messenger` 发送 context selection | `editor-babylon/src/inspector-host.ts` 通过 `onContextSelection` callback 输出序列化结果 |
| material/outline adapter 使用项目类型名和直接 Babylon imports | 新实现使用 protocol 类型，并通过 injected/global Babylon runtime 创建 Color3/Texture |
| Gizmo/Inspector patch 使用项目标记名 | 新实现使用 `fpsEditor` 标记名，不写宿主专属全局 fallback |

## 边界状态

`@fps-games/editor-babylon` 当前仍不包含以下项目专属依赖：

- `lumber_order` config
- `SceneJsonV2Validator`
- `scene-json-v2-rules.json`
- `configService`
- concrete `SceneBuilder`
- concrete `AssetManager`
- gameplay systems

Inspector 和 monitor 只产出通用 runtime change；项目持久化由后续 adapter 接入。

## 验证

已执行：

```bash
npm run check
```

结果：

- package boundary static check 通过
- TypeScript typecheck 通过

本轮尚未接入行为级 fake Babylon tests。

## Review 状态

本记录等待 Round 5 独立 Review Agent 对照 `lumber_order/src/editor-package/runtime-core` 做严格审查。Review 通过前，不进入 Round 6。
