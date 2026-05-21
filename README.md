# fps-game-editor

`fps-game-editor` 是给 Forge Play 游戏项目使用的公共编辑器运行时包。它不理解具体游戏项目的配置 schema，也不直接写项目文件；游戏项目通过 adapter 把通用编辑器能力映射到自己的 authored config、runtime scene、asset registry 和保存链路。

当前 npm 版本：

```text
0.1.0-alpha.0
```

这是 alpha 版本。建议游戏项目先使用精确版本安装，不要依赖浮动的 `latest`。

## 包结构

本仓库是 monorepo，发布到 npm 的包如下：

| 包名 | 用途 |
| --- | --- |
| `@fps-games/editor` | 游戏项目主要使用的聚合入口，提供 `createBabylonForgePlayEditor(...)` |
| `@fps-games/editor-protocol` | 平台、runtime、项目 adapter 共享的协议类型 |
| `@fps-games/editor-core` | command、document、history、selection、lifecycle、capability runtime shell |
| `@fps-games/editor-browser` | 浏览器 host、canvas、pointer、keyboard、iframe/focus 等封装 |
| `@fps-games/editor-babylon` | Babylon 运行时编辑能力：selection、gizmo、Inspector host、monitor、material/outline adapter |
| `@fps-games/editor-forge-play` | Forge Play bridge 注册、消息、事件和兼容层 |

通常游戏项目只需要直接使用 `@fps-games/editor`。如果项目代码直接 import `@fps-games/editor-babylon` 或 `@fps-games/editor-protocol` 的类型或 helper，也要把对应包列为直接依赖。

## 对外使用原则

当前策略是：**多包维护，单入口使用**。

- 代码和发布保持多包结构，因为 protocol、core、browser、Babylon、Forge Play bridge 的职责边界真实存在。
- 游戏项目默认只把 `@fps-games/editor` 当作公共入口，不需要理解内部组合方式。
- `@fps-games/editor-*` 分层包可以发布到 npm，但它们主要服务于聚合包和少数高级接入场景。
- 所有 `@fps-games/*` editor 包采用 lockstep version，同一次发布使用同一个版本号。
- 快速迭代期使用 alpha 精确版本，例如 `0.1.0-alpha.0`、`0.1.0-alpha.1`，游戏项目不要依赖浮动版本。

如果项目临时直接依赖 `@fps-games/editor-babylon` 或 `@fps-games/editor-protocol`，应把它视为当前 adapter 实现细节。后续公共入口会继续补充常用类型和 helper 的 re-export，逐步减少游戏项目需要直接理解的包数量。

## 安装

### 推荐安装方式

如果项目只从聚合入口导入：

```bash
pnpm add @fps-games/editor@0.1.0-alpha.0
```

如果项目 adapter 需要直接导入 Babylon helper 或协议类型，按当前 `lumber_order` 接入方式安装：

```bash
pnpm add @fps-games/editor@0.1.0-alpha.0 @fps-games/editor-babylon@0.1.0-alpha.0 @fps-games/editor-protocol@0.1.0-alpha.0
```

使用 npm：

```bash
npm install @fps-games/editor@0.1.0-alpha.0
```

或：

```bash
npm install @fps-games/editor@0.1.0-alpha.0 @fps-games/editor-babylon@0.1.0-alpha.0 @fps-games/editor-protocol@0.1.0-alpha.0
```

使用 yarn：

```bash
yarn add @fps-games/editor@0.1.0-alpha.0
```

或：

```bash
yarn add @fps-games/editor@0.1.0-alpha.0 @fps-games/editor-babylon@0.1.0-alpha.0 @fps-games/editor-protocol@0.1.0-alpha.0
```

### Vite/TypeScript 配置

正式 npm 接入不需要给 `@fps-games/editor*` 配本地源码 alias。项目里的 Vite alias 和 TypeScript paths 应只保留自己的项目路径，例如：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

不要再配置这类本地源码路径：

