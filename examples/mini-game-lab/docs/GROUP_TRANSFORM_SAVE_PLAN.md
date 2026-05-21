# Group Transform Save Plan

本文档用于说明 `lumber_order` 当前编辑器中，`group` 节点为什么还不能稳定进入 transform 保存链，以及如何以最小改动补齐这项能力。

## 结论

当前 `group` 节点：

1. 已经存在于 `scene.json`
2. 已经会被 `SceneBuilder` 构造成稳定 runtime node
3. 已经处于 selection / binding 相关链路中

但它**还没有正式进入 document/history/save/undo/redo 链**。

原因不是 runtime 不支持，而是 document 层当前只允许：

1. `instance`
2. `transform`

进入 transform 文档位置解析。

因此当前状态是：

- `instance` transform：可保存
- `transform` transform：可保存
- `group` transform：运行时可动，但不会稳定保存

## 当前现状

### 已经具备的部分

#### 1. `group` 是合法 authored node

`scene.nodes[*].kind` 当前支持：

1. `group`
2. `instance`
3. `transform`

所以 `group` 本身不是临时运行时对象，而是 authored 数据的一部分。

#### 2. `SceneBuilder` 已经为 `group` 创建 runtime node

当前 `SceneBuilder` 会对所有 `group / transform / instance` 创建稳定 `TransformNode` 并注册到 runtime map。

这意味着：

1. `group` 已有稳定 runtime 对应物
2. `group` 的 transform 在 runtime 已可生效

#### 3. binding 链路不是完全缺失

当前 adapter / runtime 这条链并没有完全把 `group` 排除掉。
`group` 的真正缺口在 document，而不是 runtime root 创建。

### 当前缺失的部分

#### 1. document location 不接受 `group`

当前 `document.ts` 中的 `findSceneNodeLocation()` 只接受：

1. `instance`
2. `transform`

不接受：

1. `group`

因此 `group` 无法被解析成可写回的 document location。

#### 2. transform 修改无法写回 working copy

`applyProjectDocumentChange()` 在处理 transform 变更时，会先走 location 解析：

1. 如果找不到 location，直接返回 `false`
2. 不写 working copy
3. 不 push history

所以 `group` 的 transform 修改不会真正落进 document。

#### 3. undo/redo 不会记录 `group`

undo/redo 完全依赖 history 栈。
既然 `group` transform 当前不会入 history，自然也不会进入 undo/redo。

#### 4. save/reload 不会稳定生效

因为 `group` transform 没写入 working copy，所以：

1. save 时不会导出到 `scene.json`
2. reload 后也不会由 `SceneBuilder` 重新回放

## 目标

本次补充的目标非常明确：

**让 `group` 的 transform 和 `transform` / `instance` 一样进入：**

1. document working copy
2. history
3. undo/redo
4. save
5. reload

## 非目标

本次不处理以下能力：

1. `group` material save
2. `group` outline save
3. `group` duplicate 语义扩展
4. hierarchy 规则重构

本次只补：

**`group transform` 的 document/save/history 主链**

## 推荐的最小改动方案

## 1. 扩大 `ProjectDocumentBindingLocation` 的可接受类型

文件：

- `src/editor-package/document.ts`

当前 `ProjectDocumentBindingLocation.value` 只允许：

1. `SceneInstanceNode`
2. `SceneTransformNode`

需要改成：

1. `SceneGroupNode`
2. `SceneInstanceNode`
3. `SceneTransformNode`

同时补上：

- `SceneGroupNode` 的 type import

### 改动目的

让 `group` 在类型层成为合法 document target。

## 2. 放开 `findSceneNodeLocation()` 对 `group` 的过滤

文件：

- `src/editor-package/document.ts`

当前逻辑只接受：

1. `node.id === nodeId`
2. `node.kind === 'instance' || node.kind === 'transform'`

需要改成接受：

1. `group`
2. `instance`
3. `transform`

推荐做法：

- 直接按 `node.id === nodeId` 找到 authored node
- 再允许三种合法 kind 进入返回结果

