import { PanelRegistry } from './PanelRegistry';
import { ConfigBridge } from './ConfigBridge';
import { InputStack } from './InputStack';
import { LiveBindingRegistry } from './LiveBindingRegistry';
import { generatePanel } from './CodeGenerator';
import { loadPanelsFromJSONModules as loadPanelsFromJSONModulesWithLoader, parsePanelDSLJSON, validatePanelDSL } from './PanelDSLLoader';
import type {
  DebugPanelPersistenceAdapter,
  DebugPanelRuntimeState,
  DebugPanelSessionState,
  IDebugPanel,
  PanelDSL,
  PanelLiveState,
  PanelPersistenceState,
  PanelValueState,
} from './types';

export type {
  ConfigPatch,
  DebugPanelInstanceState,
  DebugPanelPersistenceAdapter,
  DebugPanelRuntimeController,
  DebugPanelRuntimeState,
  DebugPanelSessionState,
  IDebugPanel,
  PanelDSL,
  ParamDSL,
  ParamType,
} from './types';

interface PanelStatus {
  valueState: PanelValueState;
  persistenceState: PanelPersistenceState;
  liveState: PanelLiveState;
  baselineSnapshot: string;
  lastAppliedSnapshot?: string;
  lastError?: string;
}

interface CategoryStatusSummary {
  totalCount: number;
  modifiedCount: number;
  appliedCount: number;
  pendingCount: number;
  applyFailedCount: number;
  noControllerCount: number;
  unsavedCount: number;
  savedCount: number;
  notPersistedCount: number;
  saveFailedCount: number;
}

interface StatusBadgeProjection {
  text: string;
  tone: 'ok' | 'warn' | 'error' | 'muted';
}

interface StatusBarProjection {
  value: StatusBadgeProjection;
  live: StatusBadgeProjection;
  persistence: StatusBadgeProjection;
}

function isPanelJSONModuleRecord(modules: Record<string, unknown>): boolean {
  return Object.values(modules).every((entry) => {
    if (typeof entry === 'string') return true;
    return !!entry && typeof entry === 'object' && ('default' in entry ? typeof (entry as { default?: unknown }).default === 'string' : false);
  });
}

export class DebugPanelFramework {
  private panelRegistry = new PanelRegistry();
  private configBridge = new ConfigBridge();
  private inputStack: InputStack;
  private liveBindingRegistry: LiveBindingRegistry;
  /**
   * Session lifecycle is owned by DebugPanelSession but stored here so framework
   * methods can reject late async work after dispose().
   */
  private sessionState: DebugPanelSessionState = 'created';
  /**
   * Runtime lifecycle only describes DOM/input ownership. It must not be used
   * as a proxy for whether abilities and panel DSL have been loaded.
   */
  private runtimeState: DebugPanelRuntimeState = 'unmounted';
  private saveBarEl: HTMLElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;
  private valueBadge: HTMLElement | null = null;
  private liveBadge: HTMLElement | null = null;
  private configBadge: HTMLElement | null = null;
  private debugToggleBtn: HTMLButtonElement | null = null;
  private lastSavedSnapshots = new Map<string, string>();
  private panelStatuses = new Map<string, PanelStatus>();
  private dirty = false;

  // ── 浮动窗口状态 ──
  private windowEl: HTMLElement | null = null;
  private windowBodyEl: HTMLElement | null = null;
  private tabBarEl: HTMLElement | null = null;
  private minimizedEl: HTMLElement | null = null;
  private activeCategory = '';
  private windowPos = { x: 16, y: 72 };
  private windowSize = { width: 360, height: 620 };
  private dragState: { startX: number; startY: number; pinX: number; pinY: number; ptrId: number } | null = null;
  private resizeState: { edge: 'right' | 'bottom' | 'corner'; startX: number; startY: number; width: number; height: number; ptrId: number } | null = null;
  private dragHandle: HTMLElement | null = null;
  private readonly handleViewportResize = (): void => this.syncPanelScrollport();
  private getGame: () => unknown = () => (window as any).game;

  constructor(hideSelectors: string[] = [], onToggle?: (active: boolean) => void) {
    this.inputStack = new InputStack('#debug-panel-framework-root', hideSelectors, onToggle);
    this.liveBindingRegistry = new LiveBindingRegistry(() => this.getGame());
  }

  getSessionState(): DebugPanelSessionState {
    return this.sessionState;
  }

  getRuntimeState(): DebugPanelRuntimeState {
    return this.runtimeState;
  }

  markInitializing(): void {
    // Ignore late transitions after disposal. Async session startup can still
    // resolve after a user closes or rebuilds the debug panel.
    if (this.sessionState === 'disposed' || this.sessionState === 'disposing') return;
    this.sessionState = 'initializing';
  }

