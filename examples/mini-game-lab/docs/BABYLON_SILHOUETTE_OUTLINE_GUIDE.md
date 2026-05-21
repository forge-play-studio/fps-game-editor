# Babylon 外轮廓描边接入指南

这份文档描述 `lumber_order` 当前正在使用的描边方案，目标是让别的 AI 在别的 Babylon 项目里也能按同样思路接入一个性能友好的黑色外轮廓。

文档只覆盖“运行时物体描边”这条链路，不讨论编辑器里的 Babylon `renderOutline` 属性编辑。

## 1. 当前方案结论

当前项目采用的是：

- Babylon 原生 `SelectionOutlineLayer`
- 两层结构：
  - `static layer`：静态描边目标
  - `dynamic layer`：动态描边目标
- 只做黑色外轮廓，不做面内描边、不做 glow
- 依赖深度遮挡参数，让描边尽量遵守 3D 透视关系
- 配合 `FXAA` 降低锯齿

对应文件：

- `src/services/SilhouetteOutlineService.ts`
- `src/services/RenderingService.ts`
- `src/core/Game.ts`
- `src/entities/SimplePlayer.ts`

## 2. 为什么最终选这套

这套方案不是“理论最强”，而是当前这个项目里综合效果和性能之后最稳的一套。

选择它的原因：

- 直接用 Babylon 原生能力，接入成本低
- 不需要额外自定义全屏后处理材质
- 性能比高频全屏 Sobel/深度法更稳
- 可以按 mesh 选择目标，不需要整场景统一描边
- 用深度遮挡参数后，基本能遵守普通的前后遮挡

没有继续走的方向：

- 纯屏幕空间轮廓检测
  - 容易出现遮挡不准、不同物体边缘粘连、屏幕颗粒感重
- 给 mesh 直接开 `renderOutline`
  - 对复杂项目可控性差，不适合批量统一管理
- 给频繁创建/销毁的掉落物全量描边
  - 这个项目里会明显放大卡顿和状态同步问题

## 3. 当前架构

### 3.1 服务层

`src/services/SilhouetteOutlineService.ts` 负责真正的 Babylon 描边层管理。

它做了这些事：

- 创建两个 `SelectionOutlineLayer`
- 配置统一颜色、宽度、遮挡参数
- 分别接收静态目标和动态目标
- 对目标去重、排序、截断
- 只在目标集合变化时才重建 selection
- 对单个异常 mesh 的 `addSelection()` 做容错

关键常量：

```ts
const OCCLUSION_STRENGTH = 1.0;
const OCCLUSION_THRESHOLD = 0.00001;
const MAX_STATIC_OUTLINE_TARGETS = 4096;
const MAX_DYNAMIC_OUTLINE_TARGETS = 512;
```

### 3.2 渲染层

`src/services/RenderingService.ts` 负责：

- 初始化 `DefaultRenderingPipeline`
- 开启 `FXAA`
- 在相机准备好后初始化 `SilhouetteOutlineService`
- 对外暴露：
  - `setSilhouetteStaticTargets(meshes)`
  - `setSilhouetteTargets(meshes)`

当前抗锯齿配置：

```ts
this.pipeline.samples = 4;
this.pipeline.fxaaEnabled = true;
```

### 3.3 游戏主循环

`src/core/Game.ts` 负责：

- 初始化后收集一次静态描边目标
- 在主循环里低频刷新动态描边目标
- 把目标列表交给 `RenderingService`

当前动态刷新节流：

```ts
private readonly dynamicSilhouetteUpdateInterval = 0.1;
```

也就是每 `0.1s` 更新一次动态描边，而不是每帧都重建。

### 3.4 实体侧

`src/entities/SimplePlayer.ts` 负责暴露当前角色真正需要描边的 mesh：

```ts
getSilhouetteMeshes(): AbstractMesh[]
```

当前实现只返回玩家本体 `visualMeshes`，不再返回：

- `wood_drop_*`
- `cash_drop_*`
- 其他频繁生成/销毁的掉落物

这是性能和稳定性上的明确取舍。

## 4. 当前参数

描边参数现在直接写死在 `src/services/SilhouetteOutlineService.ts`：

```ts
const OUTLINE_COLOR = new Color3(0, 0, 0);
const OUTLINE_THICKNESS = 1.0;
```

当前含义：

- 描边颜色：纯黑
- 描边厚度：`1.0`

## 5. 当前目标选择策略

### 5.1 静态目标

`Game.refreshStaticSilhouetteTargets()` 当前只收集两类静态资产：

- `asset_truck`
- `asset_tree_lv1`

做法是：

1. 遍历 `scene.json` 节点
2. 只挑指定 `assetId`
3. 取对应 runtime 的子 mesh
4. 过滤不可描边对象
5. 去重后送到 `static layer`

这意味着当前描边不是“场景所有物体都描”，而是“白名单资产描边”。

