# Scene JSON V2 设计规范

这份文档只定义 `scene.json` 自身的结构、字段语义和使用规则。

后续实现要求：

1. `scene.json` 的结构设计以本文档为准。
2. `SceneBuilder`、编辑器选中、保存链、undo/redo 都要适配这份结构。

## 设计目标

`scene.json` 需要同时满足三件事：

1. 作为项目的 authored source of truth。
2. 作为编辑器保存链的稳定目标文档。
3. 让场景层级、选中和保存语义保持一致。

当前阶段先解决：

1. hierarchy 如何表达
2. instance 和 transform 如何分层
3. asset 默认参数和 instance override 如何分层

当前阶段不展开：

1. asset 作为复合 prefab/group 的能力
2. 自动迁移脚本
3. 具体实现步骤

## 顶层结构

当前版本文件结构：

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

顶层语义：

1. `meta`
   - 文档级元信息
2. `gameplay`
   - 玩法配置
   - 例如 `player.speed`、train、tracks
3. `scene`
   - 场景 authored 数据
4. `render`
   - 全局渲染参数

## Scene 域

`scene` 当前版本只包含五类结构：

1. `rootId`
2. `assets`
3. `nodes`
4. `materials`
5. `textures`

### rootId

`rootId` 表示逻辑 scene root。

规则：

1. `rootId` 是逻辑根，不要求一定以显式 node 形式存在于 `nodes` 中。
2. 当 node 的 `parentId` 为空或缺省时，默认挂到 `rootId`。

## 当前版本：Assets

`assets` 是资源模板层。

当前版本只支持一种 asset：

1. `type: "glb"`

也就是说，当前版本的 `asset` 只表示：

1. 一个可复用的 glb 资源模板
2. 它的默认参数

当前版本不支持：

1. mesh group prefab
2. 复合 prefab
3. asset 内部 hierarchy authoring

示例：

```json
{
  "id": "tree",
  "type": "glb",
  "sourceId": "tree",
  "defaults": {
    "transform": {
      "scale": 3.2
    }
  }
}
```

字段语义：

1. `id`
   - 资源模板 ID
   - 供 instance 通过 `assetId` 引用
2. `type`
   - 当前固定为 `glb`
3. `sourceId`
   - 对应实际模型资源 ID
4. `defaults`
   - 资源级默认参数

### `materialMode`

只有两种：

1. `shared`
2. `instance`

语义：

1. `shared` 表示 shared material 默认共享，instance override 时再脱离 shared
2. `instance` 表示实例天然走独立材质语义

默认规则：

1. 未写 `materialMode` 时，默认按 `shared` 处理
2. 只有显式写 `materialMode`: `"instance"` 时，才表示默认独立材质

示例：

```json
{
  "id": "tree",
  "type": "glb",
  "sourceId": "tree",
  "materialMode": "shared"
}
```

### 为什么需要 asset 层

因为场景中经常会有大量 instance 引用同一个 glb，例如 `tree`。

如果用户改动的是“树这种资源的默认大小”，目标应该是：

1. 改 asset defaults
2. 所有未单独覆盖 scale 的 tree instance 一起变化

而不是：

1. 给每个 tree instance 单独写一份 `transform.scale`

## 当前版本：Nodes

`nodes` 是场景里的 authored 对象集合。

当前版本只定义三类 `kind`：

1. `group`
2. `instance`
3. `transform`

统一基础字段：

```json
{
  "id": "node_id",
  "name": "Readable Name",
  "kind": "group | instance | transform",
  "parentId": "group_xxx",
  "enabled": true,
  "transform": {}
}
```

基础字段规则：

1. `id`
   - 节点稳定唯一 ID
2. `name`
   - 编辑器展示名
3. `kind`
   - 节点主分类
4. `parentId`
   - authored 父级
5. `enabled`
   - authored 默认启用状态
6. `transform`
   - authored transform 覆盖值

## 当前版本：Hierarchy 规则

当前版本的 hierarchy 规则已经定稿：

1. hierarchy 只通过 `group` 表达。
2. `group` 是唯一的 authored 容器节点。
3. `instance` 和 `transform` 都是 authored 叶子节点。
4. `instance` 和 `transform` 不允许 authored 子节点。
5. runtime 可以在 `instance` 或 `transform` 下生成临时子节点，但这些子节点不属于 authored hierarchy，不写回 `scene.json`。

### parentId 规则

1. `parentId` 为空或缺省时，默认挂到 `scene.rootId`
2. `group.parentId` 只能指向另一个 `group` 或 root
3. `instance.parentId` 只能指向 `group` 或 root
4. `transform.parentId` 只能指向 `group` 或 root

## 当前版本：group

`group` 的职责非常单一：

1. 表达 hierarchy
2. 方便场景层级管理

`group` 可以包含：

1. `group`
2. `instance`
3. `transform`

示例：

```json
{
  "id": "group_station_01",
  "name": "Station Group 01",
  "kind": "group",
  "enabled": true,
  "transform": {}
}
```

