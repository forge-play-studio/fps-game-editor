# Node Visual Persistence Refactor Plan

## 1. 背景

当前编辑器已经具备以下几类保存链能力：

1. `transform` 变更可以进入 working copy / history / undo / redo / save / reload
2. `instance material` 变更可以进入 working copy / history / undo / redo / save / reload
3. `outline` 变更也已具备类似主链

但最近在真实页面联调中，暴露出一个结构性问题：

- `collect_table_sell_decal_mat` 的 `Diffuse Color` 在 Inspector 中可以直接修改
- runtime 预览会立即生效
- 点击保存后没有报错
- 刷新页面后颜色丢失

进一步确认后发现：

- 该对象对应的 scene node 是 `collect_table_sell_decal`
- 它在 `scene.json` 中是：
  - `kind: "transform"`
  - `transformType: "groundDecal"`
- 当前材质保存链在 `document.ts` 中只接受 `instance`

因此这次问题不是简单的字段映射问题，而是当前保存链模型本身过于依赖 `instance` 语义。

---

## 2. 当前问题

### 2.1 现状

当前材质保存链的大致逻辑是：

1. runtime 捕获材质属性修改
2. 解析所属 runtime node
3. 解析 document binding
4. 在 document 层要求：
   - `location.value.kind === 'instance'`
5. 再把改动写回：
   - `scene.nodes[].overrides.material`
   - `scene.nodes[].overrides.childMaterials`
   - 或 `scene.materials`

### 2.2 结构性缺口

这种实现默认假设：

- 只有 `instance` 才是材质持久化的合法宿主

但这在 runtime 世界里并不成立，因为以下节点同样可能拥有 visual state：

1. `instance`
2. `transform`
3. 未来其它 procedural / helper / decal 类节点

只要某个节点在 runtime 层拥有 material / texture，用户就可能在 Inspector 中直接编辑它。

如果 document/save 层没有为该节点类型提供 authored 落点，就会出现：

1. runtime 可改
2. 预览可见
3. document 不落盘
4. save 不生效
5. reload 丢失

### 2.3 已复现案例

`collect_table_sell_decal` 就是当前最清晰的例子：

1. 它是 `transform + groundDecal`
2. runtime 创建了 `StandardMaterial`
3. Inspector 可以直接修改 `Diffuse Color`
4. 但 document 层不认这类材质修改
5. reload 时 `SceneBuilder` 还会按 `groundDecal` 配置重新建材质

这说明当前不是 isolated bug，而是保存链模型边界被真实场景打穿。

---

## 3. 改造目标

本次改造目标不是再补一个孤立的 `groundDecal if-else`，而是建立更合理的视觉持久化模型。

### 3.1 总目标

将当前保存链从：

- 面向 `instance` 的材质保存

升级为：

- 面向 `node / material / texture` 分域的通用 visual persistence

### 3.2 核心目标

新的编辑器保存链必须明确区分三个主 domain：

1. `node`
2. `material`
3. `texture`

这三个 domain 的职责必须分开，不能继续混在一套 `instance.overrides.material` 语义里。

#### A. node domain

负责节点自身 authored 状态，例如：

1. `position`
2. `rotation`
3. `scaling`
4. `groundDecal.color`
5. `groundDecal.size`
6. 未来其它 node-level visual config

关键特征：

- 它描述的是“这个 scene node 自身是什么样”
- 数据应落在 `scene.nodes[]` 及其子结构中

#### B. material domain

负责材质参数本身，例如：

1. `PBR.albedoColor`
2. `PBR.baseWeight`
3. `PBR.reflectivityColor`
4. `Standard.diffuseColor`
5. `Standard.specularColor`
6. `Standard.specularPower`
7. `alpha`
8. `backFaceCulling`

关键特征：

- 它描述的是“材质实例的参数”
- 材质实体本体应统一落在 `scene.materials`
- 不应强行替代 node 自己的 authored visual 字段

material domain 还需要明确区分两层语义：

1. material 实体本体
   - 不论是 shared material 还是 independent material
   - 都应统一存放在 `scene.materials`
   - 不应因为“当前不是 shared”就直接降级写入 node override

2. node 上的 material override
   - 只用于 node 已经引用某个 shared material，但该 node 需要局部材质差异的情况
   - 数据应落到：
     - `scene.nodes[].overrides.material`
     - `scene.nodes[].overrides.childMaterials`
   - 它表达的是“针对某个 node 的局部覆写”，不是 material 实体本体

也就是说：

