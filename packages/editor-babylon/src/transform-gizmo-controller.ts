import type {
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
  constraint: EditorTransformConstraint;
  pivot: EditorTransformPivot;
  before: EditorTransformSnapshot | null;
  beforeTransforms: Record<string, EditorTransformSnapshot>;
}

export type BabylonTransformGizmoCommit = EditorTransformGizmoCommit | EditorTransformBatchCommit;

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
  logger?: Pick<Console, 'warn'>;
}

export interface BabylonTransformGizmoController {
  getState(): EditorTransformGizmoState;
  setTool(tool: EditorTransformTool): void;
  setSpace(space: EditorTransformSpace): void;
  setConstraint(constraint: EditorTransformConstraint): void;
  setSelectedNode(nodeId: string | null): void;
  setSelection(selection: EditorSelectionState): void;
  refreshSelection(): void;
  isGizmoDragCandidate(event: PointerEvent): boolean;
  isViewPlaneMoveCandidate(event: PointerEvent): boolean;
  beginViewPlaneMove(event: PointerEvent): boolean;
  updateViewPlaneMove(event: PointerEvent): boolean;
  endViewPlaneMove(event: PointerEvent): boolean;
  cancelDrag(): void;
  dispose(): void;
}

interface ActiveDrag {
  nodeId: string | null;
  targetIds: string[];
  activeId: string | null;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformConstraint;
  pivot: EditorTransformPivot;
  before: EditorTransformSnapshot | null;
  beforeTransforms: Record<string, EditorTransformSnapshot>;
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
  let constraint: EditorTransformConstraint = 'axis';
  let selectedNodeId: string | null = null;
  let selectedNodeIds: string[] = [];
  let activeDrag: ActiveDrag | null = null;
  let disposed = false;
  let observerDisposers: ObserverDisposer[] = [];
  let pivotProxy: any | null = null;
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

  function setPivotProxyTransform(pivot: EditorTransformPivot): any | null {
    const proxy = ensurePivotProxy();
    const Vector3 = options.babylon.Vector3;
    if (!proxy || !Vector3) return null;
    proxy.position = new Vector3(pivot.position.x, pivot.position.y, pivot.position.z);
    proxy.rotation = new Vector3(0, 0, 0);
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

  function registerDragObserversFor(gizmo: any): void {
    const axisGizmos = [
      gizmo?.xGizmo,
      gizmo?.yGizmo,
      gizmo?.zGizmo,
      gizmo?.uniformScaleGizmo,
      gizmo?.xPlaneGizmo,
      gizmo?.yPlaneGizmo,
      gizmo?.zPlaneGizmo,
    ];
    for (const axis of axisGizmos) {
      const behavior = axis?.dragBehavior;
      addObserver(behavior?.onDragStartObservable, beginDrag);
      addObserver(behavior?.onDragObservable, updateDrag);
      addObserver(behavior?.onDragEndObservable, endDrag);
    }
  }

  function registerDragObservers(): void {
    clearDragObservers();
    registerDragObserversFor(manager.gizmos?.positionGizmo);
    registerDragObserversFor(manager.gizmos?.rotationGizmo);
    registerDragObserversFor(manager.gizmos?.scaleGizmo);
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
      for (const axis of [gizmo?.xGizmo, gizmo?.yGizmo, gizmo?.zGizmo]) {
        try {
          if ('updateGizmoRotationToMatchAttachedMesh' in (axis ?? {})) {
            axis.updateGizmoRotationToMatchAttachedMesh = matchAttachedMesh;
          }
        } catch {}
      }
    }
  }

  function attachCurrentSelection(): void {
    const activeTool = activeTransformTool();
    const viewPlaneMove = activeTool === 'move' && constraint === 'view-plane';
    manager.positionGizmoEnabled = activeTool === 'move' && !viewPlaneMove;
    manager.rotationGizmoEnabled = activeTool === 'rotate';
    manager.scaleGizmoEnabled = activeTool === 'scale';
    applySpacePreference();
    registerDragObservers();

    let target: any | null = null;
    if (activeTool && !viewPlaneMove) {
      const batchTransformTargetIds = getBatchTransformTargetIds();
      if (batchTransformTargetIds.length > 1) {
        const pivot = options.projection.getSelectionPivot(batchTransformTargetIds);
        target = pivot ? setPivotProxyTransform(pivot) : null;
      } else {
        const activeTargetId = getActiveTargetId();
        target = activeTargetId ? options.projection.getAttachableRoot(activeTargetId) : null;
      }
    }
    try { manager.attachToNode?.(target ?? null); } catch (error) {
      options.logger?.warn?.('[BabylonTransformGizmoController] failed to attach gizmo', error);
    }
  }

  function beginDrag(): void {
    if (activeDrag) return;
    const activeTool = activeTransformTool();
    if (!activeTool) return;
    const targetIds = selectedNodeIds.length > 1
      ? getBatchTransformTargetIds()
      : [getActiveTargetId()].filter((nodeId): nodeId is string => !!nodeId);
    const drag = createActiveDrag(activeTool, targetIds, activeTool === 'move' ? constraint : 'axis');
    if (!drag) return;
    activeDrag = drag;
    options.onDragStart?.(activeDrag);
  }

