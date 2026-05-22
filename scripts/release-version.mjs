import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageLockPath = path.join(root, 'package-lock.json');
const internalScope = '@fps-games/';

const args = process.argv.slice(2);
const command = args.shift();

function usage() {
  console.error([
    'Usage:',
    '  node scripts/release-version.mjs check [--channel beta|stable] [--tag vX.Y.Z[-beta.N]]',
    '  node scripts/release-version.mjs set <X.Y.Z[-beta.N]>',
  ].join('\n'));
  process.exit(2);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readPackages() {
  const rootJson = readJson(path.join(root, 'package.json'));
  const rootPackage = {
    dirName: '.',
    path: path.join(root, 'package.json'),
    json: rootJson,
  };
  const workspacePatterns = Array.isArray(rootJson.workspaces)
    ? rootJson.workspaces
    : rootJson.workspaces?.packages ?? [];
  const workspacePackageMap = new Map();

  for (const pattern of workspacePatterns) {
    if (!pattern.endsWith('/*')) continue;
    const parentDirName = pattern.slice(0, -2);
    const parentDir = path.join(root, parentDirName);
    if (!fs.existsSync(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirName = `${parentDirName}/${entry.name}`;
      const packagePath = path.join(root, dirName, 'package.json');
      if (!fs.existsSync(packagePath)) continue;
      workspacePackageMap.set(dirName, {
        dirName,
        path: packagePath,
        json: readJson(packagePath),
      });
    }
  }

  const workspacePackages = [...workspacePackageMap.values()]
    .sort((a, b) => a.dirName.localeCompare(b.dirName));

  return [rootPackage, ...workspacePackages];
}

function parseFlags(flagArgs) {
  const flags = {};
  for (let index = 0; index < flagArgs.length; index += 1) {
    const arg = flagArgs[index];
    if (arg === '--channel') {
      flags.channel = flagArgs[index + 1];
      if (!flags.channel) usage();
      if (!['beta', 'stable'].includes(flags.channel)) {
        throw new Error(`Unsupported release channel "${flags.channel}". Use beta or stable.`);
      }
      index += 1;
      continue;
    }
    if (arg === '--tag') {
      flags.tag = flagArgs[index + 1];
      if (!flags.tag) usage();
      index += 1;
      continue;
    }
    usage();
  }
  return flags;
}

function isValidReleaseVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(version);
}

function assertVersionShape(version, channel) {
  if (!isValidReleaseVersion(version)) {
    throw new Error(`Invalid release version "${version}". Use X.Y.Z or X.Y.Z-beta.N.`);
  }
  if (channel === 'beta' && !/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) {
    throw new Error(`Beta releases must use X.Y.Z-beta.N, got "${version}".`);
  }
  if (channel === 'stable' && version.includes('-')) {
    throw new Error(`Stable releases must not use a prerelease suffix, got "${version}".`);
  }
}

function getInternalPackageNames(packages) {
  return new Set(
    packages
      .filter((pkg) => pkg.dirName !== '.')
      .map((pkg) => pkg.json.name)
      .filter((name) => typeof name === 'string' && name.startsWith(internalScope)),
  );
}

function updateInternalDependencies(json, internalNames, version) {
  for (const dependencyKey of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!json[dependencyKey]) continue;
    for (const dependencyName of Object.keys(json[dependencyKey])) {
      if (internalNames.has(dependencyName)) {
        json[dependencyKey][dependencyName] = version;
      }
    }
  }
}

function setVersion(version) {
  assertVersionShape(version, version.includes('-beta.') ? 'beta' : 'stable');
  const packages = readPackages();
  const internalNames = getInternalPackageNames(packages);

  for (const pkg of packages) {
    pkg.json.version = version;
    updateInternalDependencies(pkg.json, internalNames, version);
    writeJson(pkg.path, pkg.json);
  }

  if (fs.existsSync(packageLockPath)) {
    const lock = readJson(packageLockPath);
    const lockPackages = lock.packages ?? {};
    if (lockPackages['']) lockPackages[''].version = version;
    for (const pkg of packages.filter((item) => item.dirName !== '.')) {
      const lockEntry = lockPackages[pkg.dirName];
      if (!lockEntry) continue;
      lockEntry.version = version;
      updateInternalDependencies(lockEntry, internalNames, version);
    }
    writeJson(packageLockPath, lock);
  }

  console.log(`[release-version] set all workspace versions to ${version}`);
}

