import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const docsDir = resolve(root, 'docs/editor-user-guide');
const htmlFiles = ['index.html', 'shortcuts.html', 'agent.html', 'system.html'];
const requiredFiles = [...htmlFiles, 'index.md'];
const userFacingFiles = ['index.html', 'shortcuts.html'];
const forbiddenUserTerms = [
  'authoring.html',
  'Agent',
  'Manifest',
  '模板',
  '系统模板',
  '文档作者',
  '完整原文',
  'source-documents',
  'source-',
];

let ok = true;

function fail(message) {
  console.error(message);
  ok = false;
}

function readDoc(file) {
  return readFileSync(resolve(docsDir, file), 'utf8');
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(docsDir, file))) fail(`Missing docs/editor-user-guide/${file}`);
}

for (const file of htmlFiles) {
  if (!existsSync(resolve(docsDir, file))) continue;
  const html = readDoc(file);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (!ids.has(id)) fail(`${file}: missing local target ${href}`);
      continue;
    }
    if (!href.endsWith('.html') && !href.includes('.html#')) continue;
    const [target, hash] = href.split('#');
    const targetPath = resolve(docsDir, target);
    if (!existsSync(targetPath)) {
      fail(`${file}: missing linked file ${href}`);
      continue;
    }
    if (hash) {
      const targetHtml = readFileSync(targetPath, 'utf8');
      const targetIds = new Set([...targetHtml.matchAll(/\sid="([^"]+)"/g)].map(item => item[1]));
      if (!targetIds.has(hash)) fail(`${file}: missing linked anchor ${href}`);
    }
  }
}

for (const file of userFacingFiles) {
  if (!existsSync(resolve(docsDir, file))) continue;
  const html = readDoc(file);
  for (const term of forbiddenUserTerms) {
    if (html.includes(term)) fail(`${file}: forbidden internal term found: ${term}`);
  }
}

if (existsSync(resolve(docsDir, 'index.md'))) {
  const markdown = readDoc('index.md');
  if (!markdown.startsWith('# fps-game-editor 用户指南')) {
    fail('index.md: expected title "# fps-game-editor 用户指南"');
  }
  if (!markdown.includes('以 `index.html` 为准')) {
    fail('index.md: missing HTML-authoritative notice');
  }
}

const readmePath = resolve(root, 'README.md');
const agentPath = resolve(root, 'agent.md');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  if (!readme.includes('docs/editor-user-guide/index.md')) fail('README.md: missing index.md documentation entry');
  if (!readme.includes('HTML-first')) fail('README.md: missing HTML-first policy');
}
if (existsSync(agentPath)) {
  const agent = readFileSync(agentPath, 'utf8');
  if (!agent.includes('docs/editor-user-guide/index.md')) fail('agent.md: missing index.md workflow rule');
  if (!agent.includes('HTML-first')) fail('agent.md: missing HTML-first policy');
}

if (!ok) process.exit(1);
console.log('Editor user docs check passed');
