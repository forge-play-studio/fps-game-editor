# 地贴渲染问题排查记录

## 背景

本记录总结 `lumber_order` 项目中解锁门地贴相关渲染问题的成因、排查路径和解决方法，方便后续遇到类似透明地贴层级、进度填充、材质颜色不生效等问题时快速定位。

涉及对象：

- `collect_table_expand_decal`：解锁门地贴组
- `collect_table_expand_decal_base`：解锁门地贴_灰底
- `collect_table_expand_decal_base_2`：解锁门地贴_灰底2
- `collect_table_expand_decal_frame`：解锁门地贴_边框
- `collect_table_expand_decal_price`：解锁门地贴_300

相关文件：

- `src/config/scene.json`
- `src/systems/NewbieGuideSystem.ts`
- `src/services/SceneBuilder.ts`

## 问题 1：同一个地贴从不同视角看层级不一致

### 现象

在一个视角下，`解锁门地贴_300` 看起来在灰底进度效果上方；换一个视角后，灰底进度效果又像是盖在 `300` 文字上方。

### 成因

这不是高度问题，而是透明物体排序问题。

这些地贴都是带透明贴图的 ground decal：

- 灰底使用 `地贴灰底.png`
- 边框使用 `地贴边框.png`
- 价格文字使用 `300.png`

透明物体在 Babylon 中会参与透明队列排序。如果多个透明 mesh 使用相同或接近的 `alphaIndex`，排序可能依赖相机距离。相机角度变化后，透明面的排序顺序会变化，因此出现“正面看正常，侧面看穿帮”的现象。

当时还有一个关键问题：运行时代码会覆盖 `scene.json` 配置的 `alphaIndex`。

`collectGroundDecals()` 中曾经统一写死：

```ts
mesh.alphaIndex = 1;
```

`updateGroundDecalInteractions()` 中也会对交互组地贴覆盖成 `1`：

```ts
mesh.alphaIndex = isInteractiveDirectFrame
  ? 3
  : isInteractiveGreenFrame || pairedGreenFrameId || isInteractiveDirectFrame || isInteractiveGroupDecal
    ? 1
    : 1 + decal.activation;
```

由于 `collect_table_expand_decal` 被识别为交互地贴组，组内的灰底、边框、文字最终都可能被运行时改成同一个 `alphaIndex = 1`，导致透明排序不稳定。

### 错误尝试

单纯提高 `解锁门地贴_300` 的 `position.y`，例如从 `0.002` 提高到 `0.01` 或 `0.1`，不能彻底解决问题。

原因是透明排序不只看空间高度，还受到透明队列、`alphaIndex`、相机距离等因素影响。即使文字层几何高度更高，只要透明排序同层，仍可能在某些视角下被灰底盖住。

### 解决方法

给解锁门地贴组增加运行时固定排序规则，避免被通用交互逻辑覆盖。

推荐规则：

```text
collect_table_expand_decal_base      alphaIndex = 1
collect_table_expand_decal_base_2    alphaIndex = 1
collect_table_expand_decal_frame     alphaIndex = 3
collect_table_expand_decal_price     alphaIndex = 10
```

在 `NewbieGuideSystem.ts` 中新增类似函数：

```ts
private getForcedGroundDecalAlphaIndex(sceneNodeId: string): number | null {
  if (sceneNodeId === 'collect_table_expand_decal_base' || sceneNodeId === 'collect_table_expand_decal_base_2') return 1;
  if (sceneNodeId === 'collect_table_expand_decal_frame') return 3;
  if (sceneNodeId === 'collect_table_expand_decal_price') return 10;
  return null;
}
```

在初始化地贴时使用：

```ts
mesh.alphaIndex = this.getForcedGroundDecalAlphaIndex(node.id) ?? 1;
```

在每帧更新地贴交互时也优先使用：

