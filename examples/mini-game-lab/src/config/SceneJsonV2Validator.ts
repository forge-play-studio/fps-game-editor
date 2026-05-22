import type { SceneConfig } from './types';
import sceneJsonV2Rules from './scene-json-v2-rules.json';

export interface SceneJsonV2ValidationError {
  path: string;
  message: string;
}

export interface SceneJsonV2ValidationOptions {
  allowOrphanSharedMaterials?: boolean;
  allowOrphanNodeMaterials?: boolean;
  strictAssetIds?: string[];
  strictNodeIds?: string[];
  maxErrors?: number;
}

const NODE_KINDS = new Set(sceneJsonV2Rules.nodeKinds);
const ASSET_TYPES = new Set(sceneJsonV2Rules.assetTypes);
const MATERIAL_MODES = new Set(sceneJsonV2Rules.materialModes);
const MATERIAL_SCOPES = new Set(sceneJsonV2Rules.materialScopes);
const TRANSFORM_TYPES = new Set(sceneJsonV2Rules.transformTypes);
const HIERARCHY_PARENT_TARGETS = new Set(sceneJsonV2Rules.hierarchy.parentTargets);
const RUNTIME_ONLY_TOKENS = sceneJsonV2Rules.runtimeOnlyTokens;

export function validateSceneJsonV2(
  sceneConfig: SceneConfig,
  options: SceneJsonV2ValidationOptions = {},
): SceneJsonV2ValidationError[] {
  const {
    allowOrphanSharedMaterials = false,
    allowOrphanNodeMaterials = false,
    strictAssetIds = [],
    strictNodeIds = [],
    maxErrors = 50,
  } = options;
  const errors: SceneJsonV2ValidationError[] = [];
  const strictAssets = new Set(strictAssetIds);
  const strictNodes = new Set(strictNodeIds);
  const add = (path: string, message: string): void => {
    if (errors.length < maxErrors) errors.push({ path, message });
  };

  if (!isRecord(sceneConfig)) {
    add('$', 'scene json must be an object');
    return errors;
  }
  if (sceneConfig.schemaVersion !== 2) add('$.schemaVersion', 'schemaVersion must be 2');
  validateGeneratedFrom(sceneConfig.meta?.generatedFrom, '$.meta.generatedFrom', add);
  const scene = sceneConfig.scene;
  if (!isRecord(scene)) {
    add('$.scene', 'scene must be an object');
    return errors;
  }
  if (!nonEmptyString(scene.rootId)) add('$.scene.rootId', 'rootId must be a non-empty string');
  if (!Array.isArray(scene.assets)) add('$.scene.assets', 'assets must be an array');
  if (!Array.isArray(scene.nodes)) add('$.scene.nodes', 'nodes must be an array');
  if (!Array.isArray(scene.materials)) add('$.scene.materials', 'materials must be an array');
  if (!Array.isArray(scene.textures)) add('$.scene.textures', 'textures must be an array');
  if (errors.length > 0) return errors;

  const assetIds = new Set<string>();
  const nodeIds = new Set<string>();
  const nodeKinds = new Map<string, string>();

  scene.assets.forEach((asset, index) => {
    const path = `$.scene.assets[${index}]`;
    if (!isRecord(asset)) {
      add(path, 'asset must be an object');
      return;
    }
    if (!nonEmptyString(asset.id)) add(`${path}.id`, 'asset.id must be a non-empty string');
    else if (assetIds.has(asset.id)) add(`${path}.id`, `duplicate asset id: ${asset.id}`);
    else assetIds.add(asset.id);
    if (!ASSET_TYPES.has(asset.type)) add(`${path}.type`, 'asset.type must be glb');
    if (!nonEmptyString(asset.sourceId)) add(`${path}.sourceId`, 'asset.sourceId must be a non-empty string');
    if (asset.displayName != null && !nonEmptyString(asset.displayName)) add(`${path}.displayName`, 'displayName must be a non-empty string when present');
    if (asset.category != null && !nonEmptyString(asset.category)) add(`${path}.category`, 'category must be a non-empty string when present');
    if (asset.materialMode != null && !MATERIAL_MODES.has(asset.materialMode)) {
      add(`${path}.materialMode`, 'materialMode must be shared or instance');
    }
    validateAssetDefaults(asset.defaults, `${path}.defaults`, add);
    if (asset.metadata != null && !isRecord(asset.metadata)) add(`${path}.metadata`, 'metadata must be an object when present');
    if (strictAssets.has(asset.id)) assertNoRuntimeOnlyFields(asset, path, add);
  });

  scene.nodes.forEach((node, index) => {
    const path = `$.scene.nodes[${index}]`;
    if (!isRecord(node)) {
      add(path, 'node must be an object');
      return;
    }
    if (!nonEmptyString(node.id)) add(`${path}.id`, 'node.id must be a non-empty string');
    else if (nodeIds.has(node.id)) add(`${path}.id`, `duplicate node id: ${node.id}`);
    else {
      nodeIds.add(node.id);
      if (typeof node.kind === 'string') nodeKinds.set(node.id, node.kind);
    }
    if (!NODE_KINDS.has(node.kind)) add(`${path}.kind`, 'node.kind must be group, instance, or transform');
  });

  scene.nodes.forEach((node, index) => {
    if (!isRecord(node)) return;
    const path = `$.scene.nodes[${index}]`;
    const parentId = nonEmptyString(node.parentId) ? node.parentId : scene.rootId;
    validateNodeParentTarget(parentId, scene.rootId, nodeIds, `${path}.parentId`, add);
    if (nonEmptyString(node.id)) validateNodeParentCycle(node.id, scene, `${path}.parentId`, add);
    validateRuntimeSourceBinding(node.source, `${path}.source`, add);
    validateTransform(node.transform, `${path}.transform`, add);
    if (node.kind === 'instance') {
      if (!isRecord(node.instance)) add(`${path}.instance`, 'instance node must contain instance object');
      else if (!assetIds.has(node.instance.assetId)) {
        add(`${path}.instance.assetId`, `assetId must reference scene.assets: ${node.instance.assetId}`);
      }
    }
    if (node.kind === 'transform' && node.transformType != null && !TRANSFORM_TYPES.has(node.transformType)) {
      add(`${path}.transformType`, 'transformType must be plain, light, camera, or groundDecal');
    }
    if (node.kind === 'transform' && node.transformType === 'groundDecal') {
      validateGroundDecal(node.groundDecal, `${path}.groundDecal`, add);
    }
    const visualOverrides = (node as Record<string, any>).overrides;
    if (node.kind === 'instance' || node.kind === 'transform') {
      validateVisualOverrides(visualOverrides, `${path}.overrides`, add);
    } else if (visualOverrides != null) {
      add(`${path}.overrides`, 'group nodes do not support visual overrides');
    }
    if (strictNodes.has(node.id)) assertNoRuntimeOnlyFields(node, path, add);
  });

  scene.materials.forEach((material, index) => {
    const path = `$.scene.materials[${index}]`;
    if (!isRecord(material)) {
      add(path, 'material must be an object');
      return;
    }
    if (!nonEmptyString(material.id)) add(`${path}.id`, 'material.id must be a non-empty string');
    if (material.scope != null && !MATERIAL_SCOPES.has(material.scope)) {
      add(`${path}.scope`, 'material scope must be sharedAsset or nodeMaterial');
    }
    const effectiveScope = typeof material.scope === 'string' && MATERIAL_SCOPES.has(material.scope)
      ? material.scope
      : nonEmptyString(material.assetId)
        ? 'sharedAsset'
        : nonEmptyString(material.nodeId)
          ? 'nodeMaterial'
          : null;
    if (effectiveScope === 'sharedAsset') {
      if (!nonEmptyString(material.assetId)) {
        add(`${path}.assetId`, 'shared material assetId must be a non-empty string');
      } else if (!assetIds.has(material.assetId) && !allowOrphanSharedMaterials) {
        add(`${path}.assetId`, `shared material assetId must reference scene.assets: ${material.assetId}`);
      }
      if (material.nodeId != null) add(`${path}.nodeId`, 'shared material must not set nodeId');
    } else if (effectiveScope === 'nodeMaterial') {
      if (!nonEmptyString(material.nodeId)) {
        add(`${path}.nodeId`, 'node material nodeId must be a non-empty string');
      } else if (!nodeIds.has(material.nodeId) && !allowOrphanNodeMaterials) {
        add(`${path}.nodeId`, `node material nodeId must reference scene.nodes: ${material.nodeId}`);
      } else if (nodeIds.has(material.nodeId)) {
        const nodeKind = nodeKinds.get(material.nodeId);
        if (nodeKind !== 'instance' && nodeKind !== 'transform') {
          add(`${path}.nodeId`, `node material nodeId must reference an instance or transform node: ${material.nodeId}`);
        }
      }
      if (material.assetId != null) add(`${path}.assetId`, 'node material must not set assetId');
    } else {
      add(`${path}.scope`, 'material must declare scope or provide assetId/nodeId');
    }
    if (!nonEmptyString(material.materialName)) add(`${path}.materialName`, 'materialName must be a non-empty string');
    if (!isRecord(material.properties)) add(`${path}.properties`, 'properties must be an object');
    else validateMaterialProperties(material.properties, `${path}.properties`, add);
  });

  return errors;
}

