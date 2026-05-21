# Lumber `save-v2` 改造方案

本文档用于定义 `lumber_order` 在 `feat/save-v2` 分支上的编辑器保存链改造方案。

目标不是简单复制 `train_oil` 当前代码，而是：

1. 继承 `train_oil` / `train_oil_material_inspector` 已验证过的编辑器语义。
2. 基于 `lumber_order` 当前已经是 Scene JSON V2 的前提，直接落正式的 `save-v2` 方案。
3. 避免再走一次 `train_oil` 里 “先在 V1 结构上试验，再回迁到 V2” 的路径。

## 1. 为什么在 `lumber_order` 做这件事

`train_oil` 当前主项目的问题，不是 editor 本身做不了 material / outline 保存，而是：

1. 主项目配置仍以旧结构为核心。
2. `scene.json` 的 V1 -> V2 迁移会和 editor 保存链改造互相耦合。
3. 如果在主项目上继续推进 material / outline save，很容易把“配置迁移问题”和“编辑器语义问题”混在一起。

相比之下，`lumber_order` 已经具备两个明显优势：

1. 配置结构已经是 Scene JSON V2。
2. 编辑器主链已存在，只是 `document/save` 仍主要停留在 transform。

因此在 `lumber_order` 上做 `save-v2`，可以把注意力集中在：

1. Babylon Inspector 事件如何进入编辑器。
2. canonical path 如何进入 document/history/save。
3. `scene.nodes` 如何承接 visual overrides。
4. SceneBuilder 如何在 reload 时重新消费这些 overrides。

## 2. 现状判断

### 2.1 `lumber_order` 当前配置层

`lumber_order` 当前已经是 Scene JSON V2：

1. 主结构是 `scene.nodes`
2. 节点类型包括：
   - `group`
   - `instance`
   - `transform`
3. `SceneInstanceNode` 已经预留 `overrides` 槽位

这意味着：

1. `save-v2` 不需要再设计一个完全新的配置容器。
2. 真正要做的是把 `overrides` 从宽泛对象收敛为 editor 可消费的明确结构。

### 2.2 `lumber_order` 当前 editor 链

当前 `lumber_order` 的 editor 具备：

1. runtime bridge
2. selection controller
3. inspector host
4. monitor
5. document export / commit
6. transform undo / redo / save
7. 平台 `context:change` 对接

但当前能力边界是：

1. `document.ts` 只真正支持 transform
2. `monitor.ts` 虽然能感知 material 变化，但还不能把 material 写入 document
3. outline 仍处于旧链路，尚未对齐 `train_oil`

因此 `save-v2` 改造的本质是：

1. 先补齐 outline runtime 语义
2. 再让 material / outline 进入 `document -> history -> save -> reload`

## 3. 从 `train_oil` 继承什么，不继承什么

### 3.1 应该继承的结论

来自 `train_oil_material_inspector` 试验线，已经验证可行的结论有：

1. material 主事件源应当是 Babylon Inspector v2 `PropertiesServiceIdentity.onPropertyChanged`
2. Babylon 原始字段名不能直接持久化，必须经过 adapter 映射成 canonical path
3. history 必须按“用户操作级”建模，拖动 slider 时不能一帧一条 history
4. history / save 必须记录真实 material owner，而不是只记录当前选中的 root
5. save 与 reload 是两条链，需要分别打通

这些结论在 `lumber_order` 同样成立。

### 3.2 不应该直接复制的东西

以下内容不能直接照搬 `train_oil_material_inspector`：

1. `sceneInstances[*].material`
2. `nodeOverrides[ownerNodePath].material`
3. 基于 `sceneInstance` 的 binding 结构
4. `Game.ts` 里直接挂 editor helper 的试验式 reload 修复

原因：

1. `lumber_order` 的核心配置结构不是 `sceneInstances`
2. `lumber_order` 的 binding 是 `sceneNode`
3. `lumber_order` 应该把回放责任收敛到 SceneBuilder / scene document 层，而不是继续复制试验期临时补丁

