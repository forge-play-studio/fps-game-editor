import type { EditorTransformVec3 } from './transform-gizmo';

export type EditorViewportViewPreset = 'perspective' | 'top' | 'front' | 'right';

export type EditorViewportProjectionMode = 'perspective' | 'orthographic';

export type EditorViewportUtilityTool = 'none' | 'measure-distance';

export interface EditorViewportOverlaySettings {
  bounds: boolean;
  dimensions: boolean;
  edgeLengths: boolean;
  anchor: boolean;
}

export interface EditorViewportToolState {
  viewPreset: EditorViewportViewPreset;
  projectionMode: EditorViewportProjectionMode;
  activeUtilityTool: EditorViewportUtilityTool;
  overlay: EditorViewportOverlaySettings;
}

export interface EditorViewportGroundMeasurement {
  active: boolean;
  start: EditorTransformVec3 | null;
  end: EditorTransformVec3 | null;
  preview: EditorTransformVec3 | null;
  distance: number | null;
  screenStart?: EditorViewportScreenPoint | null;
  screenEnd?: EditorViewportScreenPoint | null;
  screenPreview?: EditorViewportScreenPoint | null;
  label?: {
    text: string;
    x: number;
    y: number;
  } | null;
}

export interface EditorViewportBounds {
  min: EditorTransformVec3;
  max: EditorTransformVec3;
  center: EditorTransformVec3;
  size: EditorTransformVec3;
}

export interface EditorViewportScreenPoint {
  x: number;
  y: number;
  depth: number;
}

export type EditorViewportSpatialOverlayLineKind = 'bounds';

export interface EditorViewportSpatialOverlayLine {
  id: string;
  kind: EditorViewportSpatialOverlayLineKind;
  start: EditorViewportScreenPoint;
  end: EditorViewportScreenPoint;
}

export type EditorViewportSpatialOverlayLabelKind = 'dimension' | 'edge-length' | 'anchor';

export interface EditorViewportSpatialOverlayLabel {
  id: string;
  kind: EditorViewportSpatialOverlayLabelKind;
  text: string;
  x: number;
  y: number;
}

export interface EditorViewportSpatialOverlayMarker {
  id: string;
  kind: 'anchor';
  position: EditorViewportScreenPoint;
  label: string;
}

export interface EditorViewportSpatialOverlayState {
  active: boolean;
  nodeId: string | null;
  bounds: EditorViewportBounds | null;
  anchor: EditorTransformVec3 | null;
  lines: EditorViewportSpatialOverlayLine[];
  labels: EditorViewportSpatialOverlayLabel[];
  markers: EditorViewportSpatialOverlayMarker[];
}

export const DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS = {
  bounds: false,
  dimensions: false,
  edgeLengths: false,
  anchor: false,
} satisfies EditorViewportOverlaySettings;

export const DEFAULT_EDITOR_VIEWPORT_TOOL_STATE = {
  viewPreset: 'perspective',
  projectionMode: 'perspective',
  activeUtilityTool: 'none',
  overlay: DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS,
} satisfies EditorViewportToolState;

export function cloneEditorViewportOverlaySettings(
  settings: EditorViewportOverlaySettings,
): EditorViewportOverlaySettings {
  return { ...settings };
}

export function cloneEditorViewportToolState(
  state: EditorViewportToolState,
): EditorViewportToolState {
  return {
    ...state,
    overlay: cloneEditorViewportOverlaySettings(state.overlay),
  };
}

export function cloneEditorViewportSpatialOverlayState(
  state: EditorViewportSpatialOverlayState,
): EditorViewportSpatialOverlayState {
  return {
    active: state.active,
    nodeId: state.nodeId,
    bounds: state.bounds
      ? {
          min: { ...state.bounds.min },
          max: { ...state.bounds.max },
          center: { ...state.bounds.center },
          size: { ...state.bounds.size },
        }
      : null,
    anchor: state.anchor ? { ...state.anchor } : null,
    lines: state.lines.map(line => ({
      ...line,
      start: { ...line.start },
      end: { ...line.end },
    })),
    labels: state.labels.map(label => ({ ...label })),
    markers: state.markers.map(marker => ({
      ...marker,
      position: { ...marker.position },
    })),
  };
}

export function createEmptyEditorViewportSpatialOverlayState(): EditorViewportSpatialOverlayState {
  return {
    active: false,
    nodeId: null,
    bounds: null,
    anchor: null,
    lines: [],
    labels: [],
    markers: [],
  };
}
