# Agent Instructions for `lumber_order`

##重要
尽量不要使用 npm run build 验证
导入的资源最终编译到 scene.json 时需要严格遵守 SCENE_JSON_V2_DESIGN.md 的规范。当前编辑源是 editor-scene.json，scene.json 是保存/编译产物。

## 场景变动规范

- **IMPORTANT** 使用 editor-scene.json 维护可编辑静态场景，保存时再编译到 scene.json。

1. 所有编辑器可维护的静态场景变动统一维护在 editor-scene.json。
2. 不要通过直接修改代码来实现静态场景调整。
3. 不要在配置写入、材质应用或场景初始化过程中硬编码静态场景参数。
4. 若某项变动属于静态内容，必须落到 editor-scene.json，并由保存链路编译到 scene.json，而不是写进 TS/JS 代码。
5. 仅当需求明确属于运行时动态行为时，才允许在代码中处理。
6. 平台资产命令只作为意图输入；资产注册、刷新和实例化必须由项目桥接写入 EditorSceneDocument，不要直接写旧 runtime scene document 或 scene.json。


## GLB 导入规范

1. 导入完成后，立即将默认的 `__root__` 重命名为语义化名称（如 `arrow_tower`、`tree`），禁止在场景中保留无语义的默认命名。
2. 当多个模型在逻辑上属于同一组（如一排围栏、一片树林）时，创建父级 `TransformNode` 统一归组，便于批量管理与后续扩展。

## 材质颜色写入规范

1. 材质颜色参数（`albedoColor`、`emissiveColor`、`diffuseColor`）写入配置时，必须直接存储输入值。
2. 禁止在写入配置或应用材质时做任何 Gamma/Linear 转换（包括自动 `pow(2.2)` 之类的处理）。

##工作记录规范

如果用户需要，场景变更记录到 .opencode/美术进度.md

## 美术记录学习规范

1. 每次开启新对话，先阅读项目根目录下的 `美术修改.md`。
2. 先学习其中已有的修改历史和记录格式，再继续新的美术/场景修改。
3. 后续若用户要求汇总或追加美术变更，优先更新 `美术修改.md`，并保持原有格式一致。
