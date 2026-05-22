export type SceneViewPointerButton = 'left' | 'middle' | 'right';

export type SceneViewPointerIntent =
  | 'selection-click'
  | 'box-select'
  | 'gizmo-drag'
  | 'view-plane-move'
  | 'placement'
  | 'orbit'
  | 'pan'
  | 'dolly'
  | 'flythrough';

export type SceneViewNavigationMode = 'none' | 'orbit' | 'pan' | 'dolly' | 'flythrough';

export interface SceneViewInputModifiers {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

export interface SceneViewMouseBinding {
  button: SceneViewPointerButton;
  alt?: boolean;
  shift?: boolean;
  ctrlOrMeta?: boolean;
}

export interface SceneViewPointerState {
  pointerId: number;
  button: SceneViewPointerButton;
  intent: SceneViewPointerIntent;
  start: { x: number; y: number };
  current: { x: number; y: number };
  delta: { x: number; y: number };
  modifiers: SceneViewInputModifiers;
}

export interface SceneViewInputState {
  activeIntent: SceneViewPointerIntent | null;
  navigationMode: SceneViewNavigationMode;
  activePointer: SceneViewPointerState | null;
  pressedMovementKeys: string[];
  flySpeed: number;
}