```json
{
  "paths": {
    "@fps-games/editor": ["../fps-game-editor/packages/editor/src/index.ts"]
  }
}
```

Vite 也不需要：

```ts
resolve: {
  alias: {
    '@fps-games/editor': '../fps-game-editor/packages/editor/src/index.ts',
  },
}
```

让包管理器从 `node_modules` 解析 npm 包即可。

### 本地源码联调

快速开发时不建议反复走“改 `fps-game-editor` -> 发布 npm -> 游戏项目升级版本”的链路。推荐游戏项目保留正式包名 import，只在本地开发服务里通过环境变量切到源码：

```bash
cd ../lumber_order
pnpm run dev:editor-local
```

`lumber_order` 的 `dev:editor-local` 会设置：

```text
FPS_GAME_EDITOR_ROOT=../fps-game-editor
```

Vite 检测到该变量后，会把以下包临时 alias 到 `fps-game-editor/packages/*/src/index.ts`：

- `@fps-games/editor`
- `@fps-games/editor-babylon`
- `@fps-games/editor-browser`
- `@fps-games/editor-core`
- `@fps-games/editor-forge-play`
- `@fps-games/editor-protocol`

如果仓库不在相邻目录，可以手动指定绝对路径：

```bash
cd /path/to/lumber_order
FPS_GAME_EDITOR_ROOT=/path/to/fps-game-editor pnpm dev
```

这条路径只用于本地联调。正式验证、平台沙盒和 CI 仍应使用 npm 精确版本与 lockfile。

## 游戏项目接入步骤

### 1. 安装 npm 包

按项目实际 import 安装依赖。对现阶段 Forge Play + Babylon 项目，推荐先使用：

```bash
pnpm add @fps-games/editor@0.1.0-alpha.0 @fps-games/editor-babylon@0.1.0-alpha.0 @fps-games/editor-protocol@0.1.0-alpha.0
```

### 2. 保留项目自己的 adapter

`fps-game-editor` 只提供公共 runtime。项目仍然需要自己的 adapter，负责：

- 把 runtime node 映射回项目 document binding。
- 把 transform/material/outline 等 runtime change 写回项目 authored config。
- 实现 undo/redo、dirty、export、commit。
- 实现 duplicate、selection normalize、asset import 等项目语义。
- 把保存结果交给平台或项目自己的文件写入链路。

也就是说，公共包负责编辑器流程，项目 adapter 负责项目 schema。

### 3. 创建 runtime bridge

示例：

```ts
import {
  createBabylonForgePlayEditor,
  type EditorDocumentAdapter,
  type SceneAdapter,
} from '@fps-games/editor';

const documentAdapter: EditorDocumentAdapter = {
  ensureLoaded() {
    // 读取或初始化项目 authored config。
  },
  isDirty() {
    return false;
  },
  canUndo() {
    return false;
  },
  canRedo() {
    return false;
  },
  exportDocument() {
    // 返回可交给平台保存的 document payload。
    return {};
  },
  commitSavedDocument(args) {
    // 将平台保存结果同步回项目 document 状态。
  },
  undo() {
    return null;
  },
  redo() {
    return null;
  },
  applyTransformChange(change, context) {
    // 把 Babylon transform change 映射回项目配置。
    return true;
  },
};

const sceneAdapter: SceneAdapter = {
  normalizeSelection({ rawEntity }) {
    // 可选：把 picked mesh 归一到项目 authoring node。
    return rawEntity;
  },
};

const editor = createBabylonForgePlayEditor({
  autoRegister: true,
  registerLegacyProxy: false,
  installLegacyBypass: false,
  scene: () => window.gameInstance?.scene ?? null,
  game: () => window.gameInstance ?? null,
  canvas: 'renderCanvas',
  babylon: window.BABYLON,
  documentAdapter,
  sceneAdapter,
  persistentBindingAdapter: {
    resolveBinding(node) {
      // 返回稳定项目 binding，例如 { kind: 'sceneNode', nodeId: '...' }。
      return node?.metadata?.persistentBinding ?? null;
    },
  },
  capabilities: {
    documentCommit: true,
    documentExport: true,
    inspector: true,
    materialEditing: true,
    outlineEditing: true,
    transformGizmo: true,
    undoRedo: true,
  },
});

editor.register();
```

