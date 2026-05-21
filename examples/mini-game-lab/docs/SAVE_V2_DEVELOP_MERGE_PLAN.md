# Save V2 Merge Plan Into `develop`

本文档用于指导把 `feat/save-v2` 合并进 `develop`，并明确本次合并的边界、风险点、文件级处理原则和回归要求。

当前建议执行分支：

- 基础分支：`develop`
- 集成分支：`merge/save-v2-into-develop`
- 功能分支：`feat/save-v2`

## 目标

本次合并的目标不是重做 `scene.json v2` 标准，而是把 `feat/save-v2` 已完成的能力接入 `develop`：

- material 进入 document/history/save/reload 链路
- outline 进入 document/history/save/reload 链路
- shared material 与 instance override 分流
- shared outline 与 node override 分流

同时必须保证：

- `develop` 当前 `scene.json` 为准，不被整文件覆盖
- `develop` 当前已在使用的 `childTransforms` 不丢失
- `develop` 当前 layout / overlay / camera 相关能力不回退

## 总体合并策略

不要直接在 `develop` 上执行一次 merge 然后结束，也不要拆成大量 cherry-pick。

推荐流程：

1. 从 `develop` 创建集成分支 `merge/save-v2-into-develop`
2. 在集成分支上 merge `feat/save-v2`
3. 手工处理关键文件
4. 跑构建和回归
5. 回归通过后，再把集成分支合回 `develop`

推荐命令：

```bash
git checkout develop
git pull
git checkout -b merge/save-v2-into-develop
git merge --no-ff feat/save-v2
```

## `scene.json` 处理原则

`scene.json` 以 `develop` 为准。

本次不要使用 `feat/save-v2` 的整份 `src/config/scene.json` 覆盖 `develop`。

当前已确认：

- `develop` 的 `scene.materials` 仍为空数组
- `develop` 当前没有 `forest_lv1_*` 的 material / outline override 需要迁移
- `develop` 当前已经存在 `childTransforms` 数据

因此本次对 `scene.json` 的处理原则是：

1. 保留 `develop` 的整份场景布局数据
2. 仅手工带入 `save-v2` 需要的最小语义变更
3. 当前已确认的最小变更是：
   - `asset_tree_lv1.materialMode = "shared"`

不要做的事：

- 不要用 `feat/save-v2` 的 `scene.json` 覆盖 `develop`
- 不要因为 `save-v2` 合并而重排 `develop` 当前 scene layout
- 不要清理或重写 `develop` 里已有的 `childTransforms`

## `types.ts` 合并原则

`src/config/types.ts` 不能直接选一边，必须做并集合并。

### 必须保留的 `save-v2` 类型

- `SceneAssetMaterialMode`
- `SceneAssetConfig.materialMode`
- `MaterialTextureOverrideConfig`
- `MaterialOverrideConfig`
- `SceneSharedMaterialConfig`
- `OutlineOverrideConfig`
- `SceneNodeVisualOverrides`
- `SceneDocumentScene.materials` 的正式类型
- `SceneAssetDefaults.outline / childOutlines`

### 必须保留的 `develop` 类型

- `childTransforms?: Record<string, TransformConfig>`
- `GroundOverlayPlaneConfig.position.y`
- `GroundOverlayPlaneConfig.scaling`

### 合并后的推荐形态

`SceneInstanceNode.overrides` 应统一为一个正式的 visual override 类型，并同时容纳：

- `material`
- `childMaterials`
- `childTransforms`
- `outline`
- `childOutlines`

也就是说，`childTransforms` 虽然不是 `scene json v2` 当前定稿标准的一部分，但在 `develop` 中已经是有效扩展字段，合并时必须保留。

## `ConfigService.ts` 合并原则

`src/config/ConfigService.ts` 是本次合并最容易遗漏的文件之一。

原因：

- `save-v2` 版本会对 `scene` 文档做 normalization
- `develop` 当前在使用 `childTransforms`
- 如果直接拿 `save-v2` 的 `ConfigService.ts`，而没有把 `childTransforms` 补进去，`develop` 现有数据会在 normalize/save 流程里被吃掉

必须保证：

1. `normalizeSceneNodeOverrides()` 保留 `childTransforms`
2. `childTransforms` 的值也经过与 `TransformConfig` 一致的安全归一化
3. 合并后 reload/save 不会丢失 `develop` 中已有的 `childTransforms`

建议补一个与 material / outline 同级的 transform map normalization helper。

## `SceneBuilder.ts` 合并原则

`src/services/SceneBuilder.ts` 是本次最高风险文件。

