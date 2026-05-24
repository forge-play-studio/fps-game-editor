# npm Release Runbook

本仓库采用 tag-driven 发布：版本变更必须先进入 Git，release PR 合入 `main` 后，再在对应 commit 上推送 `v*` tag 触发 GitHub Actions 发布。不要在本地直接执行 `npm publish`。

## Package Shape

- 对外只发布 `@fps-games/editor`。
- 根包 `fps-game-editor` 保持 `private: true`，负责 workspace、检查脚本和版本管理。
- `@fps-games/editor-protocol`、`@fps-games/editor-core`、`@fps-games/editor-browser`、`@fps-games/editor-babylon`、`@fps-games/editor-forge-play` 保持 private。
- 内部 5 个 workspace 通过 `@fps-games/editor` 的 `bundleDependencies` 进入最终 tarball。
- `@fps-games/editor` 的 `prepack` 会运行 `scripts/prepare-single-package.mjs`，把内部包的 `dist` 复制到聚合包下再打包。

## Channels

| Channel | npm dist-tag | Version shape | Use |
| --- | --- | --- | --- |
| beta | `beta` | `X.Y.Z-beta.N` | 真实项目提前验证，可连续迭代 |
| stable | `latest` | `X.Y.Z` | 项目默认安装的稳定版本 |

当前 npm 状态可用下面命令确认：

```bash
npm view @fps-games/editor version dist-tags versions --json
```

## One-Time Setup

- npm 为 `@fps-games/editor` 配置 Trusted Publisher。
- Trusted Publisher repository 指向 `forge-play-studio/fps-game-editor`。
- Workflow file 使用 `.github/workflows/publish.yml`。
- GitHub Environments 使用 `npm-beta` 和 `npm-stable`；`npm-stable` 应配置 required reviewers。
- 发布依赖 OIDC/provenance，不依赖长期 `NPM_TOKEN`。

## Prepare A Beta Release

从最新 `main` 创建 release PR：

```bash
git checkout main
git pull --ff-only
npm ci
npm run release:version -- 0.1.1-beta.6
npm run release:check:beta
npm run release:preflight
```

提交版本变更，开 PR，等 CI 通过并合入 `main`。`release:version` 会同步根包、所有 workspace 包、内部 `@fps-games/editor-*` 依赖声明和 `package-lock.json`。

合入后，在 release commit 上打 tag：

```bash
git checkout main
git pull --ff-only
npm run release:check:beta -- --tag v0.1.1-beta.6
git tag v0.1.1-beta.6
git push origin v0.1.1-beta.6
```

GitHub Actions 会发布：

```text
@fps-games/editor@0.1.1-beta.6 with dist-tag beta
```

## Prepare A Stable Release

稳定版只在 beta 已经通过真实项目验证后发布。从最新 `main` 创建 release PR：

```bash
git checkout main
git pull --ff-only
npm ci
npm run release:version -- 0.1.1
npm run release:check:stable
npm run release:preflight
```

合入后，在 release commit 上打 tag：

```bash
git checkout main
git pull --ff-only
npm run release:check:stable -- --tag v0.1.1
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions 会发布：

```text
@fps-games/editor@0.1.1 with dist-tag latest
```

## Local Preflight

`npm run release:preflight` 是发布前本地门禁，当前包含：

```bash
npm run release:check
npm run check
npm run build
npm run build:editor-lab
npm run test:browser
npm run test:pack
npm run pack:dry-run
```

如果只想先做版本形态检查，使用：

```bash
npm run release:check:beta
npm run release:check:stable
```

## Publish Workflow

`.github/workflows/publish.yml` 监听 `v*` tag。workflow 会：

1. 安装依赖和 Playwright Chromium。
2. 从 tag 判断发布通道。
3. 校验 version、tag、workspace 版本、内部依赖版本和 bundleDependencies。
4. 跑边界检查、类型检查、单元测试、构建、browser smoke、packed consumer smoke 和 tarball dry run。
5. 使用 `npm publish --workspace @fps-games/editor --access public --tag beta|latest` 发布。
6. npm 发布成功后创建 GitHub Release；beta 创建 prerelease，stable 创建正式 release。

## Post-Publish Verification

发布 workflow 成功后确认 npm 状态：

```bash
npm view @fps-games/editor version dist-tags versions --json
```

在真实项目中使用精确版本升级，并提交项目侧 lockfile：

```bash
npm install @fps-games/editor@0.1.1-beta.6
```

或稳定版：

```bash
npm install @fps-games/editor@0.1.1
```

## Failure Handling

- 如果 tag 检查失败且 npm 尚未发布，修正 release commit 后重建 tag。
- 如果 npm 已发布，不要尝试覆盖同名版本；改用下一个版本号重新走 release PR。
- 如果发布成功但 GitHub Release 创建失败，先确认 npm dist-tag，再手动补 GitHub Release，release notes 需要记录 npm 版本、dist-tag 和通过的验证项。
- 如果 tarball 内容异常，优先检查 `npm run build`、`scripts/prepare-single-package.mjs`、`packages/editor/package.json` 的 `files` / `bundleDependencies` / `exports`。