规则：

1. `group` 本身不表达 glb 资产语义。
2. `group` 的主要作用是组织场景结构。
3. `group` 不等于 asset。

## 当前版本：instance

`instance` 表示场景中的一个 glb 实例。

它之所以单独抽出来，不是因为它概念上完全不是 transform，而是因为它有明显独立的高频语义：

1. 引用 glb asset
2. 有高频 node 级 override 需求
3. 有高频 child override 需求

示例：

```json
{
  "id": "tree_01",
  "name": "Tree 01",
  "kind": "instance",
  "parentId": "group_forest",
  "enabled": true,
  "instance": {
    "assetId": "tree"
  },
  "transform": {
    "position": { "x": 10, "y": 0, "z": 6 }
  },
  "overrides": {
    "material": {},
    "childMaterials": {}
  }
}
```

规则：

1. `instance.instance.assetId` 必须引用 `scene.assets[*].id`
2. `instance` 不承担 hierarchy 容器职责
3. `instance.transform` 只保存实例自己的 override
4. 未写的值从 asset defaults 继承
5. `instance.overrides.material / childMaterials` 不表示普通材质本体存储
6. `instance.overrides.material / childMaterials` 只用于 node 已引用 shared material，但需要局部差异时的 override

### instance 最终参数合成顺序

对于一个 instance，最终运行时参数按以下顺序合成：

1. asset defaults
2. instance node 自身的 `transform`
3. `scene.materials` 中与该 node 相关的 material / texture authored 数据
4. instance 的 `overrides`
5. runtime transient state 不写回

## 当前版本：transform

`transform` 表示所有非 glb 的 authored node。

它的角色是：

1. 纯空间锚点
2. light
3. camera
4. groundDecal

当前版本通过 `transformType` 再细分。

当前版本支持的 `transformType`：

1. `plain`
2. `light`
3. `camera`
4. `groundDecal`

### transform 的总规则

1. `transform` 不承担 hierarchy 容器职责
2. `transform` 不允许 authored 子节点
3. `transformType` 是正式判别字段
4. 不使用自由 `tag` 作为主类型判别

### transformType = plain

表示纯空间锚点。

典型例子：

1. `water_surface_root`
2. `oil_surface_root`

示例：

```json
{
  "id": "water_surface_root",
  "name": "Water Surface Root",
  "kind": "transform",
  "transformType": "plain",
  "parentId": "group_water_area",
  "enabled": true,
  "transform": {}
}
```

### transformType = light

示例：

```json
{
  "id": "dir_light_main",
  "name": "Main Directional Light",
  "kind": "transform",
  "transformType": "light",
  "parentId": "group_env",
  "enabled": true,
  "transform": {},
  "light": {
    "type": "directional",
    "intensity": 4.5
  }
}
```

### transformType = camera

示例：

```json
{
  "id": "main_camera",
  "name": "Main Camera",
  "kind": "transform",
  "transformType": "camera",
  "parentId": "group_env",
  "enabled": true,
  "transform": {},
  "camera": {
    "type": "arcRotate"
  }
}
```

### transformType = groundDecal

示例：

```json
{
  "id": "decal_station_01",
  "name": "Station Decal 01",
  "kind": "transform",
  "transformType": "groundDecal",
  "parentId": "group_station_01",
  "enabled": true,
  "transform": {},
  "groundDecal": {
    "size": 2.4,
    "layers": []
  }
}
```

规则补充：

1. `groundDecal` 自身的 authored 结构只表达 node domain 数据，例如尺寸、业务类型等
2. `groundDecal` 对应的材质参数不默认写入 `groundDecal` 字段本身
3. 如果 `groundDecal` 有独立材质参数，这些参数进入 `scene.materials`
4. 只有当 `groundDecal` 已引用 shared material，且该 node 需要局部材质差异时，才进入 node override

## 当前版本：Materials

`scene.materials` 表示 material domain 的 authored 材质数据。

示例：

```json
{
  "id": "mat_oil_well_base",
  "scope": "sharedAsset",
  "assetId": "oil_well",
  "type": "PBRMaterial",
  "materialName": "Oil Well Base",
  "properties": {
    "metallic": 0.4,
    "roughness": 0.2
  }
}
```

规则：

1. `scene.materials` 保存 material domain 的材质实体
2. 当前至少包含两类语义：
   - shared material
   - node-scoped material
3. shared material 和 independent material 都进入 `scene.materials`
4. `scene.nodes[*].overrides.material / childMaterials` 不保存普通材质本体
5. `scene.nodes[*].overrides.material / childMaterials` 只用于 shared material 的局部节点差异
6. `scene.materials` 中的 authored 数据既可以服务 `instance`，也可以服务 `transform`

推荐示例：

```json
{
  "id": "sharedmat_asset_tree_bark",
  "scope": "sharedAsset",
  "assetId": "tree",
  "materialName": "bark_mat",
  "type": "PBRMaterial",
  "properties": {}
}
```

