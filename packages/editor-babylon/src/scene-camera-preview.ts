import type {
  BabylonEditorProjectionCameraSettings,
} from './projection';
import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonSceneCameraPreviewRig {
  target?: { x: number; y: number; z: number };
  settings?: BabylonEditorProjectionCameraSettings | null;
}

export interface BabylonSceneCameraPreviewControllerOptions {
  babylon: BabylonRuntimeGlobal & Record<string, any>;
  scene: RuntimeScene;
  editorCamera: RuntimeCamera;
}

export interface BabylonSceneCameraPreviewController {
  isActive(): boolean;
  setActive(active: boolean, rig?: BabylonSceneCameraPreviewRig | null): void;
  sync(rig: BabylonSceneCameraPreviewRig | null): void;
  dispose(): void;
}

const DEFAULT_SCENE_CAMERA_SETTINGS: BabylonEditorProjectionCameraSettings = {
  alpha: 3.9269908169872414,
  beta: 0.8,
  radius: 14,
  orthoSize: 6,
};

export function createBabylonSceneCameraPreviewController(
  options: BabylonSceneCameraPreviewControllerOptions,
): BabylonSceneCameraPreviewController {
  let previewCamera: RuntimeCamera | null = null;
  let savedActiveCamera: RuntimeCamera | null = null;
  let savedActiveCameras: RuntimeCamera[] | null = null;
  let savedPointerCamera: RuntimeCamera | null = null;
  let active = false;

  function ensurePreviewCamera(): RuntimeCamera | null {
    if (previewCamera) return previewCamera;
    const ArcRotateCamera = options.babylon.ArcRotateCamera;
    const Vector3 = options.babylon.Vector3;
    if (!ArcRotateCamera || !Vector3) return null;
    previewCamera = new ArcRotateCamera(
      'editor-scene-camera-preview',
      DEFAULT_SCENE_CAMERA_SETTINGS.alpha,
      DEFAULT_SCENE_CAMERA_SETTINGS.beta,
      DEFAULT_SCENE_CAMERA_SETTINGS.radius,
      new Vector3(0, 0, 0),
      options.scene,
    );
    previewCamera.mode = options.babylon.Camera?.ORTHOGRAPHIC_CAMERA ?? previewCamera.mode ?? 1;
    previewCamera.inertia = 0;
    return previewCamera;
  }

  function restoreEditorCamera(): void {
    if (!active) return;
    options.scene.activeCamera = savedActiveCamera ?? options.editorCamera;
    if (Array.isArray(savedActiveCameras)) {
      options.scene.activeCameras = savedActiveCameras;
    } else if (options.scene.activeCameras) {
      options.scene.activeCameras = [savedActiveCamera ?? options.editorCamera];
    }
    options.scene.cameraToUseForPointers = savedPointerCamera ?? options.editorCamera;
    savedActiveCamera = null;
    savedActiveCameras = null;
    savedPointerCamera = null;
    active = false;
  }

  function applyRig(rig: BabylonSceneCameraPreviewRig | null | undefined): void {
    const camera = ensurePreviewCamera();
    const Vector3 = options.babylon.Vector3;
    if (!camera || !Vector3) return;
    const settings = {
      ...DEFAULT_SCENE_CAMERA_SETTINGS,
      ...(rig?.settings ?? {}),
    };
    const target = rig?.target ?? { x: 0, y: 0, z: 0 };
    camera.target = new Vector3(target.x, target.y, target.z);
    camera.alpha = settings.alpha;
    camera.beta = settings.beta;
    camera.radius = settings.radius;
    camera.lowerAlphaLimit = settings.alpha;
    camera.upperAlphaLimit = settings.alpha;
    camera.lowerBetaLimit = settings.beta;
    camera.upperBetaLimit = settings.beta;
    camera.lowerRadiusLimit = settings.radius;
    camera.upperRadiusLimit = settings.radius;
    camera.mode = options.babylon.Camera?.ORTHOGRAPHIC_CAMERA ?? camera.mode ?? 1;
    const aspect = readSceneAspect(options.scene);
    const halfHeight = settings.orthoSize;
    const halfWidth = halfHeight * aspect;
    camera.orthoLeft = -halfWidth;
    camera.orthoRight = halfWidth;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
  }

  return {
    isActive() {
      return active;
    },
    setActive(nextActive, rig) {
      if (nextActive) {
        if (!active) {
          savedActiveCamera = options.scene.activeCamera ?? options.editorCamera;
          savedActiveCameras = Array.isArray(options.scene.activeCameras)
            ? [...options.scene.activeCameras]
            : null;
          savedPointerCamera = options.scene.cameraToUseForPointers ?? null;
        }
        const camera = ensurePreviewCamera();
        if (!camera) {
          savedActiveCamera = null;
          savedActiveCameras = null;
          savedPointerCamera = null;
          return;
        }
        if (!active) {
          active = true;
        }
        applyRig(rig);
        options.scene.activeCamera = camera;
        if (options.scene.activeCameras) options.scene.activeCameras = [camera];
        options.scene.cameraToUseForPointers = camera;
        return;
      }
      restoreEditorCamera();
    },
    sync(rig) {
      if (!active) return;
      applyRig(rig);
    },
    dispose() {
      restoreEditorCamera();
      previewCamera?.dispose?.();
      previewCamera = null;
    },
  };
}

function readSceneAspect(scene: RuntimeScene): number {
  const engine = scene.getEngine?.();
  const width = Number(engine?.getRenderWidth?.() ?? engine?.getRenderingCanvas?.()?.width ?? 1);
  const height = Number(engine?.getRenderHeight?.() ?? engine?.getRenderingCanvas?.()?.height ?? 1);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 16 / 9;
  return Math.max(0.01, width / height);
}
