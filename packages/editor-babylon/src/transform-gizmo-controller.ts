import type {
  EditorPlacementHit,
  EditorPlacementMode,
  EditorTransformOperationSettings,
  EditorTransformCanonicalConstraint,
  EditorSelectionState,
  EditorTransformBatchCommit,
  EditorTransformConstraint,
  EditorTransformGizmoCommit,
  EditorTransformGizmoState,
  EditorTransformPivot,
  EditorTransformSnapshot,
  EditorTransformSpace,
  EditorTransformTargetSnapshot,
  EditorTransformTool,
  EditorTransformVec3,
} from '@fps-games/editor-core';
import {
  DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
  normalizeEditorTransformConstraint,
  snapEditorTransformSnapshot,
} from '@fps-games/editor-core';
import type {
  BabylonRuntimeGlobal,
  RuntimeScene,
} from './types';
import type { BabylonEditorProjection } from './projection';

export interface BabylonTransformGizmoDragEvent {
  nodeId: string | null;
  targetIds: string[];
  activeId: string | null;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  pivot: EditorTransformPivot;
  before: EditorTransformSnapshot | null;
  beforeTransforms: Record<string, EditorTransformSnapshot>;
  duplicate: boolean;
}

export type BabylonTransformGizmoCommit = EditorTransformGizmoCommit | EditorTransformBatchCommit;

export interface BabylonTransformGizmoDuplicateDragInput {
  targetIds: string[];
  activeId: string | null;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  beforeTransforms: Record<string, EditorTransformSnapshot>;
}

export interface BabylonTransformGizmoDuplicateDragResult {
  targetIds: string[];
  activeId?: string | null;
}

export type BabylonTransformGizmoHandleKey =
  | 'xGizmo'
  | 'yGizmo'
  | 'zGizmo'
  | 'xPlaneGizmo'
  | 'yPlaneGizmo'
  | 'zPlaneGizmo'
  | 'uniformScaleGizmo';

export function resolveBabylonTransformHandleConstraint(
  tool: Exclude<EditorTransformTool, 'select'>,
  handleKey: BabylonTransformGizmoHandleKey,
): EditorTransformCanonicalConstraint | null {
  if (tool === 'move') {
    if (handleKey === 'xPlaneGizmo' || handleKey === 'yPlaneGizmo' || handleKey === 'zPlaneGizmo') return 'plane';
    if (handleKey === 'xGizmo' || handleKey === 'yGizmo' || handleKey === 'zGizmo') return 'axis';
    return null;
  }
  if (tool === 'rotate') {
    return handleKey === 'xGizmo' || handleKey === 'yGizmo' || handleKey === 'zGizmo' ? 'axis' : null;
  }
  if (tool === 'scale') {
    if (handleKey === 'uniformScaleGizmo') return 'uniform';
    return handleKey === 'xGizmo' || handleKey === 'yGizmo' || handleKey === 'zGizmo' ? 'axis' : null;
  }
  return null;
}

export interface BabylonTransformGizmoControllerOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
  projection: BabylonEditorProjection;
  initialTool?: EditorTransformTool;
  initialSpace?: EditorTransformSpace;
  onDragStart?: (event: BabylonTransformGizmoDragEvent) => void;
  onDragUpdate?: (event: BabylonTransformGizmoDragEvent & { current: EditorTransformSnapshot }) => void;
  onDragEnd?: (event: BabylonTransformGizmoCommit) => void;
  onDragCancel?: (event: BabylonTransformGizmoDragEvent) => void;
  onDuplicateDragStart?: (input: BabylonTransformGizmoDuplicateDragInput) => BabylonTransformGizmoDuplicateDragResult | null;
  logger?: Pick<Console, 'warn'>;
}

export interface BabylonTransformGizmoController {
  getState(): EditorTransformGizmoState;
  setTool(tool: EditorTransformTool): void;
  setSpace(space: EditorTransformSpace): void;
  setConstraint(constraint: EditorTransformConstraint): void;
  setOperationSettings(settings: EditorTransformOperationSettings): void;
  preparePointerDrag(event: PointerEvent): void;
  setSelectedNode(nodeId: string | null): void;
  setSelection(selection: EditorSelectionState): void;
  refreshSelection(): void;
  isGizmoDragCandidate(event: PointerEvent): boolean;
  isViewPlaneMoveCandidate(event: PointerEvent): boolean;
  beginViewPlaneMove(event: PointerEvent): boolean;
  updateViewPlaneMove(event: PointerEvent): boolean;
  endViewPlaneMove(event: PointerEvent): boolean;
  pickPlacementHit(clientX: number, clientY: number, mode: EditorPlacementMode): EditorPlacementHit | null;
  setPlacementMarker(hit: EditorPlacementHit | null): void;
  cancelDrag(): void;
  dispose(): void;
}

interface ActiveDrag {
  nodeId: string | null;
  targetIds: string[];
  activeId: string | null;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  pivot: EditorTransformPivot;
  before: EditorTransformSnapshot | null;
  beforeTransforms: Record<string, EditorTransformSnapshot>;
  duplicate: boolean;
  proxyStart?: EditorTransformSnapshot;
  viewPlane?: {
    pointerId: number;
    startPoint: EditorTransformVec3;
  };
}

type ObserverDisposer = () => void;

