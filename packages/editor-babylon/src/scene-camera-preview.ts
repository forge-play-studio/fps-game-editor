import type {
  BabylonEditorProjectionCameraSettings,
  BabylonEditorProjectionNode,
  BabylonEditorProjectionTransform,
} from './projection';
import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonSceneCameraPreviewRig {
  target?: { x: number; y: number; z: number };
  transform?: BabylonEditorProjectionTransform | null;
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
  let previewCameraKind: 'orbit' | 'transform' | null = null;
  let savedActiveCamera: RuntimeCamera | null = null;
  let savedActiveCameras: RuntimeCamera[] | null = null;
  let savedPointerCamera: RuntimeCamera | null = null;
  let active = false;

  function getPreviewCameraKind(rig: BabylonSceneCameraPreviewRig | null | undefined): 'orbit' | 'transform' {
    return rig?.transform && options.babylon.UniversalCamera ? 'transform' : 'orbit';
  }

  function ensurePreviewCamera(kind: 'orbit' | 'transform'): RuntimeCamera | null {
    if (previewCamera && previewCameraKind === kind) return previewCamera;
    previewCamera?.dispose?.();
    previewCamera = null;
    previewCameraKind = null;
    const Vector3 = options.babylon.Vector3;
    if (!Vector3) return null;
    if (kind === 'transform' && options.babylon.UniversalCamera) {
      previewCamera = new options.babylon.UniversalCamera(
        'editor-scene-camera-preview',
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else if (options.babylon.ArcRotateCamera) {
      previewCamera = new options.babylon.ArcRotateCamera(
        'editor-scene-camera-preview',
        DEFAULT_SCENE_CAMERA_SETTINGS.alpha,
        DEFAULT_SCENE_CAMERA_SETTINGS.beta,
        DEFAULT_SCENE_CAMERA_SETTINGS.radius,
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else if (options.babylon.UniversalCamera) {
      previewCamera = new options.babylon.UniversalCamera(
        'editor-scene-camera-preview',
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else {
      return null;
    }
    previewCameraKind = kind;
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
    const camera = ensurePreviewCamera(getPreviewCameraKind(rig));
    const Vector3 = options.babylon.Vector3;
    if (!camera || !Vector3) return;
    const settings = {
      ...DEFAULT_SCENE_CAMERA_SETTINGS,
      ...(rig?.settings ?? {}),
    };
    const target = rig?.target ?? { x: 0, y: 0, z: 0 };
    if (rig?.transform) {
      const transform = rig.transform;
      camera.position = new Vector3(transform.position.x, transform.position.y, transform.position.z);
      if (camera.rotationQuaternion) camera.rotationQuaternion = null;
      camera.rotation = new Vector3(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    } else {
      const targetVector = new Vector3(target.x, target.y, target.z);
      if (typeof camera.alpha === 'number') {
        camera.target = targetVector;
        camera.alpha = settings.alpha;
        camera.beta = settings.beta;
        camera.radius = settings.radius;
        camera.lowerAlphaLimit = settings.alpha;
        camera.upperAlphaLimit = settings.alpha;
        camera.lowerBetaLimit = settings.beta;
        camera.upperBetaLimit = settings.beta;
        camera.lowerRadiusLimit = settings.radius;
        camera.upperRadiusLimit = settings.radius;
      } else {
        camera.position = createOrbitPosition(Vector3, target, settings);
        camera.setTarget?.(targetVector);
      }
    }
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
        const camera = ensurePreviewCamera(getPreviewCameraKind(rig));
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

export function createBabylonSceneCameraPreviewRigFromProjectionNode(
  node: BabylonEditorProjectionNode | null | undefined,
): BabylonSceneCameraPreviewRig | null {
  if (!node || node.runtimeKind !== 'camera' || node.active === false) return null;
  return {
    ...(node.transform
      ? {
          transform: {
            position: { ...node.transform.position },
            rotation: { ...node.transform.rotation },
            ...(node.transform.scale ? { scale: { ...node.transform.scale } } : {}),
          },
        }
      : {}),
    ...(node.camera ? { settings: { ...node.camera } } : {}),
  };
}

function readSceneAspect(scene: RuntimeScene): number {
  const engine = scene.getEngine?.();
  const width = Number(engine?.getRenderWidth?.() ?? engine?.getRenderingCanvas?.()?.width ?? 1);
  const height = Number(engine?.getRenderHeight?.() ?? engine?.getRenderingCanvas?.()?.height ?? 1);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 16 / 9;
  return Math.max(0.01, width / height);
}

function createOrbitPosition(
  Vector3: new (x: number, y: number, z: number) => any,
  target: { x: number; y: number; z: number },
  settings: BabylonEditorProjectionCameraSettings,
): any {
  const sinBeta = Math.sin(settings.beta);
  return new Vector3(
    target.x + settings.radius * Math.cos(settings.alpha) * sinBeta,
    target.y + settings.radius * Math.cos(settings.beta),
    target.z + settings.radius * Math.sin(settings.alpha) * sinBeta,
  );
}