function validateNodeParentTarget(
  parentId: string,
  rootId: unknown,
  nodeIds: Set<string>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (parentId === rootId) {
    if (!HIERARCHY_PARENT_TARGETS.has('root')) {
      add(path, `parentId must point to scene node: ${parentId}`);
    }
    return;
  }
  if (HIERARCHY_PARENT_TARGETS.has('sceneNode') && nodeIds.has(parentId)) return;
  const targetDescription = HIERARCHY_PARENT_TARGETS.has('root') && HIERARCHY_PARENT_TARGETS.has('sceneNode')
    ? 'root or scene node'
    : HIERARCHY_PARENT_TARGETS.has('sceneNode')
      ? 'scene node'
      : 'root';
  add(path, `parentId must point to ${targetDescription}: ${parentId}`);
}

function validateNodeParentCycle(
  nodeId: string,
  scene: Record<string, any>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  const rootId = scene.rootId;
  if (!nonEmptyString(rootId) || !Array.isArray(scene.nodes)) return;
  const byId = new Map<string, Record<string, any>>();
  for (const node of scene.nodes) {
    if (isRecord(node) && nonEmptyString(node.id)) byId.set(node.id, node);
  }
  const visited = new Set<string>([nodeId]);
  let cursorId = nonEmptyString(byId.get(nodeId)?.parentId) ? byId.get(nodeId)?.parentId : rootId;
  while (nonEmptyString(cursorId) && cursorId !== rootId) {
    if (visited.has(cursorId)) {
      add(path, `parentId creates a node cycle involving ${nodeId}`);
      return;
    }
    visited.add(cursorId);
    const cursor = byId.get(cursorId);
    if (!cursor) return;
    cursorId = nonEmptyString(cursor.parentId) ? cursor.parentId : rootId;
  }
}

