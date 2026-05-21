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
  isEditorOwnedRegion(target: EventTarget | null): boolean;
  isUiRegion(target: EventTarget | null): boolean;
  setContextMenuOpen(open: boolean): void;
  setModalOpen(open: boolean): void;
  shouldPreventBrowserContextMenu(event: MouseEvent): boolean;
  shouldHandleDocumentShortcut(event: KeyboardEvent): boolean;
  shouldHandleGlobalShortcut(event: KeyboardEvent): boolean;
  dispose(): void;
}

export function createLocalEditorWorkbenchInputRouter(doc: Document): LocalEditorWorkbenchInputRouter {
  let modalOpen = false;
  let contextMenuOpen = false;
  const stopPanelWheel = (event: WheelEvent): void => {
    if (!isUiRegion(event.target)) return;
    event.stopPropagation();
  };
  const stopPanelContextMenu = (event: MouseEvent): void => {
    if (shouldPreventBrowserContextMenu(event)) event.preventDefault();
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
    isEditorOwnedRegion,
    isUiRegion,
    setContextMenuOpen(open) {
      contextMenuOpen = open;
    },
    setModalOpen(open) {
      modalOpen = open;
    },
    shouldPreventBrowserContextMenu,
    shouldHandleDocumentShortcut(event) {
      return !modalOpen && !contextMenuOpen && getRegion(event.target) !== 'modal';
    },
    shouldHandleGlobalShortcut(event) {
      return !modalOpen
        && !contextMenuOpen
        && !isEditableTarget(event.target)
        && !isEditableTarget(doc.activeElement)
        && getRegion(event.target) !== 'modal';
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
  if (element.closest('[data-editor-context-menu]')) return 'modal';
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

function isEditorOwnedRegion(target: EventTarget | null): boolean {
  const region = getRegion(target);
  return region === 'top-bar'
    || region === 'left-dock'
    || region === 'right-dock'
    || region === 'bottom-dock'
    || region === 'scene-header'
    || region === 'modal'
    || region === 'scene-view';
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

function shouldPreventBrowserContextMenu(event: MouseEvent): boolean {
  return isEditorOwnedRegion(event.target) && !isEditableTarget(event.target);
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
