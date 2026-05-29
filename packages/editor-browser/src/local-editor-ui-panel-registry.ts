import type {
  LocalEditorBottomDockTab,
  LocalEditorRightDockTab,
  LocalEditorWorkbenchDockArea,
  LocalEditorWorkbenchLayout,
  LocalEditorWorkbenchPanelDescriptor,
  LocalEditorWorkbenchPanelId,
} from './local-editor-ui-types';

export interface LocalEditorPanelRegistry {
  getPanel(id: LocalEditorWorkbenchPanelId): LocalEditorWorkbenchPanelDescriptor | null;
  getPanels(area: LocalEditorWorkbenchDockArea): LocalEditorWorkbenchPanelDescriptor[];
  getActivePanel(area: LocalEditorWorkbenchDockArea): LocalEditorWorkbenchPanelDescriptor | null;
  setActivePanel(area: LocalEditorWorkbenchDockArea, id: LocalEditorWorkbenchPanelId): void;
  getRightDockTab(): LocalEditorRightDockTab;
  setRightDockTab(tab: LocalEditorRightDockTab): void;
  getBottomDockTab(): LocalEditorBottomDockTab;
  setBottomDockTab(tab: LocalEditorBottomDockTab): void;
}

export function createLocalEditorPanelRegistry(layout: LocalEditorWorkbenchLayout): LocalEditorPanelRegistry {
  const panels = new Map<LocalEditorWorkbenchPanelId, LocalEditorWorkbenchPanelDescriptor>();
  for (const panel of layout.panels) panels.set(panel.id, panel);

  function canActivate(area: LocalEditorWorkbenchDockArea, id: LocalEditorWorkbenchPanelId): boolean {
    return panels.get(id)?.area === area;
  }

  return {
    getPanel(id) {
      return panels.get(id) ?? null;
    },
    getPanels(area) {
      return layout.panels.filter(panel => panel.area === area);
    },
    getActivePanel(area) {
      const activeId = layout.activeTabs[area];
      return activeId ? panels.get(activeId) ?? null : null;
    },
    setActivePanel(area, id) {
      if (!canActivate(area, id)) return;
      layout.activeTabs[area] = id;
    },
    getRightDockTab() {
      const activeId = layout.activeTabs.right;
      return activeId === 'rendering' ? 'rendering' : 'inspector';
    },
    setRightDockTab(tab) {
      layout.activeTabs.right = tab;
    },
    getBottomDockTab() {
      const activeId = layout.activeTabs.bottom;
      return activeId === 'history' ? 'history' : 'assets';
    },
    setBottomDockTab(tab) {
      layout.activeTabs.bottom = tab;
    },
  };
}