### 4. 在项目入口启用

游戏项目可以在初始化完成后动态加载 adapter：

```ts
if (import.meta.env.DEV) {
  const { createProjectEditorRuntimeBridge } = await import('./fps-game-editor-adapter/runtime');
  createProjectEditorRuntimeBridge({
    canvas: 'renderCanvas',
  });
}
```

`fps-game-editor` 不要求项目保留旧 `editor-package`。如果项目已经决定走公共包路径，可以删除旧 runtime fallback，避免判断混乱。

## 职责与排障入口

接入项目不需要在本地打开公共包调试器，但需要明确问题归属：

- 项目 schema、scene document、asset registry、binding、undo/redo、export/commit 问题，先看项目自己的 `src/fps-game-editor-adapter/*`。
- edit mode、selection、Inspector host、runtime monitor、command shell 的通用行为，归属 `fps-game-editor` 公共包。
- Sandbox 内 npm 包无法解析、依赖安装没有触发、dev server 没重启，归属 Forge Play 平台和 dev supervisor。
- 旧 `src/editor-package` 不再是公共包接入项目的排障入口。

项目 adapter 需要保证命令语义是原子的。以 `asset.import` 为例，返回成功应同时代表 authored document 已写入、runtime node 已创建并可选中；如果 runtime 创建失败，应回滚 document 变更并返回失败。

## Forge Play / Inspector 注意事项

- Forge Play 平台侧只负责 transport、意图传输和文件保存，不理解项目 schema。
- `@fps-games/editor-forge-play` 负责和 `window.__bridge` 通信。
- Babylon Inspector 的加载建议继续由项目侧 Vite 插件提供，例如注入 `ensureInspectorReady()`。公共 editor runtime 会优先使用页面已有的 Inspector loader。
- 公共包会在注册 runtime 时安装 Forge Play bridge 的 Inspector loader patch，项目入口不应再手写 `window.__bridge.editor.showInspector/loadV2` monkey patch。
- Inspector 不是数据权威。Inspector 或 runtime 上的变化必须由项目 adapter 映射回 document。

## 当前参考接入

当前 `lumber_order` 已经改为从 npm 安装：

```json
{
  "dependencies": {
    "@fps-games/editor": "0.1.0-alpha.0",
    "@fps-games/editor-babylon": "0.1.0-alpha.0",
    "@fps-games/editor-protocol": "0.1.0-alpha.0"
  }
}
```

它同时移除了 `@fps-games/editor*` 的本地源码 alias 和 `FPS_GAME_EDITOR_ROOT` 运行路径。

## 本仓库开发

安装依赖后可运行：

```bash
npm run check
```

构建所有包：

```bash
npm run build
```

检查 npm tarball 内容：

```bash
npm run pack:dry-run
```

发布 alpha 包：

```bash
npm run publish:next
```

发布前必须确认：

- `npm run check` 通过。
- `npm run pack:dry-run` 里每个包只包含 `dist` 和 `package.json`。
- 每个包的 `exports` 指向真实存在的 `dist/index.js` 和 `dist/index.d.ts`。
- 版本号已经同步更新到所有 `@fps-games/*` 包。
- 底层包先发布，最后发布 `@fps-games/editor` 聚合入口，减少 registry 同步窗口里聚合包依赖不可解析的风险。
- 游戏项目升级时使用精确版本，并提交 lockfile。

## 设计文档

当前架构基线文档：

- [docs/fps-game-editor-architecture.html](docs/fps-game-editor-architecture.html)

总体原则：

- 快速迭代，方向正确优先。
- 公共包不承载项目 schema。
- 项目 adapter 更新 authored config。
- `SceneBuilder` 消费最终配置。
- Inspector/runtime change 必须回写 document，不能让 runtime 成为数据权威。
