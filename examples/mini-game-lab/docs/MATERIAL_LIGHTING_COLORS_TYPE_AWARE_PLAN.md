# Material Lighting & Colors Type-Aware Plan

本文档用于规划 `lumber_order` 编辑器中材质 `Lighting & Colors` 分组的类型感知保存链改造。

核心目标：

1. 明确区分 `PBRMaterial` 与 `StandardMaterial`
2. 不再通过 `Standard -> PBR` 的语义映射来持久化材质属性
3. 仅覆盖 Inspector 中 `Lighting & Colors` 分组
4. 将这些属性正式接入：
   - document working copy
   - history
   - undo/redo
   - save/export
   - reload/rebuild 回放

## 一、问题背景

当前编辑器已经具备 material 的保存链，支持：

1. runtime 变更捕获
2. document 写回
3. history 入栈
4. undo/redo
5. save/export
6. reload 回放

但当前 material 保存链的 canonical path 设计更偏向 `PBRMaterial`，例如：

1. `material.albedoColor`
2. `material.emissiveColor`
3. `material.metallic`
4. `material.roughness`
5. `material.albedoTexture.url`
6. `material.normalTexture.url`
7. `material.metallicTexture.url`

这会导致：

1. `PBRMaterial` 支持相对完整
2. `StandardMaterial` 只能通过兼容映射参与保存链
3. UI 字段语义与最终保存语义不完全一致
4. 后续继续扩 Standard 字段时，复杂度会越来越高

当前真正的问题不是“拿不到材质类型”，而是：

**虽然运行时已经能识别 `PBRMaterial` / `StandardMaterial`，但 document/history/save/reload 没有真正按材质类型分流。**

## 二、当前 Inspector 字段

已根据当前项目使用的 Babylon Inspector `8.52.1` 确认：

### 1. PBR - Lighting & Colors

1. `Albedo`
2. `Base Weight`
3. `Reflectivity`
4. `Micro Surface`
5. `Emissive`
6. `Ambient`
7. `Light Falloff`

### 2. Standard - Lighting & Colors

1. `Diffuse Color`
2. `Specular Color`
3. `Specular Power`
4. `Emissive Color`
5. `Ambient Color`
6. `Use Specular Over Alpha`

## 三、目标

本次改造后，编辑器应能够：

1. 识别当前材质类型是 `pbr` 还是 `standard`
2. 仅允许对应类型的 `Lighting & Colors` 字段进入保存链
3. 为两类材质分别保存各自原生语义的数据
4. 对所有纳入范围的字段支持：
   - working copy 更新
   - history 入栈
   - undo
   - redo
   - save/export
   - reload/rebuild 回放

## 四、非目标

本方案第一阶段不处理：

1. `Textures`
2. `Transparency`
3. `Rendering`
4. `Advanced`
5. `ShaderMaterial`
6. `NodeMaterial`
7. `group material`
8. 一次性覆盖所有 Babylon 材质类型

## 五、设计原则

### 1. 类型优先

所有材质改动必须先识别材质类型，再决定允许编辑和保存哪些字段。

### 2. 不做跨类型语义映射

禁止继续把以下字段做语义混写：

1. `diffuseColor -> albedoColor`
2. `specularColor -> reflectivityColor`
3. 其它 Standard -> PBR 的语义折叠

### 3. 保存层与 UI 语义对齐

Inspector 显示的字段语义，应尽可能与最终 document/save 的语义保持一致。

### 4. 最小化扩展范围

第一阶段只覆盖 `Lighting & Colors` 分组，不扩展到其它面板。

## 六、推荐数据模型

建议改为显式的类型分支结构，而不是继续使用一套平铺 canonical path。

示意结构：

```ts
type MaterialLightingConfig =
  | {
      type: 'pbr';
      pbr: {
        albedoColor?: ColorRGB;
        baseWeight?: number;
        reflectivityColor?: ColorRGB;
        microSurface?: number;
        emissiveColor?: ColorRGB;
        ambientColor?: ColorRGB;
        lightFalloff?: number;
      };
    }
  | {
      type: 'standard';
      standard: {
        diffuseColor?: ColorRGB;
        specularColor?: ColorRGB;
        specularPower?: number;
        emissiveColor?: ColorRGB;
        ambientColor?: ColorRGB;
        useSpecularOverAlpha?: boolean;
      };
    };
```

建议逐步将以下保存位切到这种结构：

1. `SceneSharedMaterialConfig.properties`
2. `SceneNodeVisualOverrides.material`
3. `SceneNodeVisualOverrides.childMaterials[ownerNodePath]`

## 七、分阶段实施方案

## Phase 1：材质类型识别与类型化路径

### 目标

建立真正的 type-aware 路由，不再把 Standard 强行映射成 PBR 风格字段。

### 任务

1. 在 runtime 中统一识别材质类型
2. 将以下 Babylon 类型统一归类为 `pbr`：
   - `PBRMaterial`
   - `PBRBaseMaterial`
   - `PBRMetallicRoughnessMaterial`
   - `PBRSpecularGlossinessMaterial`
3. 将 `StandardMaterial` 归类为 `standard`
4. 其它材质暂归类为 `unknown`

建议新增：

```ts
type MaterialRuntimeKind = 'pbr' | 'standard' | 'unknown';

function resolveMaterialRuntimeKind(material: any): MaterialRuntimeKind
```

### 新路径建议

#### PBR

1. `material.pbr.albedoColor`
2. `material.pbr.baseWeight`
3. `material.pbr.reflectivityColor`
4. `material.pbr.microSurface`
5. `material.pbr.emissiveColor`
6. `material.pbr.ambientColor`
7. `material.pbr.lightFalloff`

