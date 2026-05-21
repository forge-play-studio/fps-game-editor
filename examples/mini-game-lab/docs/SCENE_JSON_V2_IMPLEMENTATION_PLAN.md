# Scene JSON V2 改造计划

这份文档定义 `lumber_order` 自己的 Scene JSON V2 落地计划。

目标只有两个：

1. 把 `scene.json` 从当前 V1 结构升级到 V2
2. 让配置层、运行时构建层、编辑器保存层一起对齐 V2

这份文档是 `lumber_order` 项目内文档，不依赖外部项目文档作为实施入口。

## Scope

这份文档回答：

1. 为什么 V2 要在 `lumber_order` 落地，而不是继续在别的项目推进
2. `lumber_order` 当前卡在哪些 V1 结构上
3. 具体需要改哪些文件
4. 按什么顺序改风险最低
5. 每个阶段的交付标准是什么

不包含：

1. 平台侧 bridge/editor 实现细节
2. 某个具体玩法规则设计
3. 自动迁移脚本实现

## Decision

当前决策固定如下：

1. `train_oil` 只保留 Scene V2 相关结构设计和历史参考，不再继续承担 V2 实现落地
2. `lumber_order` 作为第一个 Scene V2 落地项目
3. 项目之间保持独立，不把 `train_oil` 的实现状态直接混入 `lumber_order`
4. `pa_maker/scaffold` 暂不跟进，等 `lumber_order` 跑通后再决定是否回灌模板

## Target Structure

`lumber_order` 的目标结构以当前 V2 规范为准：

```json
{
  "schemaVersion": 2,
  "meta": {},
  "gameplay": {},
  "scene": {
    "rootId": "root",
    "assets": [],
    "nodes": [],
    "materials": [],
    "textures": []
  },
  "render": {}
}
```

核心语义固定如下：

1. `scene.assets` 是 glb 资源模板层
2. `scene.nodes` 是 authored 场景对象层
3. `group` 是 hierarchy 容器节点
4. `instance` 和 `transform` 是 authored 节点
5. `instance.instance.assetId` 引用 `scene.assets[*].id`
6. `instance.transform` 是实例覆盖，不是资源默认值
7. 全局渲染配置进入 `render`
8. 玩法相关全局配置进入 `gameplay`

## Current Lumber Status

当前 `lumber_order` 仍然是完整 V1 结构，主要体现在这些文件：

1. `src/config/types.ts`
   - 仍以 `modelRegistry` 和 `sceneInstances` 为主类型
2. `src/config/scene.json`
   - 顶层仍是 `worldBounds / modelRegistry / sceneInstances / tuning`
3. `src/config/ConfigService.ts`
   - 索引完全围绕 `modelRegistryMap` 和 `sceneInstanceMap`
4. `src/services/SceneBuilder.ts`
   - 只会读取 `getAllSceneInstances()`
   - 只会按 `sceneInstances` 构建 root 直属节点
   - 没有 `group` hierarchy 和 `nodeId -> runtime node` 视图
5. `src/services/ConfigValidator.ts`
   - 校验逻辑仍绑定 `sceneInstances` 与 `modelRegistry`
6. `src/core/Game.ts`
   - 预加载模型依赖 `getAllModelEntries()`
   - 场景加载依赖 `loadSceneInstancesFromConfig()`
7. `src/editor-package/types.ts`
   - `ProjectPersistentBinding` 只有 `kind: "sceneInstance"`
8. `src/editor-package/adapter.ts`
   - 只会解析 `sceneInstance` binding
9. `src/editor-package/document.ts`
   - 写回目标仍是 `sceneInstances[*]`
   - duplicate/undo/redo 路径仍绑定 `sceneInstances`
10. `src/editor-package/scene-instance-duplicate.ts`
   - 仍假设 duplication 目标是 V1 `sceneInstances`

结论：

不能只替换 `scene.json` 文件结构，必须同时升级：

1. 配置结构线
2. 运行时构建线
3. 编辑器保存线

## Refactor Strategy

### 阶段 1：先让配置层能读 V2

目标：

1. `ConfigService` 以 V2 结构作为主模型
2. 上层代码可以通过稳定 API 读取 `scene/assets/nodes/render/gameplay`

优先修改文件：

1. `src/config/types.ts`
2. `src/config/scene.json`
3. `src/config/ConfigService.ts`
4. `src/config/index.ts`

具体改造：

1. 在 `types.ts` 新增：
   - `SceneDocumentV2`
   - `SceneConfigV2Meta`
   - `SceneAssetConfig`
   - `SceneNodeConfig`
   - `SceneGroupNode`
   - `SceneInstanceNode`
   - `SceneTransformNode`
   - `SceneMaterialConfig`
   - `SceneTextureConfig`
   - `RenderConfig`
   - `GameplayConfig`
2. `scene.json` 改成 V2 顶层结构
3. `ConfigService` 新增：
   - `getSceneDocument()`
   - `replaceSceneDocument()`
   - `getSceneAssets()`
   - `getSceneAssetById()`
   - `getSceneNodes()`
   - `getSceneNodeById()`
   - `getSceneRootId()`
   - `getRenderConfig()`
   - `getGameplayConfig()`
4. `ConfigService` 内部索引改为：
   - `sceneAssetMap`
   - `sceneNodeMap`
5. `worldBounds`、现有调优参数等旧字段，按 V2 归属迁进 `gameplay` 或 `render`

这一阶段不要做的事：

1. 不要先改平台协议
2. 不要先改 inspector host 交互
3. 不要先做自动迁移脚本

交付标准：

