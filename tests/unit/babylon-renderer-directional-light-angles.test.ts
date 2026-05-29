import { describe, expect, it } from 'vitest';
import {
  createDirectionalLightDirectionFromAngles,
  normalizeDirectionVector,
  readDirectionalLightAngles,
} from '@fps-games/babylon-renderer';

describe('babylon-renderer directional light angles', () => {
  it('round trips horizontal and elevation angles through a normalized direction', () => {
    const direction = createDirectionalLightDirectionFromAngles(-57, 56);
    expect(direction.x).toBeCloseTo(0.304558, 6);
    expect(direction.y).toBeCloseTo(-0.829038, 6);
    expect(direction.z).toBeCloseTo(-0.468979, 6);
    expect(readDirectionalLightAngles(direction)).toEqual({
      horizontalAngleDeg: -57,
      elevationAngleDeg: 56,
    });
  });

  it('normalizes arbitrary direction vectors before reading angles', () => {
    expect(readDirectionalLightAngles({ x: -0.6, y: -2, z: -0.4 })).toEqual({
      horizontalAngleDeg: -146,
      elevationAngleDeg: 70,
    });
  });

  it('uses the fallback direction for zero vectors', () => {
    const direction = normalizeDirectionVector({ x: 0, y: 0, z: 0 });
    expect(direction.x).toBeCloseTo(-0.2822162605150792);
    expect(direction.y).toBeCloseTo(-0.9407208683835973);
    expect(direction.z).toBeCloseTo(-0.18814417367671946);
  });
});