```json
{
  "id": "nodemat_sell_decal_root",
  "scope": "nodeMaterial",
  "nodeId": "collect_table_sell_decal",
  "ownerNodePath": "collect_table_sell_decal_mesh",
  "materialName": "collect_table_sell_decal_mat",
  "type": "StandardMaterial",
  "properties": {}
}
```

## 当前版本：Textures

`scene.textures` 表示 texture domain 的 authored 纹理数据。

示例：

```json
{
  "id": "tex_oil_normal",
  "name": "Oil Normal",
  "type": "texture",
  "url": "assets/textures/oil_normal.png"
}
```

## 当前版本：编辑器语义要求

这份 schema 不是纯配置格式，它必须服务编辑器。

当前版本必须满足：

1. 选中任意场景对象时，能稳定映射到一个 node 或 asset
2. 保存时，能明确写回唯一配置路径
3. reload 后，runtime scene 与 authored hierarchy 一致

编辑器至少要区分三类编辑目标：

1. asset defaults 编辑
2. material 编辑
3. texture 编辑

### asset defaults 编辑

适用：

1. 用户想改“tree 这种资源的默认大小”

写回目标：

1. `scene.assets[*].defaults`

效果：

1. 所有未单独覆盖该字段的实例都会跟着变

### material 编辑

适用：

1. 用户想改某个 node 或某个 shared asset 的材质参数

写回目标：

1. 默认写 `scene.materials[*]`
2. 只有当 node 已引用 shared material 且需要局部差异时，才写 `scene.nodes[*].overrides.material / childMaterials`

效果：

1. shared material 会影响所有引用它且未局部覆盖的 node
2. node-scoped material 只影响当前 node

### texture 编辑

适用：

1. 用户想改某个纹理实体或某个材质槽位引用

写回目标：

1. 纹理实体本身写 `scene.textures[*]`
2. 材质槽位引用默认写 `scene.materials[*]`
3. 只有 shared material 局部差异场景，才进入 node override

效果：

1. 纹理与材质语义分离，避免把 texture 变化混进 node 字段

### node 编辑

适用：

1. 用户想改位置、旋转、缩放、启用状态或节点自身 authored 字段

写回目标：

1. `scene.nodes[*].transform`
2. `scene.nodes[*]` 下的 node-specific 字段
3. 如需 shared material 局部差异，则额外写 `scene.nodes[*].overrides`

效果：

1. 只影响当前 node 的 authored 数据

## 当前版本推荐示例

```json
{
  "schemaVersion": 2,
  "meta": {
    "name": "train_oil_main_scene"
  },
  "gameplay": {
    "player": {
      "speed": 4.2
    }
  },
  "scene": {
    "rootId": "root",
    "assets": [
      {
        "id": "tree",
        "type": "glb",
        "sourceId": "tree",
        "defaults": {
          "transform": {
            "scale": 3.2
          }
        }
      },
      {
        "id": "oil_well",
        "type": "glb",
        "sourceId": "oil_well",
        "defaults": {}
      }
    ],
    "nodes": [
      {
        "id": "group_forest",
        "name": "Forest Group",
        "kind": "group",
        "enabled": true,
        "transform": {}
      },
      {
        "id": "tree_01",
        "name": "Tree 01",
        "kind": "instance",
        "parentId": "group_forest",
        "enabled": true,
        "instance": {
          "assetId": "tree"
        },
        "transform": {
          "position": { "x": 10, "y": 0, "z": 6 }
        }
      },
      {
        "id": "tree_02",
        "name": "Tree 02",
        "kind": "instance",
        "parentId": "group_forest",
        "enabled": true,
        "instance": {
          "assetId": "tree"
        },
        "transform": {
          "position": { "x": 14, "y": 0, "z": 8 },
          "scale": 4.1
        }
      },
      {
        "id": "water_surface_root",
        "name": "Water Surface Root",
        "kind": "transform",
        "transformType": "plain",
        "enabled": true,
        "transform": {}
      },
      {
        "id": "main_light",
        "name": "Main Light",
        "kind": "transform",
        "transformType": "light",
        "enabled": true,
        "transform": {},
        "light": {
          "type": "directional",
          "intensity": 4.5
        }
      }
    ],
    "materials": [],
    "textures": []
  },
  "render": {}
}
```

## 后续版本

以下内容是后续版本可能扩展的方向，不属于当前版本定稿范围：

1. asset 支持复合 prefab / mesh group
2. asset 支持内部 hierarchy
3. `instance.overrides` 扩展到 `childTransforms`
4. 更完整的 material / texture 引用规则
5. 更细粒度的 light / camera / groundDecal schema

当前阶段不要提前把这些扩展塞进实现。

当前阶段先按本文档的当前版本落地：

1. 顶层结构
2. `assets`
3. `group / instance / transform`
4. `transformType`
5. asset defaults 与 instance override 的分层
