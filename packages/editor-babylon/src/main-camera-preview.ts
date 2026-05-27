import type {
  BabylonEditorProjectionCameraSettings,
  BabylonEditorProjectionNode,
  BabylonEditorProjectionTransform,
} from './projection';
import { applyBabylonEditorProjectionCameraRig } from './projection';
import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonMainCameraPreviewRig {
  target?: { x: number; y: number; z: number };
  transform?: BabylonEditorProjectionTransform | null;
  settings?: BabylonEditorProjectionCameraSettings | null;
}

export interface BabylonMainCameraPreviewControllerOptions {
  babylon: BabylonRuntimeGlobal & Record<string, any>;
  scene: RuntimeScene;
  editorCamera: RuntimeCamera;
}

export interface BabylonMainCameraPreviewController {
  isActive(): boolean;
  setActive(active: boolean, rig?: BabylonMainCameraPreviewRig | null): void;
  sync(rig: BabylonMainCameraPreviewRig | null): void;
  dispose(): void;
}

const DEFAULT_MAIN_CAMERA_PREVIEW_SETTINGS: BabylonEditorProjectionCameraSettings = {
  projection: 'orthographic',
  alpha: 3.9269908169872414,
  beta: 0.8,
  radius: 14,
  orthoSize: 6,
  fov: 0.85,
  targetOffset: { x: 0, y: 0, z: 0 },
  minZ: 1,
  maxZ: 10000,
  inertia: 0.9,
  targetScreenOffset: { x: 0, y: 0 },
};

export function createBabylonMainCameraPreviewController(
  options: BabylonMainCameraPreviewControllerOptions,
): BabylonMainCameraPreviewController {
  let previewCamera: RuntimeCamera | null = null;
  let previewCameraKind: 'orbit' | 'transform' | null = null;
  let savedActiveCamera: RuntimeCamera | null = null;
  let savedActiveCameras: RuntimeCamera[] | null = null;
  let savedPointerCamera: RuntimeCamera | null = null;
  let active = false;

  function getPreviewCameraKind(rig: BabylonMainCameraPreviewRig | null | undefined): 'orbit' | 'transform' {
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
        'editor-main-camera-preview',
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else if (options.babylon.ArcRotateCamera) {
      previewCamera = new options.babylon.ArcRotateCamera(
        'editor-main-camera-preview',
        DEFAULT_MAIN_CAMERA_PREVIEW_SETTINGS.alpha,
        DEFAULT_MAIN_CAMERA_PREVIEW_SETTINGS.beta,
        DEFAULT_MAIN_CAMERA_PREVIEW_SETTINGS.radius,
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else if (options.babylon.UniversalCamera) {
      previewCamera = new options.babylon.UniversalCamera(
        'editor-main-camera-preview',
        new Vector3(0, 0, 0),
        options.scene,
      );
    } else {
      return null;
    }
    previewCameraKind = kind;
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

  function applyRig(rig: BabylonMainCameraPreviewRig | null | undefined): void {
    const camera = ensurePreviewCamera(getPreviewCameraKind(rig));
    const Vector3 = options.babylon.Vector3;
    if (!camera || !Vector3) return;
    const settings = {
      ...DEFAULT_MAIN_CAMERA_PREVIEW_SETTINGS,
      ...(rig?.settings ?? {}),
    };
    const target = rig?.target ?? settings.targetOffset ?? { x: 0, y: 0, z: 0 };
    if (rig?.transform) {
      const transform = rig.transform;
      camera.position = new Vector3(transform.position.x, transform.position.y, transform.position.z);
      if (camera.rotationQuaternion) camera.rotationQuaternion = null;
      camera.rotation = new Vector3(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      applyBabylonEditorProjectionCameraRig(options.babylon, options.scene, camera, settings, { lockOrbit: false });
      camera.position = new Vector3(transform.position.x, transform.position.y, transform.position.z);
      if (camera.rotationQuaternion) camera.rotationQuaternion = null;
      camera.rotation = new Vector3(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    } else {
      if (typeof camera.alpha === 'number') {
        applyBabylonEditorProjectionCameraRig(options.babylon, options.scene, camera, settings, { target });
      } else {
        camera.position = createOrbitPosition(Vector3, target, settings);
        applyBabylonEditorProjectionCameraRig(options.babylon, options.scene, camera, settings, { target });
      }
    }
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

export function createBabylonMainCameraPreviewRigFromProjectionNode(
  node: BabylonEditorProjectionNode | null | undefined,
): BabylonMainCameraPreviewRig | null {
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