```ts
const forcedAlphaIndex = this.getForcedGroundDecalAlphaIndex(decal.sceneNodeId);

mesh.alphaIndex = forcedAlphaIndex ?? (isInteractiveDirectFrame
  ? 3
  : isInteractiveGreenFrame || pairedGreenFrameId || isInteractiveDirectFrame || isInteractiveGroupDecal
    ? 1
    : 1 + decal.activation);
```

同时可以在 `scene.json` 里同步表达：

```json
"collect_table_expand_decal_price": {
  "groundDecal": {
    "alphaIndex": 10
  }
}
```

但要注意：真正稳定生效依赖运行时代码，因为运行时可能覆盖 `scene.json` 中的配置。

## 问题 2：`scene.json` 中设置了 `alphaIndex`，但运行时不生效

### 现象

`scene.json` 中 `collect_table_expand_decal_frame` 配置了：

```json
"alphaIndex": 3
```

但运行时检查发现实际仍是：

```text
alphaIndex = 1
```

### 成因

`SceneBuilder.ts` 创建 ground decal 时确实会读取 `scene.json`：

```ts
if (typeof nodeConfig.groundDecal.alphaIndex === 'number' && Number.isFinite(nodeConfig.groundDecal.alphaIndex)) {
  (runtimeNode as any).alphaIndex = nodeConfig.groundDecal.alphaIndex;
}
```

但之后 `NewbieGuideSystem.ts` 的 `collectGroundDecals()` 和 `updateGroundDecalInteractions()` 又覆盖了它。

也就是说，配置阶段生效了，但运行时系统又把值改掉了。

### 解决方法

凡是希望长期稳定的地贴排序，不能只写 `scene.json`，还要检查运行时系统是否覆盖。

对于解锁门地贴，解决方式是增加强制排序函数，并在初始化和每帧更新中都应用。

## 问题 3：动态生成进度填充 Mesh 容易遮挡文字

### 现象

最初进度效果通过运行时创建一个新的 `gate_unlock_progress_fill` mesh 实现。它会随付款进度从左向右增长，但可能遮挡 `解锁门地贴_300`。

### 原实现逻辑

运行时创建一个绿色 `Ground`：

```ts
const mesh = MeshBuilder.CreateGround('gate_unlock_progress_fill', { width: 1, height: 1 }, this.scene);
```

每帧通过 `updateGateUnlockProgressFill()` 根据灰底包围盒计算位置和缩放：

```text
fill宽度 = 灰底宽度 * progress * 0.92
fill深度 = 灰底深度 * 0.76
fill位置 = 灰底左侧 + fill宽度 / 2
```

### 成因

动态 mesh 是独立透明物体，也要参与透明排序。如果它的 `alphaIndex`、高度或 rendering group 不明确，就会和文字、边框产生排序冲突。

即使把它的位置稍微抬高，例如：

```ts
max.y + 0.0006
```

仍不能完全保证不会在某些视角下遮挡文字。

### 解决方法

如果需求是“不要动态生成 mesh，只操作 `解锁门地贴_灰底`”，则移除独立进度 mesh，直接把 `collect_table_expand_decal_base` 当作进度条使用。

实现思路：

```text
progress = gateUnlockPaidAmount / forestUnlockCost
```

根据进度修改灰底自身：

```ts
const progressScale = Math.max(0.001, progress);

mesh.scaling.set(
  gateUnlockDecalBaseScaling.x * progressScale,
  gateUnlockDecalBaseScaling.y,
  gateUnlockDecalBaseScaling.z,
);
```

因为缩放默认从中心缩放，为了让它从左向右增长，还要调整 `position.x`：

```ts
mesh.position.set(
  gateUnlockDecalBasePosition.x - gateUnlockDecalBaseWidth * (1 - progressScale) * 0.5,
  gateUnlockDecalBasePosition.y,
  gateUnlockDecalBasePosition.z,
);
```

注意：这种方案会把灰底本身变成进度条，未填充区域不再由该层提供背景。如果需要未填充区域仍是灰色背景，可以保留 `collect_table_expand_decal_base_2` 作为灰色背景，把 `collect_table_expand_decal_base` 作为绿色进度层。

