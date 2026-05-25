import type { BrowserHost } from '@fps-games/editor-browser';
import type {
  EditorRuntimeChange,
  EditorTool,
  MaterialProp,
  MaterialRuntimeKind,
  MaterialValue,
  OutlineProp,
  OutlineValue,
  PersistentBinding,
  RuntimeProp,
} from '@fps-games/editor-protocol';

export type RuntimeScene = any;
export type RuntimeCamera = any;
export type RuntimeNode = any;

export type BabylonRuntimeGlobal = {
  Scene?: new (engine: any) => RuntimeScene;
  UniversalCamera?: new (name: string, position: any, scene: RuntimeScene) => RuntimeCamera;
  ArcRotateCamera?: new (
    name: string,
    alpha: number,
    beta: number,
    radius: number,
    target: any,
    scene: RuntimeScene,
  ) => RuntimeCamera;
  Camera?: {
    PERSPECTIVE_CAMERA?: number;
    ORTHOGRAPHIC_CAMERA?: number;
  };
  Vector3?: new (x: number, y: number, z: number) => any;
  Color3?: new (r: number, g: number, b: number) => any;
  Color4?: new (r: number, g: number, b: number, a: number) => any;
  HemisphericLight?: new (name: string, direction: any, scene: RuntimeScene) => any;
  Texture?: new (url: string, scene: RuntimeScene, noMipmap?: boolean, invertY?: boolean) => any;
  GizmoManager?: new (scene: RuntimeScene) => any;
  UtilityLayerRenderer?: any;
  PointerDragBehavior?: any;
  MeshBuilder?: {
    CreateBox?: (name: string, options: Record<string, unknown>, scene: RuntimeScene) => any;
    CreateSphere?: (name: string, options: Record<string, unknown>, scene: RuntimeScene) => any;
    CreatePlane?: (name: string, options: Record<string, unknown>, scene: RuntimeScene) => any;
    CreateGround?: (name: string, options: Record<string, unknown>, scene: RuntimeScene) => any;
    CreateCapsule?: (name: string, options: Record<string, unknown>, scene: RuntimeScene) => any;
  };
  StandardMaterial?: new (name: string, scene: RuntimeScene) => any;
  DynamicTexture?: new (
    name: string,
    options: { width: number; height: number } | number,
    scene: RuntimeScene,
    generateMipMaps?: boolean,
  ) => any;
  ShaderMaterial?: new (
    name: string,
    scene: RuntimeScene,
    shaderPath: string | Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => any;
  Effect?: {
    ShadersStore?: Record<string, string>;
  };
  Inspector?: any;
  DebugLayerTab?: any;
  InstancedMesh?: any;
  RotationGizmo?: any;
  PlaneRotationGizmo?: any;
};

export type EditorGameLike = {
  scene?: RuntimeScene | null;
  pause?: () => void;
  resume?: () => void;
  isPausedState?: () => boolean;
  enterPreview?: () => Promise<void> | void;
  exitPreview?: (save?: boolean) => Promise<void> | void;
  onEditEnter?: () => Promise<void> | void;
  onEditExit?: () => Promise<void> | void;
};

export type ViewportNavigationButton = 'left' | 'middle' | 'right';

export interface EditorInputControllerApi {
  init(options: EditorInputOptions): void;
  dispose(): void;
  isViewportNavigationActive(): boolean;
  activeViewportNavigationButton(): ViewportNavigationButton | null;
  consumeViewportPointerDelta(): { dx: number; dy: number };
  pressedViewportMovementKeys(): Set<string>;
  resetViewportNavigation(): void;
}

export interface EditorInputOptions {
  host?: BrowserHost;
  getCanvas: () => HTMLCanvasElement | null;
  isEditActive: () => boolean;
  onSetTool: (tool: EditorTool) => void;
  onFocusSelected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicateSelected?: () => void | Promise<void>;
}

export type RuntimeTransformSnapshot = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
};

export type CanonicalTransformChange = {
  runtimeNode: RuntimeNode;
  binding: PersistentBinding | null;
  prop: RuntimeProp;
  before: RuntimeTransformSnapshot[RuntimeProp];
  after: RuntimeTransformSnapshot[RuntimeProp];
};

export type CanonicalMaterialChange = {
  runtimeNode: RuntimeNode;
  binding: PersistentBinding;
  ownerNodePath: string;
  target: 'root' | 'childMaterial';
  materialName: string;
  materialType: string | null;
  materialRuntimeKind: MaterialRuntimeKind;
  path: MaterialProp;
  before: MaterialValue;
  after: MaterialValue;
};

export type CanonicalOutlineChange = {
  runtimeNode: RuntimeNode;
  binding: PersistentBinding;
  ownerNodePath: string;
  target: 'root' | 'childOutline';
  shared: boolean;
  path: OutlineProp;
  before: OutlineValue;
  after: OutlineValue;
};

export type BabylonRuntimeChange =
  | ({ kind: 'transform' } & CanonicalTransformChange)
  | ({ kind: 'material' } & CanonicalMaterialChange)
  | ({ kind: 'outline' } & CanonicalOutlineChange);

export type PersistedRuntimeChange = EditorRuntimeChange;
