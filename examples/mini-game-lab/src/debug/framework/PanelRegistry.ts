import type { IDebugPanel } from './types';

export class PanelRegistry {
  private panels = new Map<string, IDebugPanel>();

  register(panel: IDebugPanel): void {
    if (this.panels.has(panel.id)) {
      console.warn(`[PanelRegistry] Panel "${panel.id}" already registered, replacing.`);
      // Replacement is a lifecycle boundary. Dispose the old instance instead
      // of only unmounting it so stale value maps and DOM handlers cannot
      // survive under the same panel id.
      this.unregister(panel.id);
    }
    this.panels.set(panel.id, panel);
  }

  unregister(id: string): void {
    const panel = this.panels.get(id);
    if (panel) {
      // unregister is final for this panel id. Use panel.dispose() to release
      // both DOM references and internal generated-control state.
      panel.dispose();
      this.panels.delete(id);
    }
  }

  get(id: string): IDebugPanel | undefined {
    return this.panels.get(id);
  }

  list(): IDebugPanel[] {
    return [...this.panels.values()];
  }

  mountAll(container: HTMLElement): void {
    for (const panel of this.panels.values()) {
      if (!panel.isMounted) {
        const panelEl = document.createElement('div');
        panelEl.setAttribute('data-debug-panel', panel.id);
        panelEl.style.position = 'relative';
        container.appendChild(panelEl);
        panel.mount(panelEl);
      }
    }
  }

  unmountAll(): void {
    for (const panel of this.panels.values()) {
      panel.unmount();
    }
  }

  disposeAll(): void {
    for (const panel of this.panels.values()) {
      // Framework/session disposal owns final cleanup of every registered panel,
      // including panels that are currently collapsed or unmounted.
      panel.dispose();
    }
    this.panels.clear();
  }

  snapshotAll(): Map<string, Record<string, unknown>> {
    const result = new Map<string, Record<string, unknown>>();
    for (const panel of this.panels.values()) {
      result.set(panel.id, panel.snapshot());
    }
    return result;
  }
}
