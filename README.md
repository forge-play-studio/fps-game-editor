# fps-game-editor

`fps-game-editor` 是给 Forge Play 游戏项目使用的公共编辑器运行时包。它不理解具体游戏项目的配置 schema，也不直接写项目文件；游戏项目通过 adapter 把通用编辑器能力映射到自己的 authored config、runtime scene、asset registry 和保存链路。

当前 npm 版本：

```text
0.1.0
```

这是 0.1.x 初始版本。建议游戏项目先使用精确版本安装，不要依赖浮动的 `latest`。

## 快速开始

默认使用 `pa_template` 作为真实 starter / integration baseline。`fps-game-editor` 根目录下应有一个 ignored 的 `pa_template` git worktree：

```text
.local/pa_template
```

创建新的 `fps-game-editor` issue worktree 时，也应在新 worktree 下自动 clone 对应的 `.local/pa_template` 仓库。该模板仓库直接使用 `pa_template` 的 `integration/fps-game-editor-lab` 联调分支，不为每个 issue 派生新模板分支，不复制旧 `.local` 目录，也不共享同一个模板工作区。给自动化工具读取的具体规则见 [.codex/issue-worktree-setup.md](.codex/issue-worktree-setup.md)。

首次准备本地联调环境时，先创建或确认这个 worktree，并安装 `pa_template` 依赖：

```bash
npm install
pnpm --dir .local/pa_template --ignore-workspace install --frozen-lockfile
```

然后从 `fps-game-editor` 根目录启动真实项目联调：

```bash
npm run dev:pa-template
```

默认地址：

```text
http://localhost:3006
```

这条链路会设置 `FPS_GAME_EDITOR_REPO=$PWD`，让 `pa_template` 的 Vite dev server 直接 alias 到本仓库 `packages/*/src`，本地改源码后不需要 npm pack、发布 beta 或先 build dist。

`mini-game-lab` 先降级保留为历史 fixture / 回归参考，不再作为默认真实项目集成环境。只有在用户明确要求对照旧闭环、排查它自己的 adapter，或验证兼容性时才启动：

```bash
npm run dev:mini-game-lab
```

只有在用户明确要求轻量 playground、纯编辑器框架调试，或需要隔离 EditorWorld/Harness 行为时，才启动 editor lab：

```bash
npm run dev:editor-lab
```

如果是首次 clone 且历史 fixture 资产缺失，请先确认 Git LFS 已启用：

```bash
git lfs install
git lfs pull
```

常用检查：

```bash
npm run check
pnpm --dir .local/pa_template --ignore-workspace run typecheck
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

## 坐标系约定

编辑器世界坐标系应与 GLB/glTF 模型资产保持一致：右手直角坐标系，以模型导入后的 authored transform 语义为准。Transform Inspector、gizmo、Scene View helper、相机预览和项目 adapter 都应围绕这个编辑器语义工作。

Babylon runtime 可以通过 `scene.useRightHandedSystem` 切换 handedness，但这只描述底层渲染场景的左右手系，不等价于完整的编辑器坐标语义。凡是 Babylon camera、本地 helper mesh、项目 runtime config 或其他宿主使用不同本地轴约定的地方，都应在公共框架边界做显式转换，避免项目 adapter 各自补偿。

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
cd /path/to/fps-game-editor
npm run dev:pa-template
```

`dev:pa-template` 会设置：

```text
FPS_GAME_EDITOR_REPO=/path/to/fps-game-editor
```

并启动 `.local/pa_template` 的 `dev:editor-local`。`pa_template` 的 Vite 配置检测到该变量后，会把以下包临时 alias 到 `fps-game-editor/packages/*/src/index.ts`：

- `@fps-games/editor`
- `@fps-games/editor-babylon`
- `@fps-games/editor-babylon/legacy-runtime`
- `@fps-games/editor-browser`
- `@fps-games/editor-core`
- `@fps-games/editor-forge-play`
- `@fps-games/editor-protocol`

如果仓库不在相邻目录，可以手动指定绝对路径：

