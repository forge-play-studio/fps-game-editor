# Runtime Node Naming Plan

这份文档记录 `lumber_order` 当前运行时节点命名的现状、问题、建议方案，以及下一次项目迭代中如果要调整命名规则，应该怎么改。

本文档是工程设计记录，不要求在当前 `save-v2` 收尾阶段立即实施。

## 1. 当前现状

当前一个典型的树实例，在运行时会表现成三层：

1. 外层 authored scene node：`forest_lv1_54`
2. 模型根节点：`tree_lv1_inst_53:__root__`
3. 具体 mesh 节点：`tree_lv1_inst_53:pCylinder5`

这三层的来源分别不同：

1. `forest_lv1_54`
   - 来自 `scene.json` 的 `scene.nodes[*].id`
   - 由 `SceneBuilder.buildSceneNodeRuntime()` 创建
   - 是 document/history/save/binding 的稳定锚点
2. `tree_lv1_inst_53:*`
   - 来自 `ModelPool.instantiateFromContainer()`
   - 命名规则当前写死为 `{modelId}_inst_{index}:{originalName}`
   - `index` 来自 `ModelPool.getNextIndex(modelId)`，是按模型维度递增的 0-based 计数
3. `__root__ / pCylinder5`
   - 来自 glb 资产内部原始节点名
   - 是 shared material / shared outline 持久化时应使用的稳定 path segment

当前代码位置：

1. `src/services/SceneBuilder.ts`
   - `buildSceneNodeRuntime()` 创建外层 `TransformNode`
   - `createSceneAssetRuntime*()` 获取资产运行时节点
2. `src/services/ModelPool.ts`
   - `instantiateFromContainer()` 决定 pooled runtime 节点命名
   - `getNextIndex()` 决定 `tree_lv1_inst_53` 里的数字

## 2. 当前命名规则的问题

当前规则本身不是功能 bug，但会持续带来调试和维护成本。

### 2.1 authored scene node 与 runtime pooled node 不对齐

现在常见的对应关系是：

1. scene node：`forest_lv1_54`
2. runtime model root：`tree_lv1_inst_53:__root__`

这两个数字体系不同：

1. `forest_lv1_54` 是 1-based 的 authored node 编号
2. `tree_lv1_inst_53` 是 0-based 的 pooled instance 计数

结果是：

1. console 调试时需要人工做映射
2. Inspector 里看到的节点名不能直接对应 `scene.json`
3. save-v2/shared material/shared outline 的排查成本更高

### 2.2 pooled instance name 不稳定

`tree_lv1_inst_53` 这类名字依赖实例化顺序。

只要下面任意一项发生变化，runtime name 就可能变化：

1. 同模型实例数量变化
2. 加载顺序变化
3. pool 预热顺序变化
4. reload 后先后 acquire 的顺序变化

这意味着：

1. 它适合做“当前场景中唯一识别”
2. 但不适合做“跨次运行稳定标识”

### 2.3 runtime name 与 document 层语义不一致

`save-v2` 的 document/history/save 主体已经明显以 `scene.nodes[*].id` 作为主锚点。

在这种架构下，运行时最常用的名字如果仍然是 `modelId_inst_index`，就会和：

1. selection binding
2. undo/redo entry
3. shared material / shared outline 归属
4. save -> reload 验证

长期保持语义错位。

## 3. 设计目标

下一轮迭代如果调整命名，目标应固定为：

1. 运行时名字更贴近 authored scene node
2. pooled runtime 仍然保持唯一
3. save/document 使用的 stable path 不受影响
4. 不破坏已有 shared material / shared outline 的持久化语义
5. 对非 scene-node 场景保留向后兼容

## 4. 建议方案

建议把 pooled runtime 节点前缀，从当前的：

1. `{modelId}_inst_{index}`

改成：

1. `{sceneNodeId}`

也就是把：

1. `tree_lv1_inst_53:__root__`
2. `tree_lv1_inst_53:pCylinder5`

改成：

1. `forest_lv1_54:__root__`
2. `forest_lv1_54:pCylinder5`

这个方案只改变运行时节点名，不改变 document/save 的 path 语言。

### 4.1 为什么推荐 `sceneNodeId`

因为它同时满足：

1. 与 authored scene node 直接对齐
2. 在当前场景内天然唯一
3. 对编辑器和 save-v2 调试更友好
4. 不依赖 pool 内部实例顺序

### 4.2 为什么不建议用显示名

不要用 `nodeConfig.name`，只建议用 `nodeConfig.id`。

