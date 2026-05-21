import type { MaterialProp, OutlineProp, PersistentBinding } from '@fps-games/editor-protocol';
import { createBrowserHost, type BrowserHost } from '@fps-games/editor-browser';
import { adaptMaterialPropertyChange, MATERIAL_CANONICAL_PATHS, resolveMaterialRuntimeKind } from './material-property-adapter';
import { adaptOutlinePropertyChange, OUTLINE_CANONICAL_PATHS, resolveOutlineTarget } from './outline-adapter';
import type {
  CanonicalMaterialChange,
  CanonicalOutlineChange,
  CanonicalTransformChange,
  RuntimeNode,
  RuntimeScene,
  RuntimeTransformSnapshot,
} from './types';

export type EditorRuntimeMonitorChange = {
  time: number;
  obj: RuntimeNode;
  binding: PersistentBinding | null;
  prop: string;
  old: unknown;
  new: unknown;
};

export interface EditorRuntimeMonitorOptions {
  host?: BrowserHost;
  getScene: () => RuntimeScene | null;
  getSelectedEntity: () => RuntimeNode | null;
  getSelectedEntities?: () => RuntimeNode[];
  resolveBinding: (node: RuntimeNode) => PersistentBinding | null;
  onSelectionChanged?: (node: RuntimeNode | null) => void;
  onDocumentChanged?: () => void;
  onChangesFlushed?: (changes: EditorRuntimeMonitorChange[]) => void;
  onTransformChange?: (change: CanonicalTransformChange) => boolean | void;
  onMaterialChange?: (change: CanonicalMaterialChange) => boolean | void;
  onOutlineChange?: (change: CanonicalOutlineChange) => boolean | void;
  onTransformBatchBegin?: () => void;
  onTransformBatchEnd?: () => void;
  debounceMs?: number;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

export interface EditorRuntimeMonitor {
  readonly isDragging: boolean;
  start(): void;
  stop(): void;
  reset(): void;
  flush(): void;
  rebase(nextNode?: RuntimeNode | null): void;
  recordCanonicalMaterialChange(change: CanonicalMaterialChange): void;
}

type PendingTransformChange = {
  start: RuntimeTransformSnapshot;
  latest: RuntimeTransformSnapshot;
};

const EPS = 1e-6;

function vecEq(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
  return Math.abs(a.x - b.x) < EPS
    && Math.abs(a.y - b.y) < EPS
    && Math.abs(a.z - b.z) < EPS;
}

function cloneVec3Like(source: any): { x: number; y: number; z: number } | null {
  if (!source || typeof source !== 'object') return null;
  const x = typeof source.x === 'number' ? source.x : null;
  const y = typeof source.y === 'number' ? source.y : null;
  const z = typeof source.z === 'number' ? source.z : null;
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function cloneColor3(value: any): { r: number; g: number; b: number } | null {
  if (!value || typeof value !== 'object') return null;
  const r = typeof value.r === 'number' ? value.r : typeof value._r === 'number' ? value._r : null;
  const g = typeof value.g === 'number' ? value.g : typeof value._g === 'number' ? value._g : null;
  const b = typeof value.b === 'number' ? value.b : typeof value._b === 'number' ? value._b : null;
  if (r == null || g == null || b == null) return null;
  return { r, g, b };
}

function readTextureUrl(value: any): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.url === 'string' && value.url.trim()) return value.url.trim();
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
  return null;
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function valueEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPS;
  if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function readRotation(node: any): { x: number; y: number; z: number } | null {
  const quat = node?.rotationQuaternion;
  if (quat && typeof quat.toEulerAngles === 'function') return cloneVec3Like(quat.toEulerAngles());
  return cloneVec3Like(node?.rotation);
}

function snapshotTransform(node: RuntimeNode | null): RuntimeTransformSnapshot | null {
  if (!node) return null;
  const position = cloneVec3Like((node as any).position);
  const rotation = readRotation(node as any);
  const scaling = cloneVec3Like((node as any).scaling);
  if (!position || !rotation || !scaling) return null;
  return { position, rotation, scaling };
}

function hasChanged(a: RuntimeTransformSnapshot, b: RuntimeTransformSnapshot): boolean {
  return !vecEq(a.position, b.position) || !vecEq(a.rotation, b.rotation) || !vecEq(a.scaling, b.scaling);
}

function cloneTransformSnapshot(value: RuntimeTransformSnapshot): RuntimeTransformSnapshot {
  return {
    position: { ...value.position },
    rotation: { ...value.rotation },
    scaling: { ...value.scaling },
  };
}

function hasTransform(node: any): boolean {
  return !!node?.position && (!!node?.rotation || !!node?.rotationQuaternion) && !!node?.scaling;
}

function resolveTrackedNode(scene: RuntimeScene | null, entity: any, previous: RuntimeNode | null): RuntimeNode | null {
  if (!entity) return null;
  if (hasTransform(entity)) return entity as RuntimeNode;
  if (previous && (previous as any).material === entity) return previous;
  const owner = (scene?.meshes || []).find((mesh: any) => mesh?.material === entity);
  if (owner && hasTransform(owner)) return owner as RuntimeNode;
  return previous ?? null;
}

function snapshotMaterial(node: RuntimeNode | null): Record<string, unknown> {
  const material = (node as any)?.material;
  if (!material || typeof material !== 'object') return {};

  const materialRuntimeKind = resolveMaterialRuntimeKind(material);
  const out: Record<string, unknown> = {};
  for (const fieldPath of MATERIAL_CANONICAL_PATHS) {
    switch (fieldPath) {
      case 'material.albedoColor':
      case 'material.emissiveColor': {
        if (materialRuntimeKind !== 'unknown') break;
        const key = fieldPath === 'material.albedoColor'
          ? ('albedoColor' in material ? 'albedoColor' : 'diffuseColor')
          : 'emissiveColor';
        const color = cloneColor3(material[key]);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'material.metallic':
      case 'material.roughness':
      case 'material.alpha': {
        const key = fieldPath.split('.')[1]!;
        const n = material[key];
        if (typeof n === 'number' && Number.isFinite(n)) out[fieldPath] = n;
        break;
      }
      case 'material.backFaceCulling': {
        const v = material.backFaceCulling;
        if (typeof v === 'boolean') out[fieldPath] = v;
        break;
      }
      case 'material.albedoTexture.url':
      case 'material.normalTexture.url':
      case 'material.metallicTexture.url': {
        const key = fieldPath.split('.')[1]!;
        out[fieldPath] = readTextureUrl(material[key]);
        break;
      }
      case 'material.pbr.albedoColor':
      case 'material.pbr.reflectivityColor':
      case 'material.pbr.emissiveColor':
      case 'material.pbr.ambientColor': {
        if (materialRuntimeKind !== 'pbr') break;
        const key = fieldPath.split('.')[2]!;
        const hidden = `_${key}`;
        const color = cloneColor3(material[hidden] ?? material[key]);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'material.pbr.baseWeight':
      case 'material.pbr.microSurface':
      case 'material.pbr.lightFalloff': {
        if (materialRuntimeKind !== 'pbr') break;
        const key = fieldPath.split('.')[2]!;
        const hidden = `_${key}`;
        const n = material[hidden] ?? material[key];
        if (typeof n === 'number' && Number.isFinite(n)) out[fieldPath] = n;
        break;
      }
      case 'material.standard.diffuseColor':
      case 'material.standard.specularColor':
      case 'material.standard.emissiveColor':
      case 'material.standard.ambientColor': {
        if (materialRuntimeKind !== 'standard') break;
        const key = fieldPath.split('.')[2]!;
        const hidden = `_${key}`;
        const color = cloneColor3(material[key] ?? material[hidden]);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'material.standard.specularPower': {
        if (materialRuntimeKind !== 'standard') break;
        const n = material.specularPower ?? material._specularPower;
        if (typeof n === 'number' && Number.isFinite(n)) out[fieldPath] = n;
        break;
      }
      case 'material.standard.useSpecularOverAlpha': {
        if (materialRuntimeKind !== 'standard') break;
        const v = material.useSpecularOverAlpha ?? material._useSpecularOverAlpha;
        if (typeof v === 'boolean') out[fieldPath] = v;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function snapshotOutline(node: RuntimeNode | null): Record<string, unknown> {
  const { target } = resolveOutlineTarget(node);
  const outlineTarget = target as any;
  if (!outlineTarget || typeof outlineTarget !== 'object') return {};

  const out: Record<string, unknown> = {};
  for (const fieldPath of OUTLINE_CANONICAL_PATHS) {
    switch (fieldPath) {
      case 'outline.renderOutline':
        out[fieldPath] = !!outlineTarget.renderOutline;
        break;
      case 'outline.outlineWidth':
        if (typeof outlineTarget.outlineWidth === 'number' && Number.isFinite(outlineTarget.outlineWidth)) {
          out[fieldPath] = outlineTarget.outlineWidth;
        }
        break;
      case 'outline.outlineColor': {
        const color = cloneColor3(outlineTarget.outlineColor);
        if (color) out[fieldPath] = color;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export function createEditorRuntimeMonitor(options: EditorRuntimeMonitorOptions): EditorRuntimeMonitor {
  const host = options.host ?? createBrowserHost();
  const debounceMs = options.debounceMs ?? 250;
  let enabled = false;
  let sceneObs: unknown = null;
  let selectedNode: RuntimeNode | null = null;
  let selectedNodes: RuntimeNode[] = [];
  let baseline: RuntimeTransformSnapshot | null = null;
  let materialBaseline: Record<string, unknown> = {};
  let outlineBaseline: Record<string, unknown> = {};
  let pendingByNode = new Map<RuntimeNode, PendingTransformChange>();
  let pendingMaterialByKey = new Map<string, CanonicalMaterialChange>();
  let pendingOutlineByKey = new Map<string, CanonicalOutlineChange>();
  let transformTimer: number | null = null;
  let materialTimer: number | null = null;
  let outlineTimer: number | null = null;
  let contextTimer: number | null = null;
  let contextBuffer: EditorRuntimeMonitorChange[] = [];
  let pointerActive = false;
  let hadDragDuringPointer = false;
  let hadMaterialChangeDuringPointer = false;
  let hadOutlineChangeDuringPointer = false;

  function log(message: string, data?: Record<string, unknown>): void {
    options.log?.(message, data);
  }

  function isSameNode(a: RuntimeNode | null | undefined, b: RuntimeNode | null | undefined): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const aId = (a as any).uniqueId;
    const bId = (b as any).uniqueId;
    return typeof aId === 'number' && typeof bId === 'number' && aId === bId;
  }

  function collectSelectedNodes(primary: RuntimeNode | null): RuntimeNode[] {
    const out: RuntimeNode[] = [];
    if (primary) out.push(primary);
    const fromOptions = options.getSelectedEntities?.() ?? [];
    for (const node of fromOptions) {
      if (!node || !hasTransform(node)) continue;
      if (out.some(item => isSameNode(item, node))) continue;
      out.push(node);
    }
    return out;
  }

  function upsertPendingNode(node: RuntimeNode, start: RuntimeTransformSnapshot, latest: RuntimeTransformSnapshot): void {
    const existing = pendingByNode.get(node);
    if (!existing) {
      pendingByNode.set(node, { start: cloneTransformSnapshot(start), latest: cloneTransformSnapshot(latest) });
      return;
    }
    existing.latest = cloneTransformSnapshot(latest);
  }

  function materialChangeKey(change: CanonicalMaterialChange): string {
    return [change.binding.kind, change.binding.nodeId, change.target, change.ownerNodePath, change.path].join('::');
  }

  function outlineChangeKey(change: CanonicalOutlineChange): string {
    return [change.binding.kind, change.binding.nodeId, change.target, change.ownerNodePath, change.path].join('::');
  }

  function upsertPendingMaterial(change: CanonicalMaterialChange): void {
    const key = materialChangeKey(change);
    const existing = pendingMaterialByKey.get(key);
    if (!existing) {
      pendingMaterialByKey.set(key, { ...change, before: cloneValue(change.before), after: cloneValue(change.after) });
      return;
    }
    existing.runtimeNode = change.runtimeNode;
    existing.binding = change.binding;
    existing.after = cloneValue(change.after);
  }

  function upsertPendingOutline(change: CanonicalOutlineChange): void {
    const key = outlineChangeKey(change);
    const existing = pendingOutlineByKey.get(key);
    if (!existing) {
      pendingOutlineByKey.set(key, { ...change, before: cloneValue(change.before), after: cloneValue(change.after) });
      return;
    }
    existing.runtimeNode = change.runtimeNode;
    existing.binding = change.binding;
    existing.after = cloneValue(change.after);
  }

  function pushContextChange(change: EditorRuntimeMonitorChange): void {
    if (valueEq(change.old, change.new)) return;
    contextBuffer.push({ ...change, old: cloneValue(change.old), new: cloneValue(change.new) });
    scheduleContextFlush();
  }

  function flushContextChanges(): void {
    if (!contextBuffer.length) {
      if (contextTimer) {
        host.clearTimeout(contextTimer);
        contextTimer = null;
      }
      return;
    }
    if (pendingMaterialByKey.size > 0 && !pointerActive) flushPendingMaterial();
    if (pendingOutlineByKey.size > 0 && !pointerActive) flushPendingOutline();
    const payload = contextBuffer;
    contextBuffer = [];
    if (contextTimer) {
      host.clearTimeout(contextTimer);
      contextTimer = null;
    }
    options.onChangesFlushed?.(payload);
  }

  function scheduleContextFlush(): void {
    if (contextTimer) host.clearTimeout(contextTimer);
    contextTimer = host.setTimeout(flushContextChanges, debounceMs);
  }

  function scheduleTransformFlush(): void {
    if (transformTimer) host.clearTimeout(transformTimer);
    transformTimer = host.setTimeout(flushPending, debounceMs);
  }

  function scheduleMaterialFlush(): void {
    if (materialTimer) host.clearTimeout(materialTimer);
    materialTimer = host.setTimeout(flushPendingMaterial, debounceMs);
  }

  function scheduleOutlineFlush(): void {
    if (outlineTimer) host.clearTimeout(outlineTimer);
    outlineTimer = host.setTimeout(flushPendingOutline, debounceMs);
  }

  function clearPending(): void {
    if (transformTimer) {
      host.clearTimeout(transformTimer);
      transformTimer = null;
    }
    pendingByNode.clear();
  }

  function clearPendingMaterial(): void {
    if (materialTimer) {
      host.clearTimeout(materialTimer);
      materialTimer = null;
    }
    pendingMaterialByKey.clear();
  }

  function clearPendingOutline(): void {
    if (outlineTimer) {
      host.clearTimeout(outlineTimer);
      outlineTimer = null;
    }
    pendingOutlineByKey.clear();
  }

  function applyDeltaToFollowers(previous: RuntimeTransformSnapshot, next: RuntimeTransformSnapshot): void {
    if (!selectedNode) return;
    const deltaPosition = {
      x: next.position.x - previous.position.x,
      y: next.position.y - previous.position.y,
      z: next.position.z - previous.position.z,
    };
    const deltaRotation = {
      x: next.rotation.x - previous.rotation.x,
      y: next.rotation.y - previous.rotation.y,
      z: next.rotation.z - previous.rotation.z,
    };
    const deltaScaling = {
      x: next.scaling.x - previous.scaling.x,
      y: next.scaling.y - previous.scaling.y,
      z: next.scaling.z - previous.scaling.z,
    };

    for (const node of selectedNodes) {
      if (isSameNode(node, selectedNode)) continue;
      const before = snapshotTransform(node);
      if (!before) continue;

      const position = (node as any).position;
      if (position?.addInPlaceFromFloats) position.addInPlaceFromFloats(deltaPosition.x, deltaPosition.y, deltaPosition.z);
      else if (position) {
        position.x += deltaPosition.x;
        position.y += deltaPosition.y;
        position.z += deltaPosition.z;
      }

      if ((node as any).rotationQuaternion) (node as any).rotationQuaternion = null;
      const rotation = (node as any).rotation;
      if (rotation?.addInPlaceFromFloats) rotation.addInPlaceFromFloats(deltaRotation.x, deltaRotation.y, deltaRotation.z);
      else if (rotation) {
        rotation.x += deltaRotation.x;
        rotation.y += deltaRotation.y;
        rotation.z += deltaRotation.z;
      }

      const scaling = (node as any).scaling;
      if (scaling?.addInPlaceFromFloats) scaling.addInPlaceFromFloats(deltaScaling.x, deltaScaling.y, deltaScaling.z);
      else if (scaling) {
        scaling.x += deltaScaling.x;
        scaling.y += deltaScaling.y;
        scaling.z += deltaScaling.z;
      }

      const after = snapshotTransform(node);
      if (!after) continue;
      upsertPendingNode(node, before, after);
    }
  }

  function flushPending(): void {
    if (!pendingByNode.size) {
      clearPending();
      return;
    }
    const pendingCount = pendingByNode.size;
    log('flush transform pending', { pendingCount });
    const timestamp = Date.now();
    let changed = false;
    options.onTransformBatchBegin?.();
    try {
      for (const [node, value] of pendingByNode.entries()) {
        const binding = options.resolveBinding(node);
        const { start, latest } = value;
        for (const prop of ['position', 'rotation', 'scaling'] as const) {
          if (vecEq(start[prop], latest[prop])) continue;
          const change: CanonicalTransformChange = {
            runtimeNode: node,
            binding,
            prop,
            before: start[prop],
            after: latest[prop],
          };
          pushContextChange({ time: timestamp, obj: node, binding, prop, old: start[prop], new: latest[prop] });
          changed = options.onTransformChange?.(change) === true || changed;
        }
      }
    } finally {
      options.onTransformBatchEnd?.();
    }

    clearPending();
    log('flush transform completed', { pendingCount, changed });
    if (changed) options.onDocumentChanged?.();
  }

  function flushPendingMaterial(): void {
    if (!pendingMaterialByKey.size) {
      clearPendingMaterial();
      return;
    }
    const pendingCount = pendingMaterialByKey.size;
    log('flush material pending', { pendingCount });
    let changed = false;
    for (const change of pendingMaterialByKey.values()) {
      changed = options.onMaterialChange?.(change) === true || changed;
    }
    clearPendingMaterial();
    log('flush material completed', { pendingCount, changed });
    if (changed) options.onDocumentChanged?.();
  }

  function flushPendingOutline(): void {
    if (!pendingOutlineByKey.size) {
      clearPendingOutline();
      return;
    }
    const pendingCount = pendingOutlineByKey.size;
    log('flush outline pending', { pendingCount });
    let changed = false;
    for (const change of pendingOutlineByKey.values()) {
      changed = options.onOutlineChange?.(change) === true || changed;
    }
    clearPendingOutline();
    log('flush outline completed', { pendingCount, changed });
    if (changed) options.onDocumentChanged?.();
  }

  function queuePending(next: RuntimeTransformSnapshot): void {
    if (!selectedNode) return;
    const existing = pendingByNode.get(selectedNode);
    const start = existing?.start ?? baseline ?? next;
    upsertPendingNode(selectedNode, start, next);
    if (pointerActive) {
      hadDragDuringPointer = true;
      if (transformTimer) {
        host.clearTimeout(transformTimer);
        transformTimer = null;
      }
      return;
    }
    scheduleTransformFlush();
  }

  function syncSelection(nextNode: RuntimeNode | null): void {
    const scene = options.getScene();
    const resolvedNode = resolveTrackedNode(scene, nextNode, selectedNode);
    if (resolvedNode === selectedNode) return;
    flushPending();
    flushPendingMaterial();
    flushPendingOutline();
    flushContextChanges();
    selectedNode = resolvedNode;
    selectedNodes = collectSelectedNodes(selectedNode);
    baseline = snapshotTransform(selectedNode);
    materialBaseline = snapshotMaterial(selectedNode);
    outlineBaseline = snapshotOutline(selectedNode);
    options.onSelectionChanged?.(selectedNode);
  }

  function rebaseSelection(nextNode?: RuntimeNode | null): void {
    if (nextNode !== undefined) selectedNode = nextNode;
    selectedNodes = collectSelectedNodes(selectedNode);
    clearPending();
    clearPendingMaterial();
    clearPendingOutline();
    baseline = snapshotTransform(selectedNode);
    materialBaseline = snapshotMaterial(selectedNode);
    outlineBaseline = snapshotOutline(selectedNode);
  }

  function checkMaterial(): void {
    if (!selectedNode) return;
    const next = snapshotMaterial(selectedNode);
    const allPaths = new Set<string>([...Object.keys(materialBaseline), ...Object.keys(next)]);
    const binding = options.resolveBinding(selectedNode);
    let recorded = false;
    for (const path of allPaths) {
      const oldValue = materialBaseline[path];
      const newValue = next[path];
      if (valueEq(oldValue, newValue)) continue;
      pushContextChange({ time: Date.now(), obj: selectedNode, binding, prop: path, old: oldValue, new: newValue });
      if (binding) {
        const materialChange = adaptMaterialPropertyChange({
          scene: options.getScene(),
          selectedEntity: selectedNode,
          entity: selectedNode,
          propertyKey: path as MaterialProp,
          oldValue,
          newValue,
          resolveBinding: node => options.resolveBinding(node),
        });
        if (materialChange) {
          upsertPendingMaterial(materialChange);
          recorded = true;
        }
      }
    }
    materialBaseline = next;
    if (!recorded) return;
    if (pointerActive) {
      hadMaterialChangeDuringPointer = true;
      if (materialTimer) {
        host.clearTimeout(materialTimer);
        materialTimer = null;
      }
      return;
    }
    scheduleMaterialFlush();
  }

  function recordCanonicalMaterialChange(change: CanonicalMaterialChange): void {
    upsertPendingMaterial(change);
    if (selectedNode && isSameNode(selectedNode, change.runtimeNode)) materialBaseline[change.path] = cloneValue(change.after);
    pushContextChange({
      time: Date.now(),
      obj: change.runtimeNode,
      binding: change.binding,
      prop: change.path,
      old: change.before,
      new: change.after,
    });
    if (pointerActive) {
      hadMaterialChangeDuringPointer = true;
      if (materialTimer) {
        host.clearTimeout(materialTimer);
        materialTimer = null;
      }
      if (contextTimer) {
        host.clearTimeout(contextTimer);
        contextTimer = null;
      }
      return;
    }
    scheduleMaterialFlush();
  }

  function checkOutline(): void {
    if (!selectedNode) return;
    const next = snapshotOutline(selectedNode);
    const allPaths = new Set<string>([...Object.keys(outlineBaseline), ...Object.keys(next)]);
    const binding = options.resolveBinding(selectedNode);
    let recorded = false;
    for (const path of allPaths) {
      const oldValue = outlineBaseline[path];
      const newValue = next[path];
      if (valueEq(oldValue, newValue)) continue;
      pushContextChange({ time: Date.now(), obj: selectedNode, binding, prop: path, old: oldValue, new: newValue });
      if (binding) {
        const outlineChange = adaptOutlinePropertyChange({
          selectedEntity: selectedNode,
          propertyKey: path as OutlineProp,
          oldValue,
          newValue,
          resolveBinding: node => options.resolveBinding(node),
        });
        if (outlineChange) {
          upsertPendingOutline(outlineChange);
          recorded = true;
        }
      }
    }
    outlineBaseline = next;
    if (!recorded) return;
    if (pointerActive) {
      hadOutlineChangeDuringPointer = true;
      if (outlineTimer) {
        host.clearTimeout(outlineTimer);
        outlineTimer = null;
      }
      return;
    }
    scheduleOutlineFlush();
  }

  function tick(): void {
    const rawEntity = options.getSelectedEntity();
    const resolvedNode = resolveTrackedNode(options.getScene(), rawEntity, selectedNode);
    if (resolvedNode !== selectedNode) syncSelection(rawEntity);
    if (!selectedNode) return;
    selectedNodes = collectSelectedNodes(selectedNode);
    const next = snapshotTransform(selectedNode);
    if (next && baseline) {
      if (!hasChanged(baseline, next)) {
        if (pendingByNode.size > 0 && !pointerActive && !transformTimer) scheduleTransformFlush();
      } else {
        const previous = baseline;
        queuePending(next);
        applyDeltaToFollowers(previous, next);
        baseline = next;
      }
    } else if (next && !baseline) {
      baseline = next;
    }
    checkMaterial();
    checkOutline();
  }

  function onPointerDown(): void {
    if (!enabled) return;
    pointerActive = true;
    hadDragDuringPointer = false;
    hadMaterialChangeDuringPointer = false;
    hadOutlineChangeDuringPointer = false;
  }

  function onPointerUp(): void {
    if (!enabled) return;
    pointerActive = false;
    if (hadDragDuringPointer) flushPending();
    if (hadMaterialChangeDuringPointer) flushPendingMaterial();
    if (hadOutlineChangeDuringPointer) flushPendingOutline();
    flushContextChanges();
    hadDragDuringPointer = false;
    hadMaterialChangeDuringPointer = false;
    hadOutlineChangeDuringPointer = false;
  }

  return {
    get isDragging(): boolean {
      return pointerActive || pendingByNode.size > 0;
    },

    start(): void {
      if (enabled) return;
      const scene = options.getScene();
      if (!scene) return;
      syncSelection(options.getSelectedEntity());
      sceneObs = scene.onAfterRenderObservable?.add?.(() => tick()) ?? null;
      host.window.addEventListener('pointerdown', onPointerDown, true);
      host.window.addEventListener('pointerup', onPointerUp, true);
      enabled = true;
    },

    stop(): void {
      if (!enabled) return;
      flushPending();
      flushPendingMaterial();
      flushPendingOutline();
      flushContextChanges();
      const scene = options.getScene();
      if (sceneObs) {
        scene?.onAfterRenderObservable?.remove?.(sceneObs);
        sceneObs = null;
      }
      host.window.removeEventListener('pointerdown', onPointerDown, true);
      host.window.removeEventListener('pointerup', onPointerUp, true);
      pointerActive = false;
      hadDragDuringPointer = false;
      hadMaterialChangeDuringPointer = false;
      hadOutlineChangeDuringPointer = false;
      enabled = false;
    },

    reset(): void {
      this.stop();
      selectedNode = null;
      baseline = null;
      materialBaseline = {};
      outlineBaseline = {};
      contextBuffer = [];
      if (contextTimer) {
        host.clearTimeout(contextTimer);
        contextTimer = null;
      }
      clearPending();
      clearPendingMaterial();
      clearPendingOutline();
    },

    flush(): void {
      log('flush requested', {
        transformPending: pendingByNode.size,
        materialPending: pendingMaterialByKey.size,
        outlinePending: pendingOutlineByKey.size,
        contextPending: contextBuffer.length,
      });
      flushPending();
      flushPendingMaterial();
      flushPendingOutline();
      flushContextChanges();
      log('flush completed', {
        transformPending: pendingByNode.size,
        materialPending: pendingMaterialByKey.size,
        outlinePending: pendingOutlineByKey.size,
        contextPending: contextBuffer.length,
      });
    },

    rebase(nextNode?: RuntimeNode | null): void {
      rebaseSelection(nextNode);
    },

    recordCanonicalMaterialChange(change: CanonicalMaterialChange): void {
      recordCanonicalMaterialChange(change);
    },
  };
}