## 4. `save-v2` 的目标结构

### 4.1 视觉覆盖统一放在 `scene.nodes[*].overrides`

建议把 `SceneInstanceNode.overrides` 正式收敛为 visual override 容器。

第一阶段至少支持：

1. `material`
2. `childMaterials`
3. `outline`

如果后续需要对子 mesh 单独保存 outline，再补：

1. `childOutlines`

### 4.2 建议结构

建议形态如下：

```json
{
  "scene": {
    "nodes": [
      {
        "id": "sawmill_01",
        "kind": "instance",
        "instance": {
          "assetId": "sawmill"
        },
        "overrides": {
          "material": {
            "metallic": 0.35,
            "roughness": 0.42
          },
          "childMaterials": {
            "body/node0": {
              "albedoColor": {
                "r": 0.72,
                "g": 0.58,
                "b": 0.31
              }
            }
          },
          "outline": {
            "renderOutline": true,
            "outlineWidth": 0.06,
            "outlineColor": {
              "r": 1,
              "g": 0.8,
              "b": 0.2
            }
          }
        }
      }
    ]
  }
}
```

### 4.3 语义约束

1. `material`
   - 表示 instance root 自身的 material override
2. `childMaterials`
   - key 为 runtime owner node path
   - value 为该子 mesh 的 material override
3. `outline`
   - 第一阶段先只支持 instance root 级语义
   - 如果运行时对象是 `InstancedMesh`，仍按 `Mesh -> self / InstancedMesh -> sourceMesh` 处理

### 4.4 shared material 与 instance override 的分流规则

当前需要明确区分两条完全不同的材质链路：

1. shared material
2. scene node material override

#### shared material

适用：

1. 用户改的是“这类 asset 默认共享的材质”
2. 例如 `forest_lv1` 这种同 asset 大量复用、默认应共享材质的对象

运行时规则：

1. 先判断当前材质槽位是否绑定 shared material
2. 如果是 shared material，则所有引用该 shared material 的 node 默认共用同一份运行时材质对象
3. reload 时应先建立 shared material，再把它绑定到对应 node 上

保存规则：

1. shared material 的修改不能写到 `scene.nodes[*].overrides`
2. shared material 的修改应写到共享材质定义层
3. 当前 V2 设计中，共享材质定义层对应 `scene.materials`

#### scene node material override

适用：

1. 用户只想让某个 node 偏离共享默认值
2. 或该 asset 本身就是非共享材质模式

运行时规则：

1. 如果某个 node 命中了 material override，则该 node 必须脱离 shared material
2. 做法是为该 node 单独 clone 一份材质，再把 override 打到 clone 上
3. override 的优先级高于 shared material

保存规则：

1. node override 才允许写到：
   - `scene.nodes[*].overrides.material`
   - `scene.nodes[*].overrides.childMaterials[ownerNodePath]`
2. 不能出现“运行时改的是 shared material，但保存写成 override”的状态
3. 也不能出现“保存是 override，但运行时实际把 shared material 全局改掉”的状态

#### 编辑器判断规则

material 编辑前，必须先判断当前编辑目标是：

1. `sharedMaterial`
2. `nodeMaterialOverride`

后续 document/history/save 必须按这两类目标分别处理，不能继续共用一条保存链。

### 4.5 outline 的正式语义标准

`lumber_order` 后续应把 outline 的语义固定为“跟着真实 mesh target 走”，并将其作为项目标准。

#### 运行时目标规则

1. `Mesh -> self`
2. `InstancedMesh -> sourceMesh`
3. 如果当前选中的是上层 `TransformNode`，则先解析到真正承载 outline 的 mesh target

也就是说：

1. outline 不是任意 node 的抽象私有属性
2. outline 的真实编辑目标始终是 mesh target

#### 共享语义规则

