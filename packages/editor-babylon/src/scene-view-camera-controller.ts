import type {
  EditorViewportProjectionMode,
  EditorViewportViewPreset,
} from '@fps-games/editor-core';
import type {
  BabylonSceneViewInputController,
  BabylonSceneViewInputPointerEvent,
  BabylonSceneViewInputWheelEvent,
} from './scene-view-input-controller';
import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonSceneViewCameraControllerOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
  camera: RuntimeCamera;
  input: BabylonSceneViewInputController;
  orbitSensitivity?: number;
  panSensitivity?: number;
  dollySensitivity?: number;
}

export interface BabylonSceneViewCameraController {
  getState(): BabylonSceneViewCameraState;
  setViewPreset(preset: EditorViewportViewPreset, options?: BabylonSceneViewCameraPresetOptions): boolean;
  setProjectionMode(mode: EditorViewportProjectionMode): boolean;
  handlePointerIntentMove(event: BabylonSceneViewInputPointerEvent): boolean;
  handleWheel(event: BabylonSceneViewInputWheelEvent): boolean;
  dispose(): void;
}

export interface BabylonSceneViewCameraState {
  viewPreset: EditorViewportViewPreset;
  projectionMode: EditorViewportProjectionMode;
}

export interface BabylonSceneViewCameraPresetOptions {
  target?: Vec3 | null;
  radius?: number;
}

