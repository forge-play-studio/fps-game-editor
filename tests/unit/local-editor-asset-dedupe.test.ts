import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalEditorBrowserUiAssetItem } from '@fps-games/editor-browser';

const browserUiMock = vi.hoisted(() => ({
  states: [] as Array<{ assets: LocalEditorBrowserUiAssetItem[] }>,
}));

vi.mock('@fps-games/editor-browser', async (importOriginal) => {
  const original = await importOriginal<typeof import('@fps-games/editor-browser')>();
  return {
    ...original,
    createLocalEditorBrowserUi: vi.fn(() => ({
      update(state: { assets: LocalEditorBrowserUiAssetItem[] }) {
        browserUiMock.states.push({ assets: state.assets });
      },
      setTheme() {},
      getTheme: () => 'dark',
      dispose() {},
    })),
  };
});

import {
  createLocalEditorHarness,
  dedupeLocalEditorBrowserAssetItems,
} from '@fps-games/editor';

describe('local editor asset browser canonical dedupe', () => {
  beforeEach(() => {
    browserUiMock.states.length = 0;
  });

  it('shows the project item instead of a raw item with the same external platform id', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({
        id: 'raw_tree',
        external: { platformAssetId: 'platform_tree' },
      }),
      projectAsset({
        guid: '11111111-1111-4111-8111-111111111111',
        id: 'asset_tree',
        assetId: 'asset_tree',
        external: { platformAssetId: 'platform_tree' },
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'asset_tree',
      assetId: 'asset_tree',
      guid: '11111111-1111-4111-8111-111111111111',
      origin: 'project',
    });
  });

  it('keeps two project assets with different guids even when they share an external id', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      projectAsset({
        guid: '11111111-1111-4111-8111-111111111111',
        id: 'asset_tree_a',
        assetId: 'asset_tree_a',
        external: { platformAssetId: 'platform_tree' },
      }),
      projectAsset({
        guid: '22222222-2222-4222-8222-222222222222',
        id: 'asset_tree_b',
        assetId: 'asset_tree_b',
        external: { platformAssetId: 'platform_tree' },
      }),
      rawAsset({
        id: 'raw_tree',
        external: { platformAssetId: 'platform_tree' },
      }),
    ]);

    expect(items.map(item => item.id).sort()).toEqual(['asset_tree_a', 'asset_tree_b']);
  });

  it('dedupes legacy id-only items without requiring guid or external data', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({ id: 'asset_box', label: 'Box' }),
      rawAsset({ id: 'asset_box', label: 'Box duplicate', meta: 'duplicate' }),
      rawAsset({ id: 'asset_crate', label: 'Crate' }),
    ]);

    expect(items.map(item => item.id).sort()).toEqual(['asset_box', 'asset_crate']);
  });

  it('suppresses raw id-only duplicates that match a project asset id', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({ id: 'asset_tree' }),
      projectAsset({
        guid: '44444444-4444-4444-8444-444444444444',
        id: 'asset_tree',
        assetId: 'asset_tree',
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'asset_tree',
      assetId: 'asset_tree',
      guid: '44444444-4444-4444-8444-444444444444',
      origin: 'project',
    });
  });

  it('suppresses raw dedupe-key duplicates that match a project guid item', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({ id: 'raw_tree', dedupeKey: 'same_tree' }),
      projectAsset({
        guid: '55555555-5555-4555-8555-555555555555',
        id: 'asset_tree',
        assetId: 'asset_tree',
        dedupeKey: 'same_tree',
      }),
    ]);

    expect(items.map(item => item.id)).toEqual(['asset_tree']);
  });

  it('keeps project disabled/placeable state when a raw item has the same canonical key', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({
        id: 'raw_texture',
        external: { platformAssetId: 'platform_texture' },
      }),
      projectAsset({
        id: 'texture_abc',
        assetId: 'texture_abc',
        external: { platformAssetId: 'platform_texture' },
        disabled: true,
        placeable: false,
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'texture_abc',
      origin: 'project',
      disabled: true,
      placeable: false,
    });
  });

  it('dedupes before exposing assets from the harness UI state', async () => {
    const harness = createLocalEditorHarness<{ nodes: unknown[] }, never, LocalEditorBrowserUiAssetItem>({
      root: {} as HTMLElement,
      documentAdapter: {
        reduceDocument: document => document,
        getSerializedObject: () => null,
        getHierarchyItems: () => [],
      },
      persistenceAdapter: {
        async loadDocument() {
          return { nodes: [] };
        },
        async loadAssets() {
          return [
            rawAsset({
              id: 'texture_abc',
            }),
            projectAsset({
              id: 'texture_abc',
              assetId: 'texture_abc',
              guid: '33333333-3333-4333-8333-333333333333',
              disabled: true,
              placeable: false,
            }),
          ];
        },
        runGame() {},
      },
      worldAdapter: {
        disposeGameWorld() {},
        getCanvas: () => null,
        loadBabylon: async () => ({}),
        createEngine: () => null,
      },
    });

    await harness.reloadAssets();
    const latest = browserUiMock.states.at(-1);
    expect(latest?.assets).toHaveLength(1);
    expect(latest?.assets[0]).toMatchObject({
      id: 'texture_abc',
      origin: 'project',
      disabled: true,
      placeable: false,
    });
  });

  it('uses dedupeKey before asset id for non-guid non-external items', () => {
    const items = dedupeLocalEditorBrowserAssetItems([
      rawAsset({ id: 'raw_local_a', dedupeKey: 'local_texture' }),
      projectAsset({ id: 'texture_local', assetId: 'texture_local', dedupeKey: 'local_texture' }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'texture_local',
      origin: 'project',
    });
  });
});

function projectAsset(overrides: Partial<LocalEditorBrowserUiAssetItem>): LocalEditorBrowserUiAssetItem {
  return {
    id: 'asset_project',
    assetId: 'asset_project',
    label: 'Project Asset',
    origin: 'project',
    ...overrides,
  };
}

function rawAsset(overrides: Partial<LocalEditorBrowserUiAssetItem>): LocalEditorBrowserUiAssetItem {
  return {
    id: 'asset_raw',
    label: 'Raw Asset',
    origin: 'raw',
    ...overrides,
  };
}
