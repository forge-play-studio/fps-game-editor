import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  collectEditorBundledPackages,
  internalPackageNameToDir,
  readJson,
} from './internal-package-graph.mjs';

const root = process.cwd();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fps-editor-pack-smoke-'));
const packDir = path.join(tmpRoot, 'pack');
const consumerDir = path.join(tmpRoot, 'consumer');
const npmCacheDir = path.join(tmpRoot, 'npm-cache');
const rootTsc = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const rootVite = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const rootPackageJson = readJson(path.join(root, 'package.json'));
const expectedBundledPackages = collectEditorBundledPackages(root);
fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(consumerDir, { recursive: true });
fs.mkdirSync(npmCacheDir, { recursive: true });

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
  });
}

const packOutput = run('npm', ['pack', '--workspace', '@fps-games/editor', '--pack-destination', packDir]);
const tarballName = packOutput.trim().split(/\s+/).pop();
if (!tarballName) throw new Error(`Unable to read tarball name from npm pack output: ${packOutput}`);
const tarball = path.join(packDir, tarballName);

fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({
  type: 'module',
  private: true,
  dependencies: {
    '@fps-games/editor': tarball,
    '@babylonjs/core': rootPackageJson.devDependencies?.['@babylonjs/core'] ?? '^8.0.0',
  },
}, null, 2));
fs.writeFileSync(path.join(consumerDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    skipLibCheck: true,
  },
  include: ['src/**/*.ts'],
}, null, 2));
fs.mkdirSync(path.join(consumerDir, 'src'), { recursive: true });
fs.writeFileSync(path.join(consumerDir, 'src', 'index.ts'), [
  "import { createLocalEditorHarness, EDITOR_COMMAND_NAME, type LocalEditorHarness } from '@fps-games/editor';",
  '',
  'const commandName: string = EDITOR_COMMAND_NAME.UNDO;',
  'const createHarness: typeof createLocalEditorHarness = createLocalEditorHarness;',
  'type Harness = LocalEditorHarness<unknown>;',
  'void commandName;',
  'void createHarness;',
  'const maybeHarness: Harness | null = null;',
  'void maybeHarness;',
  '',
].join('\n'));
fs.writeFileSync(path.join(consumerDir, 'src', 'runtime-import.ts'), [
  'export {};',
  '',
  "const editor = await import('@fps-games/editor');",
  "if (typeof editor.createLocalEditorHarness !== 'function') {",
  "  throw new Error('Expected createLocalEditorHarness export to be a function.');",
  '}',
  '',
].join('\n'));
fs.writeFileSync(path.join(consumerDir, 'vite.config.mjs'), [
  'export default {',
  "  logLevel: 'warn',",
  '  build: {',
  "    target: 'esnext',",
  '    modulePreload: false,',
  "    outDir: 'dist',",
  '    rollupOptions: {',
  "      input: 'src/runtime-import.ts',",
  '      output: {',
  "        entryFileNames: 'runtime-import.mjs',",
  "        chunkFileNames: 'chunks/[name]-[hash].mjs',",
  '      },',
  '    },',
  '  },',
  '};',
  '',
].join('\n'));

run('npm', ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], {
  cwd: consumerDir,
  stdio: 'inherit',
});
run(rootTsc, ['-p', path.join(consumerDir, 'tsconfig.json'), '--noEmit'], {
  cwd: consumerDir,
  stdio: 'inherit',
});
run(rootVite, ['build', '--config', path.join(consumerDir, 'vite.config.mjs')], {
  cwd: consumerDir,
  stdio: 'inherit',
});
run(process.execPath, [path.join(consumerDir, 'dist', 'runtime-import.mjs')], {
  cwd: consumerDir,
  stdio: 'inherit',
});

for (const pkg of expectedBundledPackages) {
  const packageDir = path.join(
    consumerDir,
    'node_modules',
    '@fps-games',
    'editor',
    'node_modules',
    '@fps-games',
    internalPackageNameToDir(pkg.json.name),
  );
  const packageJsonPath = path.join(packageDir, 'package.json');
  const mainPath = path.join(packageDir, pkg.json.main?.replace(/^\.\//, '') ?? 'dist/index.js');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Bundled internal dependency ${pkg.json.name} was not installed inside @fps-games/editor.`);
  }
  if (!fs.existsSync(mainPath)) {
    throw new Error(`Bundled internal dependency ${pkg.json.name} is missing ${path.relative(packageDir, mainPath)}.`);
  }
}

console.log(`[pack-consumer-smoke] ok ${tarball}`);