  markReady(): void {
    // Ready means abilities and panels are loaded. The floating window may still
    // be unmounted if the host chooses to delay showing the UI.
    if (this.sessionState === 'disposed' || this.sessionState === 'disposing') return;
    this.sessionState = 'ready';
  }

  markFailed(): void {
    if (this.sessionState === 'disposed' || this.sessionState === 'disposing') return;
    this.unmount();
    this.panelRegistry.disposeAll();
    this.liveBindingRegistry.dispose();
    this.lastSavedSnapshots.clear();
    this.panelStatuses.clear();
    this.dirty = false;
    this.sessionState = 'failed';
  }

  async loadPanel(dsl: PanelDSL): Promise<IDebugPanel> {
    const validatedDsl = validatePanelDSL(dsl, `<panel:${dsl.id}>`);
    const persistence = this.configBridge.resolvePersistence(validatedDsl);
    const saved = persistence === 'config'
      ? await this.configBridge.loadFromFile(validatedDsl.configFile)
      : {};
    const defaults = Object.fromEntries(validatedDsl.params.map(p => [p.key, p.default]));
    const merged: Record<string, unknown> = { ...defaults };

    for (const param of validatedDsl.params) {
      if (param.type === 'vector3' && param.configPaths.length >= 3) {
        const defaultVector = Array.isArray(param.default) ? param.default : [];
        const values = param.configPaths.slice(0, 3).map((configPath, index) => {
          if (!configPath) {
            const fallback = defaultVector[index];
            return typeof fallback === 'number' ? fallback : undefined;
          }
          const parts = configPath.split('.');
          let cursor: unknown = saved;
          let found = true;
          for (const part of parts) {
            if (cursor == null || typeof cursor !== 'object') { found = false; break; }
            cursor = (cursor as Record<string, unknown>)[part];
          }
          return found && typeof cursor === 'number' ? cursor : undefined;
        });
        if (values.every((value): value is number => typeof value === 'number')) {
          merged[param.key] = values;
        }
        continue;
      }

      for (const configPath of param.configPaths) {
        const parts = configPath.split('.');
        let cursor: unknown = saved;
        let found = true;
        for (const part of parts) {
          if (cursor == null || typeof cursor !== 'object') { found = false; break; }
          cursor = (cursor as Record<string, unknown>)[part];
        }
        if (found && cursor !== undefined) {
          merged[param.key] = cursor;
        }
      }
    }

    const applyRuntimeChange = (key: string, value: unknown) => {
      const livePanel = this.panelRegistry.get(validatedDsl.id);
      if (livePanel) {
        const param = livePanel.params.find(item => item.key === key);
        let liveState: PanelLiveState = 'idle';
        if (param?.type === 'action') {
          liveState = this.liveBindingRegistry.invokeAction(livePanel, key, value);
        } else {
          this.markPanelValueChanged(livePanel);
          liveState = this.liveBindingRegistry.applyPanel(livePanel, key);
        }
        this.updatePanelLiveState(livePanel.id, liveState, livePanel.snapshot());
      }
      this.checkDirty();
    };

    const panel = generatePanel(
      { ...validatedDsl, persistence },
      applyRuntimeChange,
      () => this.syncPanelScrollport(),
    );

    panel.apply(merged);
    panel.setResetBaseline(merged);
    this.panelRegistry.register(panel);

    if (persistence === 'config') {
      this.lastSavedSnapshots.set(validatedDsl.id, JSON.stringify(merged));
    }
    this.panelStatuses.set(panel.id, {
      valueState: 'clean',
      persistenceState: persistence === 'config' ? 'saved' : 'not-persisted',
      liveState: 'idle',
      baselineSnapshot: JSON.stringify(panel.snapshot()),
    });
    const initialLiveState = this.liveBindingRegistry.applyPanel(panel);
    this.updatePanelLiveState(panel.id, initialLiveState, panel.snapshot());
    this.checkDirty();
    this.updateDirtyBadge();

    if (this.runtimeState !== 'unmounted' && this.windowBodyEl) {
      // Panels can be loaded after mount in future workflows. Attach only to
      // the visible runtime tree; registry state already exists either way.
      this.appendPanelToBody(panel);
    }

    return panel;
  }

  async loadPanels(dsls: PanelDSL[]): Promise<IDebugPanel[]> {
    const panels: IDebugPanel[] = [];
    for (const dsl of dsls) {
      panels.push(await this.loadPanel(dsl));
    }
    return panels;
  }

  loadPanelFromDSLObject(obj: unknown, filePath = '<inline>'): Promise<IDebugPanel> {
    return this.loadPanel(validatePanelDSL(obj, filePath));
  }

  loadPanelFromJSON(text: string, filePath = '<inline-json>'): Promise<IDebugPanel> {
    return this.loadPanel(parsePanelDSLJSON(text, filePath));
  }