```bash
cd /path/to/pa_template
FPS_GAME_EDITOR_REPO=/path/to/fps-game-editor pnpm run dev:editor-local
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

### 平台资产命令桥接

Forge Play 平台资产库不要直接修改项目场景，也不要继续依赖 native HTML5 drag/drop 跨 iframe 投放。平台只发送明确 command，项目侧解释语义：

| 命令 | 语义 |
| --- | --- |
| `asset.library.refresh` | 重新调用项目 adapter 的 `loadAssets()`，刷新编辑器资产浏览器。 |
| `asset.import` | 兼容旧平台导入入口；项目侧可先注册 `assetPath`，再刷新资产库并在当前 `EditorSceneDocument` 创建实例。 |
| `editor.asset.place` | 新的编辑器放置入口；语义同项目侧放置资产，可携带 `position`、`rotation` / `rotationDeg`、`scale` / `instanceScale`。 |

公共 harness 提供 `reloadAssets()` 和 `createAssetFromAssetId()`，项目 adapter 负责把资产库 item 映射成自己的 document patch。成功放置资产只代表编辑源 `editor-scene.json` 的 working document 已更新；Forge Play `Save & Exit` 仍通过 `document.export -> document.commit -> mode.change(play)` 把 `editor-scene.json` 保存并编译出交给平台 API 写入的 `scene.json`。

## Forge Play / Inspector 注意事项

- Forge Play 平台侧只负责 transport、意图传输和文件保存，不理解项目 schema。
- `@fps-games/editor-forge-play` 负责和 `window.__bridge` 通信。
- Babylon Inspector 的加载建议继续由项目侧 Vite 插件提供，例如注入 `ensureInspectorReady()`。公共 editor runtime 会优先使用页面已有的 Inspector loader。
- 公共包会在注册 runtime 时安装 Forge Play bridge 的 Inspector loader patch，项目入口不应再手写 `window.__bridge.editor.showInspector/loadV2` monkey patch。
- Inspector 不是数据权威。Inspector 或 runtime 上的变化必须由项目 adapter 映射回 document。

## 当前参考接入

当前真实 starter / integration baseline 是 `pa_template`。新项目从 `pa_template` 出发，所以编辑器 contract、transform、hierarchy、asset、save 和 compiler 行为应优先在 `pa_template` 中验证。`pa_template` 正式接入时仍从 npm 安装公共包：

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

本仓库现在有三层测试环境。默认服务启动和手动体验验证使用 `pa_template`，因为它是新项目实际使用的 starter / integration baseline。`mini-game-lab` 先保留为历史 fixture 和回归参考，不再作为完整真实项目集成环境；只有明确需要轻量隔离调试时才使用 `editor-lab`：

| 环境 | 命令 | 用途 |
| --- | --- | --- |
| pa_template worktree | `npm run dev:pa-template` | 默认启动环境；真实 starter / integration baseline，通过 `.local/pa_template` worktree 直接消费 `fps-game-editor/packages/*/src` |
| mini-game-lab | `npm run dev:mini-game-lab` | 历史 fixture / 回归参考；保留旧 GameWorld 闭环，适合对照旧 adapter 行为，但不再作为默认真实集成环境 |
| editor-lab | `npm run dev:editor-lab` | 仅在明确需要轻量隔离时使用的编辑器框架 playground，适合快速验证 EditorWorld、Hierarchy、Transform、Save、Undo/Redo |
| pa_template + forge-play | 在对应项目启动 | 最终平台沙盒验收环境，验证 Forge Play 按钮、iframe、proxy、文件保存链路 |

### pa_template worktree

`pa_template` 是本仓库默认真实联调环境。推荐目录结构：

```text
/path/to/fps-game-editor
  packages/
  .local/
    pa_template/
```

`.local/pa_template` 是 `pa_template` 仓库的 git worktree，被本仓库 `.gitignore` 忽略。它隔离保存测试产生的 `src/config/editor-scene.json`、`src/config/scene.json` 等场景数据改动，也避免影响正常 `pa_template` 功能开发目录。

每个 `fps-game-editor` issue worktree 都应拥有自己的 `.local/pa_template` companion 仓库。创建新 issue worktree 时，如果当前仓库已有 `.local/pa_template`，默认 clone 一个新的模板仓库到新 editor worktree 的 `.local/pa_template`，并直接 checkout `integration/fps-game-editor-lab`，跟踪 `origin/integration/fps-game-editor-lab`。不要为 `pa_template` 创建 issue-specific 分支，不要复制 `.local/pa_template` 目录，也不要用 symlink 共享旧工作区；保存测试会修改模板项目文件，共享目录会让不同 issue 相互污染。自动化流程以 [.codex/issue-worktree-setup.md](.codex/issue-worktree-setup.md) 为准。

启动：

```bash
npm run dev:pa-template
```

等价于：

```bash
FPS_GAME_EDITOR_REPO=$PWD npm --prefix .local/pa_template run dev:editor-local --
```

`pa_template` 的 Vite 配置在检测到 `FPS_GAME_EDITOR_REPO` 后，应把 `@fps-games/editor`、`@fps-games/editor-core`、`@fps-games/editor-browser`、`@fps-games/editor-babylon`、`@fps-games/editor-babylon/legacy-runtime`、`@fps-games/editor-forge-play` 和 `@fps-games/editor-protocol` alias 到本仓库 `packages/*/src`。这样本地改源码后可以立即由 `pa_template` dev server 消费，不需要 npm pack、发布 beta 或 build dist。

完整 setup、端口冲突处理和 alias 验证步骤见 [docs/pa-template-local-lab.md](docs/pa-template-local-lab.md)。

### editor-lab

`examples/editor-lab` 是包内最小 playground。不要把它作为默认服务启动目标；只有在用户明确要求 editor-only、轻量 playground，或需要隔离公共编辑器框架问题时使用：

```bash
npm run dev:editor-lab
```

`examples/editor-lab` 是编辑器框架自己的轻量假项目。它不依赖任何真实 starter 项目，但会走真实主链路：

```text
createLocalEditorHarness
  -> ProjectAuthoringHost
  -> lab source driver
  -> EditorSession
  -> Babylon EditorWorld projection
