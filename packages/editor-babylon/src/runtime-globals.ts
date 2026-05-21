import type { BabylonRuntimeGlobal } from './types';

export function getBabylonRuntime(explicitRuntime?: BabylonRuntimeGlobal | null): BabylonRuntimeGlobal | null {
  if (explicitRuntime) return explicitRuntime;
  const root = globalThis as typeof globalThis & { BABYLON?: BabylonRuntimeGlobal };
  return root.BABYLON ?? null;
}