## 问题 4：灰底改了绿色材质，但画面看起来仍然偏灰

### 现象

已经把 `collect_table_expand_decal_base` 的材质颜色设置为绿色：

```text
diffuseColor = (0.2, 1, 0.18)
emissiveColor = (0.06, 0.45, 0.05)
```

运行时检查也确认颜色确实生效，但画面仍然看起来偏灰。

### 成因

`解锁门地贴_灰底` 仍然使用灰色贴图：

```text
diffuseTexture = 地贴灰底.png
emissiveTexture = 地贴灰底.png
useAlphaFromDiffuseTexture = true
```

最终渲染结果不是纯绿色，而是类似：

```text
最终颜色 = 绿色 tint × 灰色贴图 RGB × 透明混合 × 光照影响
```

如果 `地贴灰底.png` 本身是灰色、半透明、带阴影或低亮度，绿色 tint 会被压暗，最终看起来仍然接近灰色或暗绿色。

还有一个容易忽略的点：`SceneBuilder.ts` 对带贴图的 ground decal 会这样处理：

```ts
mat.diffuseTexture = texture;
mat.useAlphaFromDiffuseTexture = true;
mat.diffuseColor = new Color3(1, 1, 1);
```

也就是说，`groundDecal.color` 对带贴图地贴的初始颜色可能被重置为白色。要改颜色，需要通过 node material 覆写，或者运行时强制设置材质颜色。

### 解决方法

如果要让进度效果明显变绿，有三种可选方案。

方案 A：继续使用灰底贴图，只做 tint。

优点：

- 保留原灰底纹理质感。
- 改动小。

缺点：

- 绿色会被灰色贴图压暗，不一定明显。

方案 B：进度层不用灰色贴图，改成纯绿色材质。

实现：

- 对 `collect_table_expand_decal_base` 的材质清掉 `diffuseTexture` / `emissiveTexture`
- 使用纯色材质：

```ts
material.diffuseTexture = null;
material.emissiveTexture = null;
material.diffuseColor.set(0.2, 1, 0.18);
material.emissiveColor.set(0.06, 0.45, 0.05);
material.disableLighting = true;
```

优点：

- 绿色最明显。
- 不受灰色贴图影响。

缺点：

- 失去原灰底纹理形状和透明边缘，除非另做 mask。

方案 C：换成白色 mask 或绿色进度专用贴图。

实现：

- 新增一张白色或绿色进度纹理。
- 保留 alpha mask，RGB 不再是灰色。
- 让材质颜色或贴图本身提供绿色。

优点：

- 最适合美术效果。
- 可以保留边缘透明和形状。

缺点：

- 需要新增资源并配置到 `scene.json`。

推荐：
如果只是要清晰绿色进度条，优先用方案 C；没有资源时可先用方案 B 验证效果。

## 问题 5：`解锁门地贴_灰底2` 会让人误判颜色是否生效

### 现象

即使 `解锁门地贴_灰底` 已经变绿，画面上仍能看到灰色区域。

### 成因

解锁门地贴组里有两层灰底：

```text
collect_table_expand_decal_base
collect_table_expand_decal_base_2
```

其中 `base_2` 仍使用 `地贴灰底.png`，颜色是白色 tint：

```text
diffuseColor = (1, 1, 1)
```

它的本地位置略高于灰底：

```text
base.y = 0
base_2.y = 0.000499999
```

因此它可能覆盖或混合在绿色灰底上方。如果 `base_2` 未隐藏，就会看到灰色。

### 解决方法

先用运行时检查确认：

```js
const scene = BABYLON.EngineStore.LastCreatedScene;
scene.getMeshById('collect_table_expand_decal_base_2').isEnabled();
```

如果 `base_2` 是隐藏的，但画面仍灰，则问题不是 `base_2`，而是灰色贴图本身压暗绿色。

如果 `base_2` 没隐藏，则要明确职责：

```text
base_2：灰色背景
base：绿色进度层
frame：边框
price：文字
```

并设置排序：