```

它覆盖 hierarchy、transform、save、undo/redo、dirty 和基础 Babylon 投影，适合隔离调试编辑器框架。`examples/babylon-editor-world` 仍保留为更低层的 Babylon 投影 demo。

### Editor UI 主题

本地编辑器 UI 默认使用 `dark` 主题，也可以在创建 harness 时切到 `light`。主题只作用于浏览器 UI surface，不写入 document、session 或 undo/redo 状态：

```ts
import { createLocalEditorHarness, type LocalEditorThemeName } from '@fps-games/editor';

const harness = createLocalEditorHarness({
  root: document.body,
  theme: 'light' satisfies LocalEditorThemeName,
  documentAdapter,
  persistenceAdapter,
  worldAdapter,
});

harness.setTheme('dark');
```

浏览器层的主题由 `.fps-editor-workbench[data-fps-editor-theme="dark|light"]` 驱动。Workbench、context menu、shortcut modal、box selection overlay 等独立 surface 会同步这个属性。新增控件应优先复用 `packages/editor-browser/src/local-editor-ui-primitives.ts` 和 `local-editor-ui-shared.ts`，颜色使用 `local-editor-ui-theme.ts` 中的 token；toolbar、hierarchy、panel 图标使用 `local-editor-ui-icons.ts` 的内联 SVG registry，不新增 UI/icon 运行时依赖，也不把 PNG kind icon 混入工具栏体系。

### mini-game-lab

`mini-game-lab` 先降级保留为历史 fixture / 回归参考。它不再是默认真实项目集成环境；新项目相关的 editor contract、transform、hierarchy、asset、save 和 compiler 行为应优先在 `pa_template` 中验证。只有需要对照旧闭环、排查它自己的 adapter，或验证兼容性时才启动：

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

`examples/mini-game-lab` 保留了历史真实资产、GameWorld、SceneBuilder、项目 adapter 和本地 authoring API，但默认关闭 Forge Play bridge。它可用于在包仓库内对照旧游戏闭环；`pa_template + forge-play` 才是后续平台沙盒验收环境。

保存链路分为两种语义：本地 `Save Scene` 使用 `local-commit-save`，同时写 `editor-scene.json` 和编译后的 `scene.json`；Forge Play `Save & Exit` 使用 `prepare-platform-save`，先保存 `editor-scene.json` 并导出 `sceneJsonText`，再交给平台现有保存 API 写 `scene.json`。平台随后发送的 `document.commit` 作为提交确认，尾部 `mode.change(play, save: true)` 不再重复保存同一次 authoring source。

平台资产命令在 mini-game-lab 中由 `local-editor-mode-switcher.ts` 接管：`asset.library.refresh` 只刷新内部资产浏览器；`asset.import` / `editor.asset.place` 会按需通过本地 authoring API 注册资产、刷新资产库，再通过 `LocalEditorHarness.createAssetFromAssetId()` 写入 `EditorSceneDocument`。这条链路不走旧 runtime scene document，也不直接写 `scene.json`。

`mini-game-lab` 是 dev-only fixture，不参与 npm 包发布，也不要求提交它自己的 `node_modules` 或 lockfile。它的依赖声明留在 `examples/mini-game-lab/package.json`，不进入根包依赖。

### 自测命令

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run check` | 包边界检查、TypeScript 检查、Vitest 单元测试 |
| `pnpm --dir .local/pa_template --ignore-workspace run typecheck` | 检查真实 integration baseline 类型 |
| `npm run typecheck:mini-game-lab` | 检查历史 fixture 类型，只有涉及 mini-game-lab 时需要 |
| `npm run build` | 构建所有内部包 |
| `npm run build:editor-lab` | 构建 editor-lab |
| `npm run test:browser` | Playwright 浏览器 smoke |
| `npm run test:pack` | npm pack 后安装到临时 consumer 做消费 smoke |
| `npm run pack:dry-run` | 检查最终 npm tarball 内容 |
| `npm run release:preflight` | 发布前本地门禁：版本检查、包边界、类型、单测、构建、browser smoke、pack smoke 和 tarball dry run |

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

