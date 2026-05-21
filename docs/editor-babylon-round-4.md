# Round 4：Babylon 基础运行时能力迁移记录

## 当前状态

Round 4 已新增 `@fps-games/editor-babylon`，迁移范围限定为 Babylon 基础编辑运行时能力：

- viewport camera 创建、移动、对焦和释放
- browser pointer/keyboard event guard
- editor input controller
- Babylon gizmo tool controller
- selection controller 基础状态、多选、viewport/tree source tracking、runtime highlight
- edit session 的进入/退出、相机切换、动画暂停、输入隔离、tool/input/event guard 组合

本轮没有迁移 Inspector host、Inspector adapter、monitor、material property adapter、outline adapter，也没有迁移任何项目 document/schema 逻辑。

## 新增包

| 项 | 当前值 |
| --- | --- |
| Package path | `packages/editor-babylon` |
| Package name | `@fps-games/editor-babylon` |
| Source comparison | `lumber_order/src/editor-package/runtime-core/*` |
| Runtime dependencies | `@fps-games/editor-browser`, `@fps-games/editor-protocol` |
| Project schema dependency | 无 |

## 源文件对照

| 原实现 | 新实现 | 当前迁移状态 |
| --- | --- | --- |
| `runtime-core/types.ts` | `packages/editor-babylon/src/types.ts` | 迁移为 generic runtime aliases 与注入型 options |
| `runtime-core/input-controller.ts` | `packages/editor-babylon/src/input-controller.ts` | 迁移为 `createEditorInputController()` 实例化 controller |
| `runtime-core/camera-controller.ts` | `packages/editor-babylon/src/camera-controller.ts` | 迁移为 `createEditorViewportCamera()` 等 generic API |
| `runtime-core/event-guard.ts` | `packages/editor-babylon/src/event-guard.ts` | 迁移为显式 `createEditorEventGuard()`，无 import-time side effect |
| `runtime-core/tool-controller.ts` | `packages/editor-babylon/src/tool-controller.ts` | 迁移为 `createEditorToolController()`，外部 tool sync 由 callback 注入 |
| `runtime-core/selection-controller.ts` | `packages/editor-babylon/src/selection-controller.ts` | 迁移基础 selection state/bridge/tracking/highlight，外部 panel selector 由 options 注入 |
| `runtime-core/edit-session.ts` | `packages/editor-babylon/src/edit-session.ts` | 迁移为 `createEditorEditSession()`，依赖 host/runtime/game callbacks 注入 |

## API / 行为对照

| 能力 | 原行为 | 新包当前行为 |
| --- | --- | --- |
| 快捷键工具切换 | `q/w/e/r` 切换 pick/move/rotate/scale | 保持一致 |
| undo/redo | `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z` | 保持一致，由 callback 注入 |
| duplicate | `Ctrl/Cmd+D` | 保持一致，由 callback 注入 |
| focus selected | `F` | 保持一致，由 callback 注入 |
| viewport navigation | 右键旋转、滚轮调速/推进、中键平移、WASD/QE 移动 | 保持一致 |
| edit enter | 暂停 game、切编辑相机、冻结运行时输入/部分 observer、暂停动画 | 保持一致 |
| edit exit | 恢复相机、输入、observer、动画和 game pause 状态 | 保持一致 |
| gizmo | 使用 Babylon `GizmoManager` attach selected node | 保持一致，构造器可注入 |
| selection highlight | selected hierarchy meshes `showBoundingBox=true` | 保持一致 |
| Inspector 相关 tool/selection | 原实现直接调用 inspector adapter | 本轮改为 callback/options 注入，不直接依赖 Inspector |

## 边界状态

`@fps-games/editor-babylon` 当前不包含以下项目专属依赖：

- `lumber_order` config
- `SceneJsonV2Validator`
- `scene-json-v2-rules.json`
- `configService`
- concrete `SceneBuilder`
- concrete `AssetManager`
- gameplay systems

本轮新增包只处理 Babylon runtime object 与浏览器事件，不写 `scene.json`，不生成资产注册代码，不处理项目 scene schema。

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

Round 4 独立 Review Agent 已通过本轮审查，未发现 P0/P1。Review 记录的 P2 事项包括补充行为级 fake Babylon tests，以及持续关注跨 iframe DOM 判断、显式 Babylon runtime 注入和宿主专属 fallback 边界。
