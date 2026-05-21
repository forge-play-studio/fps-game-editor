// 面板框架类型定义

/** 参数类型 */
export type ParamType = 'number' | 'boolean' | 'color' | 'select' | 'string' | 'curve' | 'texture' | 'vector3' | 'action' | 'log';

/**
 * Session lifecycle: framework ownership and host/game attachment state.
 *
 * This is intentionally separate from Runtime state. A session can be ready
 * while the UI is unmounted, and dispose must clean registries even when no DOM
 * is currently visible.
 */
export type DebugPanelSessionState = 'created' | 'initializing' | 'ready' | 'failed' | 'disposing' | 'disposed';

/**
 * Runtime lifecycle: visible DOM and input ownership state.
 *
 * mounted means the floating panel exists but game input still owns the page.
 * active means Debug Mode is ON and InputStack has entered its isolation layer.
 */
export type DebugPanelRuntimeState = 'unmounted' | 'mounted' | 'active';

/**
 * Single panel instance lifecycle: DSL/control state for one generated panel.
 *
 * registered keeps values without DOM, collapsed is the cheap row, expanded is
 * the full editor surface, and disposed is final cleanup.
 */
export type DebugPanelInstanceState = 'registered' | 'collapsed' | 'expanded' | 'suspended' | 'disposed';

/**
 * Live binding lifecycle: panel values patched into game runtime controllers.
 *
 * This axis is independent from Runtime/UI. A panel can be collapsed or Debug
 * Mode can be OFF while its live-applied values still affect real gameplay.
 */
export type DebugPanelLiveBindingState = 'unbound' | 'bound' | 'disposed';

export type PanelValueState = 'clean' | 'modified';
export type PanelPersistenceState = 'saved' | 'unsaved' | 'not-persisted' | 'save-failed';
export type PanelLiveState = 'idle' | 'applied' | 'modified-pending' | 'apply-failed' | 'no-controller';

/** Panel persistence model. */
export type PanelPersistence = 'config' | 'runtime' | 'none';

/** 面板 DSL 中的单个参数定义 */
export interface ParamDSL {
  key: string;
  label: string;
  type: ParamType;
  configPaths: string[];
  /**
   * Runtime controller patch path. Only params with runtimePath participate in
   * automatic live apply; params without it are UI-only values or action args.
   */
  runtimePath?: string;
  /** Runtime action name for param.type="action". */
  action?: string;
  /** Optional action payload. "$value" and "$values.<key>" are interpolated. */
  actionArgs?: Record<string, unknown>;
  default: unknown;
  range?: [number, number];
  step?: number;
  unit?: string;
  group?: string;
  options?: { label: string; value: unknown }[];
  curveMaxPoints?: number;
  description?: string;
}

/** 面板 DSL（AI 产出） */
export interface PanelDSL {
  id: string;
  title: string;
  configFile: string;
  /**
   * Defaults to "config" unless configFile is "runtime" or every param has no
   * configPaths. Runtime/none panels can live-apply values but are skipped by
   * Save to Config and dirty tracking.
   */
  persistence?: PanelPersistence;
  category: string;
  /**
   * Optional runtime controller id. When present, param changes with runtime
   * bindings are automatically patched to the controller by the framework.
   */
  controller?: string;
  params: ParamDSL[];
}

export interface PanelDSLValidationError {
  field: string;
  reason: string;
}

/** 运行时面板实例 */
export interface IDebugPanel {
  readonly id: string;
  readonly title: string;
  readonly configFile: string;
  readonly persistence: PanelPersistence;
  readonly category: string;
  readonly controller?: string;
  readonly params: ParamDSL[];
  /** L2: 创建完整控件 DOM */
  mount(container: HTMLElement): void;
  /** L0: 销毁 DOM，保留 valueMap */
  unmount(): void;
  /** L1: 仅在 container 内渲染折叠标题行 */
  renderCollapsed(container: HTMLElement): void;
  /** L1 → L2: 从折叠态展开为完整控件 */
  expand(): void;
  /** L2 → L1: 从完整控件折叠回标题行 */
  collapse(): void;
  /** Final cleanup: release DOM references and internal state. */
  dispose(): void;
  snapshot(): Record<string, unknown>;
  apply(config: Record<string, unknown>): void;
  setResetBaseline(config: Record<string, unknown>): void;
  readonly instanceState: DebugPanelInstanceState;
  readonly isMounted: boolean;
  readonly isExpanded: boolean;
}

/** ConfigBridge 的 patch 格式 */
export interface ConfigPatch {
  configFile: string;
  changes: Record<string, unknown>;
}

export interface DebugPanelPersistenceAdapter {
  load(configFile: string): Promise<Record<string, unknown>>;
  commit(patches: ConfigPatch[]): Promise<void>;
}

export interface DebugPanelRuntimeController {
  getLiveConfig?: () => unknown;
  applyLivePatch?: (patch: Record<string, unknown>) => void;
  updateConfig?: (patch: Record<string, unknown>) => void;
  resetLivePatch?: () => void;
  invokeAction?: (request: Record<string, unknown>) => void;
}
