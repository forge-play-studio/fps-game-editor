import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCAL_EDITOR_THEME,
  LOCAL_EDITOR_THEME_CLASS,
  applyLocalEditorTheme,
  normalizeLocalEditorThemeName,
} from '@fps-games/editor-browser';

function createFakeElement(): HTMLElement & { addedClasses: string[] } {
  const addedClasses: string[] = [];
  return {
    addedClasses,
    dataset: {},
    classList: {
      add(value: string) {
        addedClasses.push(value);
      },
    },
  } as unknown as HTMLElement & { addedClasses: string[] };
}

describe('local editor browser theme contract', () => {
  it('defaults unknown theme names to the dark editor theme', () => {
    expect(DEFAULT_LOCAL_EDITOR_THEME).toBe('dark');
    expect(normalizeLocalEditorThemeName(undefined)).toBe('dark');
    expect(normalizeLocalEditorThemeName('dark')).toBe('dark');
    expect(normalizeLocalEditorThemeName('light')).toBe('light');
    expect(normalizeLocalEditorThemeName('system')).toBe('dark');
  });

  it('applies the shared editor theme class and data attribute to standalone surfaces', () => {
    const element = createFakeElement();

    expect(applyLocalEditorTheme(element, 'light')).toBe('light');
    expect(element.addedClasses).toContain(LOCAL_EDITOR_THEME_CLASS);
    expect(element.dataset.fpsEditorTheme).toBe('light');

    expect(applyLocalEditorTheme(element, 'unknown')).toBe('dark');
    expect(element.dataset.fpsEditorTheme).toBe('dark');
  });
});
