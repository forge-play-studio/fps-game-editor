import type { Plugin } from 'vite';

/**
 * Exposes @babylonjs/inspector on globalThis.INSPECTOR in dev mode.
 * This gives bridge/editor a same-version local inspector instead of
 * depending on the remote Babylon preview bundle.
 */
export function inspectorPlugin(): Plugin {
  return {
    name: 'vite-plugin-babylon-inspector',
    apply: 'serve',

    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { type: 'module', src: '/vite-plugins/inspector/init.ts' },
        injectTo: 'head',
      }];
    },
  };
}
