import * as BABYLON from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import type {
  EditorTransformBatchCommit,
  EditorTransformGizmoCommit,
  EditorTransformSnapshot,
} from '../../packages/editor-core/src';
import {
  createBabylonTransformGizmoController,
  type BabylonTransformGizmoBlockEvent,
  type BabylonTransformGizmoDragEvent,
  resolveBabylonTransformHandleConstraint,
} from '../../packages/editor-babylon/src/transform-gizmo-controller';

type ObservableCallback = () => void;

class FakeVector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeTransformNode {
  name: string;
  metadata: Record<string, unknown> = {};
  position = new FakeVector3(0, 0, 0);
  rotation = new FakeVector3(0, 0, 0);
  scaling = new FakeVector3(1, 1, 1);
  disposed = false;

  constructor(name: string) {
    this.name = name;
  }

  dispose(): void {
    this.disposed = true;
  }
}

function createObservable() {
  const callbacks: ObservableCallback[] = [];
  return {
    add(callback: ObservableCallback): ObservableCallback {
      callbacks.push(callback);
      return callback;
    },
    remove(callback: ObservableCallback): void {
      const index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    },
    notify(): void {
      for (const callback of [...callbacks]) callback();
    },
  };
}

function createHandle() {
  return {
    angle: Number.NaN,
    isHovered: false,
    updateGizmoRotationToMatchAttachedMesh: false,
    dragBehavior: {
      onDragStartObservable: createObservable(),
      onDragObservable: createObservable(),
      onDragEndObservable: createObservable(),
    },
  };
}

function createGizmo() {
  return {
    updateGizmoRotationToMatchAttachedMesh: false,
    planarGizmoEnabled: false,
    xGizmo: createHandle(),
    yGizmo: createHandle(),
    zGizmo: createHandle(),
    xPlaneGizmo: createHandle(),
    yPlaneGizmo: createHandle(),
    zPlaneGizmo: createHandle(),
    uniformScaleGizmo: createHandle(),
  };
}

function cloneTransform(transform: EditorTransformSnapshot): EditorTransformSnapshot {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
}

function createFakeRuntime() {
  const managers: FakeGizmoManager[] = [];
  const meshes: any[] = [];
  let freeMoveHandle: any | null = null;
  let placementMarker: any | null = null;

  class FakeMesh {
    name: string;
    metadata: Record<string, unknown> = {};
    position = new BABYLON.Vector3(0, 0, 0);
    rotation = new BABYLON.Vector3(0, 0, 0);
    scaling = new BABYLON.Vector3(1, 1, 1);
    isPickable = false;
    isVisible = true;
    enabled = true;
    material: unknown = null;
    parent: unknown = null;
    color: unknown = null;
    alpha = 1;
    billboardMode = 0;

    constructor(name: string, _scene?: unknown) {
      this.name = name;
      meshes.push(this);
    }

    setEnabled(value: boolean): void {
      this.enabled = value;
    }

    dispose(): void {
      this.enabled = false;
    }
  }

  const createMesh = (name: string) => new FakeMesh(name);

  class FakeGizmoManager {
    gizmos = {
      positionGizmo: createGizmo(),
      rotationGizmo: createGizmo(),
      scaleGizmo: createGizmo(),
    };
    utilityLayer = {
      utilityLayerScene: {
        onPointerObservable: createObservable(),
        pick: (_x: number, _y: number, predicate?: (mesh: any) => boolean) => {
          if (predicate && freeMoveHandle && predicate(freeMoveHandle)) {
            return { hit: true, pickedMesh: freeMoveHandle };
          }
          return { hit: false, pickedMesh: null };
        },
      },
    };
    attachedNode: any | null = null;
    positionGizmoEnabled = false;
    rotationGizmoEnabled = false;
    scaleGizmoEnabled = false;
    usePointerToAttachGizmos = true;
    clearGizmoOnEmptyPointerEvent = true;
    boundingBoxGizmoEnabled = true;

    constructor(_scene: unknown) {
      managers.push(this);
    }

    attachToNode(node: any | null): void {
      this.attachedNode = node;
    }

    dispose(): void {}
  }

  return {
    babylon: {
      GizmoManager: FakeGizmoManager,
      TransformNode: FakeTransformNode,
      Vector3: BABYLON.Vector3,
      Matrix: BABYLON.Matrix,
      Quaternion: BABYLON.Quaternion,
      Color3: BABYLON.Color3,
      MeshBuilder: {
        CreatePlane: (name: string, _options: Record<string, unknown>, _scene: unknown) => createMesh(name),
        CreateSphere: (name: string, _options: Record<string, unknown>, _scene: unknown) => {
          const mesh = {
            name,
            metadata: {},
            position: new FakeVector3(0, 0, 0),
            isPickable: false,
            isVisible: false,
            enabled: false,
            disposed: false,
            setEnabled(value: boolean): void {
              this.enabled = value;
            },
            dispose(): void {
              this.disposed = true;
            },
          };
          if (name.includes('freeMoveHandle')) freeMoveHandle = mesh;
          if (name.includes('placement.marker')) placementMarker = mesh;
          return mesh;
        },
      },
      StandardMaterial: class FakeStandardMaterial {
        diffuseColor: unknown = null;
        emissiveColor: unknown = null;
        specularColor: unknown = null;
        diffuseTexture: unknown = null;
        alpha = 1;
        disableLighting = false;
        constructor(_name: string, _scene: unknown) {}
        dispose(): void {}
      },
      DynamicTexture: class FakeDynamicTexture {
        hasAlpha = false;
        constructor(_name: string, _options: unknown, _scene: unknown, _generateMipMaps?: boolean) {}
        drawText(): void {}
        dispose(): void {}
      },
    },
    managers,
    meshes,
    getFreeMoveHandle: () => freeMoveHandle,
    getPlacementMarker: () => placementMarker,
  };
}