### 必须保留的 `develop` 能力

- `applyChildTransforms(...)`
- camera projection 更新逻辑
- ground overlay 的 `position.y`
- ground overlay 的 `scaling`

### 必须采用的 `save-v2` 能力

- shared material / instance material 分流
- shared material 回放
- shared outline 回放
- scene node material override 回放
- scene node outline override 回放
- `scene.materials` 的正式消费链路

### 不建议继续保留为主链的旧逻辑

- 旧版 `applyChildMaterials(...)`

原因：

- 旧版逻辑只按 child name 和泛型对象赋值工作
- 它不理解 shared material、instance override、ownerNodePath、`scene.materials`
- 合并后如果继续由它担任主材质回放逻辑，会造成 save 链和 reload 链语义不一致

### 需要谨慎处理的逻辑

`develop` 当前存在：

```ts
if (attached.modelNode.name === '__root__') {
  attached.modelNode.name = `${nodeConfig.id}_model`;
}
```

这段逻辑不能无脑保留。

原因：

- `save-v2` 当前 material / outline 的稳定 path 语言以 `__root__/...` 为锚点
- 如果在 runtime 构建阶段把根节点改名，可能导致 save/reload path 解析链不稳定

建议：

- 先不要直接保留这段 rename
- 先保证 `save-v2` 路径语义稳定
- 如果后续仍需要 runtime naming 优化，按独立迭代处理

### 推荐的回放顺序

实例节点挂载后，推荐按以下顺序应用：

1. `asset.defaults.transform`
2. `childTransforms`
3. shared material
4. shared outline
5. scene node material override
6. scene node outline override

这样可以保证：

- `develop` 当前 child transform 修正不丢
- shared 是默认基线
- node override 最终覆盖 shared

## 关于 `childTransforms` 的定位

`childTransforms` 不属于 `scene json v2` 当前定稿标准，但属于文档明确预留的后续扩展项。

在 `develop` 当前代码中，它已经是有效功能：

- `types.ts` 已声明
- `scene.json` 已有实际数据
- `SceneBuilder.ts` 已在实例挂载时消费

因此本次合并的原则不是删除它，而是：

- 保留它
- 兼容它
- 不让 `save-v2` 的 normalization 链把它丢掉

## 风险清单

### 高风险

1. `SceneBuilder.ts`
   - save 可能成功，但 reload 语义出错
   - shared / override 优先级可能被旧逻辑污染

2. `ConfigService.ts`
   - `childTransforms` 被 normalization 吞掉
   - 导致 `develop` 现有 scene 数据丢失

### 中风险

1. `types.ts`
   - 类型没并完整，导致运行时和文档语义不一致

2. `scene.json`
   - 如果误用 `feat/save-v2` 覆盖，会回退 `develop` 现有布局数据

### 低风险

1. `editor-package/document.ts`
2. `editor-package/runtime-core/material-property-adapter.ts`
3. `editor-package/runtime-core/outline-adapter.ts`
4. `editor-package/runtime-core/monitor.ts`

这些文件主要由 `save-v2` 引入，`develop` 直接重叠修改较少，冲突通常不是主问题。

## 回归清单

合并完成后，至少回归以下场景：

### Save V2 主链

1. 普通实例 material：
   - undo
   - redo
   - save
   - reload

2. `forest_lv1` shared material：
   - shared 生效
   - save 后写入 shared material 定义位
   - reload 后继续共享

3. outline：
   - `renderOutline`
   - `outlineWidth`
   - `outlineColor`
   - undo / redo / save / reload

### `develop` 现有能力保护

1. `collect_table` 的 `childTransforms`
2. `sm_diban1_3_tile` 的 `childTransforms`
3. camera projection
4. ground overlay 的 `y/scaling`

### 组合场景

1. 先改 material，再改 outline，再做连续 undo / redo
2. save 后 reload，确认材质与 outline 结果一致
3. reload 后再编辑一次，确认不会把 shared 回退成 override

## 本次合并的边界

本次合并不处理：

- runtime node naming 重构
- `childTransforms` 升级为 `scene json v2` 当前正式标准
- 对 `develop` 现有 scene layout 的重排
- 额外新增新的 editor 协议能力

这些属于后续迭代。

## 结论

本次正确的合并方式是：

- 基于 `develop` 建立集成分支
- merge `feat/save-v2`
- 手工并合 `types.ts`、`ConfigService.ts`、`SceneBuilder.ts`
- 以 `develop` 的 `scene.json` 为准，仅带入最小语义变更
- 完整跑回归后再回合到 `develop`

不要用整文件覆盖来解决合并问题。
