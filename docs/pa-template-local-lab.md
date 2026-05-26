# pa_template 本地联调 Runbook

`pa_template` 是 `fps-game-editor` 开发时的真实 starter / integration baseline。涉及 editor contract、transform、hierarchy、asset、save、compiler 的改动，优先在 `pa_template` 中验证。

`examples/mini-game-lab` 先保留为历史 fixture / 回归参考。除非任务明确要求排查它自己的 adapter 或对照旧闭环，不要把它当成默认真实项目集成环境。

## 目录结构

推荐本地结构：

```text
/Users/admin/work/UGIT/fps-game-editor
  packages/
  .local/
    pa_template/
```

`.local/pa_template` 应该是 `pa_template` 仓库的本地 clone，不是普通复制目录，也不是 symlink。`.local/` 被 `fps-game-editor` 忽略，所以保存测试不会污染本仓库状态。

每个 `fps-game-editor` issue worktree 都应该有自己的 companion `pa_template` clone：

```text
/Users/admin/work/UGIT/fps-game-editor-issue-262-example
  packages/
  .local/
    pa_template/
```

这个 companion clone 直接使用 `pa_template` 的远程联调基准分支：

```text
integration/fps-game-editor-lab
```

创建 issue worktree 的个人流程检测到本仓库声明的 setup 约定时，应自动执行这一步；给自动化工具读取的规则见 [../.codex/issue-worktree-setup.md](../.codex/issue-worktree-setup.md)。不要为 `pa_template` 派生 issue-specific 分支，不要复制旧 `.local/pa_template`，也不要 symlink 到旧工作区；模板项目的保存测试会修改自己的 `src/config/editor-scene.json` 和 `src/config/scene.json`，每个 editor issue 需要隔离这些本地测试数据。

手动创建时，可以在新 `fps-game-editor` worktree 根目录执行类似命令：

```bash
mkdir -p .local
git clone \
  --branch integration/fps-game-editor-lab \
  --single-branch \
  "$(git -C /path/to/current/fps-game-editor/.local/pa_template remote get-url origin)" \
  "$PWD/.local/pa_template"
```

这个 worktree 适合隔离本地保存测试，因为测试经常会改：

```text
src/config/editor-scene.json
src/config/scene.json
```

除非任务明确要求更新模板基线场景，否则这些文件里的保存结果都应视为本地测试数据。

## 安装

在 `fps-game-editor` 根目录：

```bash
npm install
pnpm --dir .local/pa_template --ignore-workspace install --frozen-lockfile
```

在 `.local/pa_template` 里安装依赖时要带 `--ignore-workspace`。这个目录位于 `fps-game-editor` workspace 下面，直接运行 `pnpm install` 可能向上找到父 workspace，误装父仓库依赖。

## 启动

在 `fps-game-editor` 根目录：

```bash
npm run dev:pa-template
```

等价于：

```bash
FPS_GAME_EDITOR_REPO=$PWD npm --prefix .local/pa_template run dev:editor-local --
```

`pa_template` 的 Vite 配置检测到 `FPS_GAME_EDITOR_REPO` 后，会把 editor 包 alias 到源码：

```text
@fps-games/editor -> packages/editor/src/index.ts
@fps-games/editor-core -> packages/editor-core/src/index.ts
@fps-games/editor-browser -> packages/editor-browser/src/index.ts
@fps-games/editor-babylon -> packages/editor-babylon/src/index.ts
@fps-games/editor-babylon/legacy-runtime -> packages/editor-babylon/src/legacy-runtime.ts
@fps-games/editor-forge-play -> packages/editor-forge-play/src/index.ts
@fps-games/editor-protocol -> packages/editor-protocol/src/index.ts
```

这样本地改 `packages/*/src` 后，`pa_template` dev server 会直接消费源码，不需要 npm pack、发布 beta、`pnpm link` 或先 build dist。

## 端口冲突

`pa_template` 默认使用 `3006`，并启用 `--strictPort`。如果启动时报 `Port 3006 is already in use`，先确认占用者：

```bash
lsof -nP -iTCP:3006 -sTCP:LISTEN
```

如果占用者是另一个需要保留的 dev server，不要直接杀进程；可以临时换端口验证：

```bash
npm run dev:pa-template -- --port 3016
```

## 验证 Source Alias

启动后，Vite 日志应包含：

```text
[fps-editor] Using local editor sources from /path/to/fps-game-editor
```

也可以检查 Vite 转换后的模块：

```bash
curl -sS 'http://localhost:3006/src/debug/local-editor-mode-switcher.ts' \
  | rg 'fps-game-editor/packages|node_modules/@fps-games|dist/index'
```

期望结果：import 指向 `/@fs/.../fps-game-editor/packages/*/src`。不应指向 `pa_template/node_modules/@fps-games/editor/node_modules/@fps-games/*/dist`。

如果临时换了端口，把命令里的 `3006` 换成对应端口。

## 检查

`fps-game-editor` 常规验证：

```bash
npm run check
```

真实 integration baseline 类型检查：

```bash
pnpm --dir .local/pa_template --ignore-workspace run typecheck
```

`npm run typecheck:mini-game-lab` 仍然保留给历史 fixture，但它不是默认 integration check。

## 修复落点

- 通用编辑器行为放在 `fps-game-editor/packages/*/src`。
- starter 自己的项目 schema、compiler、asset registry、save 语义放在 `pa_template`。
- 如果需要修 `pa_template`，在 `.local/pa_template` worktree 分支提交，再 PR 回 `pa_template main`。
- 不要长期依赖在 `mini-game-lab` 和 `pa_template` 两套厚 adapter 里重复同步修复。优先在 `pa_template` 证明行为，再决定历史 fixture 是否需要兼容更新。
