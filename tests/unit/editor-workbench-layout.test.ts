import { describe, expect, it } from 'vitest';
import {
  normalizeLocalEditorWorkbenchLayout,
  normalizeLocalEditorWorkbenchUserLayout,
  resolveLocalEditorWorkbenchVisibility,
  type LocalEditorWorkbenchLayoutState,
} from '@fps-games/editor-browser';

const defaultLayout: LocalEditorWorkbenchLayoutState = {
  leftWidth: 300,
  rightWidth: 340,
  bottomHeight: 260,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
};

describe('local editor workbench layout projection', () => {
  it('defaults the bottom dock to collapsed when no saved layout exists', () => {
    const userLayout = normalizeLocalEditorWorkbenchUserLayout(undefined);
    const projected = normalizeLocalEditorWorkbenchLayout(undefined, { width: 1440, height: 900 });
    const visibility = resolveLocalEditorWorkbenchVisibility(projected, { width: 1440, height: 900 });

    expect(userLayout.bottomCollapsed).toBe(true);
    expect(projected.bottomCollapsed).toBe(true);
    expect(visibility.bottomVisible).toBe(false);
  });

  it('keeps user collapse preferences separate from responsive auto hiding', () => {
    const projected = normalizeLocalEditorWorkbenchLayout(defaultLayout, { width: 1024, height: 768 });
    const visibility = resolveLocalEditorWorkbenchVisibility(projected, { width: 1024, height: 768 });

    expect(projected.rightCollapsed).toBe(false);
    expect(visibility.rightAutoHidden).toBe(true);
    expect(visibility.rightVisible).toBe(false);
  });

  it('does not turn short viewport bottom auto hiding into a persisted collapse preference', () => {
    const projected = normalizeLocalEditorWorkbenchLayout(defaultLayout, { width: 1440, height: 480 });
    const userLayout = normalizeLocalEditorWorkbenchUserLayout(defaultLayout);
    const visibility = resolveLocalEditorWorkbenchVisibility(projected, { width: 1440, height: 480 });

    expect(projected.bottomCollapsed).toBe(false);
    expect(projected.bottomHeight).toBe(216);
    expect(userLayout.bottomHeight).toBe(260);
    expect(visibility.bottomAutoHidden).toBe(true);
    expect(visibility.bottomVisible).toBe(false);
  });

  it('normalizes stored user dimensions without viewport projection clamps', () => {
    const userLayout = normalizeLocalEditorWorkbenchUserLayout({
      ...defaultLayout,
      bottomHeight: 420,
    });
    const projected = normalizeLocalEditorWorkbenchLayout(userLayout, { width: 1440, height: 480 });

    expect(userLayout.bottomHeight).toBe(420);
    expect(projected.bottomHeight).toBe(216);
  });

  it('does not reserve auto-hidden right dock width when projecting narrow layouts', () => {
    const projected = normalizeLocalEditorWorkbenchLayout({
      ...defaultLayout,
      rightWidth: 520,
    }, { width: 1024, height: 768 });
    const visibility = resolveLocalEditorWorkbenchVisibility(projected, { width: 1024, height: 768 });

    expect(visibility.rightAutoHidden).toBe(true);
    expect(visibility.rightVisible).toBe(false);
    expect(projected.leftWidth).toBe(300);
  });

  it('preserves explicit user collapse state independently of viewport size', () => {
    const projected = normalizeLocalEditorWorkbenchLayout({
      ...defaultLayout,
      leftCollapsed: true,
      rightCollapsed: true,
      bottomCollapsed: true,
    }, { width: 2048, height: 1280 });
    const visibility = resolveLocalEditorWorkbenchVisibility(projected, { width: 2048, height: 1280 });

    expect(visibility.leftAutoHidden).toBe(false);
    expect(visibility.rightAutoHidden).toBe(false);
    expect(visibility.bottomAutoHidden).toBe(false);
    expect(visibility.leftVisible).toBe(false);
    expect(visibility.rightVisible).toBe(false);
    expect(visibility.bottomVisible).toBe(false);
  });
});
