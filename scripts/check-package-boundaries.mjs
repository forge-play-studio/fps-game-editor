import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageRoot = path.join(root, 'packages');
const forbidden = [
  'lumber_order',
  'SceneJsonV2',
  'SceneJsonV2Validator',
  'scene-json-v2-rules',
  'configService',
  'SceneBuilder',
  'AssetManager',
  'gameplay',
];
const checkedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);

function walk(dir) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && checkedExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(packageRoot)) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const term of forbidden) {
    if (text.includes(term)) violations.push(`${rel}: forbidden term "${term}"`);
  }
}

if (violations.length > 0) {
  console.error('[check-package-boundaries] forbidden project coupling found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`[check-package-boundaries] ok (${walk(packageRoot).length} files checked)`);
