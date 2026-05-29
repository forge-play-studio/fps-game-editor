import { describe, expect, it } from 'vitest';

import {
  isReadonlySceneMaterialAsset,
  mergeArtistMaterialProfiles,
  normalizeArtistMaterialProfile,
  normalizeSceneMaterialAssetConfig,
  resolveSceneMaterialAssetKind,
  resolveArtistMaterialProfile,
  type SceneMaterialAssetConfig,
} from '@fps-games/editor-protocol';

describe('artist material resolver', () => {
  it('merges original, material asset, node override, and legacy profile in order', () => {
    const materialAssets: SceneMaterialAssetConfig[] = [{
      id: 'mat_screen',
      name: 'Screen Glow',
      profile: {
        baseColor: {
          color: { r: 0.1, g: 0.2, b: 0.3 },
          brightness: 1.2,
        },
        metallic: 0.05,
        emission: {
          color: { r: 0.4, g: 0.6, b: 1 },
          intensity: 1.5,
        },
      },
    }];

    const result = resolveArtistMaterialProfile({
      originalProfile: {
        baseColor: {
          color: { r: 1, g: 1, b: 1 },
          contrast: 1,
        },
        roughness: 0.9,
      },
      materialAssets,
      binding: {
        materialAssetId: 'mat_screen',
        override: {
          baseColor: {
            saturation: 0.75,
          },
          roughness: 0.35,
          emission: {
            maskTexture: { url: '/textures/screen-mask.png' },
          },
        },
      },
      legacyProfile: {
        baseColor: {
          color: { r: 0.9, g: 0.8, b: 0.7 },
        },
        metallic: 0.2,
      },
    });

    expect(result.materialAsset?.id).toBe('mat_screen');
    expect(result.profile).toEqual({
      baseColor: {
        color: { r: 0.9, g: 0.8, b: 0.7 },
        contrast: 1,
        brightness: 1.2,
        saturation: 0.75,
      },
      metallic: 0.2,
      roughness: 0.35,
      emission: {
        color: { r: 0.4, g: 0.6, b: 1 },
        intensity: 1.5,
        maskTexture: { url: '/textures/screen-mask.png' },
      },
    });
  });

  it('reports missing material assets while keeping local overrides', () => {
    const result = resolveArtistMaterialProfile({
      materialAssets: [],
      binding: {
        materialAssetId: 'missing_material',
        override: {
          roughness: 0.4,
        },
      },
    });

    expect(result.materialAsset).toBeNull();
    expect(result.missingMaterialAssetId).toBe('missing_material');
    expect(result.profile).toEqual({ roughness: 0.4 });
  });

  it('normalizes invalid and empty artist material fields out of profiles', () => {
    expect(normalizeArtistMaterialProfile({
      baseColor: {
        color: { r: 1, g: Number.NaN, b: 1 },
        brightness: 1,
      },
      metallic: Number.POSITIVE_INFINITY,
      emission: {
        intensity: 2,
        maskTexture: { url: '  /textures/mask.png  ' },
      },
    })).toEqual({
      baseColor: {
        brightness: 1,
      },
      emission: {
        intensity: 2,
        maskTexture: { url: '/textures/mask.png' },
      },
    });
  });

  it('returns an empty profile when every merged profile is empty', () => {
    expect(mergeArtistMaterialProfiles(null, {}, {
      emission: {
        maskTexture: { url: '   ' },
      },
    })).toEqual({});
  });

  it('defaults old material assets to PBR while preserving standard and readonly metadata', () => {
    expect(resolveSceneMaterialAssetKind({})).toBe('pbr');
    expect(resolveSceneMaterialAssetKind({ materialKind: 'standard' })).toBe('standard');
    expect(resolveSceneMaterialAssetKind({ system: { preset: 'default-standard' } })).toBe('standard');

    const normalized = normalizeSceneMaterialAssetConfig({
      id: ' mat_standard ',
      name: ' Standard Mat ',
      materialKind: 'standard',
      system: {
        readonly: true,
        preset: 'default-standard',
      },
      profile: {
        baseColor: {
          color: { r: 1, g: 1, b: 1 },
        },
      },
    });

    expect(normalized).toEqual({
      id: 'mat_standard',
      name: 'Standard Mat',
      materialKind: 'standard',
      system: {
        readonly: true,
        preset: 'default-standard',
      },
      profile: {
        baseColor: {
          color: { r: 1, g: 1, b: 1 },
        },
      },
    });
    expect(isReadonlySceneMaterialAsset(normalized)).toBe(true);
    expect(normalizeSceneMaterialAssetConfig({
      id: 'bad_default',
      name: 'Bad Default',
      materialKind: 'pbr',
      system: { preset: 'default-standard' },
      profile: {
        baseColor: { color: { r: 1, g: 1, b: 1 } },
      },
    })).toBeUndefined();
  });
});