### 改动目的

让 `group` 能被解析成 document location，这是整个补充的关键。

## 3. 保持 `applyProjectDocumentChange()` 主体逻辑不变

文件：

- `src/editor-package/document.ts`

当前 transform 保存主链本身已经是通用逻辑：

1. 根据 binding 找 location
2. 找到对应 scene node
3. `ensureTransform(sceneNode)`
4. 写入 `position / rotation / scaling`
5. push transform history

因此这里只需要确认：

1. 不存在额外排除 `group` 的 kind 判断
2. `group` 进入 location 后可以自然复用这套逻辑

### 改动目的

避免为了支持 `group` 再复制一套 transform 保存逻辑。

## 4. `applyTransformHistoryEntry()` 通常自然打通

文件：

- `src/editor-package/document.ts`

undo/redo 的 transform 应用逻辑当前也是：

1. 通过 binding 找 location
2. 找到 scene node
3. 写回 transform snapshot
4. 回打 runtime root node

只要 location 能返回 `group`，这里通常不需要额外改分支。

### 改动目的

让 `group` 自动获得 transform undo/redo 能力，而不是额外加一套 history 类型。

## 不需要改动的部分

本次最小补充**不需要**修改：

1. `src/editor-package/adapter.ts`
2. `src/editor-package/runtime-core/monitor.ts`
3. `src/services/SceneBuilder.ts`
4. material 保存链
5. outline 保存链
6. `ConfigService.ts`

原因：

1. `SceneBuilder` 已经能构建 `group` runtime node
2. transform monitor 本来就是围绕 runtime node 在工作
3. 真正缺的是 document 不承认 `group`

## 预期效果

改完后，`group` 节点应具备以下能力：

1. 改 `position`
2. 改 `rotation`
3. 改 `scaling`
4. 修改会进入 history 栈
5. `undo` 生效
6. `redo` 生效
7. `save` 后写回 `scene.nodes[*].transform`
8. `reload` 后由 `SceneBuilder` 正常回放

## 风险与影响

## 1. 代码改动量小

如果只做最小方案，预计改动主要集中在：

- `src/editor-package/document.ts`

大致是：

1. import 扩展
2. 类型扩展
3. `findSceneNodeLocation()` 条件放开

属于小改。

## 2. 语义影响比代码改动更大

一旦支持 `group transform save`，就意味着：

1. `group` 不再只是 hierarchy 容器
2. `group.transform` 也成为正式 authored 数据
3. 用户可以通过改 `group.transform` 批量移动其子节点，并且结果会落盘

这不是坏事，但需要明确这是编辑器保存范围的有意扩展。

## 3. 可能暴露 hierarchy authored 设计问题

以前 `group` 改动不落盘，一些层级问题不会显性暴露。
补上后，可能更容易发现：

1. 某些 `parentId` 设计不合理
2. 某些布局依赖“group 不会保存”的隐含假设
3. 某些组合节点被整体平移后，不符合旧预期

## 4. 不会自动带来 `group` 的其他高级能力

本次补充不会自动让 `group` 获得：

1. material 保存能力
2. outline 保存能力
3. duplicate 完整语义

所以这是一个边界清晰的增强，而不是把 `group` 完全变成 `instance`。

## 验收方式

建议按下面顺序验证：

1. 选中一个 `group` 节点
2. 修改一次 `position`
3. 执行一次 `undo`
4. 执行一次 `redo`
5. 点击保存
6. 检查 `scene.json` 中对应 `scene.nodes[*].transform` 是否更新
7. 刷新页面，确认 group transform 仍然生效

至少覆盖：

1. 单轴 position 修改
2. 整体 group 平移后对子节点的连带效果
3. reload 后回放结果

## 最终建议

建议把这项补充定义为：

**“允许 `group` 正式进入 transform document/history/save 链”**

而不是把它描述成：

**“临时修一个保存 bug”**

因为从语义上看，这代表编辑器正式扩大了可保存的 authored node 集合。
