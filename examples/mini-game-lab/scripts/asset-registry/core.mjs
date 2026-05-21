import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

export function sanitizeSourceId(value) {
  const raw = String(value ?? '').replace(/\.glb$/i, '').trim().toLowerCase();
  const sanitized = raw
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return sanitized || `asset_${Date.now().toString(36)}`;
}

export function toImportName(sourceId) {
  const segments = sourceId.split('_').filter(Boolean);
  const camel = segments
    .map((segment, index) => index === 0
      ? segment
      : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
  const safe = camel.replace(/[^a-zA-Z0-9_$]/g, '') || 'assetModel';
  return /^[a-zA-Z_$]/.test(safe) ? safe : `asset${safe}`;
}

export async function runAssetRegistryCli(config, argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const rules = await config.loadRules();
  const errorCodes = rules.errorCodes ?? {};
  const fail = (message, details = {}) => {
    const error = { ok: false, error: message, ...details };
    process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
    process.exit(1);
  };

  try {
    if (args.help) {
      process.stdout.write([
        'Usage:',
        `  ${config.commands.register} -- --payload /path/to/payload.json`,
        `  ${config.commands.unregister} -- --payload /path/to/payload.json`,
        `  ${config.commands.unregister} -- --source-id source_id [--keep-file] [--force]`,
        '',
      ].join('\n'));
      return;
    }
    if (args.unregister) {
      const result = await unregisterAsset(config, args, errorCodes);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }
    const result = await registerAsset(config, args, errorCodes);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    if (error instanceof AssetRegistryError) {
      fail(error.message, error.details);
    }
    fail('asset_register_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function registerAsset(config, args, errorCodes = {}) {
  if (!args.payload) throw new AssetRegistryError('missing_payload_arg');
  const payload = await loadPayload(config, args);
  const sourcePath = path.resolve(config.cwd, String(payload.sourcePath ?? payload.assetPath ?? ''));
  if (!sourcePath.toLowerCase().endsWith(config.supportedExtension)) {
    throw new AssetRegistryError(errorCodes.sourceMustBeGlb ?? 'source_must_be_glb', { sourcePath });
  }
  try {
    await fs.access(sourcePath);
  } catch {
    throw new AssetRegistryError(errorCodes.sourceFileNotFound ?? 'source_file_not_found', { sourcePath });
  }

  const requestedSourceId = sanitizeSourceId(payload.sourceId ?? payload.assetName ?? path.basename(sourcePath));
  const originalFileName = String(payload.assetName ?? path.basename(sourcePath));
  const requestedFileName = `${requestedSourceId}${config.supportedExtension}`;
  const requestedTargetPath = path.resolve(config.importedDir, requestedFileName);
  assertInside(config.importedDir, requestedTargetPath, 'target_path');

  await fs.mkdir(config.importedDir, { recursive: true });
  await fs.mkdir(config.generatedDir, { recursive: true });

  const manifest = await loadManifest(config);
  const requestedRelativePath = config.relativeImportedPath(requestedFileName);
  const sourceId = chooseSourceId(requestedSourceId, requestedRelativePath, manifest);
  const targetFileName = `${sourceId}${config.supportedExtension}`;
  const targetPath = path.resolve(config.importedDir, targetFileName);
  assertInside(config.importedDir, targetPath, 'target_path');
  const relativePath = config.relativeImportedPath(targetFileName);
  const assetId = String(payload.assetId ?? `asset_${sourceId}`).trim() || `asset_${sourceId}`;
  const audit = await getFileAudit(sourcePath);
  const now = new Date().toISOString();

  const existing = manifest.find((entry) => entry.sourceId === sourceId);
  let copiedNewTarget = false;
  try {
    if (!existing) {
      await fs.copyFile(sourcePath, targetPath);
      copiedNewTarget = true;
      manifest.push({
        sourceId,
        relativePath,
        importName: config.toImportName(sourceId),
        originalFileName,
        contentHash: audit.contentHash,
        byteSize: audit.byteSize,
        createdAt: now,
        updatedAt: now,
      });
      manifest.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    } else {
      const existingTarget = path.resolve(config.generatedDir, existing.relativePath);
      let shouldCopy = existing.contentHash !== audit.contentHash;
      try {
        await fs.access(existingTarget);
      } catch {
        shouldCopy = true;
      }
      if (shouldCopy) {
        await fs.mkdir(path.dirname(existingTarget), { recursive: true });
        await fs.copyFile(sourcePath, existingTarget);
      }
      existing.originalFileName = existing.originalFileName || originalFileName;
      existing.contentHash = audit.contentHash;
      existing.byteSize = audit.byteSize;
      existing.createdAt = existing.createdAt || now;
      existing.updatedAt = shouldCopy ? now : (existing.updatedAt || now);
    }

    await writeGeneratedRegistry(config, manifest, errorCodes);
  } catch (error) {
    if (copiedNewTarget) {
      await fs.rm(targetPath, { force: true }).catch(() => {});
    }
    throw error;
  }

  return {
    ok: true,
    sourceId,
    assetId,
    assetUrl: config.publicUrlForImportedAsset(targetFileName),
    targetPath,
    manifestPath: config.manifestPath,
    registryPath: config.registryPath,
  };
}

export async function unregisterAsset(config, args, errorCodes = {}) {
  const payload = await loadPayload(config, args);
  const rawSourceId = args.sourceId ?? payload?.sourceId;
  if (typeof rawSourceId !== 'string' || !rawSourceId.trim()) {
    throw new AssetRegistryError(errorCodes.missingSourceId ?? 'missing_source_id');
  }
  const sourceId = sanitizeSourceId(rawSourceId);
  const deleteFile = resolveDeleteFile(args, payload);
  const force = resolveForce(args, payload);
  await assertSourceIdCanBeUnregistered(config, sourceId, force, errorCodes);

  await fs.mkdir(config.generatedDir, { recursive: true });
  const manifest = await loadManifest(config);
  const entryIndex = manifest.findIndex((entry) => entry.sourceId === sourceId);
  if (entryIndex < 0) {
    throw new AssetRegistryError(errorCodes.manifestEntryNotFound ?? 'manifest_entry_not_found', {
      sourceId,
      manifestPath: config.manifestPath,
    });
  }

  const [entry] = manifest.splice(entryIndex, 1);
  let deletedFile = false;
  let targetPath = null;
  if (deleteFile) {
    targetPath = path.resolve(config.generatedDir, entry.relativePath);
    assertInside(config.importedDir, targetPath, 'unregister_target_path');
    await fs.rm(targetPath, { force: true });
    deletedFile = true;
  }

  await writeGeneratedRegistry(config, manifest, errorCodes);
  return {
    ok: true,
    sourceId,
    removed: true,
    deleteFile,
    force,
    deletedFile,
    targetPath,
    manifestPath: config.manifestPath,
    registryPath: config.registryPath,
  };
}

export class AssetRegistryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AssetRegistryError';
    this.details = details;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--unregister') {
      args.unregister = true;
      continue;
    }
    if (item === '--payload') {
      args.payload = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--source-id') {
      args.sourceId = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--delete-file') {
      args.deleteFile = true;
      continue;
    }
    if (item === '--keep-file') {
      args.deleteFile = false;
      continue;
    }
    if (item === '--force') {
      args.force = true;
      continue;
    }
    if (item === '--help' || item === '-h') {
      args.help = true;
    }
  }
  return args;
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AssetRegistryError(`${label}_outside_allowed_directory`, { parent, child });
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function loadPayload(config, args) {
  if (!args.payload) return null;
  const payloadPath = path.resolve(config.cwd, args.payload);
  const payload = await readJson(payloadPath, null);
  if (!payload || typeof payload !== 'object') {
    throw new AssetRegistryError('invalid_payload_json', { payloadPath });
  }
  return payload;
}

function normalizeManifestEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const sourceId = typeof entry.sourceId === 'string' ? entry.sourceId.trim() : '';
  const relativePath = typeof entry.relativePath === 'string' ? entry.relativePath.trim() : '';
  const importName = typeof entry.importName === 'string' ? entry.importName.trim() : '';
  if (!sourceId || !relativePath || !importName) return null;
  return {
    sourceId,
    relativePath,
    importName,
    ...(typeof entry.originalFileName === 'string' ? { originalFileName: entry.originalFileName } : {}),
    ...(typeof entry.contentHash === 'string' ? { contentHash: entry.contentHash } : {}),
    ...(typeof entry.byteSize === 'number' ? { byteSize: entry.byteSize } : {}),
    ...(typeof entry.createdAt === 'string' ? { createdAt: entry.createdAt } : {}),
    ...(typeof entry.updatedAt === 'string' ? { updatedAt: entry.updatedAt } : {}),
  };
}