interface PerspectiveSnapshot {
  alpha?: number;
  beta?: number;
  radius?: number;
  target?: Vec3;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_ORBIT_SENSITIVITY = 0.005;
const DEFAULT_PAN_SENSITIVITY = 0.0015;
const DEFAULT_DOLLY_SENSITIVITY = 0.001;
const MIN_CAMERA_RADIUS = 0.2;
const MAX_CAMERA_RADIUS = 10000;
const DEFAULT_ORTHO_RADIUS = 10;
const DEFAULT_ORTHO_SIZE = 6;

export function createBabylonSceneViewCameraController(
  options: BabylonSceneViewCameraControllerOptions,
): BabylonSceneViewCameraController {
  const camera = options.camera as any;
  const scene = options.scene;
  const input = options.input;
  const Vector3 = options.babylon.Vector3;
  const orbitSensitivity = options.orbitSensitivity ?? DEFAULT_ORBIT_SENSITIVITY;
  const panSensitivity = options.panSensitivity ?? DEFAULT_PAN_SENSITIVITY;
  const dollySensitivity = options.dollySensitivity ?? DEFAULT_DOLLY_SENSITIVITY;
  let disposed = false;
  let renderObserver: unknown = null;
  let viewPreset: EditorViewportViewPreset = 'perspective';
  let projectionMode: EditorViewportProjectionMode = readProjectionMode();
  let lastPerspective: PerspectiveSnapshot | null = readPerspectiveSnapshot();

  if (scene?.onBeforeRenderObservable?.add) {
    renderObserver = scene.onBeforeRenderObservable.add(() => {
      if (disposed) return;
      updateFlythroughMovement();
    });
  }

  function handlePointerIntentMove(event: BabylonSceneViewInputPointerEvent): boolean {
    if (disposed) return false;
    const { intent, delta } = event.state;
    if (intent === 'orbit') {
      orbitCamera(delta.x, delta.y);
      viewPreset = 'perspective';
      return true;
    }
    if (intent === 'flythrough') {
      lookCamera(delta.x, delta.y);
      viewPreset = 'perspective';
      return true;
    }
    if (intent === 'pan') {
      panCamera(delta.x, delta.y);
      return true;
    }
    if (intent === 'dolly') {
      dollyCamera(delta.y * 4);
      return true;
    }
    return false;
  }

  function handleWheel(event: BabylonSceneViewInputWheelEvent): boolean {
    if (disposed) return false;
    if (input.getState().navigationMode === 'flythrough') return true;
    dollyCamera(event.deltaY);
    return true;
  }

  function getState(): BabylonSceneViewCameraState {
    return {
      viewPreset,
      projectionMode: readProjectionMode(),
    };
  }

  function setViewPreset(
    preset: EditorViewportViewPreset,
    presetOptions: BabylonSceneViewCameraPresetOptions = {},
  ): boolean {
    if (disposed) return false;
    const nextPreset = preset === 'top' || preset === 'front' || preset === 'right' ? preset : 'perspective';
    if (nextPreset === 'perspective') {
      viewPreset = 'perspective';
      restorePerspective();
      setProjectionMode('perspective');
      return true;
    }

    if (readProjectionMode() === 'perspective') {
      lastPerspective = readPerspectiveSnapshot() ?? lastPerspective;
    }
    viewPreset = nextPreset;
    applyOrthographicPreset(nextPreset, presetOptions);
    setProjectionMode('orthographic');
    return true;
  }

  function setProjectionMode(mode: EditorViewportProjectionMode): boolean {
    if (disposed) return false;
    const nextMode = mode === 'orthographic' ? 'orthographic' : 'perspective';
    const Camera = options.babylon.Camera;
    camera.mode = nextMode === 'orthographic'
      ? Camera?.ORTHOGRAPHIC_CAMERA ?? 1
      : Camera?.PERSPECTIVE_CAMERA ?? 0;
    projectionMode = nextMode;
    if (nextMode === 'orthographic') updateOrthoExtents(resolveOrthoSize());
    return true;
  }

  function updateFlythroughMovement(): void {
    if (input.getState().navigationMode !== 'flythrough') return;
    const pressed = input.getState().pressedMovementKeys;
    if (pressed.length === 0) return;
    const dt = Math.max(0, Number(scene?.getEngine?.()?.getDeltaTime?.() ?? 16.67)) / 1000;
    const speed = input.getState().flySpeed;
    const step = speed * dt * 4;
    const forward = getCameraForward();
    const right = getCameraRight();
    if (!forward || !right) return;
    const up = { x: 0, y: 1, z: 0 };
    let move = { x: 0, y: 0, z: 0 };
    for (const key of pressed) {
      if (key === 'w') move = addVec3(move, forward);
      else if (key === 's') move = subtractVec3(move, forward);
      else if (key === 'd') move = addVec3(move, right);
      else if (key === 'a') move = subtractVec3(move, right);
      else if (key === 'e') move = addVec3(move, up);
      else if (key === 'q') move = subtractVec3(move, up);
    }
    const normalized = normalizeVec3(move);
    if (!normalized) return;
    translateCamera(scaleVec3(normalized, step));
  }

  function orbitCamera(dx: number, dy: number): void {
    if (Number.isFinite(camera.alpha) && Number.isFinite(camera.beta)) {
      camera.alpha -= dx * orbitSensitivity;
      camera.beta = clamp(camera.beta - dy * orbitSensitivity, 0.01, Math.PI - 0.01);
      return;
    }
    if (camera.rotation) {
      camera.rotation.y -= dx * orbitSensitivity;
      camera.rotation.x = clamp(camera.rotation.x - dy * orbitSensitivity, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    }
  }

  function lookCamera(dx: number, dy: number): void {
    if (Number.isFinite(camera.alpha) && Number.isFinite(camera.beta)) {
      camera.alpha += dx * orbitSensitivity;
      camera.beta = clamp(camera.beta - dy * orbitSensitivity, 0.01, Math.PI - 0.01);
      return;
    }
    if (camera.rotation) {
      camera.rotation.y -= dx * orbitSensitivity;
      camera.rotation.x = clamp(camera.rotation.x - dy * orbitSensitivity, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    }
  }

  function panCamera(dx: number, dy: number): void {
    const right = getCameraRight();
    const up = getCameraUp();
    if (!right || !up) return;
    const radiusScale = Number.isFinite(camera.radius) ? Math.max(Number(camera.radius), 1) : 8;
    const scale = radiusScale * panSensitivity;
    const delta = addVec3(
      scaleVec3(right, -dx * scale),
      scaleVec3(up, dy * scale),
    );
    translateCamera(delta);
  }

  function dollyCamera(deltaY: number): void {
    if (Number.isFinite(camera.radius)) {
      const factor = 1 + deltaY * dollySensitivity;
      camera.radius = clamp(Number(camera.radius) * Math.max(0.05, factor), MIN_CAMERA_RADIUS, MAX_CAMERA_RADIUS);
      if (readProjectionMode() === 'orthographic') updateOrthoExtents(resolveOrthoSize());
      return;
    }
    const forward = getCameraForward();
    if (!forward) return;
    translateCamera(scaleVec3(forward, -deltaY * 0.01));
  }

  function translateCamera(delta: Vec3): void {
    if (camera.target) {
      addInPlace(camera.target, delta);
      return;
    }
    if (camera.position) {
      addInPlace(camera.position, delta);
    }
  }

  function applyOrthographicPreset(
    preset: Exclude<EditorViewportViewPreset, 'perspective'>,
    presetOptions: BabylonSceneViewCameraPresetOptions,
  ): void {
    const target = presetOptions.target ?? readTarget() ?? { x: 0, y: 0, z: 0 };
    const currentRadius = Number(camera.radius);
    const radius = clamp(
      presetOptions.radius
        ?? (Number.isFinite(currentRadius) ? currentRadius : lastPerspective?.radius ?? DEFAULT_ORTHO_RADIUS),
      MIN_CAMERA_RADIUS,
      MAX_CAMERA_RADIUS,
    );
    if (camera.target && Vector3) camera.target = new Vector3(target.x, target.y, target.z);
    else if (camera.setTarget && Vector3) camera.setTarget(new Vector3(target.x, target.y, target.z));

    if (Number.isFinite(camera.alpha) && Number.isFinite(camera.beta)) {
      if (preset === 'top') {
        camera.alpha = Math.PI / 2;
        camera.beta = 0.01;
      } else if (preset === 'front') {
        camera.alpha = -Math.PI / 2;
        camera.beta = Math.PI / 2;
      } else {
        camera.alpha = 0;
        camera.beta = Math.PI / 2;
      }
      camera.radius = radius;
    } else if (camera.position && Vector3) {
      const offset = preset === 'top'
        ? { x: 0, y: radius, z: 0 }
        : preset === 'front'
          ? { x: 0, y: 0, z: -radius }
          : { x: radius, y: 0, z: 0 };
      camera.position = new Vector3(target.x + offset.x, target.y + offset.y, target.z + offset.z);
      camera.setTarget?.(new Vector3(target.x, target.y, target.z));
    }
    updateOrthoExtents(Math.max(radius * 0.5, DEFAULT_ORTHO_SIZE));
  }

  function restorePerspective(): void {
    const snapshot = lastPerspective;
    if (!snapshot) return;
    if (Number.isFinite(snapshot.alpha)) camera.alpha = snapshot.alpha;
    if (Number.isFinite(snapshot.beta)) camera.beta = snapshot.beta;
    if (Number.isFinite(snapshot.radius)) camera.radius = snapshot.radius;
    if (snapshot.target && Vector3) {
      if (camera.target) camera.target = new Vector3(snapshot.target.x, snapshot.target.y, snapshot.target.z);
      else camera.setTarget?.(new Vector3(snapshot.target.x, snapshot.target.y, snapshot.target.z));
    }
  }

  function readProjectionMode(): EditorViewportProjectionMode {
    const Camera = options.babylon.Camera;
    const orthoMode = Camera?.ORTHOGRAPHIC_CAMERA ?? 1;
    return camera.mode === orthoMode ? 'orthographic' : 'perspective';
  }

  function readTarget(): Vec3 | null {
    if (camera.target) return readVec3(camera.target);
    const target = camera.getTarget?.();
    return target ? readVec3(target) : null;
  }

  function readPerspectiveSnapshot(): PerspectiveSnapshot | null {
    if (!camera) return null;
    return {
      alpha: Number.isFinite(camera.alpha) ? Number(camera.alpha) : undefined,
      beta: Number.isFinite(camera.beta) ? Number(camera.beta) : undefined,
      radius: Number.isFinite(camera.radius) ? Number(camera.radius) : undefined,
      target: readTarget() ?? undefined,
    };
  }

  function resolveOrthoSize(): number {
    const top = Number(camera.orthoTop);
    const bottom = Number(camera.orthoBottom);
    if (Number.isFinite(top) && Number.isFinite(bottom) && top !== bottom) {
      return Math.abs(top - bottom) / 2;
    }
    const radius = Number(camera.radius);
    return Number.isFinite(radius) ? Math.max(radius * 0.5, DEFAULT_ORTHO_SIZE) : DEFAULT_ORTHO_SIZE;
  }

  function updateOrthoExtents(halfHeight: number): void {
    const engine = scene?.getEngine?.();
    const width = Number(engine?.getRenderWidth?.() ?? engine?.getRenderingCanvas?.()?.width ?? 1);
    const height = Number(engine?.getRenderHeight?.() ?? engine?.getRenderingCanvas?.()?.height ?? 1);
    const aspect = height > 0 ? Math.max(0.0001, width / height) : 1;
    const size = Math.max(0.001, halfHeight);
    camera.orthoTop = size;
    camera.orthoBottom = -size;
    camera.orthoLeft = -size * aspect;
    camera.orthoRight = size * aspect;
  }

  function getCameraForward(): Vec3 | null {
    const forwardRayDirection = readVec3(camera?.getForwardRay?.()?.direction);
    if (isNonZeroVec3(forwardRayDirection)) return forwardRayDirection;
    const forwardZ = scene?.useRightHandedSystem ? -1 : 1;
    return getCameraDirection({ x: 0, y: 0, z: forwardZ });
  }

  function getCameraRight(): Vec3 | null {
    return getCameraDirection({ x: 1, y: 0, z: 0 });
  }

  function getCameraUp(): Vec3 | null {
    return getCameraDirection({ x: 0, y: 1, z: 0 });
  }

  function getCameraDirection(local: Vec3): Vec3 | null {
    if (!camera?.getDirection || !Vector3) return null;
    try {
      return readVec3(camera.getDirection(new Vector3(local.x, local.y, local.z)));
    } catch {
      return null;
    }
  }

  return {
    getState,
    setViewPreset,
    setProjectionMode,
    handlePointerIntentMove,
    handleWheel,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (renderObserver && scene?.onBeforeRenderObservable?.remove) {
        scene.onBeforeRenderObservable.remove(renderObserver);
      }
      renderObserver = null;
    },
  };
}

function readVec3(value: any): Vec3 {
  return {
    x: Number(value?.x) || 0,
    y: Number(value?.y) || 0,
    z: Number(value?.z) || 0,
  };
}

function isNonZeroVec3(value: Vec3): boolean {
  return Math.hypot(value.x, value.y, value.z) > 0.000001;
}

function addInPlace(target: any, delta: Vec3): void {
  if (target?.addInPlaceFromFloats) {
    target.addInPlaceFromFloats(delta.x, delta.y, delta.z);
    return;
  }
  target.x = (Number(target.x) || 0) + delta.x;
  target.y = (Number(target.y) || 0) + delta.y;
  target.z = (Number(target.z) || 0) + delta.z;
}

function addVec3(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function subtractVec3(left: Vec3, right: Vec3): Vec3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function scaleVec3(value: Vec3, scale: number): Vec3 {
  return { x: value.x * scale, y: value.y * scale, z: value.z * scale };
}

function normalizeVec3(value: Vec3): Vec3 | null {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 0.000001) return null;
  return scaleVec3(value, 1 / length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
