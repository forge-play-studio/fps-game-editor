import type { OutlineProp, OutlineValue, PersistentBinding } from '@fps-games/editor-protocol';
import { getBabylonRuntime } from './runtime-globals';
import type { BabylonRuntimeGlobal, CanonicalOutlineChange, RuntimeNode } from './types';

export const OUTLINE_PROPERTY_KEYS = [
  'renderOutline',
  'outlineColor',
  'outlineWidth',
] as const;

export type OutlinePropertyKey = (typeof OUTLINE_PROPERTY_KEYS)[number];

export type OutlineTargetState = {
  target: unknown | null;
  shared: boolean;
};

export const OUTLINE_CANONICAL_PATHS = [
  'outline.renderOutline',
  'outline.outlineWidth',
  'outline.outlineColor',
] as const satisfies readonly OutlineProp[];

type OutlinePropertyChangeArgs = {
  entity: unknown;
  property: OutlinePropertyKey;
  value: unknown;
  initialValue?: unknown;
};

type AdaptOutlinePropertyChangeOptions = {
  selectedEntity: RuntimeNode | null;
  propertyKey: unknown;
  oldValue: unknown;
  newValue: unknown;
  resolveBinding: (node: RuntimeNode) => PersistentBinding | null;
};

type ApplyOutlineRuntimeOptions = {
  babylon?: BabylonRuntimeGlobal | null;
};

const SKIP = Symbol('outline-property-skip');

function getNodeClassName(node: any): string {
  return node?.getClassName?.() || node?.constructor?.name || '';
}
function hasRenderableVertices(node: any): boolean {
  if (!node || typeof node.getTotalVertices !== 'function') return false;
  const count = node.getTotalVertices();
  return typeof count === 'number' && Number.isFinite(count) && count > 0;
}

function restoreOriginalOutlineValue(entity: any, property: OutlinePropertyKey, initialValue: unknown): void {
  if (!entity) return;
  try {
    if (
      getNodeClassName(entity) === 'InstancedMesh'
      && (property === 'renderOutline' || property === 'outlineColor' || property === 'outlineWidth')
    ) {
      Reflect.deleteProperty(entity, property);
      return;
    }
    if (initialValue === undefined) {
      if (Object.prototype.hasOwnProperty.call(entity, property)) Reflect.deleteProperty(entity, property);
      else entity[property] = undefined;
      return;
    }
    entity[property] = initialValue;
  } catch {}
}

export function isOutlinePropertyKey(value: string): value is OutlinePropertyKey {
  return (OUTLINE_PROPERTY_KEYS as readonly string[]).includes(value);
}

export function normalizeInstancedMeshOutlineProperties(entity: unknown): void {
  if (getNodeClassName(entity) !== 'InstancedMesh') return;
  for (const property of ['outlineColor', 'outlineWidth'] as const) {
    if (!Object.prototype.hasOwnProperty.call(entity, property)) continue;
    try { Reflect.deleteProperty(entity as object, property); } catch {}
  }
}

export function resolveOutlineTarget(entity: unknown): OutlineTargetState {
  const node = entity as any;
  if (!node) return { target: null, shared: false };

  const className = getNodeClassName(node);
  if (className === 'InstancedMesh') {
    normalizeInstancedMeshOutlineProperties(node);
    return { target: node.sourceMesh ?? null, shared: true };
  }

  if (className === 'Mesh' && hasRenderableVertices(node)) return { target: node, shared: false };

  const children = typeof node.getChildMeshes === 'function' ? node.getChildMeshes(false) : [];
  for (const child of children) {
    const childClassName = getNodeClassName(child);
    if (childClassName === 'InstancedMesh') {
      normalizeInstancedMeshOutlineProperties(child);
      return { target: child.sourceMesh ?? null, shared: true };
    }
    if (childClassName === 'Mesh' && hasRenderableVertices(child)) return { target: child, shared: false };
  }

  if (className === 'Mesh') return { target: node, shared: false };
  return { target: null, shared: false };
}

