# Project Directory Standard

这份文档定义 `lumber_order` 的目录结构约定。

目标只有两个：

1. 让项目内代码知道应该放在哪里
2. 让 runtime、编辑器、配置三条线的职责边界稳定

这不是 `scene.json` 规范文档，也不是某个具体玩法的实现文档。

## Scope

这份文档回答：

1. 项目根目录应该如何组织
2. `src/` 下各目录分别负责什么
3. 哪类代码应该进入哪一层
4. 新功能接入时优先修改哪些位置
5. 常见目录职责混用应该如何避免

不包含：

1. `scene.json` 字段级规范
2. 平台侧 bridge/editor 实现细节
3. 具体玩法设计文档

## Project Layout

当前项目根目录主要包含：

1. `src/`
2. `vite-plugins/`
3. `docs/`
4. `README.md`

### `src/`

项目主代码目录。

### `vite-plugins/`

放开发和构建阶段的 Vite 插件扩展。

当前主要用于：

1. bridge 注入
2. inspector 注入
3. 构建期资源处理

### `docs/`

放项目本地规范和说明文档。

仓库内约定、目录结构、后续配置规范，都应优先沉淀在这里，而不是依赖外部项目文档。

## Src Layout

### `assets/`

放静态资源和资源入口。

适合放：

1. 图片
2. 贴图
3. 模型
4. 音频
5. 资源导出入口

不要在这里放：

1. 资源加载逻辑
2. 运行时状态

### `config/`

放配置文件、配置类型和配置访问层。

适合放：

1. `scene.json`
2. `game.json`
3. `economy.json`
4. `rendering.json`
5. `types.ts`
6. `ConfigService.ts`

这层只负责：

1. 静态配置
2. 类型定义
3. 配置读取和索引

不要在这里放：

1. Babylon 场景操作
2. 具体玩法推进逻辑

### `core/`

放 runtime 总控。

当前核心是：

1. `Game`

它负责：

1. 创建模块
2. 连接模块
3. 驱动主循环
4. 提供项目级 runtime 接入点

不要把具体玩法规则继续堆进 `Game`。

### `fps-game-editor-adapter/`

放项目侧编辑器 adapter。公共编辑器 runtime 已由 npm 包 `@fps-games/editor*` 承担，项目目录只保留 `lumber_order` 自己的 schema、asset、binding 和保存链路。

适合放：

1. document adapter
2. scene adapter
3. asset adapter
4. persistent binding adapter
5. plugin/runtime 注册入口
6. export/commit/duplicate/undo/redo 的项目语义

这层负责：

1. runtime node 与持久化 binding 的映射
2. document 主链
3. 对平台暴露项目编辑器能力
4. 把公共编辑器命令映射到 Scene JSON V2 和 AssetManager

不要在这里放：

1. 具体玩法规则
2. 与编辑器无关的业务代码
3. 公共 selection / Inspector host / monitor / edit session 实现

### `entities/`

放单体对象行为封装。

适合放：

1. player
2. NPC
3. 可交互对象
4. 其他单对象生命周期逻辑

### `services/`

放运行时技术能力模块。

适合放：

1. 资源加载
2. 对象池
3. 场景构建
4. 渲染
5. 阴影
6. 材质
7. 音频
8. VFX
9. 动画
10. 输入服务

这层偏 Babylon/runtime 基础设施。

### `systems/`

放全局规则和状态推进逻辑。

适合放：

1. 游戏流程
2. 规则计算
3. 全局状态更新

这层偏系统，不负责单体对象封装。

### `ui/`

放项目默认 UI。

适合放：

1. 加载页
2. HUD
3. 弹层
4. 其他项目内建 UI

### `utils/`

放无状态工具函数。

适合放：

1. 纯函数
2. 小型转换工具
3. 不依赖 Babylon runtime 的 helper

不要把有状态模块放进 `utils`。

## Directory Decision Rules

遇到“代码应该放哪”的问题，按这套顺序判断：

1. 是配置数据还是运行时代码
2. 是单体对象行为还是全局规则
3. 是技术能力还是业务玩法
4. 是编辑器能力还是游戏 runtime 能力

可以直接套这几个规则：

1. 配置进 `config`
2. 总控进 `core`
3. 项目编辑器 adapter 进 `fps-game-editor-adapter`
4. 单体对象行为进 `entities`
5. 技术基础设施进 `services`
6. 全局规则推进进 `systems`
7. 默认 UI 进 `ui`
8. 纯工具进 `utils`

## Anti-Patterns

这些情况应尽量避免：

1. 把玩法规则塞进 `Game`
2. 把 Babylon 节点操作写进 `config`
3. 把公共编辑器 runtime 复制回项目 adapter
4. 把带状态的服务塞进 `utils`

## Current Extension Priority

当前项目继续初始化时，优先扩展这些地方：

1. `src/config/types.ts`
2. `src/config/*.json`
3. `src/config/ConfigService.ts`
4. `src/fps-game-editor-adapter/*`
5. `src/services/SceneBuilder.ts`
6. `src/core/Game.ts`