  async loadPanelsFromJSONModules(modules: Record<string, unknown>): Promise<IDebugPanel[]> {
    if (!isPanelJSONModuleRecord(modules)) {
      throw new Error('[PanelDSL] JSON module map must resolve to raw strings or { default: string } entries');
    }
    return this.loadPanels(await loadPanelsFromJSONModulesWithLoader(modules as Record<string, string | { default?: string }>));
  }

  mount(_root: HTMLElement): void {
    // Idempotency matters for HMR and repeated session.init() calls. A second
    // mount must not create another root element or resize listener.
    if (this.runtimeState !== 'unmounted') return;
    if (this.sessionState === 'failed' || this.sessionState === 'disposing' || this.sessionState === 'disposed') return;
    const initialMinWidth = this.getMinPanelWidth();
    this.windowSize.width = Math.max(initialMinWidth, Math.min(window.innerWidth - 16, this.windowSize.width));
    this.windowPos = {
      x: Math.max(8, window.innerWidth - this.windowSize.width - 10),
      y: Math.min(60, Math.max(8, window.innerHeight - 288)),
    };
    this.windowSize.height = this.clampPanelHeight(Math.min(this.windowSize.height, window.innerHeight - this.windowPos.y - 8));
    this.createFloatingWindow();
    window.addEventListener('resize', this.handleViewportResize);
    this.runtimeState = 'mounted';
  }

  activate(): void {
    // active is the only state where InputStack owns input. mounted keeps the UI
    // visible but leaves gameplay controls untouched.
    if (this.runtimeState === 'active') return;
    if (this.runtimeState !== 'mounted') return;
    this.inputStack.enter();
    this.runtimeState = 'active';
    this.syncDebugToggleButton();
  }

  deactivate(): void {
    // Deactivation returns to mounted, not unmounted: the panel remains visible
    // while input ownership goes back to the game.
    if (this.runtimeState !== 'active') return;
    this.inputStack.exit();
    this.runtimeState = 'mounted';
    this.syncDebugToggleButton();
  }

  private createFloatingWindow(): void {
    // ── 浮动窗口 ──
    this.windowEl = document.createElement('div');
    this.windowEl.id = 'debug-panel-framework-root';
    this.windowEl.style.cssText =
      `position:fixed;left:${this.windowPos.x}px;top:${this.windowPos.y}px;z-index:9998;width:${this.windowSize.width}px;height:${this.windowSize.height}px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);background:#141824;border:1px solid rgba(255,255,255,0.1);border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);font-family:monospace;font-size:11px;user-select:none;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box`;
    document.body.appendChild(this.windowEl);

    // 标题条（拖拽手柄）
    this.dragHandle = document.createElement('div');
    this.dragHandle.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#1e2030;border-radius:8px 8px 0 0;touch-action:none;cursor:move;flex-shrink:0';
    this.dragHandle.addEventListener('pointerdown', (e) => this.onDragStart(e));
    this.dragHandle.addEventListener('pointermove', (e) => this.onDragMove(e));
    this.dragHandle.addEventListener('pointerup', () => this.onDragEnd());
    this.dragHandle.addEventListener('pointercancel', () => this.onDragEnd());
    this.dragHandle.addEventListener('lostpointercapture', () => this.onDragEnd());

    const titleText = document.createElement('span');
    titleText.textContent = 'Debug Panel';
    titleText.style.cssText = 'font-size:12px;font-weight:700;color:#ccc;letter-spacing:.04em;cursor:move';
    this.dragHandle.appendChild(titleText);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:4px';

    const minBtn = document.createElement('button');
    minBtn.textContent = '—';
    minBtn.title = '最小化';
    minBtn.style.cssText = 'background:none;border:none;color:#8e97b3;cursor:pointer;font-size:14px;line-height:1;width:22px;text-align:center;padding:0';
    minBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    minBtn.addEventListener('click', () => this.minimize());
    btnGroup.appendChild(minBtn);

    this.debugToggleBtn = document.createElement('button');
    this.debugToggleBtn.textContent = 'OFF';
    this.debugToggleBtn.title = 'Debug Mode';
    this.debugToggleBtn.style.cssText = 'background:#333;color:#8e97b3;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:10px;padding:2px 6px;font-weight:600';
    this.debugToggleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.debugToggleBtn.addEventListener('click', () => {
      if (this.runtimeState === 'active') this.deactivate();
      else this.activate();
    });
    btnGroup.appendChild(this.debugToggleBtn);

    this.dragHandle.appendChild(btnGroup);
    this.windowEl.appendChild(this.dragHandle);

    // ── 分类标签栏 ──
    this.tabBarEl = document.createElement('div');
    this.tabBarEl.style.cssText = 'display:flex;gap:2px;padding:4px 8px 0;background:#141824;overflow-x:auto;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.06)';
    this.windowEl.appendChild(this.tabBarEl);

    // ── 面板列表区 ──
    this.windowBodyEl = document.createElement('div');
    this.windowBodyEl.dataset.debugPanelScrollport = 'true';
    this.windowBodyEl.style.cssText = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding:6px 8px;display:flex;flex-direction:column;gap:4px;min-height:0;max-height:100%;box-sizing:border-box';
    this.windowEl.appendChild(this.windowBodyEl);

    // ── 状态栏 ──
    this.saveBarEl = document.createElement('div');
    this.saveBarEl.style.cssText = 'padding:6px 10px 8px;background:#171a24;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;display:flex;flex-direction:column;gap:6px';

    const statusRow = document.createElement('div');
    statusRow.style.cssText = 'display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;column-gap:6px;min-width:0';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = '状态';
    statusLabel.style.cssText = 'font-size:11px;font-weight:600;color:#d5daea;white-space:nowrap;min-width:44px';
    statusRow.appendChild(statusLabel);

    const badges = document.createElement('div');
    badges.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:4px;min-width:0;width:100%';
    this.valueBadge = document.createElement('span');
    this.liveBadge = document.createElement('span');
    this.configBadge = document.createElement('span');
    badges.appendChild(this.valueBadge);
    badges.appendChild(this.liveBadge);
    badges.appendChild(this.configBadge);
    statusRow.appendChild(badges);
    this.updateDirtyBadge();

    this.saveBarEl.appendChild(statusRow);

    this.saveBtn = document.createElement('button');
    this.saveBtn.textContent = '保存到配置';
    this.saveBtn.style.cssText = 'width:100%;padding:7px 12px;background:#4fc3f7;color:#111;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;transition:background .2s';
    this.saveBtn.addEventListener('click', () => this.save());
    this.saveBarEl.appendChild(this.saveBtn);
    this.windowEl.appendChild(this.saveBarEl);

    this.addResizeHandles();

    // ── 最小化按钮（隐藏状态） ──
    this.minimizedEl = document.createElement('button');
    this.minimizedEl.textContent = 'Mock Assets';
    this.minimizedEl.title = '展开 Mock Platform Assets / Debug Panel';
    this.minimizedEl.style.cssText = `position:fixed;top:${this.windowPos.y}px;right:12px;z-index:9998;min-width:124px;height:34px;background:#1e2030;color:#d7def7;border:1px solid rgba(255,255,255,0.18);border-radius:6px;cursor:pointer;font-size:12px;font-weight:800;display:none;line-height:1;padding:0 12px;box-shadow:0 6px 22px rgba(0,0,0,0.35);letter-spacing:0`;
    this.minimizedEl.addEventListener('click', () => this.restore());
    document.body.appendChild(this.minimizedEl);

    // 首次渲染所有面板
    this.rebuildTabsAndPanels();
    this.minimize();
  }