function stableNodeSegment(node: any): string | null {
  const candidates = [node?.name, node?.id];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function buildOwnerNodePath(ownerNode: RuntimeNode, rootNode: RuntimeNode): string | null {
  if (ownerNode === rootNode) return '';
  const segments: string[] = [];
  let current: any = ownerNode;
  while (current && current !== rootNode) {
    const segment = stableNodeSegment(current);
    if (!segment) return null;
    segments.push(segment);
    current = current.parent ?? null;
  }
  if (current !== rootNode) return null;
  return segments.reverse().join('/');
}

export function resolveOutlineOwnerNode(rootNode: RuntimeNode | null): {
  ownerNode: RuntimeNode | null;
  shared: boolean;
} {
  if (!rootNode) return { ownerNode: null, shared: false };

  const className = getNodeClassName(rootNode);
  if (className === 'InstancedMesh') {
    normalizeInstancedMeshOutlineProperties(rootNode);
    return { ownerNode: rootNode, shared: true };
  }
  if (className === 'Mesh' && hasRenderableVertices(rootNode)) return { ownerNode: rootNode, shared: false };

  const children = typeof (rootNode as any).getChildMeshes === 'function'
    ? (rootNode as any).getChildMeshes(false)
    : [];
  for (const child of children) {
    const childClassName = getNodeClassName(child);
    if (childClassName === 'InstancedMesh') {
      normalizeInstancedMeshOutlineProperties(child);
      return { ownerNode: child, shared: true };
    }
    if (childClassName === 'Mesh' && hasRenderableVertices(child)) return { ownerNode: child, shared: false };
  }

  if (className === 'Mesh') return { ownerNode: rootNode, shared: false };
  return { ownerNode: null, shared: false };
}

function normalizeOutlinePropertyKey(propertyKey: unknown): OutlineProp | null {
  if (typeof propertyKey !== 'string') return null;
  const trimmed = propertyKey.trim();
  if (!trimmed) return null;
  if ((OUTLINE_CANONICAL_PATHS as readonly string[]).includes(trimmed)) return trimmed as OutlineProp;
  if (trimmed === 'renderOutline') return 'outline.renderOutline';
  if (trimmed === 'outlineWidth') return 'outline.outlineWidth';
  if (trimmed === 'outlineColor') return 'outline.outlineColor';
  return null;
}

function normalizeColor3(value: unknown): OutlineValue | typeof SKIP {
  if (value == null) return null;
  if (!value || typeof value !== 'object') return SKIP;
  const source = value as { r?: unknown; g?: unknown; b?: unknown; _r?: unknown; _g?: unknown; _b?: unknown };
  const r = typeof source.r === 'number' ? source.r : typeof source._r === 'number' ? source._r : null;
  const g = typeof source.g === 'number' ? source.g : typeof source._g === 'number' ? source._g : null;
  const b = typeof source.b === 'number' ? source.b : typeof source._b === 'number' ? source._b : null;
  if (r == null || g == null || b == null) return SKIP;
  return { r, g, b };
}

function normalizeOutlineValue(path: OutlineProp, value: unknown): OutlineValue | typeof SKIP {
  switch (path) {
    case 'outline.renderOutline':
      return typeof value === 'boolean' ? value : SKIP;
    case 'outline.outlineWidth':
      if (value == null) return null;
      return typeof value === 'number' && Number.isFinite(value) ? value : SKIP;
    case 'outline.outlineColor':
      return normalizeColor3(value);
    default:
      return SKIP;
  }
}

export function adaptOutlinePropertyChange(options: AdaptOutlinePropertyChangeOptions): CanonicalOutlineChange | null {
  const path = normalizeOutlinePropertyKey(options.propertyKey);
  if (!path) return null;
  const selectedEntity = options.selectedEntity;
  if (!selectedEntity) return null;

  const binding = options.resolveBinding(selectedEntity);
  if (!binding || binding.kind !== 'sceneNode') return null;
  const rootNode = binding.rootNode ?? selectedEntity;
  const owner = resolveOutlineOwnerNode(rootNode);
  if (!owner.ownerNode) return null;

  const ownerNodePath = buildOwnerNodePath(owner.ownerNode, rootNode);
  if (ownerNodePath == null) return null;

  const before = normalizeOutlineValue(path, options.oldValue);
  const after = normalizeOutlineValue(path, options.newValue);
  if (before === SKIP || after === SKIP) return null;
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return null;

  return {
    runtimeNode: owner.ownerNode,
    binding,
    ownerNodePath,
    target: ownerNodePath ? 'childOutline' : 'root',
    shared: owner.shared,
    path,
    before,
    after,
  };
}

export function applyOutlineValueToRuntimeNode(
  entity: RuntimeNode | null,
  path: OutlineProp,
  value: OutlineValue,
  options: ApplyOutlineRuntimeOptions = {},
): boolean {
  const { target } = resolveOutlineTarget(entity);
  const writableTarget = target as any;
  if (!writableTarget) return false;

  switch (path) {
    case 'outline.renderOutline':
      if (typeof value !== 'boolean') return false;
      writableTarget.renderOutline = value;
      return true;
    case 'outline.outlineWidth':
      if (value == null) {
        Reflect.deleteProperty(writableTarget, 'outlineWidth');
        return true;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      writableTarget.outlineWidth = value;
      return true;
    case 'outline.outlineColor': {
      if (value == null) {
        Reflect.deleteProperty(writableTarget, 'outlineColor');
        return true;
      }
      if (!value || typeof value !== 'object') return false;
      const color = value as { r: number; g: number; b: number };
      const current = writableTarget.outlineColor;
      if (current?.copyFromFloats) {
        current.copyFromFloats(color.r, color.g, color.b);
      } else {
        const Color3 = getBabylonRuntime(options.babylon)?.Color3;
        writableTarget.outlineColor = Color3 ? new Color3(color.r, color.g, color.b) : { r: color.r, g: color.g, b: color.b };
      }
      return true;
    }
    default:
      return false;
  }
}

export function applyOutlinePropertyChange(args: OutlinePropertyChangeArgs): OutlineTargetState {
  const { entity, property, value, initialValue } = args;
  const resolved = resolveOutlineTarget(entity);
  const target = resolved.target as any;
  if (!target) return resolved;

  try { target[property] = value; } catch {}
  if (target !== entity) restoreOriginalOutlineValue(entity, property, initialValue);

  return resolved;
}
