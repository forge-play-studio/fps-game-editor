# Outline 从 `train_oil` 迁移到 `lumber_order` 开发文档

这份文档只讨论一件事：

- 把 `train_oil` 当前已经跑通的 outline 编辑能力，完整迁移到 `lumber_order`
- 最终效果以 `train_oil` 当前表现为准，不做裁剪版迁移

这轮不讨论：

- material 保存
- rendering.json
- 平台协议改动
- outline 自动保存主链
- 其他编辑器功能重构

## 1. 迁移目标

迁移后的 `lumber_order` 需要具备以下行为：

1. 在 Babylon Inspector 里可以编辑：
   - `renderOutline`
   - `outlineColor`
   - `outlineWidth`
2. 普通 `Mesh`
   - 直接改当前 mesh
3. `InstancedMesh`
   - 不改实例自己
   - 改 `sourceMesh`
4. 选中高亮不要再和用户手动设置的 outline 混在一起
5. 平台变化面板可以看到 outline 变化
6. 双击对象 mention 功能不能回退
7. 如果 `train_oil` 已支持配置中的 outline override 回放，`lumber_order` 也要对齐到同层能力

这轮暂不要求：

1. outline 自动保存回配置
2. outline 接入 undo/redo 主链
3. outline 接入 document/save 主链

## 2. 当前现状对比

### 2.1 `train_oil` 已有能力

`train_oil` 当前 outline 已经具备：

1. `Mesh -> self`
2. `InstancedMesh -> sourceMesh`
3. 处理 `InstancedMesh` 自有 `outlineColor / outlineWidth` 遮挡问题
4. Babylon Inspector property change 接线
5. 平台变化面板显示：
   - `outline.renderOutline`
   - `outline.outlineWidth`
   - `outline.outlineColor`
6. `scene.json` 的 outline override 回放
7. 选中高亮只保留 bbox，不再混入 outline
8. 双击对象 mention 与 outline 链路兼容，不回退

对应核心文件：

1. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/outline-adapter.ts`
2. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/inspector-host.ts`
3. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/selection-controller.ts`
4. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/monitor.ts`
5. `/Users/admin/Projects/train_oil/src/services/SceneBuilder.ts`

### 2.2 `lumber_order` 当前差异

`lumber_order` 现在已经有：

1. 项目侧 `editor-package`
2. Inspector host
3. Selection controller
4. Monitor
5. 双击对象发 `context:selection`

但 outline 相关仍然是旧状态：

1. 没有独立的 `outline-adapter`
2. `selection-controller` 仍然直接改对象自身的：
   - `renderOutline`
   - `outlineColor`
   - `outlineWidth`
3. `monitor` 没有 outline baseline
4. `Inspector` property change 没有 outline 专用接线
5. `InstancedMesh` 没有 `sourceMesh` 语义处理

因此这次迁移目标不是“把 lumber 做到能用”，而是：

1. runtime 行为和 `train_oil` 一样
2. 平台变化感知和 `train_oil` 一样
3. 配置回放层能力和 `train_oil` 保持同层

## 3. 迁移边界

这次迁移必须坚持下面的边界：

1. 只改项目侧 `lumber_order`
2. 不改平台
3. 不把 material 链路一起重做
4. 不把 outline 自动保存主链一起重做
5. 先按 `train_oil` 对齐 runtime + monitor + config replay
6. 保存链后续单独处理

一句话：

- 这轮以“和 `train_oil` 效果完全一致”为目标
- 但暂不扩到 outline save/document 主链

## 4. 迁移要点

### 4.1 不要直接照搬旧的选中高亮

`lumber_order` 当前选中态会直接改对象自身的 outline。

这会带来两个问题：

1. 选中高亮和用户手动 outline 混在一起
2. `InstancedMesh` 上会继续走错目标对象

迁移时必须先把选中高亮收敛为：

1. 只保留 `showBoundingBox`
2. 不再由选中态写：
   - `renderOutline`
   - `outlineWidth`
   - `outlineColor`

### 4.2 `InstancedMesh` 的真实问题不是“面板显示”，而是“写入目标”

Babylon Inspector 面板看起来允许你改实例上的 outline 字段，但真正稳定工作的目标不是实例自己，而是：

- `InstancedMesh.sourceMesh`

所以迁移时必须显式固定这条语义：

1. `Mesh -> self`
2. `InstancedMesh -> sourceMesh`

### 4.3 要处理实例自有属性遮挡

这是迁移里最容易漏掉的点。

`InstancedMesh` 继承自 Babylon `AbstractMesh`，实例自己会带默认的：

1. `outlineColor`
2. `outlineWidth`

如果不清掉这两个实例自有属性，就会发生：

1. 你以为改的是 `sourceMesh`
2. 但实例自己仍然保留旧值
3. 最终颜色/宽度显示不稳定

所以迁移时必须处理：

1. 命中 `InstancedMesh` 时，删除实例自身的：
   - `outlineColor`
   - `outlineWidth`

### 4.4 平台变化面板不需要改平台

平台 `context:change` 协议本来就是通用的。