1. outline 默认是共享视觉属性
2. 只要多个实例最终指向同一个 mesh target，它们就共享同一份 outline
3. 对 `InstancedMesh` 来说，这个共享目标默认就是 `sourceMesh`

因此：

1. 改一个共享实例的 outline，允许其他同源实例一起生效
2. 这不是例外行为，而应作为正式标准

#### 保存语义规则

1. 不能出现“运行时是 shared outline，但保存写成某个 node 私有 override”的状态
2. outline 的保存语义必须与运行时 target 语义一致
3. 如果后续接入 outline 的 document/history/save，必须先明确当前编辑目标是：
   - shared outline
   - node-level override outline（如果以后真的支持）

#### 当前阶段的边界

1. 当前先把 shared outline 视为默认标准
2. 不默认支持 per-instance outline
3. 如果未来确实需要单实例 outline，必须单独定义“脱离 shared”的规则，不能复用当前默认语义

## 5. 先做 outline，再做 material/save

### 5.1 outline 是 `save-v2` 的前置阶段

当前 `lumber_order` 的 outline 还没有对齐 `train_oil`：

1. 缺 `outline-adapter`
2. `selection-controller` 还在直接改 outline 作为选中高亮
3. `monitor` 还没有 outline baseline / flush
4. `Inspector` property change 没有 outline 专用接线

如果这一步不先完成，后面会出现两个问题：

1. 用户手动改的 outline 与选中高亮混在一起
2. visual override 的保存链会被错误运行时状态污染

因此 `save-v2` 的第一阶段必须先完成 outline runtime 对齐。

### 5.2 outline 这一阶段的目标

目标效果与 `train_oil` 一致：

1. `Mesh -> self`
2. `InstancedMesh -> sourceMesh`
3. 选中态只保留 bbox
4. 平台变化面板可以看到：
   - `outline.renderOutline`
   - `outline.outlineWidth`
   - `outline.outlineColor`
5. 暂时不要求 outline 进入保存主链

也就是说：

1. 先解决 outline 的 runtime / monitor 语义
2. 再把 outline 纳入 `save-v2`

## 6. material/save-v2 正式改造方案

### 阶段 A：outline runtime 对齐

文件范围：

1. `src/editor-package/runtime-core/outline-adapter.ts`
2. `src/editor-package/runtime-core/inspector-host.ts`
3. `src/editor-package/runtime-core/selection-controller.ts`
4. `src/editor-package/runtime-core/monitor.ts`

目标：

1. 把 outline 行为对齐 `train_oil`
2. 为后续 visual override/save 提供稳定运行时语义

### 阶段 B：收敛 V2 visual override 类型

文件范围：

1. `src/config/types.ts`
2. `src/config/ConfigService.ts`
3. 必要的 V2 文档

目标：

1. 把 `SceneInstanceNode.overrides` 从宽泛 `Record<string, unknown>` 收敛为明确结构
2. 定义：
   - `MaterialOverrideConfig`
   - `OutlineOverrideConfig`
   - `childMaterials`
   - 可选的 `childOutlines`

这一步完成后，editor/document/save 才有稳定目标。

### 阶段 C：接入 material property adapter

文件范围：

1. `src/editor-package/runtime-core/material-property-adapter.ts`
2. `src/editor-package/runtime-core/inspector-host.ts`
3. `src/editor-package/runtime-core/monitor.ts`

目标：

1. Babylon v2 property event -> canonical material change
2. 建立白名单映射
3. 解析真实 material owner node path

首批 canonical path 建议与 `train_oil_material_inspector` 对齐：

1. `material.albedoColor`
2. `material.emissiveColor`
3. `material.metallic`
4. `material.roughness`
5. `material.alpha`
6. `material.backFaceCulling`
7. `material.albedoTexture.url`
8. `material.normalTexture.url`
9. `material.metallicTexture.url`

### 阶段 D：让 material 真正进入 document/history/save

文件范围：

1. `src/editor-package/document.ts`
2. `src/editor-package/types.ts`

目标：

