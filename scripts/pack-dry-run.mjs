import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fps-editor-pack-dry-run-'));
const npmCacheDir = path.join(tmpRoot, 'npm-cache');
fs.mkdirSync(npmCacheDir, { recursive: true });

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    stdio: 'inherit',
  });
}

run('npm', ['run', 'build']);
run('npm', ['pack', '--workspace', '@fps-games/editor', '--dry-run']);