### 5.2 动态目标

`Game.refreshDynamicSilhouetteTargets()` 当前只收集：

- `player.getSilhouetteMeshes()`

也就是当前只给角色本体做动态描边。

### 5.3 为什么不用“全场景扫描”

不要在别的项目里一开始就做这件事：

- 每帧遍历 `scene.meshes`
- 按名字或 tag 扫全场景
- 频繁 `clearSelection + addSelection`

这样很容易出现：

- 卡顿
- 动态对象越多越慢
- 部分对象生命周期切换时丢描边
- 某些 mesh 异常导致整帧抖动

正确思路是：

- 静态目标：初始化时收集，变更时少量刷新
- 动态目标：只收集明确需要的对象，低频刷新

## 6. 关键实现细节

### 6.1 一定要逐个 mesh 调 `addSelection`

不要这样写：

```ts
layer.addSelection(nextMeshes as any);
```

当前项目已经踩过这个坑。结果是：

- 多个一级树会被 Babylon 当成同一组选区
- 外轮廓会连成一整片

正确写法：

```ts
layer.clearSelection();
for (const mesh of nextMeshes) {
  layer.addSelection(mesh);
}
```

### 6.2 目标判断不能只看顶点数

有些 clone、instance 或特殊 mesh，`getTotalVertices()` 可能返回 `0`，但它实际是可见的。

所以当前项目用了两段式判定：

1. `getTotalVertices() > 0`
2. 否则再用包围盒尺寸兜底

示意：

```ts
if (typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0) return true;

const boundingInfo = mesh.getBoundingInfo();
// 根据包围盒尺寸兜底判断
```

### 6.3 只在目标集合变化时才重建 selection

当前项目会先把目标：

- 去重
- 按 `uniqueId` 排序
- 生成 `key`

如果 `nextKey === currentKey`，直接跳过，不重建描边层。

这一步很重要，因为 `clearSelection()` 和重新 `addSelection()` 是有成本的。

### 6.4 给 `addSelection()` 做异常保护

当前实现：

- 单个 mesh `addSelection()` 抛错时，跳过这个 mesh
- 只告警一次
- 不让整局游戏因为一个坏目标直接卡死

这在运行时对象生命周期比较复杂的项目里很有必要。

### 6.5 给目标数量上限

当前项目限制为：

- 静态：`4096`
- 动态：`512`

如果别的项目角色、敌人、可交互物更多，也建议保留上限。

原因很简单：

- 描边目标不是无限加的
- 上限能避免某次配置错误直接把性能拖垮

## 7. 透视与遮挡策略

当前项目使用的不是纯 2D 轮廓贴图，而是 Babylon 的 `SelectionOutlineLayer`，再配合：

```ts
layer.occlusionStrength = 1.0;
layer.occlusionThreshold = 0.00001;
```

这会让描边更接近正常 3D 遮挡关系。

已经解决的方向：

- 描边目标在非描边物体后面时，通常不会整片压到前面
- 比早期屏幕空间方案更遵守前后关系

仍然要接受的现实：

- 这不是精确的几何级可见边提取
- 非常贴近、非常密集、轮廓彼此接触的物体，仍可能出现局部粘连感
- 过粗的描边会放大这些问题

所以当前项目一直在控制两件事：

- 宽度不要太大
- 不给所有密集小物体都加描边

## 8. 抗锯齿策略

当前项目主要靠两件事减轻锯齿：

1. 降低描边厚度
2. 打开 `FXAA`

这套取舍比较适合性能敏感的游戏项目。

如果别的项目还想更顺滑，可以按成本从低到高考虑：

1. 保持黑色，继续缩小 `outlineThickness`
2. 打开 `FXAA`
3. 适当提高渲染分辨率或降低硬件缩放
4. 再考虑更重的后处理

在当前项目里，不建议一上来就用更重的全屏轮廓平滑方案。

## 9. 为什么移除了 `wood_drop` 和 `cash_drop` 描边

这是当前项目里最重要的经验之一。

我们最后明确移除了：

- `wood_drop`
- `cash_drop`
- 其他频繁创建、挂接、交付、销毁的掉落物描边

原因不是“视觉上不能描”，而是它们的生命周期太复杂：

1. 地上静态木板
2. 被拾取
3. 变成角色背包里的运行时对象
4. 交付到车
5. 车上再生成另一套表现对象
6. 最后被销毁

如果这类对象也参与 outline 目标管理，很容易出现：

- 首次拾取卡顿
- 第二次交付卡死
- 对象切换时描边丢失
- 动态目标数量失控

所以给别的项目的建议是：

- 先只给“稳定存在的角色本体 / 大型交互物 / 场景关键资产”加描边
- 频繁生成销毁的小掉落物，默认不要进第一版方案

## 10. 别的项目怎么接

下面是推荐的落地顺序。

### 步骤 1：新增一个独立 outline service

