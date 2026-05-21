export type LocalEditorWorkbenchInputRegion =
  | 'top-bar'
  | 'left-dock'
  | 'right-dock'
  | 'bottom-dock'
  | 'scene-header'
  | 'modal'
  | 'scene-view'
  | 'unknown';

export interface LocalEditorWorkbenchInputRouter {
  getRegion(target: EventTarget | null): LocalEditorWorkbenchInputRegion;
  isEditableTarget(target: EventTarget | null): boolean;
  isUiRegion(target: EventTarget | null): boolean;
  setModalOpen(open: boolean): void;
  shouldHandleDocumentShortcut(event: KeyboardEvent): boolean;
  shouldHandleGlobalShortcut(event: KeyboardEvent): boolean;
  dispose(): void;
}

export function createLocalEditorWorkbenchInputRouter(doc: Document): LocalEditorWorkbenchInputRouter {
  let modalOpen = false;
  const stopPanelWheel = (event: WheelEvent): void => {
    if (!isUiRegion(event.target)) return;
    event.stopPropagation();
  };
  const stopPanelContextMenu = (event: MouseEvent): void => {
    if (!isUiRegion(event.target)) return;
    event.stopPropagation();
  };
  const stopPanelPointer = (event: PointerEvent): void => {
    if (!isUiRegion(event.target)) return;
    event.stopPropagation();
  };

  doc.addEventListener('wheel', stopPanelWheel, { capture: true, passive: true });
  doc.addEventListener('contextmenu', stopPanelContextMenu, { capture: true });
  doc.addEventListener('pointerdown', stopPanelPointer, { capture: true });

  return {
    getRegion,
    isEditableTarget,
    isUiRegion,
    setModalOpen(open) {
      modalOpen = open;
    },
    shouldHandleDocumentShortcut(event) {
      return !modalOpen && getRegion(event.target) !== 'modal';
    },
    shouldHandleGlobalShortcut(event) {
      return !modalOpen && !isEditableTarget(event.target) && getRegion(event.target) !== 'modal';
    },
    dispose() {
      doc.removeEventListener('wheel', stopPanelWheel, { capture: true });
      doc.removeEventListener('contextmenu', stopPanelContextMenu, { capture: true });
      doc.removeEventListener('pointerdown', stopPanelPointer, { capture: true });
    },
  };
}

function getRegion(target: EventTarget | null): LocalEditorWorkbenchInputRegion {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return 'unknown';
  if (element.closest('[data-editor-shortcut-help]')) return 'modal';
  const region = element.closest<HTMLElement>('[data-editor-workbench-region]')?.dataset.editorWorkbenchRegion;
  if (region === 'scene-toolbar') return 'scene-header';
  if (region === 'top-bar'
    || region === 'left-dock'
    || region === 'right-dock'
    || region === 'bottom-dock'
    || region === 'scene-header') {
    return region;
  }
  if (element.closest('[data-editor-workbench]')) return 'scene-view';
  return 'unknown';
}

function isUiRegion(target: EventTarget | null): boolean {
  const region = getRegion(target);
  return region === 'top-bar'
    || region === 'left-dock'
    || region === 'right-dock'
    || region === 'bottom-dock'
    || region === 'scene-header'
    || region === 'modal';
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || element.isContentEditable;
}
