# lumber_order

这是 `lumber_order` 的本地初始化版本。

## 当前状态

1. 已接入当前平台 `bridge/editor`
2. 已切换为 npm 包路径接入 `@fps-games/editor`
3. 已移除旧 `src/editor-package` runtime fallback
4. 已保留项目侧 `src/fps-game-editor-adapter`，负责 scene/document/asset/binding 语义
5. 已保留基础 `economy` 能力
6. 已强制固定 Babylon 右手坐标系

## 本地开发

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm typecheck
pnpm build
```

## 当前建议的初始化修改入口

优先改这些文件：

1. `src/config/game.json`
2. `src/config/scene.json`
3. `src/config/types.ts`
4. `src/config/ConfigService.ts`
5. `src/core/Game.ts`
6. `src/fps-game-editor-adapter/*`
7. `src/services/SceneBuilder.ts`

## 编辑器接入边界

本项目通过 npm 包使用 `@fps-games/editor*`。项目内不再保留旧 `src/editor-package`，也不再提供 legacy runtime fallback。

本地快速联调可以临时启用源码直连模式，但代码里的 import 仍保持正式包名，不改成相对路径：

```bash
pnpm run dev:editor-local
```

该脚本会设置 `FPS_GAME_EDITOR_ROOT=../fps-game-editor`，Vite 只在开发服务里把 `@fps-games/editor*` alias 到相邻的 `fps-game-editor/packages/*/src/index.ts`。不设置 `FPS_GAME_EDITOR_ROOT` 时，项目继续从 `node_modules` 解析 npm 包。

如果两个仓库不在默认相邻目录，可以手动指定：

```bash
FPS_GAME_EDITOR_ROOT=/absolute/path/to/fps-game-editor pnpm dev
```

本地手动验证“游戏场景 -> 编辑器修改游戏场景”时，使用页面顶部的 DEV-only mode switcher 按钮：

1. 在 `lumber_order` 启动源码直连开发服务：

   ```bash
   cd /Users/admin/work/UGIT/lumber_order
   pnpm run dev:editor-local
   ```

2. 打开游戏页面，页面顶部会出现 `Game Mode / Editor Mode` 按钮组。
3. 点击 `Enter Editor`，当前 GameWorld 会被 dispose，随后在同一个 `renderCanvas` 上创建独立 Babylon EditorWorld。第一版 EditorWorld 只显示 camera/light/grid，不投影 `scene.nodes`。
4. 点击 `Save Scene`，它会走 `exportProjectEditorDocument -> 本地 mock platform 写 src/config/scene.json -> commitProjectEditorDocumentSave`。
5. 点击 `Save & Run Game`，保存后 dispose EditorWorld 并刷新页面，重新创建 GameWorld，让 `SceneBuilder` 消费最新 `scene.json`。
6. 如果不想保存本次编辑，点击 `Discard & Run Game`，直接 dispose EditorWorld 并刷新页面。

这个 switcher 只用于本地开发；它不直接改项目 document，也不替代平台编辑按钮。当前第一版先跑通 `GameWorld -> 独立 EditorWorld -> 保存 document -> 重启 GameWorld`，后续再把 `scene.nodes` 投影到 EditorWorld 并接入 selection/gizmo patch。

职责入口：

1. `src/fps-game-editor-adapter/*`：项目 adapter，负责把公共编辑器命令映射到 `lumber_order` 的 Scene JSON V2、AssetManager、runtime binding、undo/redo、export/commit。
2. `@fps-games/editor`：公共编辑器聚合入口，负责 runtime shell、mode、command dispatch、selection、Inspector host、monitor 和 Forge Play bridge 注册。
3. `@fps-games/editor-babylon`：Babylon 通用编辑能力，负责 gizmo、selection、Inspector、runtime change 观测和 material/outline canonical change。
4. `@fps-games/editor-protocol`：平台、公共包、项目 adapter 共享的命令、事件、capability 和类型。
5. `forge-play`：平台沙盒、文件保存、依赖安装、dev supervisor、preview 和 bridge 宿主。

排障原则：

1. scene schema、asset registry、节点持久化问题先看 `src/fps-game-editor-adapter/*`、`src/services/AssetManager.ts`、`src/services/SceneBuilder.ts`。
2. edit mode、selection、Inspector host、monitor、command shell 的通用行为看 `fps-game-editor` 公共包源码。
3. sandbox 内 npm 包无法解析、依赖没有安装、dev server 没重启等问题看 `forge-play` supervisor 和 sandbox sync 链路。
4. `src/editor-package` 已不是排障入口，不要按旧路径继续添加编辑器 runtime 代码。

## 基础约束

1. 项目使用 Babylon 右手坐标系，不要改成左手系
2. 项目会直接接 `glb/glTF` 模型，这也是强制使用右手规则的主要原因
3. Inspector loader 由平台/Vite 插件注入，公共编辑器包负责 Inspector host；项目侧只维护业务 binding 和 authored config 写回

## 本地规范

目录结构和代码分层规范，统一参考：

- `docs/PROJECT_DIRECTORY_STANDARD.md`