#### Standard

1. `material.standard.diffuseColor`
2. `material.standard.specularColor`
3. `material.standard.specularPower`
4. `material.standard.emissiveColor`
5. `material.standard.ambientColor`
6. `material.standard.useSpecularOverAlpha`

## Phase 2：runtime 改动捕获

### 目标

让 Inspector 修改进入正确的类型化 material change。

### 主要修改点

文件：

- `src/editor-package/runtime-core/material-property-adapter.ts`

### 任务

1. 识别当前材质类型
2. 分别建立 PBR / Standard 的 propertyKey 映射
3. 当材质类型和字段不匹配时，直接忽略，不进保存链
4. 扩展 `CanonicalMaterialChange`，增加 `materialRuntimeKind`

### 建议映射

#### PBR

1. `_albedoColor` -> `material.pbr.albedoColor`
2. `_baseWeight` -> `material.pbr.baseWeight`
3. `_reflectivityColor` -> `material.pbr.reflectivityColor`
4. `_microSurface` -> `material.pbr.microSurface`
5. `_emissiveColor` -> `material.pbr.emissiveColor`
6. `_ambientColor` -> `material.pbr.ambientColor`
7. `_lightFalloff` -> `material.pbr.lightFalloff`

#### Standard

1. `diffuseColor` -> `material.standard.diffuseColor`
2. `specularColor` -> `material.standard.specularColor`
3. `specularPower` -> `material.standard.specularPower`
4. `emissiveColor` -> `material.standard.emissiveColor`
5. `ambientColor` -> `material.standard.ambientColor`
6. `useSpecularOverAlpha` -> `material.standard.useSpecularOverAlpha`

## Phase 3：document / history / undo / redo

### 目标

让两类材质的 `Lighting & Colors` 字段都正式进入 document 主链。

### 主要修改点

文件：

- `src/editor-package/document.ts`
- `src/editor-package/types.ts`
- `src/config/types.ts`

### 任务

1. 扩展 `ProjectMaterialProp`
2. 扩展 `ProjectMaterialValue`
3. 扩展 material snapshot 结构
4. 为 material history entry 增加 `materialRuntimeKind`
5. 改造：
   - `applyProjectMaterialDocumentChange()`
   - `getMaterialSnapshot()`
   - `setMaterialSnapshot()`
   - shared material 的 snapshot 读写
6. 确保 undo/redo 可按材质类型回写

## Phase 4：runtime 回放

### 目标

确保 save 后 reload/rebuild 能正确恢复两类材质的 Lighting & Colors 属性。

### 主要修改点

文件：

- `src/editor-package/runtime-core/material-property-adapter.ts`
- `src/services/SceneBuilder.ts`

### 任务

1. 扩展 `applyMaterialValueToRuntimeMaterial()`，支持类型化 path
2. PBR 按 PBR 字段回写
3. Standard 按 Standard 字段回写
4. `SceneBuilder` 回放 shared material / override / childMaterials 时按材质类型分支处理

## Phase 5：UI / Inspector 对齐

### 目标

确保 UI 层与保存层语义一致。

### 最低要求

即使暂时不重写 Inspector UI，也要做到：

1. 当前材质不支持的字段不进入保存链
2. `PBR` 只保存 PBR 的 Lighting & Colors 字段
3. `Standard` 只保存 Standard 的 Lighting & Colors 字段

### 理想状态

后续若可控 UI 层，应进一步做到：

1. `PBR` 仅暴露：
   - Albedo
   - Base Weight
   - Reflectivity
   - Micro Surface
   - Emissive
   - Ambient
   - Light Falloff
2. `Standard` 仅暴露：
   - Diffuse Color
   - Specular Color
   - Specular Power
   - Emissive Color
   - Ambient Color
   - Use Specular Over Alpha

## 八、兼容策略

### 1. 旧数据兼容

允许旧 schema 在读取阶段被兼容，但新增写入优先使用新结构。

### 2. 建议策略

1. 读取时可做 normalize
2. 保存时优先输出 type-aware schema
3. 不要求一次性迁移所有旧数据

## 九、验证计划

### 1. PBR 验证

逐项验证：

1. `Albedo`
2. `Base Weight`
3. `Reflectivity`
4. `Micro Surface`
5. `Emissive`
6. `Ambient`
7. `Light Falloff`

每项验证以下链路：

1. 修改属性
2. working copy 更新
3. history 入栈
4. undo
5. redo
6. export/save
7. reload/rebuild 回放

### 2. Standard 验证

逐项验证：

1. `Diffuse Color`
2. `Specular Color`
3. `Specular Power`
4. `Emissive Color`
5. `Ambient Color`
6. `Use Specular Over Alpha`

每项验证同样的完整链路。

### 3. 保存位验证

两类材质都要覆盖：

1. shared material
2. instance root material
3. child material

## 十、风险点

1. 当前 material save schema 已有历史负担
2. 旧配置兼容需要谨慎处理
3. shared material 与 override 双链路需要双份验证
4. 若 UI 层不裁剪，短期内仍可能看到不适用字段

## 十一、结论

当前 material 保存链已经存在，但本质上偏向 `PBRMaterial` 设计。

下一步需要做的不是继续给 `StandardMaterial` 做兼容映射，而是：

1. 先识别材质类型
2. 分别建立 `PBR` 与 `Standard` 的 `Lighting & Colors` 保存语义
3. 把这些属性正式接入：
   - document
   - history
   - undo/redo
   - save/export
   - reload

一句话总结：

**先按材质类型分流，再把 `Lighting & Colors` 这一组字段各自接入完整保存链，不再把 Standard 硬映射成 PBR。**