- 是否进入 `material domain`，取决于这个改动是不是“材质参数修改”
- 进入 `material domain` 后，先判断是在编辑 material 实体本体，还是在编辑 node 对 shared material 的局部 override

#### C. texture domain

负责纹理引用及纹理槽位，例如：

1. `albedoTexture`
2. `normalTexture`
3. `metallicTexture`
4. `groundDecal.textureId`
5. 未来的 texture asset reference / sampler config

关键特征：

- 它描述的是“材质或节点使用了什么纹理资源”
- 它不应与 material color、node color 混成一个保存入口

### 3.3 具体目标

1. 保存资格不再由 `node.kind === 'instance'` 决定
2. 改为由：
   - 当前节点类型
   - 当前变更属于 `node / material / texture` 哪个 domain
   - 该节点是否定义了对应 authored mapping
   共同决定
3. `node / material / texture` 三条链都具备统一建模能力
4. 允许不同 node kind 实现各自的 persistence mapping
5. 对 `material domain`，必须先判断该 node 是否使用 shared material：
   - 使用 shared material：走 shared material 保存
   - 不使用 shared material：走 node 内部 override 保存

### 3.4 非目标

本方案不要求一次性支持所有 Babylon 材质或所有 runtime node。

第一阶段不做：

1. `group material`
2. 所有 procedural node 的完整视觉语义
3. 所有 texture slot 的全量扩展
4. Inspector UI 全量重构

---

## 4. 设计原则

### 4.1 先找 node，再找 domain

所有 visual 变更都应先回答两个问题：

1. 这个变更属于哪个 scene node
2. 这个变更属于哪个 domain

domain 至少包括：

1. `node`
2. `material`
3. `texture`
4. `outline`

其中：

- `transform` 应属于 `node domain`
- `groundDecal.color` 也应属于 `node domain`
- 材质参数属于 `material domain`
- 纹理引用属于 `texture domain`

### 4.2 保存资格按 authored mapping 决定

不再使用这种硬编码：

```ts
location.value.kind === 'instance'
```

改为：

```ts
canPersistNodeVisualChange(node, domain, change)
```

也就是：

- 不是某个 kind 天生能存
- 而是某个 kind 是否实现了对应 domain 的 authored 落点

### 4.3 runtime 编辑能力与 document 持久化能力要对齐

如果一个节点在 Inspector 中暴露了某个可编辑 visual 属性，就应尽量保证它：

1. 可以进 working copy
2. 可以进 history
3. 可以 undo / redo
4. 可以 save
5. 可以 reload 回放

若暂不支持，至少应在适配层明确拦截，而不是让用户出现“能改但存不住”的假象。

### 4.4 static visual 必须落到 scene.json

符合仓库约定，所有静态视觉结果都应写回 `scene.json`。

不能通过：

1. `SceneBuilder` 硬编码默认颜色作为最终结果
2. reload 后再次覆盖用户在编辑器中的静态修改

---

## 5. 推荐架构

## 5.1 引入 Visual Domain Mapping

建议引入一层统一抽象：

```ts
type VisualDomain = 'node' | 'material' | 'texture' | 'outline';

type VisualPersistenceMapping =
  | { supported: false; reason: string }
  | {
      supported: true;
      domain: VisualDomain;
      nodeKind: string;
      writeToDocument(change: unknown): boolean;
      readFromDocument(node: unknown): unknown;
      applyToRuntime(node: unknown, value: unknown): boolean;
    };
```

并提供：

```ts
resolveVisualPersistenceMapping(nodeConfig, runtimeNode, change)
```

由它决定：

1. 当前改动是否支持保存
2. 如果支持，落到 `scene.json` 的哪里
3. undo / redo 时如何回放
4. reload 时如何重新构建

---

## 5.2 将保存链按 node kind + domain 拆分

### A. `node domain`

这一层只处理“scene node 自身 authored 字段”的保存。

例如：

1. `group.transform`
2. `transform.transform`
3. `instance.transform`
4. `groundDecal.color`
5. `groundDecal.size`

它不应关心 Babylon runtime 上是否恰好通过 material 才表现出颜色变化。

如果一个视觉效果在 authored schema 中属于 node 自己的字段，那么即使 runtime 最终是改了 material，也应该优先回写到 node domain。

### B. `material domain`

应拆成两条明确子链：

1. material 实体本体
   - shared material 和 independent material 都统一写到 `scene.materials`
   - 这是材质参数的主要 source of truth

