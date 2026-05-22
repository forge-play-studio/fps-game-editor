import type {
  EditorTransformSnapshot,
  EditorTransformTool,
  EditorTransformVec3,
  EditorTransformTargetSnapshot,
} from './transform-gizmo';

export interface EditorTransformSnapSettings {
  enabled: boolean;
  moveStep: number;
  rotateStepDegrees: number;
  scaleStep: number;
}

export type EditorPlacementMode = 'off' | 'ground' | 'surface';

export interface EditorPlacementHit {
  mode: Exclude<EditorPlacementMode, 'off'>;
  position: EditorTransformVec3;
  normal?: EditorTransformVec3;
  nodeId?: string | null;
}

export interface EditorTransformOperationSettings {
  snap: EditorTransformSnapSettings;
  placementMode: EditorPlacementMode;
}

export type EditorTransformAction =
  | 'align-x'
  | 'align-y'
  | 'align-z'
  | 'align-all'
  | 'distribute-x'
  | 'distribute-y'
  | 'distribute-z';

export interface EditorTransformActionTarget {
  id: string;
  transform: EditorTransformSnapshot;
}

export interface EditorTransformActionInput {
  action: EditorTransformAction;
  activeId: string | null;
  targets: readonly EditorTransformActionTarget[];
}

export const DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS: EditorTransformOperationSettings = {
  snap: {
    enabled: false,
    moveStep: 0.5,
    rotateStepDegrees: 15,
    scaleStep: 0.1,
  },
  placementMode: 'off',
};

export function snapEditorTransformSnapshot(
  before: EditorTransformSnapshot,
  after: EditorTransformSnapshot,
  tool: Exclude<EditorTransformTool, 'select'>,
  settings: EditorTransformSnapSettings,
): EditorTransformSnapshot {
  if (!settings.enabled) return cloneTransformSnapshot(after);
  if (tool === 'move') {
    return {
      position: snapVec3Delta(before.position, after.position, settings.moveStep),
      rotation: cloneVec3(after.rotation),
      scale: cloneVec3(after.scale),
    };
  }
  if (tool === 'rotate') {
    return {
      position: cloneVec3(after.position),
      rotation: snapVec3Delta(before.rotation, after.rotation, degreesToRadians(settings.rotateStepDegrees)),
      scale: cloneVec3(after.scale),
    };
  }
  return {
    position: cloneVec3(after.position),
    rotation: cloneVec3(after.rotation),
    scale: snapVec3Delta(before.scale, after.scale, settings.scaleStep),
  };
}

export function computeEditorTransformActionTargets(
  input: EditorTransformActionInput,
): EditorTransformTargetSnapshot[] {
  const targets = input.targets
    .filter(target => !!target.id)
    .map(target => ({
      id: target.id,
      before: cloneTransformSnapshot(target.transform),
      after: cloneTransformSnapshot(target.transform),
    }));
  if (targets.length === 0) return [];
  if (input.action.startsWith('align-')) {
    return computeAlignTargets(input.action, input.activeId, targets);
  }
  return computeDistributeTargets(input.action, targets);
}

function computeAlignTargets(
  action: EditorTransformAction,
  activeId: string | null,
  targets: EditorTransformTargetSnapshot[],
): EditorTransformTargetSnapshot[] {
  if (targets.length < 2 || !activeId) return [];
  const active = targets.find(target => target.id === activeId);
  if (!active) return [];
  const axes = action === 'align-all' ? ['x', 'y', 'z'] as const : [action.slice(-1) as 'x' | 'y' | 'z'];
  return targets.map((target) => {
    const position = cloneVec3(target.after.position);
    for (const axis of axes) position[axis] = active.before.position[axis];
    return {
      ...target,
      after: {
        ...target.after,
        position,
      },
    };
  });
}

function computeDistributeTargets(
  action: EditorTransformAction,
  targets: EditorTransformTargetSnapshot[],
): EditorTransformTargetSnapshot[] {
  if (targets.length < 3) return [];
  const axis = action.slice(-1) as 'x' | 'y' | 'z';
  const sorted = [...targets].sort((left, right) => left.before.position[axis] - right.before.position[axis]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const step = (last.before.position[axis] - first.before.position[axis]) / (sorted.length - 1);
  return sorted.map((target, index) => {
    const position = cloneVec3(target.after.position);
    position[axis] = sanitizeNumber(first.before.position[axis] + step * index);
    return {
      ...target,
      after: {
        ...target.after,
        position,
      },
    };
  });
}

function snapVec3Delta(
  before: EditorTransformVec3,
  after: EditorTransformVec3,
  step: number,
): EditorTransformVec3 {
  if (!Number.isFinite(step) || step <= 0) return cloneVec3(after);
  return {
    x: snapDeltaComponent(before.x, after.x, step),
    y: snapDeltaComponent(before.y, after.y, step),
    z: snapDeltaComponent(before.z, after.z, step),
  };
}

function snapDeltaComponent(before: number, after: number, step: number): number {
  const delta = after - before;
  return sanitizeNumber(before + Math.round(delta / step) * step);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function cloneTransformSnapshot(transform: EditorTransformSnapshot): EditorTransformSnapshot {
  return {
    position: cloneVec3(transform.position),
    rotation: cloneVec3(transform.rotation),
    scale: cloneVec3(transform.scale),
  };
}

function cloneVec3(value: EditorTransformVec3): EditorTransformVec3 {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function sanitizeNumber(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.abs(value) < 0.000000000001
    ? 0
    : Number(value.toFixed(12));
}
