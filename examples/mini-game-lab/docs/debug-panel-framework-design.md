# Debug Panel Framework 设计说明

## 背景

`lumber_order` 先把 `axe_and_bear` 中的 Debug Panel Framework 视作测试版来源，将项目无关核心复制到当前项目内继续规范化。当前阶段不抽共享包，目标是在本项目中验证更干净的框架边界，再择机抽成 `@fps-playable/debug-panel-framework`。

## 边界

框架分为两类代码：

- 框架空间：`src/debug/framework/*`、`src/debug/framework-session.ts`。AI 不能修改 Layer 1-3 框架代码，除非明确在做框架自身演进。
- 项目空间：`src/debug/framework-config.ts`、`src/debug/panels/*.panel.json`、游戏 runtime controllers。AI 可以在这里新增面板和项目胶水。

框架核心不能写死游戏业务路径、资源路径或具体 config 文件路径。配置持久化必须通过项目侧 adapter 注入。

## 数据流

```text
panel JSON DSL
  -> PanelDSLLoader 校验
  -> CodeGenerator 渲染 DOM 控件
  -> LiveBindingRegistry 调 runtime controller
  -> ConfigBridge 通过 adapter 保存配置
```

普通参数变化走 `controller + runtimePath`：

```text
panel value changed
  -> controller.applyLivePatch(patch)
```

一次性调试动作走 `action`：

```text
action button clicked
  -> controller.invokeAction({ action, args })
```

## 当前落地

- 已复制框架核心到 `src/debug/framework/*`。
- 已新增 `src/debug/framework-session.ts`。
- 已新增 `src/debug/framework-config.ts`，作为 `lumber_order` 项目胶水。
- 已将 `ConfigBridge` 改为 adapter 模式，避免框架核心写死 Vite endpoint。
- 已新增最小面板 `src/debug/panels/runtime-probe.panel.json`。
- 已在 `Game` 中注册 `runtimeProbe` controller。
- 当前默认同时挂载旧 `src/debug/live-panel.ts` 和新 Debug Panel Framework；新框架测试不得影响旧面板使用。

## 后续方向

- 把 `CodeGenerator` 拆成 control renderer registry。
- 增加 scene node picker / asset picker 等项目侧控件，但控件必须通过 controller 调项目侧 API。
- Debug panel 若涉及静态场景变更，必须走 AssetManager、`scene.node.*` 或 editor document API，不能绕过 Scene JSON V2 validator。
- 旧 `live-panel.ts` 暂时保留并继续默认启用；后续只有在明确确认替代方案稳定后，才讨论迁移或下线。
