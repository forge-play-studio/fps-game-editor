import { createContextMenu } from './local-editor-ui-primitives';
import { LOCAL_EDITOR_THEME_CLASS } from './local-editor-ui-theme';
import type { LocalEditorContextMenuItem } from './local-editor-ui-types';

export interface LocalEditorContextMenuOpenInput {
  x: number;
  y: number;
  items: LocalEditorContextMenuItem[];
  onAction: (item: LocalEditorContextMenuItem) => void;
}

export interface LocalEditorContextMenuController {
  isOpen(): boolean;
  open(input: LocalEditorContextMenuOpenInput): void;
  close(): void;
  dispose(): void;
}

export function createLocalEditorContextMenuController(
  doc: Document,
  onOpenChange: (open: boolean) => void,
): LocalEditorContextMenuController {
  const menu = createContextMenu(doc);
  menu.classList.add(LOCAL_EDITOR_THEME_CLASS);
  menu.tabIndex = -1;
  menu.setAttribute('role', 'menu');
  doc.body.appendChild(menu);

  let open = false;
  let onAction: ((item: LocalEditorContextMenuItem) => void) | null = null;

  const close = (): void => {
    if (!open) return;
    open = false;
    onAction = null;
    menu.style.display = 'none';
    clearMenu();
    onOpenChange(false);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!open) return;
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const onCloseEvent = (): void => close();

  doc.addEventListener('pointerdown', onPointerDown, { capture: true });
  doc.addEventListener('keydown', onKeyDown, { capture: true });
  doc.defaultView?.addEventListener('resize', onCloseEvent);
  doc.defaultView?.addEventListener('scroll', onCloseEvent, { capture: true });

  menu.addEventListener('click', (event) => {
    if (!open) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const itemId = target?.closest<HTMLButtonElement>('[data-editor-context-menu-item]')?.dataset.editorContextMenuItem;
    if (!itemId) return;
    const item = findMenuItem(itemId, currentItems);
    if (!item || item.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const action = onAction;
    close();
    action?.(item);
  });

  let currentItems: LocalEditorContextMenuItem[] = [];

  return {
    isOpen() {
      return open;
    },
    open(input) {
      currentItems = input.items;
      onAction = input.onAction;
      renderMenu(doc, menu, currentItems);
      menu.style.display = '';
      menu.style.left = '0px';
      menu.style.top = '0px';
      clampMenuPosition(doc, menu, input.x, input.y);
      open = true;
      onOpenChange(true);
      menu.focus({ preventScroll: true });
    },
    close,
    dispose() {
      close();
      doc.removeEventListener('pointerdown', onPointerDown, { capture: true });
      doc.removeEventListener('keydown', onKeyDown, { capture: true });
      doc.defaultView?.removeEventListener('resize', onCloseEvent);
      doc.defaultView?.removeEventListener('scroll', onCloseEvent, { capture: true });
      menu.remove();
    },
  };

  function clearMenu(): void {
    currentItems = [];
    while (menu.firstChild) menu.removeChild(menu.firstChild);
  }
}

function renderMenu(doc: Document, menu: HTMLElement, items: LocalEditorContextMenuItem[]): void {
  while (menu.firstChild) menu.removeChild(menu.firstChild);
  for (const item of items) {
    if (item.separatorBefore) {
      const separator = doc.createElement('div');
      separator.setAttribute('role', 'separator');
      separator.style.cssText = 'height:1px;margin:4px;background:var(--fps-editor-divider)';
      menu.appendChild(separator);
    }
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.editorContextMenuItem = item.id;
    button.disabled = item.disabled ?? false;
    button.setAttribute('role', 'menuitem');
    button.style.cssText = [
      'width:100%',
      'min-height:26px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:18px',
      'padding:4px 8px',
      'border:0',
      'border-radius:2px',
      'background:transparent',
      `color:${item.disabled ? 'var(--fps-editor-muted)' : item.danger ? '#ffb8b3' : 'var(--fps-editor-text)'}`,
      'font-family:var(--fps-editor-font)',
      'font-size:12px',
      'font-weight:800',
      `cursor:${item.disabled ? 'not-allowed' : 'pointer'}`,
      'text-align:left',
    ].join(';');
    const label = doc.createElement('span');
    label.textContent = item.label;
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    button.appendChild(label);
    if (item.shortcut) {
      const shortcut = doc.createElement('span');
      shortcut.textContent = item.shortcut;
      shortcut.style.cssText = 'color:var(--fps-editor-muted);font-size:11px;font-weight:800;white-space:nowrap';
      button.appendChild(shortcut);
    }
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) button.style.background = 'var(--fps-editor-accent-soft)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
    });
    menu.appendChild(button);
  }
}

function clampMenuPosition(doc: Document, menu: HTMLElement, x: number, y: number): void {
  const view = doc.defaultView;
  const viewportWidth = view?.innerWidth ?? doc.documentElement.clientWidth;
  const viewportHeight = view?.innerHeight ?? doc.documentElement.clientHeight;
  const rect = menu.getBoundingClientRect();
  const left = Math.max(4, Math.min(x, viewportWidth - rect.width - 4));
  const top = Math.max(4, Math.min(y, viewportHeight - rect.height - 4));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function findMenuItem(id: string, items: LocalEditorContextMenuItem[]): LocalEditorContextMenuItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children ? findMenuItem(id, item.children) : null;
    if (child) return child;
  }
  return null;
}
