export type EditorTransformTool = 'select' | 'move' | 'rotate' | 'scale';

export type EditorTransformSpace = 'world' | 'local';

export type EditorTransformConstraint = 'axis' | 'plane' | 'view-plane';

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
  constraint: EditorTransformConstraint;
  pivot: EditorTransformPivot;
  targets: EditorTransformTargetSnapshot[];
}