原因：

1. `name` 可能重复
2. `name` 可能被用户修改
3. `id` 才是 document/history/save 的稳定主键

## 5. 非目标

这次命名迭代不应该顺带做这些事：

1. 不改 shared material / shared outline 的持久化 path
2. 不改 `scene.json` 结构
3. 不改 document binding 语义
4. 不把 runtime name 写入 save key
5. 不把 Babylon 节点 `id` 和 `name` 都强行重写成同一套持久化语言

一句话：

只改运行时“可读命名”，不改持久化“稳定路径”。

## 6. 具体实施方案

### 6.1 修改 `ModelPool.acquire()`

当前接口：

```ts
acquire(modelId: string): PooledInstance
```

建议改成：

```ts
acquire(modelId: string, runtimePrefix?: string): PooledInstance
```

同理，`acquireOnce()` 也建议补同样的可选参数：

```ts
acquireOnce(modelId: string, runtimePrefix?: string): Promise<PooledInstance>
```

设计要求：

1. `runtimePrefix` 未传时，保持旧行为
2. `runtimePrefix` 已传时，使用 `sceneNodeId` 风格的名字

这样可以保证：

1. `SceneBuilder` 这条 authored scene node 路径可以启用新命名
2. 非 scene-node 场景下的旧代码不被强制打断

### 6.2 为 pooled 实例增加“整棵层级重命名” helper

不能只在首次 `instantiateModelsToScene()` 时改名。

因为对象池会复用实例。一次实例归还后，下一次可能要服务另一个 `sceneNodeId`。

所以需要新增 helper，例如：

```ts
private renameRuntimeHierarchy(root: TransformNode, prefix: string): void
```

逻辑要求：

1. 遍历 `root` 和全部子节点
2. 取每个节点当前名字的稳定 suffix
3. 重新写成 `${prefix}:${suffix}`

示例：

1. `tree_lv1_inst_53:__root__` -> `forest_lv1_54:__root__`
2. `tree_lv1_inst_53:pCylinder5` -> `forest_lv1_54:pCylinder5`
3. `pCylinder5` -> `forest_lv1_54:pCylinder5`

### 6.3 `instantiateFromContainer()` 保留兜底命名

即使引入 `runtimePrefix`，`instantiateFromContainer()` 仍然应该保留旧的默认命名：

1. `{modelId}_inst_{index}:{originalName}`

原因：

1. 它仍然是未传 `runtimePrefix` 时的兼容兜底
2. 新建实例后，在第一次 `acquire(..., runtimePrefix)` 时再统一重命名即可

### 6.4 在 `SceneBuilder` 里显式传入 `sceneNodeId`

当前 `SceneBuilder` 在 shared/runtime path 中会直接：

1. `this.modelPool.acquire(asset.sourceId)`
2. `this.modelPool.acquireOnce(asset.sourceId)`

建议改成：

1. `this.modelPool.acquire(asset.sourceId, nodeConfig.id)`
2. `this.modelPool.acquireOnce(asset.sourceId, nodeConfig.id)`

主要落点：

1. `src/services/SceneBuilder.ts`
   - `createSceneAssetRuntimeAsync(...)`
   - `createSceneAssetRuntimeSync(...)`

这样外层 authored scene node id 就能成为内部 runtime hierarchy 的命名前缀。

### 6.5 只改 `name`，先不改 `id`

建议第一轮只改 Babylon 节点 `name`，不要同时改节点 `id`。

原因：

1. 当前很多逻辑先读 `name`，再回退 `id`
2. 同时改 `id` 的影响面更大
3. `name` 足够满足调试、日志和 runtime 可读性的目标

如果未来有需要，再单独评估是否同步改 `id`。

## 7. 为什么不能直接把 runtime name 也简化成 `__root__ / pCylinder5`

不能只保留 `__root__` 和 `pCylinder5`，原因是运行时场景里会同时存在很多份同模型实例。

如果所有实例内部都直接叫：

1. `__root__`
2. `pCylinder5`

就会出现大量重名节点。

这会带来：

1. Inspector 调试无法区分属于哪一份实例
2. console 日志不可读
3. pooled instance 排查困难
4. 选择、监控和运行时诊断的人工成本大幅上升

因此：

1. `__root__/pCylinder5` 适合作为 document/save 的 stable path
2. `forest_lv1_54:__root__ / forest_lv1_54:pCylinder5` 适合作为 runtime unique name

## 8. 风险点

### 8.1 对象池复用下的命名残留

这是最大风险。

