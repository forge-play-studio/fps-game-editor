import type { ColorRGB, Position3D, Scale3D, SceneNodeConfig, TransformConfig } from '../config';

export type SceneNodeFieldPatch = {
  path: string;
  value: unknown;
};

type SceneNodeFieldSchemaEntry = {
  path: string;
  appliesTo: ReadonlyArray<SceneNodeConfig['kind']>;
  validate: (value: unknown) => boolean;
  allowDelete?: boolean;
};

const ANY_NODE_KIND = ['group', 'instance', 'transform'] as const;
const VISUAL_NODE_KIND = ['instance', 'transform'] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === 'string';
}

function isOptionalNonEmptyString(value: unknown): value is string | null | undefined {
  return value == null || (typeof value === 'string' && value.trim().length > 0);
}

function isOptionalBoolean(value: unknown): value is boolean | null | undefined {
  return value == null || typeof value === 'boolean';
}

function isVec3(value: unknown): value is Position3D {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.x) && isFiniteNumber(record.y) && isFiniteNumber(record.z);
}

function isScale(value: unknown): value is number | Scale3D {
  if (isFiniteNumber(value)) return value > 0;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.x) && record.x > 0
    && isFiniteNumber(record.y) && record.y > 0
    && isFiniteNumber(record.z) && record.z > 0;
}

function isColor(value: unknown): value is ColorRGB {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.r) && isFiniteNumber(record.g) && isFiniteNumber(record.b);
}

function isPositiveSize(value: unknown): value is { width: number; depth: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.width) && record.width > 0
    && isFiniteNumber(record.depth) && record.depth > 0;
}

function isTransform(value: unknown): value is TransformConfig {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.position !== undefined && !isVec3(record.position)) return false;
  if (record.rotation !== undefined && !isVec3(record.rotation)) return false;
  if (record.rotationDeg !== undefined && !isVec3(record.rotationDeg)) return false;
  if (record.scale !== undefined && !isScale(record.scale)) return false;
  return true;
}

function materialColorPath(path: string): SceneNodeFieldSchemaEntry {
  return { path, appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isColor(value) };
}

function materialNumberPath(path: string): SceneNodeFieldSchemaEntry {
  return { path, appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) };
}

export const SCENE_NODE_FIELD_SCHEMA: ReadonlyArray<SceneNodeFieldSchemaEntry> = [
  { path: 'name', appliesTo: ANY_NODE_KIND, validate: isOptionalString },
  { path: 'parentId', appliesTo: ANY_NODE_KIND, validate: isOptionalString },
  { path: 'enabled', appliesTo: ANY_NODE_KIND, validate: isOptionalBoolean },
  { path: 'transform', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isTransform(value) },
  { path: 'transform.position', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isVec3(value) },
  { path: 'transform.position.x', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.position.y', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.position.z', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotation', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isVec3(value) },
  { path: 'transform.rotation.x', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotation.y', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotation.z', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotationDeg', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isVec3(value) },
  { path: 'transform.rotationDeg.x', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotationDeg.y', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.rotationDeg.z', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'transform.scale', appliesTo: ANY_NODE_KIND, validate: (value) => value == null || isScale(value) },
  { path: 'instance.assetId', appliesTo: ['instance'], validate: (value) => typeof value === 'string' && value.trim().length > 0, allowDelete: false },
  { path: 'transformType', appliesTo: ['transform'], validate: (value) => value == null || value === 'plain' || value === 'light' || value === 'camera' || value === 'groundDecal' },
  { path: 'groundDecal.size', appliesTo: ['transform'], validate: (value) => value == null || isPositiveSize(value) },
  { path: 'groundDecal.size.width', appliesTo: ['transform'], validate: (value) => value == null || (isFiniteNumber(value) && value > 0), allowDelete: false },
  { path: 'groundDecal.size.depth', appliesTo: ['transform'], validate: (value) => value == null || (isFiniteNumber(value) && value > 0), allowDelete: false },
  { path: 'groundDecal.textureId', appliesTo: ['transform'], validate: isOptionalNonEmptyString },
  { path: 'groundDecal.color', appliesTo: ['transform'], validate: (value) => value == null || isColor(value) },
  { path: 'groundDecal.color.r', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
  { path: 'groundDecal.color.g', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
  { path: 'groundDecal.color.b', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
  { path: 'groundDecal.alphaIndex', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'groundDecal.diffuseTextureLevel', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value) },
  { path: 'groundDecal.emissiveTextureLevel', appliesTo: ['transform'], validate: (value) => value == null || isFiniteNumber(value) },
  materialColorPath('overrides.material.albedoColor'),
  materialColorPath('overrides.material.diffuseColor'),
  materialColorPath('overrides.material.emissiveColor'),
  materialNumberPath('overrides.material.metallic'),
  materialNumberPath('overrides.material.roughness'),
  materialNumberPath('overrides.material.alpha'),
  { path: 'overrides.material.backFaceCulling', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || typeof value === 'boolean' },
  { path: 'overrides.outline.renderOutline', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || typeof value === 'boolean' },
  materialNumberPath('overrides.outline.outlineWidth'),
  { path: 'overrides.outline.outlineColor', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isColor(value) },
  { path: 'overrides.outline.outlineColor.r', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
  { path: 'overrides.outline.outlineColor.g', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
  { path: 'overrides.outline.outlineColor.b', appliesTo: VISUAL_NODE_KIND, validate: (value) => value == null || isFiniteNumber(value), allowDelete: false },
];

export function resolveSceneNodeFieldSchema(path: string, nodeKind: SceneNodeConfig['kind']): SceneNodeFieldSchemaEntry | null {
  const entry = SCENE_NODE_FIELD_SCHEMA.find((item) => item.path === path) ?? null;
  if (!entry || !entry.appliesTo.includes(nodeKind)) return null;
  return entry;
}