async function loadManifest(config) {
  return (await readJson(config.manifestPath, []))
    .map(normalizeManifestEntry)
    .filter(Boolean);
}

function chooseSourceId(baseSourceId, targetRelativePath, manifest) {
  let sourceId = baseSourceId;
  let suffix = 2;
  while (true) {
    const existing = manifest.find((entry) => entry.sourceId === sourceId);
    if (!existing || existing.relativePath === targetRelativePath) return sourceId;
    sourceId = `${baseSourceId}_${suffix}`;
    suffix += 1;
  }
}

function validateGeneratedTypescript(content, errorCodes) {
  const output = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  const blocking = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (blocking.length > 0) {
    throw new AssetRegistryError(errorCodes.generatedRegistrySyntaxError ?? 'generated_registry_syntax_error', {
      diagnostics: blocking.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    });
  }
}

async function atomicWrite(filePath, content) {
  try {
    const previous = await fs.readFile(filePath, 'utf8');
    if (previous === content) return false;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, content);
  await fs.rename(tmpPath, filePath);
  return true;
}

async function getFileAudit(filePath) {
  const bytes = await fs.readFile(filePath);
  const stats = await fs.stat(filePath);
  return {
    contentHash: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
    byteSize: stats.size,
  };
}

async function writeGeneratedRegistry(config, manifest, errorCodes) {
  const registryContent = config.generateRegistry(manifest);
  validateGeneratedTypescript(registryContent, errorCodes);
  await atomicWrite(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await atomicWrite(config.registryPath, registryContent);
}

function resolveDeleteFile(args, payload) {
  if (typeof args.deleteFile === 'boolean') return args.deleteFile;
  if (payload && typeof payload.deleteFile === 'boolean') return payload.deleteFile;
  return true;
}

function resolveForce(args, payload) {
  return Boolean(args.force || payload?.force === true);
}

async function findSceneReferencesBySourceId(config, sourceId) {
  const sceneConfig = await readJson(config.scenePath, null);
  const assets = Array.isArray(sceneConfig?.scene?.assets) ? sceneConfig.scene.assets : [];
  const nodes = Array.isArray(sceneConfig?.scene?.nodes) ? sceneConfig.scene.nodes : [];
  const assetIds = assets
    .filter((asset) => asset?.sourceId === sourceId)
    .map((asset) => asset.id)
    .filter(Boolean);
  const assetIdSet = new Set(assetIds);
  const nodeIds = nodes
    .filter((node) => node?.kind === 'instance' && assetIdSet.has(node?.instance?.assetId))
    .map((node) => node.id)
    .filter(Boolean);
  return { assetIds, nodeIds };
}

async function assertSourceIdCanBeUnregistered(config, sourceId, force, errorCodes) {
  if (force) return;
  const references = await findSceneReferencesBySourceId(config, sourceId);
  if (references.nodeIds.length === 0) return;
  throw new AssetRegistryError(errorCodes.assetStillReferenced ?? 'asset_still_referenced', {
    sourceId,
    scenePath: config.scenePath,
    assetIds: references.assetIds,
    nodeIds: references.nodeIds,
  });
}
