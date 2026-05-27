import { describe, expect, it, vi } from 'vitest';
import { createLocalEditorWorkbenchInputRouter } from '../../packages/editor-browser/src/local-editor-ui-input-router';

function createDocumentStub(): Document {
  return {
    activeElement: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;
}

function createKeyboardEvent(key: string, overrides: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> = {}): KeyboardEvent {
  return {
    key,
    target: null,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    altKey: overrides.altKey ?? false,
  } as unknown as KeyboardEvent;
}

describe('Local editor UI input router', () => {
  it('reserves scene view owned shortcuts before document and global handlers run', () => {
    const doc = createDocumentStub();
    const isShortcutReserved = vi.fn((event: KeyboardEvent) => event.key.toLowerCase() === 'w' && !event.ctrlKey);
    const router = createLocalEditorWorkbenchInputRouter(doc, { isShortcutReserved });

    const flythroughKey = createKeyboardEvent('w');
    expect(router.shouldHandleDocumentShortcut(flythroughKey)).toBe(false);
    expect(router.shouldHandleGlobalShortcut(flythroughKey)).toBe(false);

    const ctrlShortcut = createKeyboardEvent('w', { ctrlKey: true });
    expect(router.shouldHandleDocumentShortcut(ctrlShortcut)).toBe(true);
    expect(router.shouldHandleGlobalShortcut(ctrlShortcut)).toBe(true);
    expect(isShortcutReserved).toHaveBeenCalledTimes(4);

    router.dispose();
  });

  it('preserves existing modal and context-menu shortcut guards', () => {
    const doc = createDocumentStub();
    const router = createLocalEditorWorkbenchInputRouter(doc, { isShortcutReserved: () => false });
    const event = createKeyboardEvent('f');

    expect(router.shouldHandleDocumentShortcut(event)).toBe(true);
    expect(router.shouldHandleGlobalShortcut(event)).toBe(true);

    router.setContextMenuOpen(true);
    expect(router.shouldHandleDocumentShortcut(event)).toBe(false);
    expect(router.shouldHandleGlobalShortcut(event)).toBe(false);

    router.setContextMenuOpen(false);
    router.setModalOpen(true);
    expect(router.shouldHandleDocumentShortcut(event)).toBe(false);
    expect(router.shouldHandleGlobalShortcut(event)).toBe(false);

    router.dispose();
  });
});