2. node 对 shared material 的局部 override
   - 只有 node 已经在使用某个 shared material
   - 且当前编辑意图是“只影响这个 node”
   - 才写到：
     - `scene.nodes[].overrides.material`
     - `scene.nodes[].overrides.childMaterials`

### C. `transform(groundDecal) + material`

不应再把 `groundDecal` 的材质本体编辑误建模成 `node domain`。

例如：

1. `StandardMaterial.diffuseColor`
2. `StandardMaterial.specularColor`
3. `StandardMaterial.specularPower`

这些都属于 `material domain`，应优先落到 `scene.materials` 中对应的 material 实体。

只有当 `groundDecal` 正在引用某个 shared material，且该次修改明确是“只影响当前 node”的局部差异时，才进入 node override。

### D. `transform(groundDecal) + texture`

应从 material 保存链中拆出一部分，作为 texture domain 单独建模。

例如：

1. `material.diffuseTexture.url`
   - 不再直接当作 generic material override
   - 而是映射为：
     - `groundDecal.textureId`
     - 或 `groundDecal.texture`

### E. `node + outline`

outline 也不应长期锁死在 `instance` 上。

有 outline target 的节点，应允许声明自己的 outline persistence mapping。

---

## 6. 第一阶段最小改造范围

建议先做一个能闭环当前真实问题的最小版本。

### 6.1 目标

先补 `groundDecal` 相关 case，但不再走错误的 `node -> groundDecal.color` 持久化。

第一阶段目标应是：

1. `transformType === 'groundDecal'`
2. `StandardMaterial`
3. `Lighting & Colors`
4. 将材质编辑统一接入 `material domain`

### 6.2 authored 落点

将 runtime 中的：

- `material.standard.diffuseColor`

优先回写到 `scene.materials` 中对应的 material 实体。

只有当同时满足以下条件时，才允许落到 node override：

1. 当前 node 正在使用 shared material
2. 当前编辑意图是为该 node 创建局部材质差异

此时可写入：

- `scene.nodes[].overrides.material`
- `scene.nodes[].overrides.childMaterials`

同时需要明确一条优先级规则：

1. material 实体本体默认写入 `scene.materials`
2. node internal material override 只用于 shared material 的局部差异
3. `groundDecal.color` 仍然是 node 自身 authored 字段，但不应承接普通材质参数编辑

### 6.3 需要打通的链路

1. runtime 变更捕获
2. document working copy 写入
3. history 入栈
4. undo / redo
5. save / export
6. reload / rebuild 回放

### 6.4 SceneBuilder 同步修改

`SceneBuilder.attachTransformRuntime()` 当前对 textured decal 有这段逻辑：

```ts
mat.diffuseTexture = texture;
mat.useAlphaFromDiffuseTexture = true;
mat.diffuseColor = new Color3(1, 1, 1);
```

这会在 reload 时把颜色强行重置为白色。

第一阶段必须改成：

1. 构建阶段的默认颜色与 material override 回放职责分离
2. 不应让重建逻辑把已保存的 material edit 再覆盖掉
3. reload 后应优先按 `scene.materials` / node override 的最终 authored 结果回放

---

## 7. 第一阶段具体实现建议

## 7.1 `material-property-adapter.ts`

增加对 material 实体与 node-local override 的区分：

1. 先通过 binding 找到 scene node
2. 再识别当前编辑对象对应的是：
   - material 实体本体
   - 还是 node 对 shared material 的局部 override
3. 对 `groundDecal` 的 `StandardMaterial.diffuseColor`
   - 不再转换成 `node domain`
   - 而是继续作为 `material.standard.diffuseColor` 进入 `material domain`

## 7.2 `document.ts`

需要把 `material domain` 的 authored 路由修正为：

1. material 实体本体：
   - 写入 `scene.materials`
2. shared material 的 node-local override：
   - 写入 `scene.nodes[].overrides.material`
   - 或 `scene.nodes[].overrides.childMaterials`
3. 不再把普通材质参数编辑回写成 `sceneNode.groundDecal.color`

## 7.3 `types.ts`

需要在类型层面明确：

1. material 实体配置的 schema
2. node 对 material 的引用关系
3. node-local material override 只代表 shared material 的局部差异

## 7.4 `runtime-core/monitor.ts`

让 monitor 支持：

1. 当识别到该材质属于 groundDecal
2. 且修改的是 `StandardMaterial.diffuseColor`
3. 继续生成 `material domain` 的快照和变更
4. 并进一步区分应写入 `scene.materials` 还是 node-local material override

## 7.5 `SceneBuilder.ts`

reload/rebuild 时需要保证：