检查 `pa_template` worktree 类型：

```bash
pnpm --dir .local/pa_template --ignore-workspace run typecheck
```

检查历史 fixture 类型：

```bash
npm run typecheck:mini-game-lab
```

检查 npm tarball 内容：

```bash
npm run pack:dry-run
```

### GitHub 发包流程

完整可执行 checklist 见 [docs/npm-release-runbook.md](docs/npm-release-runbook.md)。本节只保留发布规则摘要。

发布渠道：

| 渠道 | npm dist-tag | 版本格式 | 用途 |
| --- | --- | --- | --- |
| beta | `beta` | `0.1.1-beta.0` | 给真实项目提前验证，允许继续迭代 |
| stable | `latest` | `0.1.1` | 真实项目默认安装的稳定版本 |

版本号必须进入 Git，不在 CI 中临时改版本。准备 beta release PR：

```bash
npm run release:version -- 0.1.1-beta.0
npm run release:check:beta
npm run release:preflight
```

准备 stable release PR：

```bash
npm run release:version -- 0.1.1
npm run release:check:stable
npm run release:preflight
```

`release:version` 会同步根包、所有 workspace 包、内部 `@fps-games/editor-*` 依赖声明和 `package-lock.json` 中的 workspace 版本。合并 release PR 后，使用 tag 驱动 `Publish Package` workflow 发包：

- 在 main 的 release commit 上推送 tag `v0.1.1-beta.0`，自动发布到 `@fps-games/editor@beta` 并创建 GitHub prerelease。
- 在 main 的 release commit 上推送 tag `v0.1.1`，自动发布到 `@fps-games/editor@latest` 并创建 GitHub release。
- 不通过 `workflow_dispatch` 手动选择发布通道，不在本地直接执行 `npm publish`。
- npm publish 成功后，workflow 才创建 GitHub Release；如果 npm 发布失败，不生成 release 记录。

GitHub/npm 发布环境要求：

