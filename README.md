# fps-game-editor

`fps-game-editor` 是给 Forge Play 游戏项目使用的公共编辑器运行时包。它不理解具体游戏项目的配置 schema，也不直接写项目文件；游戏项目通过 adapter 把通用编辑器能力映射到自己的 authored config、runtime scene、asset registry 和保存链路。

当前 npm 版本：

```text
0.1.0
```

这是 0.1.x 初始版本。建议游戏项目先使用精确版本安装，不要依赖浮动的 `latest`。

## 快速开始

如果只是开发编辑器框架，优先启动轻量 editor lab：

```bash
npm install
npm run dev:editor-lab
```

如果要验证“编辑器修改 -> 保存 -> GameWorld 运行态消费”的完整闭环，启动 mini game lab：

```bash
cd examples/mini-game-lab
npm install
cd ../..
npm run dev:mini-game-lab
```

默认地址：

```text
http://localhost:5184
```

如果是首次 clone 且 mini-game-lab 资产缺失，请先确认 Git LFS 已启用：

```bash
git lfs install
git lfs pull
```

常用检查：

```bash
npm run check
npm run typecheck:mini-game-lab
npm run build:editor-lab
npm run pack:dry-run
```

## 包结构

本仓库内部仍然按职责保留 monorepo 分层，但 npm 对外只发布一个包：

| 包名 | 用途 | 发布状态 |
| --- | --- | --- |
| `@fps-games/editor` | 游戏项目唯一安装入口，提供 EditorWorld、authoring host、Babylon/Forge Play 接线等公共能力 | 发布 |
| `@fps-games/editor-protocol` | 平台、runtime、项目 adapter 共享的协议类型 | 内部 workspace，随 `@fps-games/editor` 打包 |
| `@fps-games/editor-core` | command、document、history、selection、lifecycle、capability runtime shell | 内部 workspace，随 `@fps-games/editor` 打包 |
| `@fps-games/editor-browser` | 浏览器 host、canvas、pointer、keyboard、iframe/focus、EditorWorld UI 等封装 | 内部 workspace，随 `@fps-games/editor` 打包 |
| `@fps-games/editor-babylon` | Babylon 运行时编辑能力：selection、gizmo、Inspector host、monitor、material/outline adapter | 内部 workspace，随 `@fps-games/editor` 打包 |
| `@fps-games/editor-forge-play` | Forge Play bridge 注册、消息、事件和兼容层 | 内部 workspace，随 `@fps-games/editor` 打包 |

游戏项目不要直接安装或发布 `@fps-games/editor-*` 分层包。它们是维护边界，不是对外依赖边界。

## 对外使用原则

当前策略是：**多包维护，单包发布，单入口使用**。

- 代码保持多包结构，因为 protocol、core、browser、Babylon、Forge Play bridge 的职责边界真实存在。
- npm 只发布 `@fps-games/editor` 一个包，内部 workspace 作为 bundled dependencies 随聚合包进入 tarball。
- 游戏项目默认只把 `@fps-games/editor` 当作公共入口，不需要理解内部组合方式。
- `@fps-games/editor-*` 分层包标记为 private，不再独立发布。
- 快速迭代期使用精确版本，例如 `0.1.0`、`0.1.1`，游戏项目不要依赖浮动版本。

如果项目需要新的类型或 helper，应优先从 `@fps-games/editor` 统一 re-export，而不是让项目直接 import 内部分层包。

## 安装

### 推荐安装方式

```bash
pnpm add @fps-games/editor@0.1.0
```

使用 npm：

```bash
npm install @fps-games/editor@0.1.0
```

使用 yarn：

```bash
yarn add @fps-games/editor@0.1.0
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

安装唯一对外包：

```bash
pnpm add @fps-games/editor@0.1.0
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
    "@fps-games/editor": "0.1.0"
  }
}
```

正式 npm 接入不需要安装 `@fps-games/editor-*` 内部分层包。它们会随 `@fps-games/editor` 的 tarball 一起被打包进去。

## 本仓库开发

### 开发环境分层

本仓库现在有三层测试环境，日常开发按从轻到重使用：

| 环境 | 命令 | 用途 |
| --- | --- | --- |
| editor-lab | `npm run dev:editor-lab` | 最轻量的编辑器框架 playground，适合快速验证 EditorWorld、Hierarchy、Transform、Save、Undo/Redo |
| mini-game-lab | `npm run dev:mini-game-lab` | 包仓库内的真实 GameWorld 闭环，基于 `lumber_order` 基线复制，适合验证保存后运行态消费 |
| lumber_order + forge-play | 在对应项目启动 | 最终平台沙盒验收环境，验证 Forge Play 按钮、iframe、proxy、文件保存链路 |

### editor-lab

日常开发优先使用包内最小 playground：

```bash
npm run dev:editor-lab
```

`examples/editor-lab` 是编辑器框架自己的轻量假项目。它不依赖 `lumber_order`，但会走真实主链路：

```text
createLocalEditorHarness
  -> ProjectAuthoringHost
  -> lab source driver
  -> EditorSession
  -> Babylon EditorWorld projection