  function createActiveDrag(
    activeTool: Exclude<EditorTransformTool, 'select'>,
    targetIds: string[],
    activeConstraint: EditorTransformConstraint,
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
    };
  }

  function updateDrag(): void {
    if (!activeDrag) return;
    if (activeDrag.targetIds.length > 1) {
      const currentTransforms = previewBatchTransform(activeDrag);
      const current = activeDrag.activeId
        ? currentTransforms[activeDrag.activeId] ?? Object.values(currentTransforms)[0] ?? null
        : Object.values(currentTransforms)[0] ?? null;
      if (!current) return;
      options.onDragUpdate?.({ ...activeDrag, current });
      return;
    }
    if (!activeDrag.nodeId) return;
    const current = options.projection.readNodeTransform(activeDrag.nodeId);
    if (!current) return;
    options.onDragUpdate?.({ ...activeDrag, current });
  }

  function endDrag(): void {
    const drag = activeDrag;
    if (!drag) return;
    activeDrag = null;
    if (drag.targetIds.length > 1) {
      const afterTransforms = previewBatchTransform(drag);
      emitTransformCommit(drag, afterTransforms);
      attachCurrentSelection();
      return;
    }
    if (!drag.nodeId || !drag.before) {
      options.onDragCancel?.(drag);
      return;
    }
    const after = options.projection.readNodeTransform(drag.nodeId);
    if (!after) {
      options.onDragCancel?.(drag);
      return;
    }
    options.onDragEnd?.({
      nodeId: drag.nodeId,
      tool: drag.tool,
      space: drag.space,
      before: drag.before,
      after,
    });
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
    if (drag.tool === 'move') {
      return previewMoveWithDelta(drag, subtractVec3(pivotTransform.position, drag.pivot.position));
    }
    if (drag.tool === 'rotate') {
      return previewRotateWithDelta(drag, pivotTransform.rotation);
    }
    if (drag.tool === 'scale') {
      return previewScaleWithDelta(drag, pivotTransform.scale);
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
      transforms[nodeId] = translateTransform(before, delta);
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
    }
    options.projection.setNodeTransformsPreview(transforms);
    return transforms;
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
    if (disposed || activeDrag || tool !== 'move' || constraint !== 'view-plane' || event.button !== 0) return false;
    const targetIds = selectedNodeIds.length > 1
      ? getBatchTransformTargetIds()
      : [getActiveTargetId()].filter((nodeId): nodeId is string => !!nodeId);
    if (targetIds.length === 0) return false;
    const pickedId = options.projection.pickNodeIdAt(event.clientX, event.clientY);
    return !!pickedId && targetIds.includes(pickedId);
  }

  function isGizmoDragCandidate(event: PointerEvent): boolean {
    if (disposed || activeDrag || event.button !== 0) return false;
    const activeTool = activeTransformTool();
    if (!activeTool || (activeTool === 'move' && constraint === 'view-plane')) return false;
    const picked = pickGizmoMeshAt(event.clientX, event.clientY);
    return !!picked && isGizmoNode(picked);
  }

  function beginViewPlaneMove(event: PointerEvent): boolean {
    if (!isViewPlaneMoveCandidate(event)) return false;
    const targetIds = selectedNodeIds.length > 1
      ? getBatchTransformTargetIds()
      : [getActiveTargetId()].filter((nodeId): nodeId is string => !!nodeId);
    const drag = createActiveDrag('move', targetIds, 'view-plane');
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

  function updateViewPlaneMove(event: PointerEvent): boolean {
    const drag = activeDrag;
    if (!drag?.viewPlane || drag.viewPlane.pointerId !== event.pointerId || disposed) return false;
    const currentPoint = projectPointerToViewPlane(event.clientX, event.clientY, drag.pivot.position);
    if (!currentPoint) return false;
    const transforms = previewMoveWithDelta(drag, subtractVec3(currentPoint, drag.viewPlane.startPoint));
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

  function isGizmoNode(node: any): boolean {
    let current = node;
    const roots = collectCurrentGizmoRoots();
    while (current) {
      if (roots.has(current)) return true;
      if (current.metadata?.editorProjection?.nodeId) return false;
      if (current.metadata?.editorProjectionHelper) return false;
      const name = String(current.name ?? current.id ?? '').toLowerCase();
      if (name.includes('gizmo')) return true;
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
      if (constraint === nextConstraint) return;
      controller.cancelDrag();
      constraint = nextConstraint;
      attachCurrentSelection();
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
    cancelDrag() {
      const drag = activeDrag;
      if (!drag) return;
      activeDrag = null;
      if (drag.targetIds.length > 1) {
        options.projection.setNodeTransformsPreview(drag.beforeTransforms);
        attachCurrentSelection();
      } else if (drag.nodeId && drag.before) {
        options.projection.setNodeTransformPreview(drag.nodeId, drag.before);
      }
      options.onDragCancel?.(drag);
    },
    dispose() {
      if (disposed) return;
      controller.cancelDrag();
      clearDragObservers();
      try { manager.attachToNode?.(null); } catch {}
      try { manager.dispose?.(); } catch {}
      try { pivotProxy?.dispose?.(); } catch {}
      pivotProxy = null;
      disposed = true;
    },
  };

  attachCurrentSelection();
  return controller;
}