```text
base_2 alphaIndex = 1
base alphaIndex = 2
frame alphaIndex = 3
price alphaIndex = 10
```

如果不需要灰色背景，则隐藏或删除 `base_2`。

## 问题 6：`renderingGroupId` 默认是多少，什么时候需要改

### 当前状态

`解锁门地贴_灰底` 没有显式设置 `renderingGroupId`，Babylon 默认是：

```text
renderingGroupId = 0
```

### 是否需要修改

一般不建议一开始就改 `renderingGroupId`。

`renderingGroupId` 是更强的渲染分组控制。把文字放到更高 rendering group，例如：

```ts
priceMesh.renderingGroupId = 1;
```

确实可以让它更晚绘制，但也可能导致它压过不该压过的其它场景物体。

对于同一组地贴内部排序，优先使用：

```text
alphaIndex
```

只有当 `alphaIndex` 仍无法解决跨系统、跨 rendering group 的遮挡问题时，再考虑 `renderingGroupId`。

## 推荐排查顺序

遇到地贴显示层级或颜色异常时，按下面顺序排查。

### 1. 确认运行时真实对象

在浏览器 DevTools 中检查：

```js
const scene = BABYLON.EngineStore.LastCreatedScene;
const mesh = scene.getMeshById('collect_table_expand_decal_price');
mesh.alphaIndex;
mesh.renderingGroupId;
mesh.position;
mesh.scaling;
mesh.visibility;
mesh.isEnabled();
```

不要只看 `scene.json`，因为运行时代码可能覆盖配置。

### 2. 确认材质颜色

```js
const mat = mesh.material;
mat.diffuseColor;
mat.emissiveColor;
mat.alpha;
mat.diffuseTexture?.name;
mat.emissiveTexture?.name;
mat.useAlphaFromDiffuseTexture;
mat.disableLighting;
```

如果颜色正确但画面不对，继续看贴图。

### 3. 确认是否使用灰色贴图

如果使用灰色贴图，再强的绿色 tint 也可能被贴图 RGB 压暗。

判断方式：

```text
diffuseTexture = 地贴灰底.png
```

如果是这种情况，要想明显绿色，需要换贴图、去贴图或使用白色 mask。

### 4. 确认是否被每帧逻辑覆盖

搜索：

```text
mesh.alphaIndex =
material.diffuseColor.copyFrom
material.emissiveColor.copyFrom
```

很多配置看似正确，但每帧会被系统重置。

### 5. 确认同组内是否有重复背景层

例如：

```text
base
base_2
```

如果某个灰色背景层还在显示，可能误以为绿色没生效。

## 当前项目中已采用的稳定做法

### 解锁门文字永远最高

运行时强制排序：

```text
collect_table_expand_decal_base      alphaIndex = 1
collect_table_expand_decal_base_2    alphaIndex = 1
collect_table_expand_decal_frame     alphaIndex = 3
collect_table_expand_decal_price     alphaIndex = 10
```

### 解锁门进度不再使用独立 Mesh

不再动态生成：

```text
gate_unlock_progress_fill
```

改为直接操作：

```text
collect_table_expand_decal_base
```

用它自身的 `scaling.x` 和 `position.x` 表示进度。

### 解锁门脉冲已取消

不再做周期缩放，也不再做投钱弹跳缩放，只保留进度变化。

## 后续建议

1. 如果需要清晰绿色进度条，建议新增专用绿色进度贴图，而不是复用 `地贴灰底.png`。
2. 如果继续复用灰底贴图，需要接受绿色被灰色贴图压暗。
3. 对所有组合地贴，建议明确每层 `alphaIndex`，并避免运行时统一覆盖。
4. 对重要 UI 地贴文字，如价格、锁、数字，建议统一使用较高 `alphaIndex`，例如 `10`。
5. 对透明地贴，不建议依赖 `position.y` 保证层级，应该优先依赖 `alphaIndex`。
6. `renderingGroupId` 只作为最后手段，避免影响其它场景物体遮挡关系。