1. 新增 `applyProjectMaterialDocumentChange(...)`
2. 新增 material history entry
3. 支持 material undo/redo
4. export / commit 时把结果落进 `scene.nodes[*].overrides`

这里要特别注意：

1. binding 是 `sceneNode`
2. target 应区分：
   - root material
   - childMaterials[ownerNodePath]

### 阶段 E：SceneBuilder 回放

文件范围：

1. `src/services/SceneBuilder.ts`

目标：

1. 启动时先构建基础节点
2. 再消费 `scene.nodes[*].overrides`
3. 将 material / outline 重新应用到 runtime

要求：

1. reload 后不依赖 Inspector 当前状态
2. 不依赖 `Game.ts` 里的临时 editor helper 调用
3. SceneBuilder 成为 visual override 的正式回放入口

### 阶段 F：平台变化感知对齐

文件范围：

1. `src/editor-package/runtime-core/monitor.ts`
2. `src/editor-package/runtime.ts`

目标：

1. 平台右侧变化面板继续保留
2. 但变化面板不再只是“观察者”
3. material / outline 的变化应当与 document dirty 状态保持一致

换句话说：

1. 变化面板和 save 主链要说同一种语言
2. 都基于 canonical path

## 7. 为什么这条线比 `train_oil` 更容易落地

关键原因只有一个：

1. `lumber_order` 已经是 Scene JSON V2

这意味着：

1. 不需要先做 `sceneInstances -> scene.nodes` 迁移
2. 可以直接把 editor 的保存目标定义在 `scene.nodes[*].overrides`
3. 可以直接让 SceneBuilder 成为正式回放入口

而 `train_oil` 之前的复杂度主要来自：

1. 旧配置结构仍在主项目里占主导
2. material/save 的试验必须先在旧结构上验证可行性
3. reload 阶段不得不加一些试验性质的补丁式接法

因此 `lumber_order` 更适合作为：

1. `save-v2` 的正式落地项目
2. 后续 material / outline save 语义的标准样板

## 8. 开发顺序建议

建议严格按下面顺序做：

1. 先完成 outline runtime 对齐
2. 再定义 V2 visual override 类型
3. 再接 material property adapter
4. 再接 material document/history/save
5. 再做 SceneBuilder reload 回放
6. 最后再把 outline 纳入 save-v2

不要一开始就做：

1. `rendering.json` 合并
2. `SceneDocumentV2` 大改
3. 平台协议扩展
4. 全量 Inspector 参数支持

## 9. 验证标准

### 9.1 outline 阶段

1. `Mesh` 的 outline 编辑稳定生效
2. `InstancedMesh` 的 outline 编辑稳定落到 `sourceMesh`
3. 选中态只保留 bbox
4. 平台变化面板能看到 outline 变化

### 9.2 material/save-v2 阶段

1. Inspector 改 material 后，dirty 状态变为 true
2. 一次 slider 拖动只产生一条 history
3. undo/redo 可以稳定回到拖动前 / 后状态
4. 点击保存后，`scene.json` 中 `scene.nodes[*].overrides` 被正确更新
5. reload 后 SceneBuilder 重新消费 overrides，运行时效果恢复

### 9.3 最终验收

满足下面 5 条，才能认为 `save-v2` 完成：

1. outline runtime 行为与 `train_oil` 对齐
2. material 保存进入正式 document/history/save 主链
3. `scene.json` 成为 visual override 的唯一增量保存落点
4. reload 回放不依赖试验性 `Game` 补丁
5. 平台变化面板、dirty 状态、save 结果三者一致

## 10. 本轮建议结论

`feat/save-v2` 应当被定义为：

1. 先完成 `lumber_order` 的 outline runtime 对齐
2. 再把 material/save 正式落到 V2 `scene.nodes[*].overrides`
3. 最终把 `lumber_order` 做成比 `train_oil_material_inspector` 更正式、更干净的 save-v2 样板

一句话总结：

- `train_oil_material_inspector` 证明了 material 链路可以做通
- `lumber_order` 才适合把这条链路做成正式版本