建议直接做一个类似 `SilhouetteOutlineService` 的服务类，职责只做三件事：

- 初始化 Babylon outline layer
- 接收静态目标列表
- 接收动态目标列表

不要把“谁需要描边”的业务判断塞进 service 里。

### 步骤 2：渲染服务里统一初始化

在你们项目的渲染服务或 scene bootstrapping 里：

1. 创建主渲染管线
2. 开 `FXAA`
3. 取主相机
4. 初始化 outline service

### 步骤 3：由游戏层管理目标来源

让主循环或场景控制器负责：

- 初始化收集静态目标
- 低频刷新动态目标

不要让每个业务系统自己随手往 Babylon layer 里写 selection。

### 步骤 4：每个可描边实体暴露统一接口

例如：

```ts
getSilhouetteMeshes(): AbstractMesh[]
```

约定：

- 返回真正需要描边的渲染 mesh
- 返回前先过滤掉已销毁、已禁用、不可渲染对象
- 不要返回临时辅助节点、空父节点、特效节点

### 步骤 5：先做白名单，不要做全自动

推荐第一版只接：

- 玩家
- 载具
- 树
- 大型可交互设施

不要第一版就把：

- 所有掉落物
- 所有装饰物
- 所有可采集物
- 所有粒子表现物

全部放进来。

## 11. 推荐模板

下面是一个简化版模板，适合给别的项目 AI 直接改名复用。

```ts
class SilhouetteOutlineService {
  private staticLayer: SelectionOutlineLayer | null = null;
  private dynamicLayer: SelectionOutlineLayer | null = null;
  private staticKey = '';
  private dynamicKey = '';

  initialize(scene: Scene, camera: Camera) {
    this.staticLayer = new SelectionOutlineLayer('outline_static', scene, {
      camera,
      mainTextureRatio: 1.0,
      outlineMethod: 0,
    });
    this.dynamicLayer = new SelectionOutlineLayer('outline_dynamic', scene, {
      camera,
      mainTextureRatio: 1.0,
      outlineMethod: 0,
    });

    for (const layer of [this.staticLayer, this.dynamicLayer]) {
      if (!layer) continue;
      layer.outlineColor = new Color3(0, 0, 0);
      layer.outlineThickness = 1.0;
      layer.occlusionStrength = 1.0;
      layer.occlusionThreshold = 0.00001;
    }
  }

  setStaticTargets(meshes: AbstractMesh[]) {
    this.staticKey = this.applyTargets(this.staticLayer, meshes, this.staticKey);
  }

  setTargets(meshes: AbstractMesh[]) {
    this.dynamicKey = this.applyTargets(this.dynamicLayer, meshes, this.dynamicKey);
  }

  private applyTargets(
    layer: SelectionOutlineLayer | null,
    meshes: AbstractMesh[],
    currentKey: string,
  ): string {
    if (!layer) return currentKey;

    const nextMeshes = dedupeAndFilter(meshes);
    const nextKey = nextMeshes.map((m) => m.uniqueId).join(',');
    if (nextKey === currentKey) return currentKey;

    layer.clearSelection();
    for (const mesh of nextMeshes) {
      layer.addSelection(mesh);
    }
    return nextKey;
  }
}
```

## 12. 当前项目的接入检查清单

如果别的 AI 想照这套方案接入，至少要完成下面这些点：

1. 有独立 outline service，而不是把逻辑散在多个业务类里
2. 有静态层和动态层区分
3. 有统一的目标去重和可渲染性过滤
4. `addSelection()` 是逐个 mesh 调用
5. 有目标集合 key，避免无变化时重建
6. 有动态刷新节流，不要每帧重建
7. 有动态目标数量上限
8. 开启 `FXAA`
9. 初版只覆盖稳定对象，不覆盖高频创建销毁的小物体
10. 有一个地方能看到当前 outline 厚度，方便调试

## 13. 当前项目的已知边界

这套方案适合：

- 俯视角或偏固定视角项目
- 需要强调主角、树、车辆、关键设施
- 追求“够好且稳”的描边

这套方案不适合直接拿去要求：

- 极端精确的几何边可见线
- 海量密集小物件同时描边
- 完全没有任何轮廓粘连
- 完全没有锯齿

如果目标是这些，你就不该把这份文档当最终方案，而应该改走更重的定制后处理或几何外扩方案。

## 14. 给别的 AI 的一句话指令

如果你要在另一个 Babylon 项目里复用当前方案，建议按下面的理解执行：

- 用 `SelectionOutlineLayer` 做黑色外轮廓
- 分 static/dynamic 两层
- 由游戏层统一收集目标
- 动态目标低频刷新
- 打开 `FXAA`
- 目标按 mesh 单独 `addSelection`
- 不要第一版就给频繁生成销毁的掉落物描边

这就是 `lumber_order` 当前稳定可用的描边实现思路。
