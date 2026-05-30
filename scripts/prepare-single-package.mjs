import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectEditorBundledPackages,
  internalPackageNameToDir,
  readJson,
  writeJson,
} from './internal-package-graph.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const aggregateRoot = path.join(root, 'packages', 'editor');
const bundledScopeRoot = path.join(aggregateRoot, 'node_modules', '@fps-games');

function copyBundledPackage(pkg) {
  const sourceRoot = path.join(root, pkg.dirName);
  const sourcePackageJsonPath = pkg.path;
  const sourceDist = path.join(sourceRoot, 'dist');
  const sourcePackageJson = readJson(sourcePackageJsonPath);
  const targetRoot = path.join(bundledScopeRoot, internalPackageNameToDir(sourcePackageJson.name));
  const targetDist = path.join(targetRoot, 'dist');

  if (!fs.existsSync(sourceDist)) {
    throw new Error(`Missing dist for ${sourcePackageJson.name}. Run npm run build before packing.`);
  }

  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(sourceDist, targetDist, { recursive: true });

  const bundledPackageJson = {
    name: sourcePackageJson.name,
    version: sourcePackageJson.version,
    private: true,
    type: sourcePackageJson.type,
    description: sourcePackageJson.description,
    sideEffects: sourcePackageJson.sideEffects,
    main: sourcePackageJson.main,
    types: sourcePackageJson.types,
    exports: sourcePackageJson.exports,
    dependencies: sourcePackageJson.dependencies,
    peerDependencies: sourcePackageJson.peerDependencies,
    optionalDependencies: sourcePackageJson.optionalDependencies,
  };

  for (const key of Object.keys(bundledPackageJson)) {
    if (bundledPackageJson[key] === undefined) delete bundledPackageJson[key];
  }

  writeJson(path.join(targetRoot, 'package.json'), bundledPackageJson);
}

const bundledPackages = collectEditorBundledPackages(root);
fs.rmSync(bundledScopeRoot, { recursive: true, force: true });
fs.mkdirSync(bundledScopeRoot, { recursive: true });
for (const pkg of bundledPackages) copyBundledPackage(pkg);

console.log(
  `[prepare-single-package] bundled ${bundledPackages.length} internal packages into packages/editor: ${
    bundledPackages.map((pkg) => pkg.json.name).join(', ')
  }`,
);