## 11. 当前开发进度（2026-04-16）

截至 2026-04-16，`lumber_order` 这条 `save-v2` 线的实际开发进度如下。

### 11.1 Phase A：outline runtime 对齐

状态：

1. 已完成

已落地内容：

1. 新增 `src/editor-package/runtime-core/outline-adapter.ts`
2. `selection-controller` 已改为 bbox-only
3. `inspector-host` 已接 outline property change
4. `monitor` 已支持 outline baseline / flush
5. `SceneBuilder` 已支持读取配置中的 `outline / childOutlines` 做 runtime 回放

当前结论：

1. outline runtime 行为已基本对齐 `train_oil`
2. 后续阶段已补齐 outline 的 `document/history/undo/redo/save`

### 11.2 Phase B：收敛 V2 visual override 类型

状态：

1. 已完成

已落地内容：

1. `SceneInstanceNode.overrides` 已收敛为明确结构
2. 已定义：
   - `material`
   - `childMaterials`
   - `outline`
   - `childOutlines`
3. `ConfigService` 已增加 normalization

当前结论：

1. 配置层的正式目标结构已经稳定

### 11.3 Phase C：material property adapter

状态：

1. 已完成

已落地内容：

1. Babylon Inspector v2 material property event 已进入 adapter
2. 已建立 canonical material path 白名单
3. 已支持解析真实 material owner node path
4. 已支持 runtime material value 回打 helper

当前结论：

1. material 事件源与 canonical path 语言已经基本稳定

### 11.4 Phase D：material document/history/save

状态：

1. 已完成

已落地内容：

1. `document.ts` 已新增 material history entry
2. 已新增 `applyProjectMaterialDocumentChange(...)`
3. 已有 material undo/redo 分支
4. instance override 材质会落进：
   - `scene.nodes[*].overrides.material`
   - `scene.nodes[*].overrides.childMaterials[ownerNodePath]`
5. shared material 已正式落进：
   - `scene.materials[*]`
6. 已实测：
   - `albedo / emissive` 的 material undo/redo 可用
   - 一次 slider 拖动可折叠为一条 material history
   - material 保存后会真实写进 `scene.json`
   - shared material 保存后不再错误写入 `scene.nodes[*].overrides`
   - `save -> reload` 后 shared material 能从 `scene.materials` 正确回放

当前结论：

1. Phase D 已完成
2. material 已正式分成两条保存链：
   - instance override -> `scene.nodes[*].overrides`
   - shared material -> `scene.materials`
3. runtime、document、history、save、reload 的材质语义已对齐

### 11.5 Phase E：SceneBuilder 回放

状态：

1. 已完成

已落地内容：

1. `SceneBuilder` 已在节点构建后消费 `scene.nodes[*].overrides`
2. 已能回放：
   - `material`
   - `childMaterials`
   - `outline`
   - `childOutlines`
3. `SceneBuilder` 已能回放：
   - `scene.materials`
   - `scene.assets[*].defaults.outline`
   - `scene.assets[*].defaults.childOutlines`

当前结论：

1. reload 回放入口已经从 `Game.ts` 试验补丁，转移到 `SceneBuilder`
2. 当前支持范围内的 save -> reload 闭环已经打通

### 11.6 Phase F：平台变化感知对齐

状态：

1. 已基本完成

已落地内容：

1. 变化面板已能显示 canonical material / outline path
2. `dirty`、`save`、`reload` 已开始与同一套路径语言对齐

当前结论：

1. 当前支持的 material / outline 参数，变化面板、history 与 save 语义已基本一致
2. 若未来继续扩 Inspector 参数范围，再单独补充变化面板覆盖度验证

## 12. 当前总判断

按原计划的真实进度，应表述为：

1. Phase A 已完成
2. Phase B 已完成
3. Phase C 已完成
4. Phase D 已完成
5. Phase E 已完成
6. Phase F 已基本完成

