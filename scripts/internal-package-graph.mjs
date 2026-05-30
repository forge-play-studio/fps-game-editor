import fs from 'node:fs';
import path from 'node:path';

const internalScope = '@fps-games/';
const dependencyKeys = ['dependencies', 'peerDependencies', 'optionalDependencies'];

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function internalPackageNameToDir(packageName) {
  if (!packageName.startsWith(internalScope)) {
    throw new Error(`Expected an ${internalScope} package name, got "${packageName}".`);
  }
  return packageName.slice(internalScope.length);
}

function readWorkspacePackages(root) {
  const rootJson = readJson(path.join(root, 'package.json'));
  const workspacePatterns = Array.isArray(rootJson.workspaces)
    ? rootJson.workspaces
    : rootJson.workspaces?.packages ?? [];
  const packages = [];

  for (const pattern of workspacePatterns) {
    if (!pattern.endsWith('/*')) continue;
    const parentDirName = pattern.slice(0, -2);
    const parentDir = path.join(root, parentDirName);
    if (!fs.existsSync(parentDir)) continue;

    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirName = `${parentDirName}/${entry.name}`;
      const packageJsonPath = path.join(root, dirName, 'package.json');
      if (!fs.existsSync(packageJsonPath)) continue;
      packages.push({
        dirName,
        path: packageJsonPath,
        json: readJson(packageJsonPath),
      });
    }
  }

  return packages.sort((a, b) => a.dirName.localeCompare(b.dirName));
}

function getInternalDependencies(pkg, workspaceByName) {
  const dependencies = [];
  for (const dependencyKey of dependencyKeys) {
    for (const dependencyName of Object.keys(pkg.json[dependencyKey] ?? {})) {
      if (workspaceByName.has(dependencyName)) dependencies.push(dependencyName);
    }
  }
  return [...new Set(dependencies)].sort();
}

export function collectEditorBundledPackages(root) {
  const workspaceByName = new Map(
    readWorkspacePackages(root)
      .filter((pkg) => typeof pkg.json.name === 'string')
      .map((pkg) => [pkg.json.name, pkg]),
  );
  const editorPackage = workspaceByName.get('@fps-games/editor');
  if (!editorPackage) throw new Error('Missing @fps-games/editor workspace package.');

  const bundledPackageNames = new Set([
    ...Object.keys(editorPackage.json.dependencies ?? {}),
    ...(editorPackage.json.bundleDependencies ?? []),
    ...(editorPackage.json.bundledDependencies ?? []),
  ].filter((packageName) => workspaceByName.has(packageName)));

  const visit = (packageName) => {
    const pkg = workspaceByName.get(packageName);
    if (!pkg) return;
    for (const dependencyName of getInternalDependencies(pkg, workspaceByName)) {
      if (!bundledPackageNames.has(dependencyName)) {
        bundledPackageNames.add(dependencyName);
        visit(dependencyName);
      }
    }
  };

  for (const packageName of [...bundledPackageNames].sort()) visit(packageName);

  return [...bundledPackageNames]
    .sort()
    .map((packageName) => workspaceByName.get(packageName));
}