1. 项目内代码不再需要把 `modelRegistry` / `sceneInstances` 当主模型
2. `ConfigService` 已经能完整提供 V2 读取出口

### 阶段 2：重构 SceneBuilder

目标：

1. runtime scene 能按 V2 hierarchy 构建
2. authored node 和 runtime node 的映射稳定

优先修改文件：

1. `src/services/SceneBuilder.ts`
2. `src/core/Game.ts`
3. 如有需要再补 `src/services/ConfigValidator.ts`

具体改造：

1. `SceneBuilder` 内部从 `sceneInstances` 视图切到 `scene.nodes`
2. 建立三类运行时索引：
   - `groupId -> runtime TransformNode`
   - `nodeId -> runtime object`
   - `assetId -> SceneAssetConfig`
3. 场景构建拆成三个步骤：
   - 先建 group hierarchy
   - 再建 transform nodes
   - 最后建 instance nodes
4. `instance` 的参数合成顺序固定为：
   - asset defaults
   - instance.transform
   - instance.overrides
5. `transformType` 至少预留分派入口：
   - `plain`
   - `light`
   - `camera`
   - `groundDecal`
6. `Game.init()` 中的预加载逻辑从 `getAllModelEntries()` 改成读取 `scene.assets`

需要同时调整的运行时 API：

1. `getSceneInstanceNode(id)` 需要升级为更通用的 `getSceneNodeRuntime(id)`，或保留旧名但内部改为 `nodeId` 视图
2. `onEditorDocumentCommitted()` 之后的 reload/sync 逻辑要以 V2 文档为准

交付标准：

1. V2 `scene.json` 可以被 SceneBuilder 读取并构建
2. hierarchy、实例节点、普通 transform 节点都有稳定 runtime 映射

### 阶段 3：升级编辑器保存链

目标：

1. 选中、保存、undo、redo、duplicate 全部对齐 V2

优先修改文件：

1. `src/editor-package/types.ts`
2. `src/editor-package/adapter.ts`
3. `src/editor-package/document.ts`
4. `src/editor-package/scene-instance-duplicate.ts`
5. `src/editor-package/runtime.ts`

具体改造：

1. `ProjectPersistentBinding` 从单一 `sceneInstance` 升级为至少：
   - `sceneNode`
   - 视后续需求再补 `sceneAsset`
2. `adapter.ts` 的职责改成：
   - `runtime node -> sceneNode binding`
   - authored root node 归一化
   - 新 hierarchy 下的 selection 解析
3. `document.ts` 的写回路径从：
   - `sceneInstances[index]`
   改成：
   - `scene.nodes[index]`
4. transform 写回目标改成节点级 authored transform
5. duplicate 逻辑改为复制 `scene.nodes` 中的目标节点，而不是复制 V1 `sceneInstances`
6. history entry 名义上至少区分：
   - `nodeTransform`
   - 后续如果要支持 asset defaults，再补 `assetDefaultTransform`
7. `runtime.ts` 里的 context change 序列化也要支持新的 binding 形态

交付标准：

1. workspace 进入编辑模式后可以正常选中 V2 节点
2. transform 调整可以写回 `scene.nodes`
3. undo/redo/save/reload 能闭环

## File-Level Change List

如果按当前代码状态估算，V2 首轮改造至少会触达这些文件：

1. `src/config/types.ts`
2. `src/config/scene.json`
3. `src/config/ConfigService.ts`
4. `src/services/SceneBuilder.ts`
5. `src/services/ConfigValidator.ts`
6. `src/core/Game.ts`
7. `src/editor-package/types.ts`
8. `src/editor-package/adapter.ts`
9. `src/editor-package/document.ts`
10. `src/editor-package/scene-instance-duplicate.ts`
11. `src/editor-package/runtime.ts`

可能跟着调整但不一定首轮必须动的文件：

1. `src/editor-package/runtime-core/monitor.ts`
2. `src/editor-package/runtime-core/selection-controller.ts`
3. `src/editor-package/runtime-core/inspector-host.ts`

原则：

1. 如果只是 binding 枚举和 document path 变化，优先控制在 `editor-package` 外围
2. 只有当 V2 hierarchy 影响选中行为时，再下沉到 `runtime-core`

## Recommended Execution Order

建议按下面顺序推进，而不是并行乱改：

1. 先改 `types.ts + scene.json + ConfigService`
2. 再改 `SceneBuilder + Game`
3. 再改 `editor-package`
4. 最后补 `ConfigValidator`
5. 每阶段结束都做一次最小验收

原因：

1. `editor-package` 依赖配置结构和 runtime node 视图
2. 如果配置层和 SceneBuilder 还没稳定，先改编辑器只会反复返工

## Validation Checklist

每个阶段完成后，至少做这些验证：

1. `pnpm typecheck`
2. `pnpm build`
3. 本地项目能正常启动
4. 场景节点能按预期构建
5. 平台 workspace 点击 `Edit` 后 inspector 能正常拉起
6. 选中对象后能改 transform
7. 保存并刷新后结果仍在

## Short-Term Recommendation

当前最合理的第一刀不是直接改编辑器，而是：

1. 先在 `src/config/types.ts` 定义 V2 类型
2. 把 `src/config/scene.json` 改成 V2 结构
3. 同步重写 `src/config/ConfigService.ts`

完成这一步后，再进入 `SceneBuilder` 改造。

这样做的原因是：

1. V2 的根变化首先是 authored 数据模型变化
2. `SceneBuilder` 和 `editor-package` 都依赖配置层
3. 先稳定主模型，后续改造面才可控
