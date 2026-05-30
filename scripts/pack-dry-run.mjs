import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  collectEditorBundledPackages,
  internalPackageNameToDir,
} from './internal-package-graph.mjs';

const root = process.cwd();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fps-editor-pack-dry-run-'));
const npmCacheDir = path.join(tmpRoot, 'npm-cache');
const expectedBundledPackages = collectEditorBundledPackages(root);
fs.mkdirSync(npmCacheDir, { recursive: true });

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  });
}

function parsePackJson(output) {
  let index = output.indexOf('[');
  while (index >= 0) {
    try {
      return JSON.parse(output.slice(index));
    } catch {
      index = output.indexOf('[', index + 1);
    }
  }
  throw new Error(`Unable to find npm pack JSON output:\n${output}`);
}

run('npm', ['run', 'build']);
const dryRunOutput = run('npm', ['pack', '--workspace', '@fps-games/editor', '--dry-run', '--json'], {
  stdio: 'pipe',
});
const [packInfo] = parsePackJson(dryRunOutput);
if (!packInfo) throw new Error('npm pack --dry-run did not return package metadata.');

const filePaths = new Set(packInfo.files?.map((file) => file.path) ?? []);
const bundledNames = new Set(packInfo.bundled ?? []);
for (const pkg of expectedBundledPackages) {
  const packageDir = internalPackageNameToDir(pkg.json.name);
  const expectedPaths = [
    `node_modules/@fps-games/${packageDir}/package.json`,
    `node_modules/@fps-games/${packageDir}/${pkg.json.main?.replace(/^\.\//, '') ?? 'dist/index.js'}`,
  ];

  if (!bundledNames.has(pkg.json.name)) {
    throw new Error(`npm pack dry-run did not report ${pkg.json.name} as bundled.`);
  }
  for (const expectedPath of expectedPaths) {
    if (!filePaths.has(expectedPath)) {
      throw new Error(`npm pack dry-run is missing ${expectedPath}.`);
    }
  }
}

console.log(
  `[pack-dry-run] ok ${packInfo.filename} (${expectedBundledPackages.length} bundled internal packages checked)`,
);