- npm 上为 `@fps-games/editor` 配置 Trusted Publisher，仓库指向 `forge-play-studio/fps-game-editor`，workflow 文件使用 `.github/workflows/publish.yml`。
- GitHub Environments 建议配置 `npm-beta` 和 `npm-stable`，其中 `npm-stable` 需要 required reviewers。
- workflow 使用 OIDC 和 provenance 发布，不依赖长期 `NPM_TOKEN`。npm Trusted Publisher 的 Environment name 可以留空，让同一个 trusted publisher 覆盖 `npm-beta` 和 `npm-stable` 两个 GitHub environment。
- `@fps-games/editor-*` 分层包继续保持 private，只作为 bundled dependencies 进入 `@fps-games/editor` tarball。
- 如果发包流程、版本规则、CI 发布入口或包边界发生变化，必须在同一个 PR 中同步更新 `README.md`、`agent.md` 和 `docs/npm-release-runbook.md`。

tag 发布前必须确认：

- release PR 已合入 main，且 main CI 通过。
- tag 指向的 main commit 中 package version 与 tag 完全一致，例如 `v0.1.1-beta.0` 对应 package version `0.1.1-beta.0`。
- npm 上还不存在同名版本。npm 不允许覆盖已经发布过的版本。
- beta 版本 tag 只能用于 `-beta.N` 版本；stable tag 不能包含 prerelease 后缀。

发布前必须确认：

- `npm run release:preflight` 通过。
- `npm run pack:dry-run` 只生成 `@fps-games/editor` tarball。
- tarball 的 Bundled Dependencies 包含 5 个内部 workspace：protocol、core、browser、Babylon、Forge Play bridge。
- `@fps-games/editor` 的 `exports` 指向真实存在的 `dist/index.js` 和 `dist/index.d.ts`。
- 游戏项目升级时使用精确版本，并提交 lockfile。

## 用户文档

编辑器说明文档采用 HTML-first 形式，并按读者分层：

- [docs/editor-user-guide/index.html](docs/editor-user-guide/index.html)：对外教学文档，只放给关卡设计师、玩法设计师、技术美术和项目接入开发者阅读的学习路径、教程、手册、快捷键和排障内容。
- [docs/editor-user-guide/index.md](docs/editor-user-guide/index.md)：`index.html` 的 Markdown 发布副本，方便上传到其他平台；不作为源文档维护。
- [docs/editor-user-guide/shortcuts.html](docs/editor-user-guide/shortcuts.html)：对外快捷键页面，按工具、视图、鼠标、选择、文档、层级和面板分类整理快捷键与鼠标操作。
- [docs/editor-user-guide/agent.html](docs/editor-user-guide/agent.html)：Agent 参考文档，只放写作目标、更新流程、事实来源和质量检查。
- [docs/editor-user-guide/system.html](docs/editor-user-guide/system.html)：系统模板与 Manifest，只放内容类型、稳定术语和模板骨架。

维护规则：

- 不在 `docs/editor-user-guide/` 下维护独立 Markdown/YAML 源文档；`index.md` 只是从 `index.html` 同步出来的发布副本。
- 不把 Manifest、Agent 写作规则、系统模板或模板占位内容放进用户指南 `index.html`。
- 用户指南内容面向真实读者任务；快捷键等可独立查阅的用户参考可以拆成单独 HTML 页面；更新用户教学入口时先改 `index.html`，再同步 `index.md`；Agent 参考放在 `agent.html`，系统模板和 Manifest 放在 `system.html`。

常用命令：

- `npm run docs:export-user-guide`：从 `index.html` 同步生成 `index.md`。
- `npm run docs:check-user-guide`：检查用户文档分层、HTML 链接、Markdown 发布副本声明和 README/agent 规则。

## 设计文档

当前架构基线文档：

- [docs/fps-game-editor-architecture.html](docs/fps-game-editor-architecture.html)

总体原则：

- 快速迭代，方向正确优先。
- 公共包不承载项目 schema。
- 项目 adapter 更新 authored config。
- `SceneBuilder` 消费最终配置。
- Inspector/runtime change 必须回写 document，不能让 runtime 成为数据权威。