  // ═══════════ 拖拽 ═══════════
  private onDragStart(e: PointerEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
    this.dragState = { startX: e.clientX, startY: e.clientY, pinX: this.windowPos.x, pinY: this.windowPos.y, ptrId: e.pointerId };
    if (this.dragHandle) this.dragHandle.setPointerCapture(e.pointerId);
  }

  private onDragMove(e: PointerEvent): void {
    if (!this.dragState || !this.windowEl) return;
    this.windowPos.x = this.clampPanelLeft(this.dragState.pinX + (e.clientX - this.dragState.startX));
    this.windowPos.y = this.clampPanelTop(this.dragState.pinY + (e.clientY - this.dragState.startY));
    this.windowEl.style.left = `${this.windowPos.x}px`;
    this.windowEl.style.top = `${this.windowPos.y}px`;
  }

  private onDragEnd(): void {
    if (this.dragState && this.dragHandle) {
      this.dragHandle.releasePointerCapture(this.dragState.ptrId);
    }
    this.dragState = null;
  }

  // ═══════════ 调整大小 ═══════════
  private addResizeHandles(): void {
    if (!this.windowEl) return;

    const right = this.createResizeHandle('right', 'right:0;top:32px;bottom:32px;width:8px;cursor:ew-resize');
    const bottom = this.createResizeHandle('bottom', 'left:32px;right:32px;bottom:0;height:8px;cursor:ns-resize');
    const corner = this.createResizeHandle('corner', 'right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize');
    corner.style.background = 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.22) 54%, transparent 55%)';

    this.windowEl.appendChild(right);
    this.windowEl.appendChild(bottom);
    this.windowEl.appendChild(corner);
  }

  private createResizeHandle(edge: 'right' | 'bottom' | 'corner', css: string): HTMLElement {
    const handle = document.createElement('div');
    handle.dataset.debugPanelResize = edge;
    handle.style.cssText = `position:absolute;z-index:2;touch-action:none;${css}`;
    handle.addEventListener('pointerdown', (event) => this.onResizeStart(event, edge, handle));
    handle.addEventListener('pointermove', (event) => this.onResizeMove(event));
    handle.addEventListener('pointerup', () => this.onResizeEnd(handle));
    handle.addEventListener('pointercancel', () => this.onResizeEnd(handle));
    handle.addEventListener('lostpointercapture', () => this.onResizeEnd(handle));
    return handle;
  }

  private onResizeStart(e: PointerEvent, edge: 'right' | 'bottom' | 'corner', handle: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();
    this.resizeState = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      width: this.windowSize.width,
      height: this.windowSize.height,
      ptrId: e.pointerId,
    };
    handle.setPointerCapture(e.pointerId);
  }

  private onResizeMove(e: PointerEvent): void {
    if (!this.resizeState || !this.windowEl) return;
    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - this.resizeState.startX;
    const deltaY = e.clientY - this.resizeState.startY;
    if (this.resizeState.edge === 'right' || this.resizeState.edge === 'corner') {
      this.windowSize.width = this.clampPanelWidth(this.resizeState.width + deltaX);
      this.windowEl.style.width = `${this.windowSize.width}px`;
    }
    if (this.resizeState.edge === 'bottom' || this.resizeState.edge === 'corner') {
      this.windowSize.height = this.clampPanelHeight(this.resizeState.height + deltaY);
      this.windowEl.style.height = `${this.windowSize.height}px`;
    }
    this.syncPanelScrollport();
  }

  private onResizeEnd(handle: HTMLElement): void {
    if (this.resizeState && handle.hasPointerCapture(this.resizeState.ptrId)) {
      handle.releasePointerCapture(this.resizeState.ptrId);
    }
    this.resizeState = null;
    this.syncPanelScrollport();
  }

  private ensureWindowWithinViewport(): void {
    if (!this.windowEl) return;

    this.windowSize.width = this.clampPanelWidth(Math.min(this.windowSize.width, window.innerWidth - 16));
    this.windowSize.height = this.clampPanelHeight(Math.min(this.windowSize.height, window.innerHeight - 16));
    this.windowPos.x = this.clampPanelLeft(this.windowPos.x);
    this.windowPos.y = this.clampPanelTop(this.windowPos.y);

    this.windowEl.style.left = `${this.windowPos.x}px`;
    this.windowEl.style.top = `${this.windowPos.y}px`;
    this.windowEl.style.width = `${this.windowSize.width}px`;
    this.windowEl.style.height = `${this.windowSize.height}px`;
    if (this.minimizedEl) {
      this.minimizedEl.style.top = `${this.windowPos.y}px`;
    }
  }

  private syncPanelScrollport(): void {
    if (!this.windowEl || !this.windowBodyEl) return;
    this.ensureWindowWithinViewport();
    const body = this.windowBodyEl;
    const maxScrollTop = Math.max(0, body.scrollHeight - body.clientHeight);
    if (body.scrollTop > maxScrollTop) {
      body.scrollTop = maxScrollTop;
    }
    // Use an explicit scrollbar only when content overflows. This keeps the
    // scroll affordance stable without creating nested per-panel scroll areas.
    body.style.overflowY = body.scrollHeight > body.clientHeight ? 'scroll' : 'auto';
  }

  private clampPanelWidth(width: number): number {
    const minWidth = this.getMinPanelWidth();
    const maxWidth = Math.max(minWidth, window.innerWidth - this.windowPos.x - 8);
    return Math.max(minWidth, Math.min(maxWidth, width));
  }

  private clampPanelHeight(height: number): number {
    const minHeight = this.getMinPanelHeight();
    const maxHeight = Math.max(minHeight, window.innerHeight - this.windowPos.y - 8);
    return Math.max(minHeight, Math.min(maxHeight, height));
  }

  private clampPanelLeft(left: number): number {
    return Math.max(8, Math.min(left, window.innerWidth - Math.min(this.windowSize.width, window.innerWidth - 16) - 8));
  }

  private clampPanelTop(top: number): number {
    return Math.max(8, Math.min(top, window.innerHeight - Math.min(this.windowSize.height, window.innerHeight - 16) - 8));
  }

  private getMinPanelWidth(): number {
    return Math.max(120, Math.min(320, window.innerWidth - 16));
  }

  private getMinPanelHeight(): number {
    return Math.max(120, Math.min(280, window.innerHeight - 16));
  }

  // ═══════════ 最小化/恢复 ═══════════
  private minimize(): void {
    if (!this.windowEl || !this.minimizedEl) return;
    this.windowEl.style.display = 'none';
    this.minimizedEl.style.display = '';
  }

  private restore(): void {
    if (!this.windowEl || !this.minimizedEl) return;
    this.minimizedEl.style.display = 'none';
    this.windowEl.style.display = '';
    this.syncPanelScrollport();
  }

  // ═══════════ 分类标签 + 手风琴 ═══════════
  private rebuildTabsAndPanels(): void {
    if (!this.windowEl || !this.tabBarEl) return;

    // 收集所有分类
    const categories = new Map<string, IDebugPanel[]>();
    for (const panel of this.panelRegistry.list()) {
      const cat = panel.category || 'General';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(panel);
    }

    if (categories.size === 0) return;

    if (!this.activeCategory || !categories.has(this.activeCategory)) {
      this.activeCategory = categories.has('Mock Platform')
        ? 'Mock Platform'
        : [...categories.keys()][0]!;
    }

    // 重建标签栏
    this.tabBarEl.innerHTML = '';
    for (const [cat, panels] of categories) {
      const tab = document.createElement('button');
      tab.textContent = `${cat} (${panels.length})`;
      tab.style.cssText = `padding:4px 10px;border:none;border-radius:4px 4px 0 0;cursor:pointer;font-size:11px;font-weight:600;${
        cat === this.activeCategory
          ? 'background:#2a2a3e;color:#4fc3f7;border-bottom:2px solid #4fc3f7'
          : 'background:transparent;color:#8e97b3'
      }`;
      tab.addEventListener('click', () => {
        if (this.activeCategory === cat) return;
        this.activeCategory = cat;
        this.rebuildTabsAndPanels();
        this.updateDirtyBadge();
        this.syncPanelScrollport();
      });
      this.tabBarEl.appendChild(tab);
    }

    // 渲染当前分类
    this.renderActiveCategory();
  }

  private renderActiveCategory(): void {
    if (!this.windowBodyEl) return;

    // 卸载当前分类所有面板
    for (const panel of this.panelRegistry.list()) {
      if (panel.isMounted) panel.unmount();
    }

    this.windowBodyEl.innerHTML = '';

    const panels = this.panelRegistry.list().filter(p => (p.category || 'General') === this.activeCategory);
    if (panels.length === 0) return;

    // 默认所有面板折叠，避免加载 Debug Panel 时自动打开调试控件。
    panels.forEach((panel) => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:2px;transition:background .15s';
      this.windowBodyEl!.appendChild(row);

      panel.renderCollapsed(row);
    });
    this.syncPanelScrollport();
  }

  /** 面板在 mounted 后加载时，拼接到当前分类 */
  private appendPanelToBody(panel: IDebugPanel): void {
    if (!this.windowBodyEl) return;
    const cat = panel.category || 'General';

    // 检查是否需要新建分类标签
    const hasCategory = this.panelRegistry.list().some(
      p => p !== panel && (p.category || 'General') === cat
    );
    if (!hasCategory) {
      this.rebuildTabsAndPanels();
      return;
    }

    // 同分类 → 折叠插入
    if (cat === this.activeCategory) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:2px';
      panel.renderCollapsed(row);
      this.windowBodyEl.appendChild(row);
      this.syncPanelScrollport();
    }
  }

  unmount(): void {
    if (this.runtimeState === 'unmounted') return;
    if (this.runtimeState === 'active') {
      // Always release input ownership before removing DOM. This keeps
      // InputStack's global listeners and hidden-selector state balanced.
      this.deactivate();
    } else {
      this.inputStack.exit();
    }
    window.removeEventListener('resize', this.handleViewportResize);
    this.panelRegistry.unmountAll();
    if (this.windowEl) {
      this.windowEl.remove();
      this.windowEl = null;
    }
    if (this.minimizedEl) {
      this.minimizedEl.remove();
      this.minimizedEl = null;
    }
    this.runtimeState = 'unmounted';
    this.windowBodyEl = null;
    this.tabBarEl = null;
    this.saveBarEl = null;
    this.saveBtn = null;
    this.valueBadge = null;
    this.liveBadge = null;
    this.configBadge = null;
    this.debugToggleBtn = null;
  }

  dispose(): void {
    // Final framework cleanup. This is stronger than unmount(): it releases
    // panel registries and live bindings so the owning session can be rebuilt
    // without sharing stale runtime state.
    if (this.sessionState === 'disposed' || this.sessionState === 'disposing') return;
    this.sessionState = 'disposing';
    this.unmount();
    this.panelRegistry.disposeAll();
    this.liveBindingRegistry.dispose();
    this.lastSavedSnapshots.clear();
    this.panelStatuses.clear();
    this.dirty = false;
    this.sessionState = 'disposed';
  }

  async save(): Promise<void> {
    const btn = this.saveBtn;
    const patches = [];
    const panels = this.panelRegistry.list();
    for (const panel of panels) {
      if (panel.persistence !== 'config') continue;
      const currentValues = panel.snapshot();
      const patch = this.configBridge.buildPatch({
        id: panel.id,
        title: panel.title,
        configFile: panel.configFile,
        persistence: panel.persistence,
        category: panel.category,
        params: panel.params,
      }, currentValues);
      if (patch) patches.push(patch);
    }

    if (btn) {
      btn.textContent = '保存中...';
      btn.style.background = '#ffa726';
    }

    try {
      await this.configBridge.commit(patches);

      // 更新 baseline
      for (const panel of panels) {
        if (panel.persistence !== 'config') continue;
        const snapshot = panel.snapshot();
        const serialized = JSON.stringify(snapshot);
        this.lastSavedSnapshots.set(panel.id, serialized);
        panel.setResetBaseline(snapshot);
        const status = this.ensurePanelStatus(panel);
        status.baselineSnapshot = serialized;
        status.valueState = 'clean';
        status.persistenceState = 'saved';
      }
      this.dirty = false;
      this.updateDirtyBadge();

      if (btn) {
        btn.textContent = '\u2713 已保存';
        btn.style.background = '#66bb6a';
        setTimeout(() => {
          btn.textContent = '保存到配置';
          btn.style.background = '#4fc3f7';
        }, 1500);
      }
    } catch (err) {
      for (const panel of panels) {
        if (panel.persistence !== 'config') continue;
        const status = this.ensurePanelStatus(panel);
        status.persistenceState = 'save-failed';
        status.lastError = err instanceof Error ? err.message : String(err);
      }
      this.updateDirtyBadge();
      if (btn) {
        btn.textContent = '\u2717 保存失败';
        btn.style.background = '#ef5350';
        setTimeout(() => {
          btn.textContent = '保存到配置';
          btn.style.background = '#4fc3f7';
        }, 2000);
      }
      console.error('[Framework] \u4FDD\u5B58\u5931\u8D25:', err);
    }
  }

  private checkDirty(): void {
    let hasUnsavedConfig = false;
    for (const panel of this.panelRegistry.list()) {
      const status = this.ensurePanelStatus(panel);
      const changed = status.baselineSnapshot !== JSON.stringify(panel.snapshot());
      status.valueState = changed ? 'modified' : 'clean';
      if (panel.persistence === 'config') {
        status.persistenceState = changed ? 'unsaved' : 'saved';
        hasUnsavedConfig = hasUnsavedConfig || changed;
      } else {
        status.persistenceState = 'not-persisted';
      }
    }
    if (this.dirty !== hasUnsavedConfig) {
      this.dirty = hasUnsavedConfig;
    }
    this.updateDirtyBadge();
  }

  private updateDirtyBadge(): void {
    if (!this.valueBadge || !this.liveBadge || !this.configBadge) return;
    const projection = this.getStatusBarProjection();
    this.setStatusBadge(this.valueBadge, projection.value.text, projection.value.tone);
    this.setStatusBadge(this.liveBadge, projection.live.text, projection.live.tone);
    this.setStatusBadge(this.configBadge, projection.persistence.text, projection.persistence.tone);
  }

  private ensurePanelStatus(panel: IDebugPanel): PanelStatus {
    let status = this.panelStatuses.get(panel.id);
    if (!status) {
      status = {
        valueState: 'clean',
        persistenceState: panel.persistence === 'config' ? 'saved' : 'not-persisted',
        liveState: 'idle',
        baselineSnapshot: JSON.stringify(panel.snapshot()),
      };
      this.panelStatuses.set(panel.id, status);
    }
    return status;
  }

  private markPanelValueChanged(panel: IDebugPanel): void {
    const status = this.ensurePanelStatus(panel);
    status.valueState = status.baselineSnapshot !== JSON.stringify(panel.snapshot()) ? 'modified' : 'clean';
    status.persistenceState = panel.persistence === 'config'
      ? status.valueState === 'modified' ? 'unsaved' : 'saved'
      : 'not-persisted';
    if (panel.controller) {
      status.liveState = 'modified-pending';
    }
  }

  private updatePanelLiveState(panelId: string, liveState: PanelLiveState, snapshot: Record<string, unknown>): void {
    const status = this.panelStatuses.get(panelId);
    if (!status) return;
    if (liveState !== 'idle') {
      status.liveState = liveState;
      if (liveState === 'applied') {
        status.lastAppliedSnapshot = JSON.stringify(snapshot);
        status.lastError = undefined;
      } else if (liveState === 'apply-failed' || liveState === 'no-controller') {
        status.lastError = liveState;
      }
    }
    this.updateDirtyBadge();
  }

  private getCategoryStatusSummary(category: string): CategoryStatusSummary {
    const panels = this.panelRegistry.list().filter(panel => (panel.category || 'General') === category);
    const statuses = (panels.length > 0 ? panels : this.panelRegistry.list()).map(panel => this.ensurePanelStatus(panel));
    return {
      totalCount: statuses.length,
      modifiedCount: statuses.filter(status => status.valueState === 'modified').length,
      appliedCount: statuses.filter(status => status.liveState === 'applied').length,
      pendingCount: statuses.filter(status => status.liveState === 'modified-pending').length,
      applyFailedCount: statuses.filter(status => status.liveState === 'apply-failed').length,
      noControllerCount: statuses.filter(status => status.liveState === 'no-controller').length,
      unsavedCount: statuses.filter(status => status.persistenceState === 'unsaved').length,
      savedCount: statuses.filter(status => status.persistenceState === 'saved').length,
      notPersistedCount: statuses.filter(status => status.persistenceState === 'not-persisted').length,
      saveFailedCount: statuses.filter(status => status.persistenceState === 'save-failed').length,
    };
  }

  private getStatusBarProjection(): StatusBarProjection {
    return this.getCategoryStatusBarProjection(this.getCategoryStatusSummary(this.activeCategory));
  }

  private getCategoryStatusBarProjection(summary: CategoryStatusSummary): StatusBarProjection {
    if (summary.totalCount === 0) {
      return {
        value: { text: '值：无面板', tone: 'muted' },
        live: { text: '实时：无面板', tone: 'muted' },
        persistence: { text: '配置：无面板', tone: 'muted' },
      };
    }

    const value: StatusBadgeProjection = summary.modifiedCount > 0
      ? { text: `值：${summary.modifiedCount} 项已修改`, tone: 'warn' }
      : { text: '值：全部未修改', tone: 'ok' };

    let live: StatusBadgeProjection;
    if (summary.applyFailedCount > 0) {
      live = { text: `实时：${summary.applyFailedCount} 项应用失败`, tone: 'error' };
    } else if (summary.noControllerCount > 0) {
      live = { text: `实时：${summary.noControllerCount} 项未找到控制器`, tone: 'error' };
    } else if (summary.pendingCount > 0) {
      live = { text: `实时：${summary.pendingCount} 项等待应用`, tone: 'warn' };
    } else if (summary.appliedCount > 0) {
      live = { text: `实时：${summary.appliedCount} 项已应用`, tone: 'ok' };
    } else {
      live = { text: '实时：未应用', tone: 'muted' };
    }

    let persistence: StatusBadgeProjection;
    if (summary.saveFailedCount > 0) {
      persistence = { text: `配置：${summary.saveFailedCount} 项保存失败`, tone: 'error' };
    } else if (summary.unsavedCount > 0) {
      persistence = { text: `配置：${summary.unsavedCount} 项未保存`, tone: 'warn' };
    } else if (summary.savedCount > 0 && summary.notPersistedCount > 0) {
      persistence = { text: `配置：${summary.savedCount} 项已保存 / ${summary.notPersistedCount} 项不持久化`, tone: 'muted' };
    } else if (summary.notPersistedCount === summary.totalCount) {
      persistence = { text: '配置：全部不持久化', tone: 'muted' };
    } else {
      persistence = { text: '配置：全部已保存', tone: 'ok' };
    }

    return { value, live, persistence };
  }

  private setStatusBadge(el: HTMLElement, text: string, tone: 'ok' | 'warn' | 'error' | 'muted'): void {
    const styles = {
      ok: ['rgba(102, 187, 106, 0.18)', '#81c784'],
      warn: ['rgba(255, 167, 38, 0.18)', '#ffb74d'],
      error: ['rgba(239, 83, 80, 0.2)', '#ff8a80'],
      muted: ['rgba(142, 151, 179, 0.16)', '#aab3cf'],
    } as const;
    const [background, color] = styles[tone];
    el.textContent = text;
    el.title = text;
    el.style.cssText = `font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:${background};color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;min-width:0;box-sizing:border-box`;
  }

  private syncDebugToggleButton(): void {
    if (!this.debugToggleBtn) return;
    if (this.runtimeState === 'active') {
      this.debugToggleBtn.textContent = 'ON';
      this.debugToggleBtn.style.background = '#ef5350';
      this.debugToggleBtn.style.color = '#fff';
    } else {
      this.debugToggleBtn.textContent = 'OFF';
      this.debugToggleBtn.style.background = '#333';
      this.debugToggleBtn.style.color = '#8e97b3';
    }
  }

  setGetGame(fn: () => unknown): void {
    this.getGame = fn;
  }

  getPanelRegistry(): PanelRegistry {
    return this.panelRegistry;
  }

  getConfigBridge(): ConfigBridge {
    return this.configBridge;
  }

  getInputStack(): InputStack {
    return this.inputStack;
  }

  setOnToggle(fn: (active: boolean) => void): void {
    this.inputStack.setOnToggle(fn);
  }

  setHideSelectors(selectors: string[]): void {
    this.inputStack.setHideSelectors(selectors);
  }

  setPersistenceAdapter(adapter: DebugPanelPersistenceAdapter): void {
    this.configBridge.setPersistenceAdapter(adapter);
  }
}

export function createDebugPanelFramework(): DebugPanelFramework {
  // This factory is intentionally explicit. Importing the framework module must
  // not create a hidden singleton; the session factory decides when a runtime
  // instance exists.
  return new DebugPanelFramework();
}
