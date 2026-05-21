import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const aggregateRoot = path.join(root, 'packages', 'editor');
const bundledScopeRoot = path.join(aggregateRoot, 'node_modules', '@fps-games');

const bundledPackages = [
  'editor-protocol',
  'editor-browser',
  'editor-core',
  'editor-forge-play',
  'editor-babylon',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copyBundledPackage(packageDirName) {
  const sourceRoot = path.join(root, 'packages', packageDirName);
  const sourcePackageJsonPath = path.join(sourceRoot, 'package.json');
  const sourceDist = path.join(sourceRoot, 'dist');
  const sourcePackageJson = readJson(sourcePackageJsonPath);
  const targetRoot = path.join(bundledScopeRoot, packageDirName.replace(/^editor-?/, 'editor-'));
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
  };

  for (const key of Object.keys(bundledPackageJson)) {
    if (bundledPackageJson[key] === undefined) delete bundledPackageJson[key];
  }

  writeJson(path.join(targetRoot, 'package.json'), bundledPackageJson);
}

fs.mkdirSync(bundledScopeRoot, { recursive: true });
for (const packageDirName of bundledPackages) copyBundledPackage(packageDirName);

console.log(`[prepare-single-package] bundled ${bundledPackages.length} internal packages into packages/editor`);
