import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';
import {
  createBabylonEditorSkyBackdrop,
  type BabylonEditorSkyBackdrop,
  type BabylonEditorSkyOptions,
} from './editor-sky';

export interface BabylonEditorWorldOptions {
  engine: any;
  canvas?: HTMLCanvasElement | null;
  babylon: BabylonRuntimeGlobal;
  cameraTarget?: { x: number; y: number; z: number };
  cameraRadius?: number;
  clearColor?: { r: number; g: number; b: number; a: number };
  sky?: BabylonEditorSkyOptions | false;
  useRightHandedSystem?: boolean;
  enableGizmoManager?: boolean;
  enableDefaultCameraControls?: boolean;
}

export interface BabylonEditorWorld {
  scene: RuntimeScene;
  camera: RuntimeCamera;
  gizmoManager: any | null;
  skyBackdrop: BabylonEditorSkyBackdrop | null;
  render(): void;
  dispose(): void;
}

function requireBabylonCtor<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Babylon runtime missing ${name}`);
  return value;
}

export function createBabylonEditorWorld(options: BabylonEditorWorldOptions): BabylonEditorWorld {
  const SceneCtor = requireBabylonCtor(options.babylon.Scene, 'Scene');
  const Vector3Ctor = requireBabylonCtor(options.babylon.Vector3, 'Vector3');

  const scene = new SceneCtor(options.engine);
  if (options.useRightHandedSystem !== undefined) {
    scene.useRightHandedSystem = options.useRightHandedSystem;
  }
  if (options.clearColor && options.babylon.Color4) {
    scene.clearColor = new options.babylon.Color4(
      options.clearColor.r,
      options.clearColor.g,
      options.clearColor.b,
      options.clearColor.a,
    );
  }
  const skyBackdrop = createBabylonEditorSkyBackdrop({
    babylon: options.babylon,
    scene,
    sky: options.sky,
  });

  const target = options.cameraTarget ?? { x: 0, y: 0.8, z: 0 };
  let camera: RuntimeCamera;
  if (options.babylon.ArcRotateCamera) {
    camera = new options.babylon.ArcRotateCamera(
      'editor-world-camera',
      Math.PI / 4,
      Math.PI / 3,
      options.cameraRadius ?? 9,
      new Vector3Ctor(target.x, target.y, target.z),
      scene,
    );
  } else {
    const UniversalCameraCtor = requireBabylonCtor(options.babylon.UniversalCamera, 'UniversalCamera');
    camera = new UniversalCameraCtor(
      'editor-world-camera',
      new Vector3Ctor(target.x, target.y, target.z - (options.cameraRadius ?? 9)),
      scene,
    );
    camera.setTarget?.(new Vector3Ctor(target.x, target.y, target.z));
  }
  if (options.canvas && options.enableDefaultCameraControls !== false) {
    camera.attachControl?.(options.canvas, true);
    configureEditorCameraControls(camera);
  }

  if (options.babylon.HemisphericLight) {
    const light = new options.babylon.HemisphericLight(
      'editor-world-light',
      new Vector3Ctor(0.3, 1, 0.2),
      scene,
    );
    light.intensity = 0.86;
  }

  const gizmoManager = options.enableGizmoManager && options.babylon.GizmoManager
    ? new options.babylon.GizmoManager(scene)
    : null;

  return {
    scene,
    camera,
    gizmoManager,
    skyBackdrop,
    render() {
      scene.render();
    },
    dispose() {
      skyBackdrop?.dispose();
      gizmoManager?.dispose?.();
      scene.dispose();
    },
  };
}

function configureEditorCameraControls(camera: RuntimeCamera): void {
  const pointerInput = (camera as any).inputs?.attached?.pointers;
  if (pointerInput) {
    try { pointerInput.buttons = [1, 2]; } catch {}
    try { pointerInput.panningMouseButton = 1; } catch {}
  }
  try { (camera as any).panningMouseButton = 1; } catch {}
}