function validateAssetDefaults(
  defaults: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (defaults == null) return;
  if (!isRecord(defaults)) {
    add(path, 'defaults must be an object');
    return;
  }
  for (const key of Object.keys(defaults)) {
    if (!['transform', 'outline', 'childOutlines'].includes(key)) {
      add(`${path}.${key}`, `unsupported asset defaults field: ${key}`);
    }
  }
  validateTransform(defaults.transform, `${path}.transform`, add);
  validateOutline(defaults.outline, `${path}.outline`, add);
  if (defaults.childOutlines != null) {
    if (!isRecord(defaults.childOutlines)) {
      add(`${path}.childOutlines`, 'childOutlines must be an object');
    } else {
      for (const [key, outline] of Object.entries(defaults.childOutlines)) {
        validateOutline(outline, `${path}.childOutlines.${key}`, add);
      }
    }
  }
}

function validateVisualOverrides(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'overrides must be an object');
    return;
  }
  validateMaterialOverride(value.material, `${path}.material`, add);
  validateOutline(value.outline, `${path}.outline`, add);
  if (value.childMaterials != null) {
    if (!isRecord(value.childMaterials)) {
      add(`${path}.childMaterials`, 'childMaterials must be an object');
    } else {
      for (const [key, material] of Object.entries(value.childMaterials)) {
        validateMaterialOverride(material, `${path}.childMaterials.${key}`, add);
      }
    }
  }
  if (value.childOutlines != null) {
    if (!isRecord(value.childOutlines)) {
      add(`${path}.childOutlines`, 'childOutlines must be an object');
    } else {
      for (const [key, outline] of Object.entries(value.childOutlines)) {
        validateOutline(outline, `${path}.childOutlines.${key}`, add);
      }
    }
  }
}