因此 outline 变化要出现在平台右侧面板，不需要平台改代码，只需要 `lumber_order` 侧：

1. monitor 增加 outline baseline
2. flush 时输出 outline 的变化 payload

## 5. 建议实施顺序

不要一次改完全部文件。建议按下面顺序推进。

### 阶段 A：先把 runtime 行为完全对齐 `train_oil`

#### A1. 新增 `outline-adapter.ts`

新增文件：

- `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/outline-adapter.ts`

目标职责：

1. `isOutlinePropertyKey()`
2. `resolveOutlineTarget()`
3. `applyOutlinePropertyChange()`
4. `normalizeInstancedMeshOutlineProperties()`

语义固定：

1. `Mesh -> self`
2. `InstancedMesh -> sourceMesh`

#### A2. 修改 `inspector-host.ts`

文件：

- `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/inspector-host.ts`

需要补的内容：

1. Babylon Inspector `OnPropertyChangedObservable` 接线
2. 只拦 outline 三个字段：
   - `renderOutline`
   - `outlineColor`
   - `outlineWidth`
3. 命中后调 `applyOutlinePropertyChange()`
4. 对 `InstancedMesh.prototype` 做最小 outline 字段转发 patch
5. 禁用 Inspector 自己的选中 outline 高亮
6. 保留双击对象发 `context:selection` 的现有逻辑

#### A3. 修改 `selection-controller.ts`

文件：

- `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/selection-controller.ts`

目标：

1. 选中态只保留 bbox
2. 删掉选中态对以下字段的直接写入：
   - `renderOutline`
   - `outlineWidth`
   - `outlineColor`

这是 runtime 行为能稳定的前提。

### 阶段 B：让平台变化面板效果完全对齐 `train_oil`

#### B1. 修改 `monitor.ts`

文件：

- `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/monitor.ts`

要补的内容：

1. `OUTLINE_FIELD_PATHS`
2. `snapshotOutline()`
3. `outlineBaseline`
4. `checkOutline()`

注意：

1. baseline 不是直接读当前节点
2. 必须先走 `resolveOutlineTarget()`

否则 `InstancedMesh` 会继续读错对象。

#### B2. 验证 `context:change`

`runtime.ts` 一般不需要大改，因为它本来就会把 monitor 的 change flush 到平台。

只要 `monitor.ts` 输出 outline 变化，平台就应该直接看到。

### 阶段 C：把配置回放层对齐到 `train_oil`

这一步这次需要纳入计划。

如果要做到和 `train_oil` 效果一致，就要让 `lumber_order` 也支持配置里的 outline override 回放：

1. 扩配置类型
2. 扩场景构建/节点回放
3. 仍然保持：
   - `Mesh -> self`
   - `InstancedMesh -> sourceMesh`

注意：`lumber_order` 的数据模型是 `sceneNode`，不是 `train_oil` 的 `sceneInstance`，所以不能直接照抄 `SceneBuilder` 的路径。

### 阶段 D：做一致性验收

这一阶段不再只看“是否可用”，而是直接对标 `train_oil`。

验收基线：

1. 普通 `Mesh` outline 行为一致
2. `InstancedMesh` outline 行为一致
3. 选中态只保留 bbox
4. 平台变化面板字段一致
5. 双击对象 mention 不回退
6. 配置回放能力一致

## 6. 文件迁移映射

建议按下面的对照关系迁移。

### 6.1 可直接借鉴的实现来源

来源文件：

1. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/outline-adapter.ts`
2. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/inspector-host.ts`
3. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/selection-controller.ts`
4. `/Users/admin/Projects/train_oil/src/editor-package/runtime-core/monitor.ts`

### 6.2 `lumber_order` 对应落点

目标文件：

1. `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/outline-adapter.ts`
2. `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/inspector-host.ts`
3. `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/selection-controller.ts`
4. `/Users/admin/Projects/lumber_order/src/editor-package/runtime-core/monitor.ts`

## 7. 迁移时不要直接照抄的点

### 7.1 不要照抄 `train_oil` 的保存链

原因：

1. `train_oil` 绑定模型是 `sceneInstance`
2. `lumber_order` 绑定模型是 `sceneNode`

所以：

1. duplicate 逻辑不同
2. document 路径不同
3. config 写入位置不同

outline runtime 可以借鉴，save/document 不能无脑复制。

### 7.2 不要继续保留旧的选中 outline 高亮

这是 `lumber_order` 当前和 `train_oil` 的最大行为差异之一。

如果不先改掉，后面所有验证都会混乱。

## 8. 风险点

### 8.1 `InstancedMesh` 表面上“有值”，实际上写错目标

这是最核心风险。

表现：

1. Inspector 面板里改了
2. 运行时看起来不稳定
3. 颜色和宽度经常不对

根因：

1. 实例自己带 `outlineColor / outlineWidth`
2. 没有真正落到 `sourceMesh`

### 8.2 选中高亮和手动 outline 混淆

如果保留 `selection-controller` 的旧实现，会导致：

1. 用户看起来像是 outline 生效了
2. 实际只是选中高亮

### 8.3 平台变化面板没变化

如果只改 Inspector，不改 monitor，就会出现：

1. 画面变了
2. 平台右侧没有变化记录

这不是平台 bug，而是项目没有把 outline 纳入 monitor。

## 9. 验证方案

验证必须分阶段做，但验收标准以 `train_oil` 当前效果为准。

### 9.1 验证 runtime 行为

在项目页进入 edit 后，按下面步骤测。

#### 验证普通 `Mesh`

1. 选一个普通 `Mesh`
2. 打开 `RenderOutline`
3. 修改 `outlineWidth`
4. 修改 `outlineColor`
5. 取消选中

预期：

1. outline 仍然保留
2. 颜色和宽度都稳定
3. 不依赖选中高亮

#### 验证 `InstancedMesh`

1. 选一个 `InstancedMesh`
2. 打开 `RenderOutline`
3. 修改 `outlineWidth`
4. 修改 `outlineColor`
5. 取消选中

预期：

1. 当前实例保持 outline
2. 同源实例一起变化
3. 不出现“改了颜色但还是旧值”的情况

### 9.2 验证选中高亮边界

1. 选中对象
2. 只观察选中效果
3. 不改 Inspector 属性

预期：

1. 只有 bbox
2. 不应额外多一层选中 outline

### 9.3 验证平台变化面板

1. 打开 `RenderOutline`
2. 改 `outlineWidth`
3. 改 `outlineColor`

预期：

平台右侧变化面板出现：

1. `outline.renderOutline`
2. `outline.outlineWidth`
3. `outline.outlineColor`

### 9.4 验证双击 mention 不回退

这次迁移不应破坏已有双击对象 mention。

验证：

1. 选中对象
2. 双击画布

预期：

1. 对话框里继续出现对象 mention
2. 快照内容仍然正常

### 9.5 验证配置回放

1. 手改 `lumber_order` 的配置，给某个节点加 outline override
2. 重新加载场景

预期：

1. 普通 `Mesh` 正确回放到自身
2. `InstancedMesh` 正确回放到 `sourceMesh`
3. 效果与 `train_oil` 同层

## 10. 验收标准

满足下面 6 条，才算迁移完成：

1. `Mesh` 的 outline 编辑稳定生效
2. `InstancedMesh` 的 outline 编辑稳定落到 `sourceMesh`
3. 选中高亮不再污染用户手动 outline
4. 平台变化面板能看到 outline 变化
5. 现有双击对象 mention 功能不回退
6. 配置回放能力与 `train_oil` 对齐

## 11. 本轮建议结论

如果现在就开始迁移，建议严格按下面顺序执行：

1. `outline-adapter.ts`
2. `inspector-host.ts`
3. `selection-controller.ts`
4. 手测 runtime
5. `monitor.ts`
6. 再测平台变化面板
7. 配置回放层
8. 做和 `train_oil` 的逐项对比验收

不要一开始就做：

1. save
2. document 持久化
3. material 联动

先把 runtime、monitor、config replay 三层对齐 `train_oil`，再考虑 save/document 主链。

## 12. 当前进度（2026-04-16）

截至 2026-04-16，这条线的实际状态如下：

### 12.1 已完成

`lumber_order` 的 outline runtime 对齐已经完成，具体包括：

1. 已新增 `src/editor-package/runtime-core/outline-adapter.ts`
2. 已实现：
   - `Mesh -> self`
   - `InstancedMesh -> sourceMesh`
3. 已处理 `InstancedMesh` 自有 `outlineColor / outlineWidth` 遮挡问题
4. `selection-controller` 已收敛为 bbox-only
5. Babylon Inspector outline 属性变更已接入项目侧逻辑
6. 平台变化面板已能看到：
   - `outline.renderOutline`
   - `outline.outlineWidth`
   - `outline.outlineColor`
7. `SceneBuilder` 已开始支持从 `scene.nodes[*].overrides` 回放：
   - `outline`
   - `childOutlines`

### 12.2 已确认通过的现象

在当前沙盒里，已经确认：

1. 默认选中态不再显示黄色 outline，只保留 bbox
2. 平台变化面板可以看到 outline 三条变化
3. `forest_lv1` 运行时不是 `InstancedMesh` 共享，而是各自独立的 mesh/runtime 对象

### 12.3 当前完成情况

outline 这条线当前已经进一步收口，当前沙盒内已确认：

1. outline 已正式接入 `document/history/undo/redo`
2. outline 已正式接入 `save` 主链
3. `renderOutline / outlineWidth / outlineColor` 均已完成手测
4. shared outline 已改为按 asset defaults 保存，不再错误写成 node override
5. `save -> reload` 后 shared outline 能正确回放

换句话说：

1. outline runtime 对齐已完成
2. outline undo/redo 已完成
3. outline save/document 主链已完成
4. 当前默认语义是 shared outline

### 12.4 下一步建议

如果继续做 outline 相关工作，下一步应转向收尾和规范化：

1. 做一轮完整回归，确认 material / outline 联合编辑时的 undo 顺序符合预期
2. 清理联调阶段临时日志
3. 继续遵守 shared outline 默认标准，不要回退到 node 私有保存语义