如果只在首次实例化时命名，而不是每次 acquire 都重命名，就会出现：

1. 当前 scene node 是 `forest_lv1_54`
2. runtime 内部却残留上一次的 `forest_lv1_12:*`

所以必须保证：

1. 每次 acquire 都执行 `renameRuntimeHierarchy()`

### 8.2 依赖旧 runtime name 的代码可能受影响

仓库内如果有旧逻辑直接按：

1. `modelId_inst_*`
2. 某个具体 runtime 节点名

做查找或特殊处理，改名后会失效。

因此实施前必须扫描：

1. `rg "_inst_" src`
2. `rg "modelId_inst" src`
3. `rg "getChildren\\(|getChildMeshes\\(" src`

并确认没有把旧 runtime name 当成稳定协议使用。

### 8.3 pool 调试信息减少

旧命名的优点是可以直接看出：

1. 这是第几个 pooled instance

改成 `sceneNodeId` 后，这类 pool 视角信息会丢失。

建议补充做法：

1. 在节点 `metadata` 中保留 `modelId`
2. 需要时可额外保留 `poolIndex`
3. pool 调试不要继续依赖 `name` 本身编码序号

### 8.4 singleton 行为要单独确认

`acquireOnce()` 当前只重命名根节点，不递归改子节点。

如果未来希望 singleton 也采用同样规则，需要先明确：

1. singleton 是否真的对应 authored scene node
2. 是否允许对其整棵层级重命名

建议第一轮策略：

1. pooled scene-node instance 先支持新命名
2. singleton 继续兼容旧逻辑
3. 若 singleton 也进入 scene-node authored 体系，再单独升级

### 8.5 不能误伤 stable path 逻辑

shared material / shared outline / child material / child outline 当前都依赖稳定 path segment。

无论 runtime name 怎么改，下面这些都不能变：

1. `__root__/pCylinder5`
2. `resolveMaterialOwnerNode()` 的稳定 path 语言
3. document/history/save 的 key 语义

也就是说：

1. runtime naming 可以变
2. stable owner path 不能因此退回依赖 runtime prefix

## 9. 实施顺序建议

建议按这个顺序做：

1. 先扩 `ModelPool.acquire/acquireOnce` 签名
2. 再实现 `renameRuntimeHierarchy(root, prefix)`
3. 在 `SceneBuilder` 的 scene-node 路径传 `nodeConfig.id`
4. 保持未传 `runtimePrefix` 的调用点继续走旧行为
5. 扫描仓库里对 `_inst_` 的依赖
6. 做回归测试

不要一上来就：

1. 全仓硬替换 runtime 命名
2. 同时修改 `name` 和 `id`
3. 同时修改 save/document path

## 10. 回归测试清单

实施后至少验证这些场景：

### 10.1 运行时命名

1. `forest_lv1_54` 的内部节点应变成 `forest_lv1_54:__root__`
2. 对应 mesh 应变成 `forest_lv1_54:pCylinder5`
3. reload 后命名保持一致

### 10.2 pooled 复用

1. 销毁或回收一个 scene node
2. 再创建另一个同模型 scene node
3. 确认内部名字会被重新命名成新的 `sceneNodeId:*`
4. 不能残留上一次实例的前缀

### 10.3 material / outline save-v2

1. shared material save 仍然写入 `scene.materials`
2. shared outline save 仍然写入 `scene.assets[*].defaults.outline / childOutlines`
3. instance override 仍然写入 `scene.nodes[*].overrides`
4. `ownerNodePath` 仍然是 `__root__/pCylinder5` 风格

### 10.4 undo / redo / reload

1. material undo/redo 正常
2. outline undo/redo 正常
3. save -> reload 正常
4. 不能因为 runtime name 改了，导致 shared path 命中失败

### 10.5 非 scene-node 路径兼容

1. 非 `SceneBuilder` 直接调用 `modelPool.acquire(modelId)` 的代码继续可用
2. 未传 `runtimePrefix` 的场景仍保留旧命名

## 11. 建议结论

对于 `lumber_order` 这类已经明显进入 document-driven/save-v2 的项目，建议在下一轮迭代中采用：

1. authored scene node 外层仍由 `sceneNodeId` 表示
2. runtime pooled hierarchy 的前缀改为同一个 `sceneNodeId`
3. stable save path 继续使用资产内部路径 `__root__/...`

简化后就是：

1. runtime 可读命名对齐 `sceneNodeId`
2. document/save 稳定路径继续对齐 glb 内部节点层级

这是当前最平衡的方案。