function validateMaterialOverride(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'material override must be an object');
    return;
  }
  validateMaterialProperties(value, path, add);
}

function validateGeneratedFrom(
  generatedFrom: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (generatedFrom == null) return;
  if (!isRecord(generatedFrom)) {
    add(path, 'generatedFrom must be an object when present');
    return;
  }
  validateAuthoringSourceRef(generatedFrom, path, add);
  if (!nonEmptyString(generatedFrom.compilerId)) add(`${path}.compilerId`, 'compilerId must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compilerVersion)) add(`${path}.compilerVersion`, 'compilerVersion must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compiledAt)) add(`${path}.compiledAt`, 'compiledAt must be a non-empty string');
}

function validateRuntimeSourceBinding(
  source: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (source == null) return;
  if (!isRecord(source)) {
    add(path, 'source must be an object when present');
    return;
  }
  validateAuthoringSourceRef(source, path, add);
  if (source.objectId != null && !nonEmptyString(source.objectId)) add(`${path}.objectId`, 'objectId must be a non-empty string when present');
  if (source.component != null && !nonEmptyString(source.component)) add(`${path}.component`, 'component must be a non-empty string when present');
  if (source.propertyPath != null && !nonEmptyString(source.propertyPath)) add(`${path}.propertyPath`, 'propertyPath must be a non-empty string when present');
}

function validateAuthoringSourceRef(
  source: Record<string, any>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (!nonEmptyString(source.sourceId)) add(`${path}.sourceId`, 'sourceId must be a non-empty string');
  if (!nonEmptyString(source.sourceType)) add(`${path}.sourceType`, 'sourceType must be a non-empty string');
  if (source.revision != null && (typeof source.revision !== 'number' || !Number.isFinite(source.revision))) {
    add(`${path}.revision`, 'revision must be a finite number when present');
  }
}

export function assertSceneJsonV2(sceneConfig: SceneConfig, options?: SceneJsonV2ValidationOptions): void {
  const errors = validateSceneJsonV2(sceneConfig, options);
  if (errors.length === 0) return;
  throw new Error(`[SceneJsonV2Validator] ${JSON.stringify(errors, null, 2)}`);
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTransform(transform: unknown, path: string, add: (path: string, message: string) => void): void {
  if (transform == null) return;
  if (!isRecord(transform)) {
    add(path, 'transform must be an object');
    return;
  }
  validateVec3(transform.position, `${path}.position`, add);
  validateVec3(transform.rotation, `${path}.rotation`, add);
  validateVec3(transform.rotationDeg, `${path}.rotationDeg`, add);
  if (typeof transform.scale === 'number') {
    if (!Number.isFinite(transform.scale)) add(`${path}.scale`, 'scale number must be finite');
  } else {
    validateVec3(transform.scale, `${path}.scale`, add);
  }
}

function validateVec3(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'value must be a vector object');
    return;
  }
  for (const axis of ['x', 'y', 'z']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      add(`${path}.${axis}`, 'vector component must be a finite number');
    }
  }
}

function validateColor(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'color must be an object');
    return;
  }
  for (const key of ['r', 'g', 'b']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      add(`${path}.${key}`, 'color component must be a finite number');
    }
  }
}

function validateOutline(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'outline must be an object');
    return;
  }
  if (value.renderOutline != null && typeof value.renderOutline !== 'boolean') add(`${path}.renderOutline`, 'renderOutline must be boolean');
  if (value.outlineWidth != null && (typeof value.outlineWidth !== 'number' || !Number.isFinite(value.outlineWidth))) {
    add(`${path}.outlineWidth`, 'outlineWidth must be a finite number');
  }
  validateColor(value.outlineColor, `${path}.outlineColor`, add);
}