1. 先构建默认 runtime material
2. 再按 `scene.materials` 回放 material 实体本体
3. 若该 node 存在 shared material 的局部 override，再继续覆盖
4. 不让构建阶段默认值把已保存的 material 结果冲掉

---

## 8. 第二阶段扩展方向

在 `groundDecal` 的 material domain 闭环完成后，再扩更通用的 visual persistence。

### 8.1 对 `transform + groundDecal` 扩展 texture domain

建议增加：

1. `groundDecal.textureId`
2. 可能的 `groundDecal.texture.url`
3. 统一 texture slot 持久化模型

### 8.2 对更多 node kind 开放 material domain

例如：

1. procedural transform mesh
2. helper plane
3. 未来其它 runtime-owned visual node

前提是：

- 每个节点类型都必须声明自己的 authored 落点

### 8.3 统一 change routing

最终把当前：

1. `applyProjectDocumentChange`
2. `applyProjectMaterialDocumentChange`
3. `applyProjectOutlineDocumentChange`

统一抽象成：

```ts
applyProjectVisualDocumentChange(change)
```

内部再分派到：

1. node domain
2. material domain
3. texture domain
4. outline domain

其中 `material domain` 的固定分派规则应为：

1. 先判断当前是在编辑 material 实体本体，还是 node 对 shared material 的局部 override
2. 若是 material 实体本体：
   - 统一写入 `scene.materials`
3. 若是 shared material 的 node-local override：
   - 写入 `scene.nodes[].overrides.material` 或 `scene.nodes[].overrides.childMaterials`
4. 不允许把普通 material 实体编辑错误降级为 node override
5. 不允许在 `scene.materials` 和 node internal override 之间双写

---

## 9. 风险点

### 9.1 Inspector 暴露能力与持久化能力错位

如果某个字段在 Inspector 可改，但底层还没 persistence mapping，就仍会出现“能改但存不住”。

因此要么：

1. 尽快补映射
2. 要么在 adapter 层明确拒绝未支持字段

### 9.2 textured decal 的颜色语义

当前 `groundDecal` 带贴图时被强制设为白色，说明现有逻辑默认把颜色当作“贴图不参与 tint”。

这需要明确：

1. 是否允许贴图被颜色 tint
2. 如果允许，reload 时必须保留 authored color
3. 如果不允许，就不应在 Inspector 中暴露可编辑颜色

### 9.3 旧 schema 兼容

未来若要扩更多 node visual domain，需要注意：

1. 兼容已有 `instance.overrides.material`
2. 兼容已有 shared material 保存结构
2. 不要破坏现有 save/export
3. 渐进式引入，不一次性重写全部逻辑

---

## 10. 验证计划

### 第一阶段验证对象

1. `collect_table_sell_decal`
2. 其 runtime material：`collect_table_sell_decal_mat`

### 验证步骤

1. 在页面中选中该 decal
2. 修改 `Diffuse Color`
3. 确认 runtime 预览变化
4. 检查 working copy 是否更新到 `scene.materials` 或符合预期的 node-local material override
5. 执行 undo
6. 执行 redo
7. 点击保存
8. 检查 `scene.json` 写盘结果
9. 刷新页面
10. 确认颜色仍保留

### 通过标准

1. 不再出现“预览变了但刷新丢失”
2. 普通材质编辑不再错误写入 `groundDecal.color`
3. shared material 与 node-local override 的分派规则清晰且稳定
4. reload 不再把已保存的 material 结果冲掉

---

## 11. 最终结论

当前编辑器的保存链不是完全错误，而是抽象层级偏低：

1. `node` 保存链已有一部分基础
2. `material` 保存链却主要绑定在 `instance`
3. `texture` 还没有作为独立 domain 建模
4. 这导致非 `instance`、但 runtime 同样拥有 material / texture 的节点天然漏存

正确方向不是继续为单个 case 打补丁，而是逐步升级成：

- 面向 `node / material / texture` 分域的通用 visual persistence 模型

第一阶段应先补齐：

- `groundDecal StandardMaterial.diffuseColor -> material domain`
- 默认写入 `scene.materials`
- 仅在 shared material 的 node 局部差异场景下写入 node-local override

用这个真实场景把新模型跑通，然后再扩展到更完整的：

1. material
2. texture
3. outline
4. 其它 node visual domain

一句话总结：

**新的编辑器链路应明确区分 `node / material / texture` 三个 domain；保存逻辑不再默认绑定到 `instance`，而应升级成 node-aware、domain-aware 的通用持久化模型。**