export function createBabylonTransformGizmoController(
  options: BabylonTransformGizmoControllerOptions,
): BabylonTransformGizmoController {
  const GizmoManager = options.babylon.GizmoManager;
  if (!GizmoManager) throw new Error('Babylon runtime missing GizmoManager');

  const manager = new GizmoManager(options.scene);
  manager.usePointerToAttachGizmos = false;
  manager.clearGizmoOnEmptyPointerEvent = false;
  manager.boundingBoxGizmoEnabled = false;

  let tool: EditorTransformTool = options.initialTool ?? 'select';
  let space: EditorTransformSpace = options.initialSpace ?? 'world';
  let constraint: EditorTransformCanonicalConstraint = normalizeConstraintForTool(tool, 'axis') ?? 'axis';
  let selectedNodeId: string | null = null;
  let selectedNodeIds: string[] = [];
  let activeDrag: ActiveDrag | null = null;
  let disposed = false;
  let operationSettings = cloneOperationSettings(DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS);
  let pendingDuplicateDrag = false;
  let observerDisposers: ObserverDisposer[] = [];
  let pivotProxy: any | null = null;
  let freeMoveHandle: any | null = null;
  let freeMoveHandleMaterial: any | null = null;
  let placementMarker: any | null = null;
  let placementMarkerMaterial: any | null = null;
  const canvas = options.scene.getEngine?.().getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;

  function activeTransformTool(): Exclude<EditorTransformTool, 'select'> | null {
    return tool === 'select' ? null : tool;
  }

  function getActiveTargetId(): string | null {
    if (selectedNodeId && selectedNodeIds.includes(selectedNodeId)) return selectedNodeId;
    return selectedNodeIds[selectedNodeIds.length - 1] ?? null;
  }

  function getBatchTransformTargetIds(): string[] {
    if ((tool === 'select' || tool == null) || selectedNodeIds.length <= 1) return [];
    return selectedNodeIds.filter(nodeId => !!options.projection.getAttachableRoot(nodeId));
  }

  function getCurrentTransformTargetIds(): string[] {
    return selectedNodeIds.length > 1
      ? getBatchTransformTargetIds()
      : [getActiveTargetId()].filter((nodeId): nodeId is string => !!nodeId);
  }

  function normalizeConstraintForTool(
    nextTool: EditorTransformTool,
    nextConstraint?: EditorTransformConstraint | null,
  ): EditorTransformCanonicalConstraint | undefined {
    return normalizeEditorTransformConstraint(nextTool, nextConstraint);
  }

  function ensurePivotProxy(): any | null {
    if (pivotProxy) return pivotProxy;
    const TransformNode = (options.babylon as any).TransformNode;
    if (!TransformNode) return null;
    pivotProxy = new TransformNode('editor.selectionPivotProxy', options.scene);
    pivotProxy.metadata = {
      ...(pivotProxy.metadata ?? {}),
      editorProjectionHelper: true,
    };
    return pivotProxy;
  }

  function setPivotProxyTransform(
    pivot: EditorTransformPivot,
    rotation: EditorTransformVec3 = { x: 0, y: 0, z: 0 },
  ): any | null {
    const proxy = ensurePivotProxy();
    const Vector3 = options.babylon.Vector3;
    if (!proxy || !Vector3) return null;
    proxy.position = new Vector3(pivot.position.x, pivot.position.y, pivot.position.z);
    proxy.rotation = new Vector3(rotation.x, rotation.y, rotation.z);
    proxy.scaling = new Vector3(1, 1, 1);
    return proxy;
  }

  function clearDragObservers(): void {
    for (const dispose of observerDisposers) dispose();
    observerDisposers = [];
  }

  function addObserver(observable: any, callback: () => void): void {
    if (!observable?.add || !observable?.remove) return;
    const observer = observable.add(callback);
    observerDisposers.push(() => {
      try { observable.remove(observer); } catch {}
    });
  }

  function registerDragObserversFor(
    activeTool: Exclude<EditorTransformTool, 'select'>,
    gizmo: any,
  ): void {
    const handleKeys: BabylonTransformGizmoHandleKey[] = [
      'xGizmo',
      'yGizmo',
      'zGizmo',
      'uniformScaleGizmo',
      'xPlaneGizmo',
      'yPlaneGizmo',
      'zPlaneGizmo',
    ];
    for (const handleKey of handleKeys) {
      const activeConstraint = resolveBabylonTransformHandleConstraint(activeTool, handleKey);
      if (!activeConstraint) continue;
      const behavior = gizmo?.[handleKey]?.dragBehavior;
      addObserver(behavior?.onDragStartObservable, () => beginDrag(activeConstraint));
      addObserver(behavior?.onDragObservable, updateDrag);
      addObserver(behavior?.onDragEndObservable, endDrag);
    }
  }

  function registerDragObservers(): void {
    clearDragObservers();
    registerDragObserversFor('move', manager.gizmos?.positionGizmo);
    registerDragObserversFor('rotate', manager.gizmos?.rotationGizmo);
    registerDragObserversFor('scale', manager.gizmos?.scaleGizmo);
  }

  function applySpacePreference(): void {
    const matchAttachedMesh = space === 'local';
    const gizmos = [
      manager.gizmos?.positionGizmo,
      manager.gizmos?.rotationGizmo,
      manager.gizmos?.scaleGizmo,
    ];
    for (const gizmo of gizmos) {
      try {
        if ('updateGizmoRotationToMatchAttachedMesh' in (gizmo ?? {})) {
          gizmo.updateGizmoRotationToMatchAttachedMesh = matchAttachedMesh;
        }
      } catch {}
      for (const axis of [
        gizmo?.xGizmo,
        gizmo?.yGizmo,
        gizmo?.zGizmo,
        gizmo?.xPlaneGizmo,
        gizmo?.yPlaneGizmo,
        gizmo?.zPlaneGizmo,
        gizmo?.uniformScaleGizmo,
      ]) {
        try {
          if ('updateGizmoRotationToMatchAttachedMesh' in (axis ?? {})) {
            axis.updateGizmoRotationToMatchAttachedMesh = matchAttachedMesh;
          }
        } catch {}
      }
    }
  }

  function applyHandlePreference(): void {
    const positionGizmo = manager.gizmos?.positionGizmo;
    if (positionGizmo) {
      try { positionGizmo.planarGizmoEnabled = tool === 'move'; } catch {}
    }
  }

  function attachCurrentSelection(): void {
    const activeTool = activeTransformTool();
    manager.positionGizmoEnabled = activeTool === 'move';
    manager.rotationGizmoEnabled = activeTool === 'rotate';
    manager.scaleGizmoEnabled = activeTool === 'scale';
    applyHandlePreference();
    applySpacePreference();
    registerDragObservers();

    let target: any | null = null;
    if (activeTool) {
      target = attachNativeTransformProxy(getCurrentTransformTargetIds());
    }
    try { manager.attachToNode?.(target ?? null); } catch (error) {
      options.logger?.warn?.('[BabylonTransformGizmoController] failed to attach gizmo', error);
    }
    updateFreeMoveHandle();
  }

  function beginDrag(activeConstraint: EditorTransformCanonicalConstraint = constraint): void {
    if (activeDrag) return;
    const activeTool = activeTransformTool();
    if (!activeTool) return;
    const duplicate = pendingDuplicateDrag;
    pendingDuplicateDrag = false;
    const targetIds = resolveDragTargetIds(activeTool, getCurrentTransformTargetIds(), activeConstraint, duplicate);
    const drag = createActiveDrag(activeTool, targetIds, activeConstraint, duplicate);
    if (!drag) return;
    activeDrag = drag;
    options.onDragStart?.(activeDrag);
  }

  function resolveDragTargetIds(
    activeTool: Exclude<EditorTransformTool, 'select'>,
    targetIds: string[],
    activeConstraint: EditorTransformCanonicalConstraint,
    duplicate: boolean,
  ): string[] {
    if (!duplicate || targetIds.length === 0) return targetIds;
    const beforeTransforms = options.projection.readNodeTransforms(targetIds);
    const validTargetIds = targetIds.filter(nodeId => !!beforeTransforms[nodeId]);
    if (validTargetIds.length === 0) return [];
    const duplicateResult = options.onDuplicateDragStart?.({
      targetIds: validTargetIds,
      activeId: selectedNodeId && validTargetIds.includes(selectedNodeId) ? selectedNodeId : validTargetIds[validTargetIds.length - 1] ?? null,
      tool: activeTool,
      space,
      constraint: activeConstraint,
      beforeTransforms,
    });
    if (!duplicateResult?.targetIds.length) return [];
    selectedNodeIds = [...duplicateResult.targetIds];
    selectedNodeId = duplicateResult.activeId && selectedNodeIds.includes(duplicateResult.activeId)
      ? duplicateResult.activeId
      : selectedNodeIds[selectedNodeIds.length - 1] ?? null;
    if (!attachDragTargetIds(selectedNodeIds)) return [];
    return selectedNodeIds;
  }

  function attachDragTargetIds(targetIds: string[]): boolean {
    const target = attachNativeTransformProxy(targetIds);
    if (!target) return false;
    try {
      manager.attachToNode?.(target);
      updateFreeMoveHandle();
      return true;
    } catch (error) {
      options.logger?.warn?.('[BabylonTransformGizmoController] failed to attach duplicate drag target', error);
      return false;
    }
  }

  function attachNativeTransformProxy(targetIds: string[]): any | null {
    const validTargetIds = targetIds.filter(nodeId => !!options.projection.getAttachableRoot(nodeId));
    if (validTargetIds.length === 0) return null;
    const pivot = validTargetIds.length > 1
      ? options.projection.getSelectionPivot(validTargetIds)
      : createSingleTargetPivot(validTargetIds[0]!);
    if (!pivot) return null;
    const rotation = validTargetIds.length === 1 && space === 'local'
      ? options.projection.readNodeTransform(validTargetIds[0]!)?.rotation ?? { x: 0, y: 0, z: 0 }
      : { x: 0, y: 0, z: 0 };
    return setPivotProxyTransform(pivot, rotation);
  }

  function createSingleTargetPivot(nodeId: string): EditorTransformPivot | null {
    const transform = options.projection.readNodeTransform(nodeId);
    return transform
      ? {
          mode: 'selection-center',
          position: transform.position,
        }
      : null;
  }

  function createActiveDrag(
    activeTool: Exclude<EditorTransformTool, 'select'>,
    targetIds: string[],
    activeConstraint: EditorTransformCanonicalConstraint,
    duplicate = false,
  ): ActiveDrag | null {
    if (targetIds.length === 0) return null;
    const beforeTransforms = options.projection.readNodeTransforms(targetIds);
    const validTargetIds = targetIds.filter(nodeId => !!beforeTransforms[nodeId]);
    if (validTargetIds.length === 0) return null;
    const pivot = validTargetIds.length > 1
      ? options.projection.getSelectionPivot(validTargetIds)
      : {
          mode: 'selection-center' as const,
          position: beforeTransforms[validTargetIds[0]!]!.position,
        };
    if (!pivot) return null;
    const before = validTargetIds.length === 1 ? beforeTransforms[validTargetIds[0]!] ?? null : null;
    return {
      nodeId: validTargetIds.length === 1 ? validTargetIds[0]! : null,
      targetIds: validTargetIds,
      activeId: selectedNodeId && validTargetIds.includes(selectedNodeId) ? selectedNodeId : validTargetIds[validTargetIds.length - 1] ?? null,
      tool: activeTool,
      space,
      constraint: activeConstraint,
      pivot,
      before,
      beforeTransforms,
      duplicate,
      proxyStart: readNativeProxyTransform(pivot),
    };
  }

  function updateDrag(): void {
    if (!activeDrag) return;
    const currentTransforms = previewBatchTransform(activeDrag);
    const current = activeDrag.activeId
      ? currentTransforms[activeDrag.activeId] ?? Object.values(currentTransforms)[0] ?? null
      : Object.values(currentTransforms)[0] ?? null;
    if (!current) return;
    if (activeDrag.tool === 'move') {
      const pivotPosition = resolvePreviewPivotPosition(activeDrag, currentTransforms);
      if (pivotPosition) setFreeMoveHandlePosition(pivotPosition);
    }
    options.onDragUpdate?.({ ...activeDrag, current });
  }

  function endDrag(): void {
    const drag = activeDrag;
    if (!drag) return;
    const afterTransforms = previewBatchTransform(drag);
    activeDrag = null;
    emitTransformCommit(drag, afterTransforms);
    attachCurrentSelection();
  }

  function emitTransformCommit(
    drag: ActiveDrag,
    afterTransforms: Record<string, EditorTransformSnapshot>,
  ): void {
    if (drag.targetIds.length === 1) {
      const nodeId = drag.targetIds[0]!;
      const before = drag.beforeTransforms[nodeId];
      const after = afterTransforms[nodeId];
      if (!before || !after) {
        options.onDragCancel?.(drag);
        return;
      }
      options.onDragEnd?.({
        nodeId,
        tool: drag.tool,
        space: drag.space,
        constraint: drag.constraint,
        before,
        after,
      });
      return;
    }
    options.onDragEnd?.({
      targetIds: drag.targetIds,
      activeId: drag.activeId,
      tool: drag.tool,
      space: drag.space,
      constraint: drag.constraint,
      pivot: drag.pivot,
      targets: drag.targetIds
        .map((id): EditorTransformTargetSnapshot | null => {
          const before = drag.beforeTransforms[id];
          const after = afterTransforms[id];
          return before && after ? { id, before, after } : null;
        })
        .filter((target): target is EditorTransformTargetSnapshot => !!target),
    });
  }

  function previewBatchTransform(drag: ActiveDrag): Record<string, EditorTransformSnapshot> {
    const pivotTransform = readProjectionLikeTransform(pivotProxy, {
      position: drag.pivot.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    const proxyStart = drag.proxyStart ?? {
      position: drag.pivot.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    if (drag.tool === 'move') {
      return previewMoveWithDelta(drag, subtractVec3(pivotTransform.position, proxyStart.position));
    }
    if (drag.tool === 'rotate') {
      return previewRotateWithDelta(drag, subtractVec3(pivotTransform.rotation, proxyStart.rotation));
    }
    if (drag.tool === 'scale') {
      return previewScaleWithDelta(drag, divideVec3(pivotTransform.scale, proxyStart.scale));
    }
    return {};
  }

  function previewMoveWithDelta(
    drag: ActiveDrag,
    delta: EditorTransformVec3,
  ): Record<string, EditorTransformSnapshot> {
    const transforms: Record<string, EditorTransformSnapshot> = {};
    for (const nodeId of drag.targetIds) {
      const before = drag.beforeTransforms[nodeId];
      if (!before) continue;
      transforms[nodeId] = applySnapToTransform(drag, nodeId, translateTransform(before, delta));
    }
    options.projection.setNodeTransformsPreview(transforms);
    return transforms;
  }

  function translateTransform(
    transform: EditorTransformSnapshot,
    delta: EditorTransformVec3,
  ): EditorTransformSnapshot {
    return {
      position: addVec3(transform.position, delta),
      rotation: transform.rotation,
      scale: transform.scale,
    };
  }

  function previewRotateWithDelta(
    drag: ActiveDrag,
    rotationDelta: EditorTransformVec3,
  ): Record<string, EditorTransformSnapshot> {
    const transforms: Record<string, EditorTransformSnapshot> = {};
    for (const nodeId of drag.targetIds) {
      const before = drag.beforeTransforms[nodeId];
      if (!before) continue;
      const offset = subtractVec3(before.position, drag.pivot.position);
      transforms[nodeId] = {
        position: addVec3(drag.pivot.position, rotateVec3Euler(offset, rotationDelta)),
        rotation: addVec3(before.rotation, rotationDelta),
        scale: before.scale,
      };
      transforms[nodeId] = applySnapToTransform(drag, nodeId, transforms[nodeId]!);
    }
    options.projection.setNodeTransformsPreview(transforms);
    return transforms;
  }

  function previewScaleWithDelta(
    drag: ActiveDrag,
    scaleDelta: EditorTransformVec3,
  ): Record<string, EditorTransformSnapshot> {
    const transforms: Record<string, EditorTransformSnapshot> = {};
    const safeScale = {
      x: Number.isFinite(scaleDelta.x) ? scaleDelta.x : 1,
      y: Number.isFinite(scaleDelta.y) ? scaleDelta.y : 1,
      z: Number.isFinite(scaleDelta.z) ? scaleDelta.z : 1,
    };
    for (const nodeId of drag.targetIds) {
      const before = drag.beforeTransforms[nodeId];
      if (!before) continue;
      const offset = subtractVec3(before.position, drag.pivot.position);
      transforms[nodeId] = {
        position: addVec3(drag.pivot.position, multiplyVec3(offset, safeScale)),
        rotation: before.rotation,
        scale: multiplyVec3(before.scale, safeScale),
      };
      transforms[nodeId] = applySnapToTransform(drag, nodeId, transforms[nodeId]!);
    }
    options.projection.setNodeTransformsPreview(transforms);
    return transforms;
  }

  function applySnapToTransform(
    drag: ActiveDrag,
    nodeId: string,
    after: EditorTransformSnapshot,
  ): EditorTransformSnapshot {
    if (!operationSettings.snap.enabled) return after;
    const before = drag.beforeTransforms[nodeId];
    if (!before) return after;
    return snapEditorTransformSnapshot(before, after, drag.tool, operationSettings.snap);
  }

  function readNativeProxyTransform(pivot: EditorTransformPivot): EditorTransformSnapshot {
    return readProjectionLikeTransform(pivotProxy, {
      position: pivot.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  function readProjectionLikeTransform(
    node: any,
    fallback: EditorTransformSnapshot,
  ): EditorTransformSnapshot {
    const rotation = node?.rotationQuaternion?.toEulerAngles?.() ?? node?.rotation;
    return {
      position: readVec3Like(node?.position) ?? fallback.position,
      rotation: readVec3Like(rotation) ?? fallback.rotation,
      scale: readVec3Like(node?.scaling) ?? fallback.scale,
    };
  }

  function readVec3Like(value: any): EditorTransformVec3 | null {
    if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y) || !Number.isFinite(value?.z)) return null;
    return {
      x: Number(value.x),
      y: Number(value.y),
      z: Number(value.z),
    };
  }

  function addVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
    return {
      x: left.x + right.x,
      y: left.y + right.y,
      z: left.z + right.z,
    };
  }

  function subtractVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
    return {
      x: left.x - right.x,
      y: left.y - right.y,
      z: left.z - right.z,
    };
  }

  function scaleVec3(value: EditorTransformVec3, factor: number): EditorTransformVec3 {
    return {
      x: value.x * factor,
      y: value.y * factor,
      z: value.z * factor,
    };
  }

  function dotVec3(left: EditorTransformVec3, right: EditorTransformVec3): number {
    return left.x * right.x + left.y * right.y + left.z * right.z;
  }

  function multiplyVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
    return {
      x: left.x * right.x,
      y: left.y * right.y,
      z: left.z * right.z,
    };
  }

  function divideVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
    return {
      x: Math.abs(right.x) > 0.000001 ? left.x / right.x : 1,
      y: Math.abs(right.y) > 0.000001 ? left.y / right.y : 1,
      z: Math.abs(right.z) > 0.000001 ? left.z / right.z : 1,
    };
  }

  function rotateVec3Euler(value: EditorTransformVec3, rotation: EditorTransformVec3): EditorTransformVec3 {
    return rotateZ(rotateY(rotateX(value, rotation.x), rotation.y), rotation.z);
  }

  function rotateX(value: EditorTransformVec3, angle: number): EditorTransformVec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: value.x,
      y: value.y * cos - value.z * sin,
      z: value.y * sin + value.z * cos,
    };
  }

  function rotateY(value: EditorTransformVec3, angle: number): EditorTransformVec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: value.x * cos + value.z * sin,
      y: value.y,
      z: -value.x * sin + value.z * cos,
    };
  }

  function rotateZ(value: EditorTransformVec3, angle: number): EditorTransformVec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: value.x * cos - value.y * sin,
      y: value.x * sin + value.y * cos,
      z: value.z,
    };
  }

  function isViewPlaneMoveCandidate(event: PointerEvent): boolean {
    if (disposed || activeDrag || tool !== 'move' || event.button !== 0) return false;
    const targetIds = getCurrentTransformTargetIds();
    if (targetIds.length === 0) return false;
    if (pickFreeMoveHandleAt(event.clientX, event.clientY)) return true;
    if (constraint !== 'free') return false;
    const pickedId = options.projection.pickNodeIdAt(event.clientX, event.clientY);
    return !!pickedId && targetIds.includes(pickedId);
  }

  function isGizmoDragCandidate(event: PointerEvent): boolean {
    if (disposed || activeDrag || event.button !== 0) return false;
    const activeTool = activeTransformTool();
    if (!activeTool) return false;
    const picked = pickGizmoMeshAt(event.clientX, event.clientY);
    if (isFreeMoveHandleNode(picked)) return false;
    const candidate = !!picked && isGizmoNode(picked);
    if (candidate) pendingDuplicateDrag = isDuplicateDragModifier(event);
    return candidate;
  }

  function beginViewPlaneMove(event: PointerEvent): boolean {
    if (!isViewPlaneMoveCandidate(event)) return false;
    const duplicate = isDuplicateDragModifier(event);
    const targetIds = resolveDragTargetIds('move', getCurrentTransformTargetIds(), 'free', duplicate);
    const drag = createActiveDrag('move', targetIds, 'free', duplicate);
    if (!drag) return false;
    const startPoint = projectPointerToViewPlane(event.clientX, event.clientY, drag.pivot.position);
    if (!startPoint) return false;
    drag.viewPlane = {
      pointerId: event.pointerId,
      startPoint,
    };
    activeDrag = drag;
    options.onDragStart?.(drag);
    return true;
  }

  function isDuplicateDragModifier(event: PointerEvent): boolean {
    return event.altKey === true;
  }

  function updateViewPlaneMove(event: PointerEvent): boolean {
    const drag = activeDrag;
    if (!drag?.viewPlane || drag.viewPlane.pointerId !== event.pointerId || disposed) return false;
    const currentPoint = projectPointerToViewPlane(event.clientX, event.clientY, drag.pivot.position);
    if (!currentPoint) return false;
    const delta = subtractVec3(currentPoint, drag.viewPlane.startPoint);
    const transforms = previewMoveWithDelta(drag, delta);
    setFreeMoveHandlePosition(resolvePreviewPivotPosition(drag, transforms) ?? addVec3(drag.pivot.position, delta));
    const current = drag.activeId
      ? transforms[drag.activeId] ?? Object.values(transforms)[0] ?? null
      : Object.values(transforms)[0] ?? null;
    if (current) options.onDragUpdate?.({ ...drag, current });
    return true;
  }

  function endViewPlaneMove(event: PointerEvent): boolean {
    const drag = activeDrag;
    if (!drag?.viewPlane || drag.viewPlane.pointerId !== event.pointerId || disposed) return false;
    const currentPoint = projectPointerToViewPlane(event.clientX, event.clientY, drag.pivot.position);
    const transforms = currentPoint
      ? previewMoveWithDelta(drag, subtractVec3(currentPoint, drag.viewPlane.startPoint))
      : previewMoveWithDelta(drag, { x: 0, y: 0, z: 0 });
    activeDrag = null;
    emitTransformCommit(drag, transforms);
    attachCurrentSelection();
    return true;
  }

  function resolvePreviewPivotPosition(
    drag: ActiveDrag,
    transforms: Record<string, EditorTransformSnapshot>,
  ): EditorTransformVec3 | null {
    for (const nodeId of drag.targetIds) {
      const before = drag.beforeTransforms[nodeId];
      const after = transforms[nodeId];
      if (!before || !after) continue;
      return addVec3(drag.pivot.position, subtractVec3(after.position, before.position));
    }
    return null;
  }

  function projectPointerToViewPlane(
    clientX: number,
    clientY: number,
    planePoint: EditorTransformVec3,
  ): EditorTransformVec3 | null {
    const camera = options.scene.activeCamera ?? (options.scene as any).cameraToUseForPointers ?? null;
    const Vector3 = options.babylon.Vector3 as any;
    const Matrix = (options.babylon as any).Matrix;
    if (!canvas || !camera || !Vector3 || !Matrix?.Identity || !options.scene.createPickingRay) return null;
    const rect = canvas.getBoundingClientRect();
    const ray = options.scene.createPickingRay(clientX - rect.left, clientY - rect.top, Matrix.Identity(), camera);
    const origin = readVec3Like(ray?.origin);
    const direction = readVec3Like(ray?.direction);
    const normal = readCameraForward(camera);
    if (!origin || !direction || !normal) return null;
    const denominator = dotVec3(direction, normal);
    if (Math.abs(denominator) < 0.000001) return null;
    const t = dotVec3(subtractVec3(planePoint, origin), normal) / denominator;
    if (!Number.isFinite(t)) return null;
    return addVec3(origin, scaleVec3(direction, t));
  }

  function readCameraForward(camera: any): EditorTransformVec3 | null {
    const forwardRayDirection = readVec3Like(camera?.getForwardRay?.()?.direction);
    if (forwardRayDirection) return forwardRayDirection;
    const Vector3 = options.babylon.Vector3 as any;
    if (!Vector3 || typeof camera?.getDirection !== 'function') return null;
    const forwardZ = options.scene.useRightHandedSystem ? -1 : 1;
    return readVec3Like(camera.getDirection(new Vector3(0, 0, forwardZ)));
  }

  function pickPlacementHit(
    clientX: number,
    clientY: number,
    mode: EditorPlacementMode,
  ): EditorPlacementHit | null {
    if (mode === 'off') return null;
    if (mode === 'ground') return pickGroundPlacementHit(clientX, clientY);
    return pickSurfacePlacementHit(clientX, clientY);
  }

  function pickGroundPlacementHit(clientX: number, clientY: number): EditorPlacementHit | null {
    const ray = createScenePointerRay(clientX, clientY);
    const origin = readVec3Like(ray?.origin);
    const direction = readVec3Like(ray?.direction);
    if (!origin || !direction || Math.abs(direction.y) < 0.000001) return null;
    const t = -origin.y / direction.y;
    if (!Number.isFinite(t) || t < 0) return null;
    return {
      mode: 'ground',
      position: addVec3(origin, scaleVec3(direction, t)),
      normal: { x: 0, y: 1, z: 0 },
      nodeId: null,
    };
  }

  function pickSurfacePlacementHit(clientX: number, clientY: number): EditorPlacementHit | null {
    if (!canvas || typeof options.scene.pick !== 'function') return null;
    const rect = canvas.getBoundingClientRect();
    const pick = options.scene.pick(clientX - rect.left, clientY - rect.top, (mesh: any) => !isPlacementPickIgnored(mesh));
    const point = readVec3Like(pick?.pickedPoint);
    if (!pick?.hit || !point) return null;
    const normal = readVec3Like(pick?.getNormal?.(true)) ?? readVec3Like(pick?.normal);
    return {
      mode: 'surface',
      position: point,
      normal: normal ?? undefined,
      nodeId: options.projection.resolveProjectionNodeId(pick.pickedMesh ?? null),
    };
  }

  function isPlacementPickIgnored(node: any): boolean {
    let current = node;
    while (current) {
      if (current.metadata?.editorProjectionHelper) return true;
      if (current.metadata?.editorTransformFreeMoveHandle) return true;
      if (current.metadata?.editorPlacementMarker) return true;
      current = current.parent ?? null;
    }
    return false;
  }

  function createScenePointerRay(clientX: number, clientY: number): any | null {
    const camera = options.scene.activeCamera ?? (options.scene as any).cameraToUseForPointers ?? null;
    const Matrix = (options.babylon as any).Matrix;
    if (!canvas || !camera || !Matrix?.Identity || !options.scene.createPickingRay) return null;
    const rect = canvas.getBoundingClientRect();
    return options.scene.createPickingRay(clientX - rect.left, clientY - rect.top, Matrix.Identity(), camera);
  }

  function ensurePlacementMarker(): any | null {
    if (placementMarker) return placementMarker;
    const MeshBuilder = (options.babylon as any).MeshBuilder;
    const StandardMaterial = (options.babylon as any).StandardMaterial;
    const Color3 = options.babylon.Color3 as any;
    const utilityScene = manager.utilityLayer?.utilityLayerScene;
    if (!MeshBuilder?.CreateSphere || !utilityScene) return null;
    placementMarker = MeshBuilder.CreateSphere(
      'editor.placement.marker',
      { diameter: 0.32, segments: 16 },
      utilityScene,
    );
    placementMarker.metadata = {
      ...(placementMarker.metadata ?? {}),
      editorProjectionHelper: true,
      editorPlacementMarker: true,
    };
    placementMarker.isPickable = false;
    if (StandardMaterial && Color3) {
      placementMarkerMaterial = new StandardMaterial('editor.placement.marker.material', utilityScene);
      placementMarkerMaterial.diffuseColor = new Color3(0.18, 0.86, 0.78);
      placementMarkerMaterial.emissiveColor = new Color3(0.1, 0.62, 0.56);
      placementMarkerMaterial.specularColor = new Color3(0.04, 0.18, 0.16);
      placementMarker.material = placementMarkerMaterial;
    }
    setPlacementMarkerVisible(false);
    return placementMarker;
  }

  function setPlacementMarkerVisible(visible: boolean): void {
    if (!placementMarker) return;
    placementMarker.isVisible = visible;
    try { placementMarker.setEnabled?.(visible); } catch {}
  }

  function setPlacementMarker(hit: EditorPlacementHit | null): void {
    if (!hit) {
      setPlacementMarkerVisible(false);
      return;
    }
    const marker = ensurePlacementMarker();
    const Vector3 = options.babylon.Vector3;
    if (!marker || !Vector3) return;
    marker.position = new Vector3(hit.position.x, hit.position.y, hit.position.z);
    setPlacementMarkerVisible(true);
  }

  function pickGizmoMeshAt(clientX: number, clientY: number): any | null {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const utilityScene = manager.utilityLayer?.utilityLayerScene;
    const utilityPick = typeof utilityScene?.pick === 'function' ? utilityScene.pick(x, y) : null;
    if (utilityPick?.hit && utilityPick.pickedMesh) return utilityPick.pickedMesh;
    const scenePick = typeof options.scene.pick === 'function' ? options.scene.pick(x, y) : null;
    return scenePick?.hit ? scenePick.pickedMesh ?? null : null;
  }

  function pickFreeMoveHandleAt(clientX: number, clientY: number): any | null {
    if (!canvas || !freeMoveHandle) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const utilityScene = manager.utilityLayer?.utilityLayerScene;
    const pick = typeof utilityScene?.pick === 'function'
      ? utilityScene.pick(x, y, (mesh: any) => isFreeMoveHandleNode(mesh))
      : null;
    return pick?.hit && isFreeMoveHandleNode(pick.pickedMesh) ? pick.pickedMesh : null;
  }

  function ensureFreeMoveHandle(): any | null {
    if (freeMoveHandle) return freeMoveHandle;
    const MeshBuilder = (options.babylon as any).MeshBuilder;
    const StandardMaterial = (options.babylon as any).StandardMaterial;
    const Color3 = options.babylon.Color3 as any;
    const utilityScene = manager.utilityLayer?.utilityLayerScene;
    if (!MeshBuilder?.CreateSphere || !utilityScene) return null;
    freeMoveHandle = MeshBuilder.CreateSphere(
      'editor.transform.freeMoveHandle',
      { diameter: 0.22, segments: 12 },
      utilityScene,
    );
    freeMoveHandle.metadata = {
      ...(freeMoveHandle.metadata ?? {}),
      editorProjectionHelper: true,
      editorTransformFreeMoveHandle: true,
    };
    freeMoveHandle.isPickable = true;
    if (StandardMaterial && Color3) {
      freeMoveHandleMaterial = new StandardMaterial('editor.transform.freeMoveHandle.material', utilityScene);
      freeMoveHandleMaterial.diffuseColor = new Color3(1, 0.82, 0.28);
      freeMoveHandleMaterial.emissiveColor = new Color3(1, 0.68, 0.18);
      freeMoveHandleMaterial.specularColor = new Color3(0.2, 0.18, 0.08);
      freeMoveHandle.material = freeMoveHandleMaterial;
    }
    setFreeMoveHandleVisible(false);
    return freeMoveHandle;
  }

  function setFreeMoveHandleVisible(visible: boolean): void {
    if (!freeMoveHandle) return;
    freeMoveHandle.isVisible = visible;
    try { freeMoveHandle.setEnabled?.(visible); } catch {}
  }

  function setFreeMoveHandlePosition(position: EditorTransformVec3): void {
    const handle = ensureFreeMoveHandle();
    const Vector3 = options.babylon.Vector3;
    if (!handle || !Vector3) return;
    handle.position = new Vector3(position.x, position.y, position.z);
    setFreeMoveHandleVisible(true);
  }

  function updateFreeMoveHandle(): void {
    if (tool !== 'move' || activeDrag) {
      setFreeMoveHandleVisible(false);
      return;
    }
    const targetIds = getCurrentTransformTargetIds();
    if (targetIds.length === 0) {
      setFreeMoveHandleVisible(false);
      return;
    }
    const pivot = targetIds.length > 1
      ? options.projection.getSelectionPivot(targetIds)
      : null;
    const position = pivot?.position
      ?? (targetIds[0] ? options.projection.readNodeTransform(targetIds[0])?.position : null);
    if (!position) {
      setFreeMoveHandleVisible(false);
      return;
    }
    setFreeMoveHandlePosition(position);
  }

  function isGizmoNode(node: any): boolean {
    let current = node;
    const roots = collectCurrentGizmoRoots();
    while (current) {
      if (isFreeMoveHandleNode(current)) return false;
      if (roots.has(current)) return true;
      if (current.metadata?.editorProjection?.nodeId) return false;
      if (current.metadata?.editorProjectionHelper) return false;
      const name = String(current.name ?? current.id ?? '').toLowerCase();
      if (name.includes('gizmo')) return true;
      current = current.parent ?? null;
    }
    return false;
  }

  function isFreeMoveHandleNode(node: any): boolean {
    let current = node;
    while (current) {
      if (current.metadata?.editorTransformFreeMoveHandle) return true;
      current = current.parent ?? null;
    }
    return false;
  }

  function collectCurrentGizmoRoots(): Set<any> {
    const roots = new Set<any>();
    const activeTool = activeTransformTool();
    const gizmo = activeTool === 'move'
      ? manager.gizmos?.positionGizmo
      : activeTool === 'rotate'
        ? manager.gizmos?.rotationGizmo
        : activeTool === 'scale'
          ? manager.gizmos?.scaleGizmo
          : null;
    collectGizmoRoots(gizmo, roots);
    return roots;
  }

  function collectGizmoRoots(value: any, roots: Set<any>): void {
    if (!value || roots.has(value)) return;
    if (value._rootMesh) roots.add(value._rootMesh);
    if (value.rootMesh) roots.add(value.rootMesh);
    if (value.attachedMesh) roots.add(value.attachedMesh);
    for (const key of ['xGizmo', 'yGizmo', 'zGizmo', 'xPlaneGizmo', 'yPlaneGizmo', 'zPlaneGizmo', 'uniformScaleGizmo']) {
      if (value[key]) collectGizmoRoots(value[key], roots);
    }
  }

  const controller: BabylonTransformGizmoController = {
    getState() {
      return {
        tool,
        space,
        selectedNodeId,
        dragPhase: activeDrag ? 'dragging' : 'idle',
        draggingNodeId: activeDrag?.nodeId ?? null,
        constraint,
      };
    },
    setTool(nextTool) {
      if (disposed) return;
      if (tool === nextTool) return;
      controller.cancelDrag();
      tool = nextTool;
      constraint = normalizeConstraintForTool(tool, constraint) ?? 'axis';
      attachCurrentSelection();
    },
    setSpace(nextSpace) {
      if (disposed) return;
      if (space === nextSpace) return;
      controller.cancelDrag();
      space = nextSpace;
      attachCurrentSelection();
    },
    setConstraint(nextConstraint) {
      if (disposed) return;
      const normalized = normalizeConstraintForTool(tool, nextConstraint) ?? 'axis';
      if (constraint === normalized) return;
      controller.cancelDrag();
      constraint = normalized;
      attachCurrentSelection();
    },
    setOperationSettings(settings) {
      if (disposed) return;
      operationSettings = cloneOperationSettings(settings);
      if (activeDrag) updateDrag();
    },
    preparePointerDrag(event) {
      if (disposed || event.button !== 0) return;
      pendingDuplicateDrag = isDuplicateDragModifier(event);
    },
    setSelectedNode(nextNodeId) {
      if (disposed) return;
      if (selectedNodeId === nextNodeId && selectedNodeIds.length === (nextNodeId ? 1 : 0)) return;
      controller.cancelDrag();
      selectedNodeId = nextNodeId;
      selectedNodeIds = nextNodeId ? [nextNodeId] : [];
      attachCurrentSelection();
    },
    setSelection(selection) {
      if (disposed) return;
      const nextNodeIds = [...selection.selectedIds];
      const nextActiveId = selection.activeId;
      if (
        selectedNodeId === nextActiveId
        && selectedNodeIds.length === nextNodeIds.length
        && selectedNodeIds.every((id, index) => id === nextNodeIds[index])
      ) {
        return;
      }
      controller.cancelDrag();
      selectedNodeId = nextActiveId;
      selectedNodeIds = nextNodeIds;
      attachCurrentSelection();
    },
    refreshSelection() {
      if (disposed) return;
      if (activeDrag) return;
      attachCurrentSelection();
    },
    isGizmoDragCandidate,
    isViewPlaneMoveCandidate,
    beginViewPlaneMove,
    updateViewPlaneMove,
    endViewPlaneMove,
    pickPlacementHit,
    setPlacementMarker,
    cancelDrag() {
      const drag = activeDrag;
      if (!drag) return;
      activeDrag = null;
      if (drag.targetIds.length > 1) {
        options.projection.setNodeTransformsPreview(drag.beforeTransforms);
      } else if (drag.nodeId && drag.before) {
        options.projection.setNodeTransformPreview(drag.nodeId, drag.before);
      }
      attachCurrentSelection();
      options.onDragCancel?.(drag);
    },
    dispose() {
      if (disposed) return;
      controller.cancelDrag();
      clearDragObservers();
      try { manager.attachToNode?.(null); } catch {}
      try { manager.dispose?.(); } catch {}
      try { pivotProxy?.dispose?.(); } catch {}
      try { freeMoveHandle?.dispose?.(); } catch {}
      try { freeMoveHandleMaterial?.dispose?.(); } catch {}
      try { placementMarker?.dispose?.(); } catch {}
      try { placementMarkerMaterial?.dispose?.(); } catch {}
      pivotProxy = null;
      freeMoveHandle = null;
      freeMoveHandleMaterial = null;
      placementMarker = null;
      placementMarkerMaterial = null;
      disposed = true;
    },
  };

  attachCurrentSelection();
  return controller;
}

function cloneOperationSettings(
  settings: EditorTransformOperationSettings,
): EditorTransformOperationSettings {
  return {
    snap: {
      enabled: settings.snap.enabled,
      moveStep: settings.snap.moveStep,
      rotateStepDegrees: settings.snap.rotateStepDegrees,
      scaleStep: settings.snap.scaleStep,
    },
    placementMode: settings.placementMode,
  };
}