不要误判为：

1. 当前已经支持全部 Babylon Inspector 参数
2. `scene.materials` 已推广到所有资产和所有材质编辑语义
3. runtime node naming 已经收敛为最终长期标准

当前更准确的说法是：

1. outline runtime 已完成
2. material 的 instance override / shared material 两条 save-v2 主链已打通
3. outline 已进入 `document/history/undo/redo/save`
4. shared outline 默认按 asset defaults 保存，并能 `save -> reload` 回放
5. runtime node naming 仍沿用 `modelId_inst_index` 风格；是否切到 `sceneNodeId` 前缀，留到下一轮迭代按独立方案评估

补充文档：

1. 运行时节点命名方案与风险记录见 `docs/RUNTIME_NODE_NAMING_PLAN.md`

## 13. 下一个 agent 的优先级建议

下一个 agent 不要继续发散做新能力，优先把当前链路收口。

建议顺序：

1. 先做一轮完整回归，把当前支持范围内的 material / outline `undo -> redo -> save -> reload` 验全
2. 清理联调阶段遗留的临时诊断日志和注释
3. 根据验收结果更新 `OUTLINE_MIGRATION_FROM_TRAIN.md`
4. 再决定下一轮是否推进：
   - runtime node naming 对齐 `sceneNodeId`
   - 更广的 Inspector 参数覆盖

## 14. 交接说明（可直接转给下一个 agent）

下面这段可以直接复制给下一个 agent：

```text
当前工作仓库是 /Users/admin/Projects/lumber_order，分支是 feat/save-v2。

请注意：
1. 不要去 train_oil 主项目继续做 material/save 改造。
2. 当前这条线只在 lumber_order 上推进。

目前真实进度：
1. Phase A 已完成：outline runtime 已对齐 train_oil。
   - 已有 outline-adapter
   - selection highlight 只保留 bbox
   - monitor 已能看到 outline.renderOutline / outline.outlineWidth / outline.outlineColor
   - SceneBuilder 已能回放配置里的 outline / childOutlines
2. Phase B 已完成：SceneInstanceNode.overrides 已收敛为 material / childMaterials / outline / childOutlines。
3. Phase C 已完成：material-property-adapter 已接 Babylon Inspector v2 property event，并输出 canonical material change。
4. Phase D 已完成：
   - material undo/redo/save 对 instance override 已验证可用
   - shared material 已正式保存到 `scene.materials`
   - 一次 slider 拖动只生成一条 material history
5. Phase E 已完成：
   - SceneBuilder 已能回放 material / childMaterials / outline / childOutlines
   - 也已能回放 `scene.materials` 和 asset defaults 上的 shared outline
6. outline 已完成接入 document/history/undo/redo/save，并已在 sandbox 手测通过：
   - `renderOutline / outlineWidth / outlineColor` undo/redo 正常
   - shared outline 保存后能 reload 回放
7. 当前已经明确的规则是：
   - shared material 默认共用一份材质
   - 只有命中 override 时，该 node 才应 clone 材质并脱离 shared
   - shared material 的修改必须保存到共享材质定义层，不能继续写成 node override
   - shared outline 默认跟着真实 mesh target 走，并保存到 asset defaults

请你接下来优先做：
1. 先做一轮完整回归，确认当前支持范围内的 material / outline 都能稳定 `undo -> redo -> save -> reload`
2. 清理联调阶段遗留的临时日志
3. 更新相关文档，避免后续误以为 shared material / outline 仍未完成
4. 再决定是否进入下一轮命名规范或参数范围扩展

当前不要做：
1. rendering.json 合并
2. SceneDocumentV2 大改
3. 平台协议扩展
4. 全量 Inspector 参数支持
5. 把新功能继续往外扩

当前文档：
1. /Users/admin/Projects/lumber_order/docs/OUTLINE_MIGRATION_FROM_TRAIN.md
2. /Users/admin/Projects/lumber_order/docs/SAVE_V2_PLAN.md
```