function assertReleaseIntegrity(flags) {
  const packages = readPackages();
  const rootPackage = packages.find((pkg) => pkg.dirName === '.');
  const publishPackage = packages.find((pkg) => pkg.json.name === '@fps-games/editor');
  const internalNames = getInternalPackageNames(packages);
  const version = rootPackage.json.version;

  if (!publishPackage) throw new Error('Missing @fps-games/editor workspace package.');
  assertVersionShape(version, flags.channel);

  for (const pkg of packages) {
    if (pkg.json.version !== version) {
      throw new Error(`${pkg.dirName} version ${pkg.json.version} does not match root ${version}.`);
    }
    updateInternalDependencyChecks(pkg, internalNames, version);
  }

  const publicPackages = packages
    .filter((pkg) => pkg.dirName !== '.' && pkg.json.private !== true)
    .map((pkg) => pkg.json.name);
  if (publicPackages.length !== 1 || publicPackages[0] !== '@fps-games/editor') {
    throw new Error(`Only @fps-games/editor may be publishable, got: ${publicPackages.join(', ') || 'none'}.`);
  }

  const expectedBundles = [...internalNames]
    .filter((name) => name !== '@fps-games/editor')
    .sort();
  const actualBundles = [...(publishPackage.json.bundleDependencies ?? [])].sort();
  if (JSON.stringify(actualBundles) !== JSON.stringify(expectedBundles)) {
    throw new Error(`@fps-games/editor bundleDependencies must be ${expectedBundles.join(', ')}.`);
  }

  if (flags.tag) {
    const expectedTag = `v${version}`;
    if (flags.tag !== expectedTag) {
      throw new Error(`Git tag ${flags.tag} does not match package version ${expectedTag}.`);
    }
  }

  if (fs.existsSync(packageLockPath)) {
    assertPackageLock(version, internalNames);
  }

  console.log(`[release-version] ok ${version}${flags.channel ? ` (${flags.channel})` : ''}`);
}

function updateInternalDependencyChecks(pkg, internalNames, version) {
  for (const dependencyKey of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!pkg.json[dependencyKey]) continue;
    for (const [dependencyName, dependencyVersion] of Object.entries(pkg.json[dependencyKey])) {
      if (internalNames.has(dependencyName) && dependencyVersion !== version) {
        throw new Error(
          `${pkg.dirName} ${dependencyKey}.${dependencyName} is ${dependencyVersion}, expected ${version}.`,
        );
      }
    }
  }
}

function assertPackageLock(version, internalNames) {
  const lock = readJson(packageLockPath);
  const lockPackages = lock.packages ?? {};
  if (lockPackages['']?.version !== version) {
    throw new Error(`package-lock root version is ${lockPackages['']?.version}, expected ${version}.`);
  }
  for (const [lockPath, lockEntry] of Object.entries(lockPackages)) {
    if (!lockPath.startsWith('packages/')) continue;
    if (lockEntry.version !== version) {
      throw new Error(`package-lock ${lockPath} version is ${lockEntry.version}, expected ${version}.`);
    }
    for (const [dependencyName, dependencyVersion] of Object.entries(lockEntry.dependencies ?? {})) {
      if (internalNames.has(dependencyName) && dependencyVersion !== version) {
        throw new Error(
          `package-lock ${lockPath} dependency ${dependencyName} is ${dependencyVersion}, expected ${version}.`,
        );
      }
    }
  }
}

if (command === 'set') {
  const version = args.shift();
  if (!version || args.length > 0) usage();
  setVersion(version);
} else if (command === 'check') {
  assertReleaseIntegrity(parseFlags(args));
} else {
  usage();
}
