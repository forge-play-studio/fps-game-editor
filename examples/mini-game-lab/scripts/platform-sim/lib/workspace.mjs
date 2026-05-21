import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.vite',
]);

export async function createWorkspace({ repoRoot, write }) {
  if (write) {
    return {
      root: repoRoot,
      mode: 'write',
      cleanup: async () => {},
    };
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lumber-order-platform-sim-'));
  await copyProject(repoRoot, root);
  await fs.symlink(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  return {
    root,
    mode: 'dry',
    cleanup: async () => {
      if (process.env.PLATFORM_SIM_KEEP_TMP === '1') return;
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

async function copyProject(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyProject(from, to);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(from);
      await fs.symlink(link, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}
