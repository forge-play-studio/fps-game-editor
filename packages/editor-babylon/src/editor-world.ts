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

export interface BabylonEditorWorldAppearanceOptions {
  clearColor?: { r: number; g: number; b: number; a: number };
  sky?: BabylonEditorSkyOptions | false;
}

export interface BabylonEditorWorld {
  scene: RuntimeScene;
  camera: RuntimeCamera;
  gizmoManager: any | null;
  skyBackdrop: BabylonEditorSkyBackdrop | null;
  setAppearance(options: BabylonEditorWorldAppearanceOptions): void;
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
  applyEditorWorldClearColor(options.babylon, scene, options.clearColor);
  let skyBackdrop = createBabylonEditorSkyBackdrop({
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
  scene.activeCamera = camera;
  scene.cameraToUseForPointers = camera;

  const gizmoManager = options.enableGizmoManager && options.babylon.GizmoManager
    ? new options.babylon.GizmoManager(scene)
    : null;

  return {
    scene,
    camera,
    gizmoManager,
    get skyBackdrop() {
      return skyBackdrop;
    },
    setAppearance(appearance) {
      applyEditorWorldClearColor(options.babylon, scene, appearance.clearColor);
      if (isEditorWorldSkyDisabled(appearance.sky)) {
        skyBackdrop?.dispose();
        skyBackdrop = null;
        return;
      }
      if (skyBackdrop) {
        skyBackdrop.update(appearance.sky);
      } else {
        skyBackdrop = createBabylonEditorSkyBackdrop({
          babylon: options.babylon,
          scene,
          sky: appearance.sky,
        });
      }
    },
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

function applyEditorWorldClearColor(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  clearColor: BabylonEditorWorldAppearanceOptions['clearColor'],
): void {
  if (!clearColor || !babylon.Color4) return;
  scene.clearColor = new babylon.Color4(
    clearColor.r,
    clearColor.g,
    clearColor.b,
    clearColor.a,
  );
}

function isEditorWorldSkyDisabled(sky: BabylonEditorWorldAppearanceOptions['sky']): boolean {
  return sky === false || sky?.enabled === false;
}
