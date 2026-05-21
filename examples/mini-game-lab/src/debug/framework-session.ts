import type { DebugPanelFramework, DebugPanelRuntimeState, DebugPanelSessionState } from './framework';

export interface DebugPanelSessionOptions {
  /**
   * Session-owned framework instance.
   *
   * Do not default this to any module-level active binding. The session is the
   * ownership boundary: rebuilding a debug panel session should also rebuild
   * its registries, DOM references, input stack, and live binding scope.
   */
  framework: DebugPanelFramework;
  root?: HTMLElement;
  getGame?: () => unknown;
  panelModules: Record<string, unknown>;
  pollIntervalMs?: number;
}

type HostDisposeObservable = {
  /**
   * Babylon Observable exposes addOnce/add/remove. We keep the type small here
   * because the session only needs lifecycle cleanup, not the full Observable
   * API surface.
   */
  addOnce?: (callback: () => void) => unknown;
  add?: (callback: () => void) => unknown;
  remove?: (observer: unknown) => void;
};

type HostGame = {
  scene?: {
    onDisposeObservable?: HostDisposeObservable;
  };
};

export class DebugPanelSession {
  private readonly framework: DebugPanelFramework;
  private readonly root: HTMLElement;
  private readonly getGame: () => unknown;
  private readonly panelModules: Record<string, unknown>;
  private readonly pollIntervalMs: number;
  /**
   * Guards async init against duplicate callers.
   *
   * HMR, main.ts startup, or future tools may ask for init repeatedly. Reusing
   * the first promise keeps module loading and DOM mount single-shot for this
   * session.
   */
  private initPromise: Promise<void> | null = null;
  /**
   * Host scene disposal subscription.
   *
   * These fields are separate so manual session.dispose() can unregister the
   * host callback before the scene itself disposes. That prevents old sessions
   * from waking up later and touching a disposed framework.
   */
  private hostDisposeObservable: HostDisposeObservable | null = null;
  private hostDisposeObserver: unknown = null;

  constructor(options: DebugPanelSessionOptions) {
    this.framework = options.framework;
    this.root = options.root ?? document.body;
    this.getGame = options.getGame ?? (() => (window as any).game);
    this.panelModules = options.panelModules;
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
  }

  get sessionState(): DebugPanelSessionState {
    return this.framework.getSessionState();
  }

  get runtimeState(): DebugPanelRuntimeState {
    return this.framework.getRuntimeState();
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.isDisposingOrDisposed()) return;

    // Session state covers async loading. Runtime state remains unmounted until
    // abilities/panels are loaded and the UI is actually attached.
    this.framework.markInitializing();
    this.initPromise = this.runInit();
    return this.initPromise;
  }

  mount(root: HTMLElement = this.root): void {
    this.framework.mount(root);
  }

  activate(): void {
    this.framework.activate();
  }

  deactivate(): void {
    this.framework.deactivate();
  }

  unmount(): void {
    this.framework.unmount();
  }

  dispose(): void {
    // Unbind host first: framework.dispose() is idempotent, but stale host
    // callbacks would still keep this session reachable until scene disposal.
    this.unbindHostDispose();
    this.framework.dispose();
  }

  private async runInit(): Promise<void> {
    try {
      this.framework.setGetGame(this.getGame);
      const hasGame = await this.waitForGame();
      if (!hasGame || this.isDisposingOrDisposed()) return;

      this.bindHostDispose();

      await this.framework.loadPanelsFromJSONModules(this.panelModules);
      if (this.isDisposingOrDisposed()) return;

      this.framework.markReady();
      // Mounting after ready gives agents a reliable model:
      // created -> initializing -> ready, then runtime unmounted -> mounted.
      this.framework.mount(this.root);
      console.log('[Framework] ready');
    } catch (error) {
      this.unbindHostDispose();
      this.framework.markFailed();
      console.error('[Framework] init failed:', error);
      throw error;
    }
  }

  private async waitForGame(): Promise<boolean> {
    // DEV startup races with game creation. Polling is intentionally session
    // scoped so dispose() can cancel the wait without needing a global timer.
    while (!this.isGameReady()) {
      if (this.isDisposingOrDisposed()) return false;
      await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
    }
    return true;
  }

  private isGameReady(): boolean {
    const game = this.getGame() as HostGame | null | undefined;
    return !!game?.scene;
  }

  private isDisposingOrDisposed(): boolean {
    const state = this.framework.getSessionState();
    return state === 'disposing' || state === 'disposed' || state === 'failed';
  }

  private bindHostDispose(): void {
    if (this.hostDisposeObservable) return;
    const game = this.getGame() as HostGame | null | undefined;
    const observable = game?.scene?.onDisposeObservable;
    if (!observable) return;

    this.hostDisposeObservable = observable;
    if (typeof observable.addOnce === 'function') {
      // addOnce still returns an observer in Babylon. Store it so a manual
      // session dispose can remove the callback before the scene fires.
      this.hostDisposeObserver = observable.addOnce(() => this.dispose());
      return;
    }
    if (typeof observable.add === 'function') {
      this.hostDisposeObserver = observable.add(() => this.dispose());
    }
  }

  private unbindHostDispose(): void {
    if (this.hostDisposeObservable && this.hostDisposeObserver) {
      this.hostDisposeObservable.remove?.(this.hostDisposeObserver);
    }
    this.hostDisposeObservable = null;
    this.hostDisposeObserver = null;
  }
}
