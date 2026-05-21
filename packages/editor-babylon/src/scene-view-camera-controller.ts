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
  handlePointerIntentMove(event: BabylonSceneViewInputPointerEvent): boolean;
  handleWheel(event: BabylonSceneViewInputWheelEvent): boolean;
  dispose(): void;
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
      return true;
    }
    if (intent === 'flythrough') {
      lookCamera(delta.x, delta.y);
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
