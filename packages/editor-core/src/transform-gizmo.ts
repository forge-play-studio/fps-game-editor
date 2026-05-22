export type EditorTransformTool = 'select' | 'move' | 'rotate' | 'scale';

export type EditorTransformSpace = 'world' | 'local';

export type EditorTransformCanonicalConstraint = 'axis' | 'plane' | 'free' | 'uniform';

export type EditorTransformConstraint = EditorTransformCanonicalConstraint | 'view-plane';

export interface EditorTransformHandleDescriptor {
  id: string;
  constraint: EditorTransformCanonicalConstraint;
  label: string;
  description: string;
}

export interface EditorTransformToolDescriptor {
  tool: EditorTransformTool;
  label: string;
  shortcut?: string;
  defaultConstraint?: EditorTransformCanonicalConstraint;
  handles: readonly EditorTransformHandleDescriptor[];
}

export const DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS = {
  select: {
    tool: 'select',
    label: '选择',
    shortcut: 'Q',
    handles: [],
  },
  move: {
    tool: 'move',
    label: '移动',
    shortcut: 'W',
    defaultConstraint: 'axis',
    handles: [
      {
        id: 'move.axis',
        constraint: 'axis',
        label: '轴向',
        description: '沿 X/Y/Z 单轴移动。',
      },
      {
        id: 'move.plane',
        constraint: 'plane',
        label: '平面',
        description: '沿 XY/XZ/YZ 平面移动。',
      },
      {
        id: 'move.free',
        constraint: 'free',
        label: '自由',
        description: '沿当前摄像机视图平面自由移动。',
      },
    ],
  },
  rotate: {
    tool: 'rotate',
    label: '旋转',
    shortcut: 'E',
    defaultConstraint: 'axis',
    handles: [
      {
        id: 'rotate.axis',
        constraint: 'axis',
        label: '轴向',
        description: '绕 X/Y/Z 单轴旋转。',
      },
    ],
  },
  scale: {
    tool: 'scale',
    label: '缩放',
    shortcut: 'R',
    defaultConstraint: 'axis',
    handles: [
      {
        id: 'scale.axis',
        constraint: 'axis',
        label: '轴向',
        description: '沿 X/Y/Z 单轴缩放。',
      },
      {
        id: 'scale.uniform',
        constraint: 'uniform',
        label: '统一',
        description: '沿所有轴等比缩放。',
      },
    ],
  },
} satisfies Record<EditorTransformTool, EditorTransformToolDescriptor>;

export function getEditorTransformToolDescriptor(
  tool: EditorTransformTool,
): EditorTransformToolDescriptor {
  return DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS[tool];
}

export function normalizeEditorTransformConstraint(
  tool: EditorTransformTool,
  constraint?: EditorTransformConstraint | null,
): EditorTransformCanonicalConstraint | undefined {
  const descriptor = getEditorTransformToolDescriptor(tool);
  if (!descriptor.defaultConstraint) return undefined;
  const normalized = constraint === 'view-plane' ? 'free' : constraint;
  if (normalized && descriptor.handles.some(handle => handle.constraint === normalized)) {
    return normalized;
  }
  return descriptor.defaultConstraint;
}

export interface EditorTransformVec3 {
  x: number;
  y: number;
  z: number;
}

export interface EditorTransformSnapshot {
  position: EditorTransformVec3;
  rotation: EditorTransformVec3;
  scale: EditorTransformVec3;
}

export type EditorTransformGizmoDragPhase = 'idle' | 'dragging';

export interface EditorTransformGizmoState {
  tool: EditorTransformTool;
  space: EditorTransformSpace;
  constraint?: EditorTransformConstraint;
  selectedNodeId: string | null;
  dragPhase: EditorTransformGizmoDragPhase;
  draggingNodeId: string | null;
}

export interface EditorTransformGizmoCommit {
  nodeId: string;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  before: EditorTransformSnapshot;
  after: EditorTransformSnapshot;
}

export interface EditorTransformPivot {
  mode: 'selection-center';
  position: EditorTransformVec3;
}

export interface EditorTransformTargetSnapshot {
  id: string;
  before: EditorTransformSnapshot;
  after: EditorTransformSnapshot;
}

export interface EditorTransformBatchCommit {
  targetIds: string[];
  activeId: string | null;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  pivot: EditorTransformPivot;
  targets: EditorTransformTargetSnapshot[];
}
