# Agent 工作原则

## 快速迭代

当前仓库的协作原则是：快速迭代，只要方向正确就可以继续推进。

我们不急于优化，也不急于把设计一次性定死。当前目标是保持独立编辑器方向成立，通过真实项目接入持续验证，让稳定边界从实际使用中逐步浮现。

## 执行规则

- 方向优先于完美抽象：保持“平台传意图、编辑器解释语义、项目 adapter 更新 authored config、游戏 runtime 消费最终配置”这条主线清晰。
- 优先小步、可回退的改动，不做大而全的最终设计式重写。
- 当前 API 和包边界默认视为工作共识，除非明确标注稳定，不把它们过早冻结。
- 不把项目 schema、AssetManager 规则、SceneBuilder 逻辑或具体游戏语义搬进通用编辑器包。
- 保存链路保持两阶段语义：项目 adapter 先保存 authoring source，编译 runtime scene；平台宿主再保存 runtime artifact。Forge Play `Save & Exit` 中 `document.export` 只负责 prepare authoring source 并导出 `sceneJsonText`，平台保存成功后的 `document.commit` 是提交确认，尾部 `mode.change(play, save: true)` 不能重复保存同一事务。
- 平台资产库只发送 command，不直接写项目场景，也不依赖 native HTML5 drag/drop 作为权威链路。`asset.library.refresh`、`asset.import`、`editor.asset.place` 应由项目侧桥接处理：先注册/刷新资产库，再通过 `LocalEditorHarness` 和项目 document adapter 写入 `EditorSceneDocument`。不要把新资产实例直接写到旧 runtime scene document 或 `scene.json`。
- 启动本地服务时，默认启动包含真实 GameWorld 闭环的 `mini-game-lab`（`npm run dev:mini-game-lab`），不要只启动纯编辑器 `editor-lab`。只有用户明确要求轻量 playground、editor-only 调试，或需要隔离公共编辑器框架问题时，才使用 `npm run dev:editor-lab`。
- handoff 或 push 前，以现有检查通过作为最低质量线。
- 文档记录当前事实和决策，但不把文档过早写成固定路线图。

## GitHub Issue 创建规则

- Issue 标题使用“前缀 + 中文描述”，例如 `feat: 添加 mini-game-lab 方便编辑器调试`。
- Issue 正文需要写清楚：类型、背景、目标、范围、非目标、验收标准。正文里的“类型 / 优先级 / 工作量”只是说明文字，不等于 GitHub 右侧面板里的结构化字段。
- 创建 issue 时必须设置 assignee 和 label；如果仓库没有合适 label，先查看现有 label 再选择最贴近的，不随意创建新 label。
- 创建后必须单独设置 GitHub 右侧的结构化 `Type`，不能只写在正文里。当前仓库常用类型为 `Feature`、`Task`、`Bug`。
- 创建后必须单独设置 GitHub 右侧 `Fields`。当前仓库至少需要设置 `Priority`；如任务规模明确，也设置 `Effort`。
- 对开发工具、框架能力补齐、非紧急基础设施任务，默认使用 `Priority: Medium`、`Effort: Medium`；如果用户明确指定，以用户指定为准。
- 使用 `gh issue create` 后，要用 GitHub GraphQL 或页面确认右侧面板里的 `Type` 和 `Fields` 已真实生效。不要把正文中的字段描述误认为已经完成设置。

## 发包与版本管理规则

- 对外只发布 `@fps-games/editor`。`@fps-games/editor-*` 分层包保持 private，只作为 bundled dependencies 进入聚合包 tarball。
- 发布渠道分为 `beta` 和 `stable`：`beta` 使用 npm dist-tag `beta`，版本格式为 `X.Y.Z-beta.N`；`stable` 使用 npm dist-tag `latest`，版本格式为 `X.Y.Z`。
- 版本号必须进入 Git。使用 `npm run release:version -- <version>` 同步根包、所有 workspace 包、内部依赖声明和 `package-lock.json`，不要在 CI 中临时改版本。
- 发包入口是 tag 驱动的 GitHub Actions `Publish Package` workflow。release PR 合入 main 后，在对应 main commit 上推送 `vX.Y.Z-beta.N` 或 `vX.Y.Z` tag 触发发布。除非用户明确要求，不通过 `workflow_dispatch` 手动选择通道，不在本地直接执行 `npm publish`。
- `npm-beta` 和 `npm-stable` GitHub Environments 是发布保护边界；`npm-stable` 应要求 reviewer 审批。
- npm 侧优先使用 Trusted Publishing / OIDC / provenance，不依赖长期 `NPM_TOKEN`。npm Trusted Publisher 的 Environment name 可以留空，让同一个 trusted publisher 覆盖 `npm-beta` 和 `npm-stable` 两个 GitHub environment。
- 发包前至少确认 `npm run release:check`、`npm run check`、`npm run build`、`npm run build:editor-lab`、`npm run test:browser`、`npm run test:pack` 和 `npm run pack:dry-run` 通过。
- tag 发布前必须确认 release PR 已合入 main、main CI 通过、tag 指向 main 上的 release commit、package version 与 tag 一致，且 npm 上不存在同名版本。
- npm publish 成功后，workflow 会自动创建 GitHub Release；`-beta.N` 创建 prerelease，稳定版创建正式 release。
- 游戏项目升级编辑器包时使用精确版本，并提交项目侧 lockfile。
- 如果发包流程、版本规则、CI 发布入口或包边界发生变化，必须及时同步更新 `README.md` 和 `agent.md`。不要只改 workflow、脚本或 package metadata。