function createFakeScene(overrides: {
  createPickingRay?: (x: number, y: number) => any;
  pick?: (x: number, y: number, predicate?: (mesh: any) => boolean) => any;
} = {}) {
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  return {
    getEngine: () => ({
      getRenderingCanvas: () => canvas,
      getRenderWidth: () => 1280,
      getRenderHeight: () => 720,
    }),
    activeCamera: {
      getForwardRay: () => ({
        direction: { x: 0, y: 0, z: 1 },
      }),
    },
    createPickingRay: overrides.createPickingRay ?? ((x: number, y: number) => ({
      origin: { x: x / 10, y: y / 10, z: 0 },
      direction: { x: 0, y: 0, z: 1 },
    })),
    pick: overrides.pick ?? (() => ({ hit: false, pickedMesh: null })),
    useRightHandedSystem: false,
  };
}

function createFakeProjection(initialTransforms: Record<string, EditorTransformSnapshot>) {
  const transforms = Object.fromEntries(
    Object.entries(initialTransforms).map(([id, transform]) => [id, cloneTransform(transform)]),
  ) as Record<string, EditorTransformSnapshot>;
  const roots = Object.fromEntries(
    Object.entries(transforms).map(([id, transform]) => [
      id,
      {
        name: id,
        metadata: { editorProjection: { nodeId: id } },
        position: new FakeVector3(transform.position.x, transform.position.y, transform.position.z),
        rotation: new FakeVector3(transform.rotation.x, transform.rotation.y, transform.rotation.z),
        scaling: new FakeVector3(transform.scale.x, transform.scale.y, transform.scale.z),
      },
    ]),
  ) as Record<string, any>;

  const syncRoot = (id: string) => {
    const transform = transforms[id];
    const root = roots[id];
    if (!transform || !root) return;
    root.position = new FakeVector3(transform.position.x, transform.position.y, transform.position.z);
    root.rotation = new FakeVector3(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    root.scaling = new FakeVector3(transform.scale.x, transform.scale.y, transform.scale.z);
  };

  return {
    transforms,
    addNode: (id: string, transform: EditorTransformSnapshot) => {
      transforms[id] = cloneTransform(transform);
      roots[id] = {
        name: id,
        metadata: { editorProjection: { nodeId: id } },
        position: new FakeVector3(transform.position.x, transform.position.y, transform.position.z),
        rotation: new FakeVector3(transform.rotation.x, transform.rotation.y, transform.rotation.z),
        scaling: new FakeVector3(transform.scale.x, transform.scale.y, transform.scale.z),
      };
    },
    getAttachableRoot: (id: string) => roots[id] ?? null,
    readNodeTransform: (id: string) => {
      const transform = transforms[id];
      const root = roots[id];
      if (!transform || !root) return null;
      return {
        position: { x: root.position.x, y: root.position.y, z: root.position.z },
        rotation: { x: root.rotation.x, y: root.rotation.y, z: root.rotation.z },
        scale: { x: root.scaling.x, y: root.scaling.y, z: root.scaling.z },
      };
    },
    readNodeTransforms: (ids: string[]) => Object.fromEntries(
      ids
        .filter(id => !!transforms[id])
        .map(id => [id, cloneTransform(transforms[id]!)]),
    ),
    setNodeTransformPreview: (id: string, transform: EditorTransformSnapshot) => {
      transforms[id] = cloneTransform(transform);
      syncRoot(id);
    },
    setNodeTransformsPreview: (nextTransforms: Record<string, EditorTransformSnapshot>) => {
      for (const [id, transform] of Object.entries(nextTransforms)) {
        transforms[id] = cloneTransform(transform);
        syncRoot(id);
      }
    },
    getSelectionPivot: (ids: string[]) => {
      const selected = ids.map(id => transforms[id]).filter((value): value is EditorTransformSnapshot => !!value);
      if (selected.length === 0) return null;
      return {
        mode: 'selection-center' as const,
        position: {
          x: selected.reduce((sum, transform) => sum + transform.position.x, 0) / selected.length,
          y: selected.reduce((sum, transform) => sum + transform.position.y, 0) / selected.length,
          z: selected.reduce((sum, transform) => sum + transform.position.z, 0) / selected.length,
        },
      };
    },
    pickNodeIdAt: () => null,
    resolveProjectionNodeId: (target: any) => {
      let current = target;
      while (current) {
        const nodeId = current.metadata?.editorProjection?.nodeId;
        if (typeof nodeId === 'string') return nodeId;
        current = current.parent ?? null;
      }
      return null;
    },
  };
}

function pointerEvent(clientX: number, clientY: number, altKey = false): PointerEvent {
  return {
    button: 0,
    clientX,
    clientY,
    pointerId: 7,
    altKey,
  } as PointerEvent;
}

describe('Babylon transform gizmo handle constraints', () => {
  it('maps move axis and plane handles to canonical constraints', () => {
    expect(resolveBabylonTransformHandleConstraint('move', 'xGizmo')).toBe('axis');
    expect(resolveBabylonTransformHandleConstraint('move', 'yGizmo')).toBe('axis');
    expect(resolveBabylonTransformHandleConstraint('move', 'zGizmo')).toBe('axis');
    expect(resolveBabylonTransformHandleConstraint('move', 'xPlaneGizmo')).toBe('plane');
    expect(resolveBabylonTransformHandleConstraint('move', 'yPlaneGizmo')).toBe('plane');
    expect(resolveBabylonTransformHandleConstraint('move', 'zPlaneGizmo')).toBe('plane');
    expect(resolveBabylonTransformHandleConstraint('move', 'uniformScaleGizmo')).toBeNull();
  });

  it('maps rotate and scale handles to canonical constraints', () => {
    expect(resolveBabylonTransformHandleConstraint('rotate', 'xGizmo')).toBe('axis');
    expect(resolveBabylonTransformHandleConstraint('rotate', 'xPlaneGizmo')).toBeNull();
    expect(resolveBabylonTransformHandleConstraint('scale', 'xGizmo')).toBe('axis');
    expect(resolveBabylonTransformHandleConstraint('scale', 'uniformScaleGizmo')).toBe('uniform');
    expect(resolveBabylonTransformHandleConstraint('scale', 'xPlaneGizmo')).toBeNull();
  });

  it('does not create a Babylon GizmoManager while idle in select mode', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    expect(runtime.managers).toHaveLength(0);

    controller.setTool('move');
    expect(runtime.managers).toHaveLength(1);
  });

  it('keeps native move plane drags in the batch lifecycle with a plane constraint', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const starts: BabylonTransformGizmoDragEvent[] = [];
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDragStart: event => starts.push(event),
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    expect(manager.gizmos.positionGizmo.planarGizmoEnabled).toBe(true);

    manager.gizmos.positionGizmo.xPlaneGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.position = new FakeVector3(3, 0, 0);
    manager.gizmos.positionGizmo.xPlaneGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.positionGizmo.xPlaneGizmo.dragBehavior.onDragEndObservable.notify();

    expect(starts[0]?.constraint).toBe('plane');
    expect(commits[0]?.constraint).toBe('plane');
    expect(commits[0]?.targets.map(target => [target.id, target.after.position.x])).toEqual([
      ['a', 2],
      ['b', 4],
    ]);
  });

  it('keeps single-target native plane commits on canonical handle constraints', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    manager.gizmos.positionGizmo.xPlaneGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.position = new FakeVector3(1, 0, 0);
    manager.gizmos.positionGizmo.xPlaneGizmo.dragBehavior.onDragEndObservable.notify();

    expect(commits[0]?.constraint).toBe('plane');
    expect(commits[0]?.after.position.x).toBe(1);
  });

  it('keeps single-target snap preview decoupled from the native gizmo proxy', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setOperationSettings({
      snap: { enabled: true, moveStep: 0.5, rotateStepDegrees: 15, scaleStep: 0.1 },
      placementMode: 'off',
    });
    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });

    const manager = runtime.managers[0]!;
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.position = new FakeVector3(0.74, 0, 0);
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragObservable.notify();

    expect(manager.attachedNode.position.x).toBe(0.74);
    expect(projection.transforms.a?.position.x).toBe(0.5);

    manager.attachedNode.position = new FakeVector3(1.24, 0, 0);
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(commits[0]?.after.position.x).toBe(1);
  });

  it('snaps native move previews and commits when operation snap is enabled', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const updates: Array<BabylonTransformGizmoDragEvent & { current: EditorTransformSnapshot }> = [];
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDragUpdate: event => updates.push(event),
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setOperationSettings({
      snap: { enabled: true, moveStep: 0.5, rotateStepDegrees: 15, scaleStep: 0.1 },
      placementMode: 'off',
    });
    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });

    const manager = runtime.managers[0]!;
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.position = new FakeVector3(1.74, 0, 0);
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(updates[0]?.current.position.x).toBe(0.5);
    expect(commits[0]?.targets.map(target => [target.id, target.after.position.x])).toEqual([
      ['a', 0.5],
      ['b', 2.5],
    ]);
  });

  it('snaps native rotate previews and commits when operation snap is enabled', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'rotate',
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setOperationSettings({
      snap: { enabled: true, moveStep: 0.5, rotateStepDegrees: 15, scaleStep: 0.1 },
      placementMode: 'off',
    });
    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });

    const manager = runtime.managers[0]!;
    manager.gizmos.rotationGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.rotation = new FakeVector3((22 * Math.PI) / 180, 0, 0);
    manager.gizmos.rotationGizmo.xGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.rotationGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(commits[0]?.targets[0]?.after.rotation.x).toBeCloseTo((15 * Math.PI) / 180);
    expect(commits[0]?.targets[1]?.after.rotation.x).toBeCloseTo((15 * Math.PI) / 180);
  });

  it('commits world rotate handles in world space for pre-rotated targets', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const initialRotation = { x: 0.45, y: 0.8, z: -0.25 };
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: initialRotation, scale: { x: 1, y: 1, z: 1 } },
    });
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'rotate',
      initialSpace: 'world',
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    manager.gizmos.rotationGizmo.zGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.rotation = new FakeVector3(0, 0, Math.PI / 6);
    manager.gizmos.rotationGizmo.zGizmo.dragBehavior.onDragEndObservable.notify();

    const after = commits[0]?.after.rotation;
    expect(after?.x).toBeCloseTo(0.053746467954180574);
    expect(after?.y).toBeCloseTo(0.8914884034697566);
    expect(after?.z).toBeCloseTo(0.10635131382026909);
    expect(after?.z).not.toBeCloseTo(initialRotation.z + Math.PI / 6);
  });

  it('uses rotation handle angles for local x-axis drags on pre-rotated targets', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const initialRotation = { x: 0.45, y: 0.8, z: -0.25 };
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: initialRotation, scale: { x: 1, y: 1, z: 1 } },
    });
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'rotate',
      initialSpace: 'local',
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    manager.gizmos.rotationGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.gizmos.rotationGizmo.xGizmo.angle = Math.PI / 6;
    manager.gizmos.rotationGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    const expected = BABYLON.Quaternion
      .FromEulerAngles(initialRotation.x, initialRotation.y, initialRotation.z)
      .multiply(BABYLON.Quaternion.FromEulerAngles(Math.PI / 6, 0, 0))
      .toEulerAngles();
    const after = commits[0]?.after.rotation;
    expect(after?.x).toBeCloseTo(expected.x);
    expect(after?.y).toBeCloseTo(expected.y);
    expect(after?.z).toBeCloseTo(expected.z);
    expect(after?.y).not.toBeCloseTo(initialRotation.y);
    expect(after?.z).not.toBeCloseTo(initialRotation.z);
  });

  it('snaps native scale previews and commits when operation snap is enabled', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
    });
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'scale',
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setOperationSettings({
      snap: { enabled: true, moveStep: 0.5, rotateStepDegrees: 15, scaleStep: 0.1 },
      placementMode: 'off',
    });
    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });

    const manager = runtime.managers[0]!;
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.scaling = new FakeVector3(1.24, 1.24, 1.24);
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragEndObservable.notify();

    expect(commits[0]?.targets.map(target => [target.id, target.after.scale.x])).toEqual([
      ['a', 1.2],
      ['b', 2.5],
    ]);
  });

  it('allows local non-uniform scale on rotated targets', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const initialRotation = { x: 0.25, y: 0.5, z: -0.75 };
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: initialRotation, scale: { x: 1, y: 2, z: 3 } },
    });
    const starts: BabylonTransformGizmoDragEvent[] = [];
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'scale',
      initialSpace: 'local',
      onDragStart: event => starts.push(event),
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    expect(controller.getState().space).toBe('local');
    expect(manager.gizmos.scaleGizmo.updateGizmoRotationToMatchAttachedMesh).toBe(true);
    expect(manager.attachedNode.rotation.x).toBeCloseTo(initialRotation.x);
    expect(manager.attachedNode.rotation.y).toBeCloseTo(initialRotation.y);
    expect(manager.attachedNode.rotation.z).toBeCloseTo(initialRotation.z);

    manager.gizmos.scaleGizmo.zGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.scaling = new FakeVector3(1, 1, 2);
    manager.gizmos.scaleGizmo.zGizmo.dragBehavior.onDragEndObservable.notify();

    expect(starts[0]?.space).toBe('local');
    expect(commits[0]?.space).toBe('local');
    expect(commits[0]?.after.scale.x).toBeCloseTo(1);
    expect(commits[0]?.after.scale.y).toBeCloseTo(2);
    expect(commits[0]?.after.scale.z).toBeCloseTo(6);
  });

  it('blocks world non-uniform scale when a rotated target would require shear', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const initialTransform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 4, z: 0 },
      scale: { x: 1, y: 2, z: 3 },
    };
    const projection = createFakeProjection({ a: initialTransform });
    const blocks: BabylonTransformGizmoBlockEvent[] = [];
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'scale',
      initialSpace: 'world',
      onDragBlocked: event => blocks.push(event),
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    expect(controller.getState().space).toBe('world');
    expect(manager.gizmos.scaleGizmo.updateGizmoRotationToMatchAttachedMesh).toBe(false);

    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.scaling = new FakeVector3(2, 1, 1);
    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.reason).toBe('non-trs-representable');
    expect(blocks[0]?.failedTargetId).toBe('a');
    expect(commits).toHaveLength(0);
    expect(projection.transforms.a).toEqual(initialTransform);
  });

  it('blocks a whole batch transform when any target cannot represent the solver output', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const initialTransforms = {
      a: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      b: {
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
    const projection = createFakeProjection(initialTransforms);
    const blocks: BabylonTransformGizmoBlockEvent[] = [];
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'scale',
      initialSpace: 'world',
      onDragBlocked: event => blocks.push(event),
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.scaling = new FakeVector3(2, 1, 1);
    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.scaleGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.reason).toBe('non-trs-representable');
    expect(blocks[0]?.failedTargetId).toBe('b');
    expect(commits).toHaveLength(0);
    expect(projection.transforms.a).toEqual(initialTransforms.a);
    expect(projection.transforms.b).toEqual(initialTransforms.b);
  });

  it('redirects alt native gizmo drags to duplicated targets before commit', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const sourceTransform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    const projection = createFakeProjection({ a: sourceTransform });
    const duplicateRequests: string[][] = [];
    const commits: EditorTransformGizmoCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDuplicateDragStart: (input) => {
        duplicateRequests.push(input.targetIds);
        projection.addNode('a_copy', sourceTransform);
        return { targetIds: ['a_copy'], activeId: 'a_copy' };
      },
      onDragEnd: event => {
        if ('nodeId' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a'], activeId: 'a' });
    controller.preparePointerDrag(pointerEvent(0, 0, true));
    const manager = runtime.managers[0]!;
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragStartObservable.notify();
    expect(manager.attachedNode.name).toBe('editor.selectionPivotProxy');
    manager.attachedNode.position = new FakeVector3(1, 0, 0);
    manager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragEndObservable.notify();

    expect(duplicateRequests).toEqual([['a']]);
    expect(commits[0]?.nodeId).toBe('a_copy');
    expect(commits[0]?.after.position.x).toBe(1);
    expect(projection.transforms.a?.position.x).toBe(0);
  });

  it('projects the free center handle through the view plane and commits as free', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    });
    const starts: BabylonTransformGizmoDragEvent[] = [];
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'move',
      onDragStart: event => starts.push(event),
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });
    expect(runtime.getFreeMoveHandle()?.isVisible).toBe(true);
    expect(controller.beginViewPlaneMove(pointerEvent(10, 10))).toBe(true);
    expect(controller.updateViewPlaneMove(pointerEvent(20, 10))).toBe(true);
    expect(controller.endViewPlaneMove(pointerEvent(20, 10))).toBe(true);

    expect(starts[0]?.constraint).toBe('free');
    expect(commits[0]?.constraint).toBe('free');
    expect(commits[0]?.targets.map(target => [target.id, target.after.position.x])).toEqual([
      ['a', 1],
      ['b', 3],
    ]);
  });

  it('maps uniform scale drags into the shared batch commit lifecycle', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene();
    const projection = createFakeProjection({
      a: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      b: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
    });
    const starts: BabylonTransformGizmoDragEvent[] = [];
    const commits: EditorTransformBatchCommit[] = [];
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
      initialTool: 'scale',
      onDragStart: event => starts.push(event),
      onDragEnd: event => {
        if ('targets' in event) commits.push(event);
      },
    });

    controller.setSelection({ selectedIds: ['a', 'b'], activeId: 'a' });
    const manager = runtime.managers[0]!;
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragStartObservable.notify();
    manager.attachedNode.scaling = new FakeVector3(2, 2, 2);
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragObservable.notify();
    manager.gizmos.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragEndObservable.notify();

    expect(starts[0]?.constraint).toBe('uniform');
    expect(commits[0]?.constraint).toBe('uniform');
    expect(commits[0]?.targets.map(target => [target.id, target.after.scale.x])).toEqual([
      ['a', 2],
      ['b', 4],
    ]);
  });

  it('picks XZ ground placement hits from the scene pointer ray', () => {
    const runtime = createFakeRuntime();
    const scene = createFakeScene({
      createPickingRay: () => ({
        origin: { x: 2, y: 5, z: -3 },
        direction: { x: 0, y: -1, z: 0 },
      }),
    });
    const projection = createFakeProjection({});
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
    });

    const hit = controller.pickPlacementHit(12, 18, 'ground');
    controller.setPlacementMarker(hit);

    expect(hit).toEqual({
      mode: 'ground',
      position: { x: 2, y: 0, z: -3 },
      normal: { x: 0, y: 1, z: 0 },
      nodeId: null,
    });
    expect(runtime.getPlacementMarker()?.isVisible).toBe(true);
    expect(runtime.getPlacementMarker()?.position).toMatchObject({ x: 2, y: 0, z: -3 });
  });

  it('picks surface placement hits and resolves projected node ids', () => {
    const runtime = createFakeRuntime();
    const pickedMesh = {
      metadata: { editorProjection: { nodeId: 'ground_mesh' } },
    };
    const scene = createFakeScene({
      pick: (_x, _y, predicate) => (predicate?.(pickedMesh) === false
        ? { hit: false, pickedMesh: null }
        : {
            hit: true,
            pickedMesh,
            pickedPoint: { x: 4, y: 1.5, z: -2 },
            getNormal: () => ({ x: 0, y: 1, z: 0 }),
          }),
    });
    const projection = createFakeProjection({});
    const controller = createBabylonTransformGizmoController({
      babylon: runtime.babylon,
      scene,
      projection: projection as any,
    });

    expect(controller.pickPlacementHit(20, 30, 'surface')).toEqual({
      mode: 'surface',
      position: { x: 4, y: 1.5, z: -2 },
      normal: { x: 0, y: 1, z: 0 },
      nodeId: 'ground_mesh',
    });
  });
});