function validateGroundDecal(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'groundDecal must be an object');
    return;
  }
  if (!isRecord(value.size)) {
    add(`${path}.size`, 'groundDecal.size must be an object');
  } else {
    for (const key of ['width', 'depth']) {
      if (typeof value.size[key] !== 'number' || !Number.isFinite(value.size[key]) || value.size[key] <= 0) {
        add(`${path}.size.${key}`, 'groundDecal size must be a positive finite number');
      }
    }
  }
  if (value.textureId != null && !nonEmptyString(value.textureId)) add(`${path}.textureId`, 'textureId must be non-empty when present');
  validateColor(value.color, `${path}.color`, add);
  for (const key of ['alphaIndex', 'diffuseTextureLevel', 'emissiveTextureLevel']) {
    if (value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      add(`${path}.${key}`, `${key} must be a finite number`);
    }
  }
}

function validateMaterialProperties(value: Record<string, any>, path: string, add: (path: string, message: string) => void): void {
  if (Object.keys(value).length === 0) {
    add(path, 'material properties must contain at least one override field');
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (['albedoColor', 'diffuseColor', 'emissiveColor'].includes(key)) {
      validateColor(child, childPath, add);
    } else if (['metallic', 'roughness', 'contrast', 'brightness', 'saturation', 'hue', 'colorDensity', 'alpha', 'alphaCutOff', 'transparencyMode'].includes(key)) {
      validateFiniteNumber(child, key, childPath, add);
    } else if (key === 'backFaceCulling') {
      validateBoolean(child, key, childPath, add);
    } else if (['albedoTexture', 'normalTexture', 'metallicTexture'].includes(key)) {
      validateMaterialTextureOverride(child, childPath, key, add);
    } else if (key === 'pbr') {
      if (!isRecord(child)) add(childPath, 'pbr must be an object');
      else validatePbrMaterialProperties(child, childPath, add);
    } else if (key === 'standard') {
      if (!isRecord(child)) add(childPath, 'standard must be an object');
      else validateStandardMaterialProperties(child, childPath, add);
    } else {
      add(childPath, `unsupported material override field: ${key}`);
    }
  }
}

function validatePbrMaterialProperties(value: Record<string, any>, path: string, add: (path: string, message: string) => void): void {
  if (Object.keys(value).length === 0) {
    add(path, 'pbr material properties must contain at least one override field');
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (['albedoColor', 'reflectivityColor', 'emissiveColor', 'ambientColor'].includes(key)) {
      validateColor(child, childPath, add);
    } else if ([
      'baseWeight',
      'microSurface',
      'lightFalloff',
      'directIntensity',
      'emissiveIntensity',
      'environmentIntensity',
      'specularIntensity',
      'metallicF0Factor',
      'indexOfRefraction',
    ].includes(key)) {
      validateFiniteNumber(child, key, childPath, add);
    } else {
      add(childPath, `unsupported pbr material override field: ${key}`);
    }
  }
}

function validateStandardMaterialProperties(value: Record<string, any>, path: string, add: (path: string, message: string) => void): void {
  if (Object.keys(value).length === 0) {
    add(path, 'standard material properties must contain at least one override field');
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (['diffuseColor', 'specularColor', 'emissiveColor', 'ambientColor'].includes(key)) {
      validateColor(child, childPath, add);
    } else if (key === 'specularPower') {
      validateFiniteNumber(child, key, childPath, add);
    } else if (key === 'useSpecularOverAlpha') {
      validateBoolean(child, key, childPath, add);
    } else {
      add(childPath, `unsupported standard material override field: ${key}`);
    }
  }
}

function validateFiniteNumber(
  value: unknown,
  key: string,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) add(path, `${key} must be a finite number`);
}

function validateBoolean(
  value: unknown,
  key: string,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (typeof value !== 'boolean') add(path, `${key} must be boolean`);
}

function validateMaterialTextureOverride(
  value: unknown,
  path: string,
  key: string,
  add: (path: string, message: string) => void,
): void {
  if (!isRecord(value)) {
    add(path, `${key} must be an object`);
    return;
  }
  if (!nonEmptyString(value.url)) {
    add(`${path}.url`, 'texture url must be non-empty when texture override is present');
  }
  for (const childKey of Object.keys(value)) {
    if (childKey !== 'url') add(`${path}.${childKey}`, `unsupported texture override field: ${childKey}`);
  }
}

function assertNoRuntimeOnlyFields(
  value: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  const serialized = JSON.stringify(value);
  const found = RUNTIME_ONLY_TOKENS.filter((token) => serialized.includes(token));
  if (found.length > 0) add(path, `contains runtime-only asset fields: ${found.join(', ')}`);
}