```

它覆盖 hierarchy、transform、save、undo/redo、dirty 和基础 Babylon 投影，适合平时快速改编辑器框架。`examples/babylon-editor-world` 仍保留为更低层的 Babylon 投影 demo。

### mini-game-lab

如果需要验证“编辑器保存后回到真实 GameWorld”的完整体验，可以启动从 `lumber_order` 基线复制来的 mini game lab：

```bash
cd examples/mini-game-lab
npm install
cd ../..
npm run dev:mini-game-lab
```

默认地址是：

```text
http://localhost:5184
```

`examples/mini-game-lab` 保留了 lumber_order 的真实资产、GameWorld、SceneBuilder、项目 adapter 和本地 authoring API，但默认关闭 Forge Play bridge。它用于在包仓库内快速模拟真实游戏闭环；`lumber_order + forge-play` 仍然是最终平台沙盒验收环境。

`mini-game-lab` 是 dev-only fixture，不参与 npm 包发布，也不要求提交它自己的 `node_modules` 或 lockfile。它的依赖声明留在 `examples/mini-game-lab/package.json`，不进入根包依赖。

### 自测命令

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run check` | 包边界检查、TypeScript 检查、Vitest 单元测试 |
| `npm run typecheck:mini-game-lab` | 检查 mini-game-lab 类型 |
| `npm run build` | 构建所有内部包 |
| `npm run build:editor-lab` | 构建 editor-lab |
| `npm run test:browser` | Playwright 浏览器 smoke |
| `npm run test:pack` | npm pack 后安装到临时 consumer 做消费 smoke |
| `npm run pack:dry-run` | 检查最终 npm tarball 内容 |

主检查：

```bash
npm run check
```

`check` 会跑包边界检查、TypeScript 检查和 Vitest 单元测试。

浏览器 smoke 需要本机可运行 Playwright 浏览器：

```bash
npm run test:browser
```

包消费 smoke：

```bash
npm run test:pack
```

构建所有包：

```bash
npm run build
```

构建 editor-lab：

```bash
npm run build:editor-lab
```

检查 mini-game-lab 类型：

```bash
npm run typecheck:mini-game-lab
```

检查 npm tarball 内容：

```bash
npm run pack:dry-run
```

### GitHub 发包流程

发布渠道：

| 渠道 | npm dist-tag | 版本格式 | 用途 |
| --- | --- | --- | --- |
| beta | `beta` | `0.1.1-beta.0` | 给真实项目提前验证，允许继续迭代 |
| stable | `latest` | `0.1.1` | 真实项目默认安装的稳定版本 |

版本号必须进入 Git，不在 CI 中临时改版本。准备发布时先开 release PR：

```bash
npm run release:version -- 0.1.1-beta.0
npm run release:check:beta
```

稳定版使用：

```bash
npm run release:version -- 0.1.1
npm run release:check:stable
```

`release:version` 会同步根包、所有 workspace 包、内部 `@fps-games/editor-*` 依赖声明和 `package-lock.json` 中的 workspace 版本。合并 release PR 后，通过 GitHub Actions 的 `Publish Package` workflow 发包：

- 手动触发并选择 `beta`，发布到 `@fps-games/editor@beta`。
- 手动触发并选择 `stable`，发布到 `@fps-games/editor@latest`。
- 推送 tag `v0.1.1-beta.0` 会自动走 beta 校验。
- 推送 tag `v0.1.1` 会自动走 stable 校验。

GitHub/npm 发布环境要求：

- npm 上为 `@fps-games/editor` 配置 Trusted Publisher，仓库指向 `forge-play-studio/fps-game-editor`，workflow 文件使用 `.github/workflows/publish.yml`。
- GitHub Environments 建议配置 `npm-beta` 和 `npm-stable`，其中 `npm-stable` 需要 required reviewers。
- workflow 使用 OIDC 和 provenance 发布，不依赖长期 `NPM_TOKEN`。
- `@fps-games/editor-*` 分层包继续保持 private，只作为 bundled dependencies 进入 `@fps-games/editor` tarball。
- 如果发包流程、版本规则、CI 发布入口或包边界发生变化，必须在同一个 PR 中同步更新 `README.md` 和 `agent.md`。

发布前必须确认：

- `npm run release:check` 通过。
- `npm run check` 通过。
- `npm run build` 通过。
- `npm run build:editor-lab` 通过。
- `npm run test:browser` 通过。
- `npm run test:pack` 通过。
- `npm run pack:dry-run` 只生成 `@fps-games/editor` tarball。
- tarball 的 Bundled Dependencies 包含 5 个内部 workspace：protocol、core、browser、Babylon、Forge Play bridge。
- `@fps-games/editor` 的 `exports` 指向真实存在的 `dist/index.js` 和 `dist/index.d.ts`。
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
