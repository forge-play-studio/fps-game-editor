import { describe, expect, it } from 'vitest';
import {
  LOCAL_EDITOR_ICON_NAMES,
  isLocalEditorIconName,
  resolveLocalEditorIconName,
} from '@fps-games/editor-browser';

describe('local editor browser icon registry contract', () => {
  it('keeps icon names unique for deterministic toolbar lookup', () => {
    expect(new Set(LOCAL_EDITOR_ICON_NAMES).size).toBe(LOCAL_EDITOR_ICON_NAMES.length);
  });

  it('guards unknown icon names and resolves to a stable fallback', () => {
    expect(isLocalEditorIconName('save')).toBe(true);
    expect(isLocalEditorIconName('theme')).toBe(true);
    expect(isLocalEditorIconName('lucide-save')).toBe(false);

    expect(resolveLocalEditorIconName('camera')).toBe('camera');
    expect(resolveLocalEditorIconName('missing')).toBe('object');
    expect(resolveLocalEditorIconName(null, 'help')).toBe('help');
  });
});
