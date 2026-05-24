import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const docsDir = resolve(root, 'docs/editor-user-guide');
const guideHtmlFile = 'fps-game-editor使用指南.html';
const guideMarkdownFile = 'fps-game-editor使用指南.md';
const htmlFiles = [guideHtmlFile, 'shortcuts.html', 'agent.html', 'system.html'];
const requiredFiles = [...htmlFiles, guideMarkdownFile];
const userFacingFiles = [guideHtmlFile, 'shortcuts.html'];
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

if (existsSync(resolve(docsDir, guideMarkdownFile))) {
  const markdown = readDoc(guideMarkdownFile);
  if (!markdown.startsWith('# fps-game-editor使用指南')) {
    fail(`${guideMarkdownFile}: expected title "# fps-game-editor使用指南"`);
  }
  if (!markdown.includes(`以 \`${guideHtmlFile}\` 为准`)) {
    fail(`${guideMarkdownFile}: missing HTML-authoritative notice`);
  }
  if (markdown.includes('(shortcuts.html)')) {
    fail(`${guideMarkdownFile}: must be self-contained and not depend on shortcuts.html for required user content`);
  }
  for (const text of ['工具与 Transform', 'Scene View 导航', '快捷键不生效', '| 按键或入口 |']) {
    if (!markdown.includes(text)) fail(`${guideMarkdownFile}: missing portable content marker: ${text}`);
  }
}

if (existsSync(resolve(docsDir, guideHtmlFile))) {
  const guideHtml = readDoc(guideHtmlFile);
  if (guideHtml.includes('href="shortcuts.html"')) {
    fail(`${guideHtmlFile}: must not require shortcuts.html for the primary user guide`);
  }
  for (const text of ['单独打开本页', '工具与 Transform', 'Scene View 导航', '快捷键不生效']) {
    if (!guideHtml.includes(text)) fail(`${guideHtmlFile}: missing portable content marker: ${text}`);
  }
}

const readmePath = resolve(root, 'README.md');
const agentPath = resolve(root, 'agent.md');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  if (!readme.includes(`docs/editor-user-guide/${guideMarkdownFile}`)) fail(`README.md: missing ${guideMarkdownFile} documentation entry`);
  if (!readme.includes('HTML-first')) fail('README.md: missing HTML-first policy');
  if (!readme.includes('自包含') || !readme.includes('其他电脑')) fail('README.md: missing portable export policy');
}
if (existsSync(agentPath)) {
  const agent = readFileSync(agentPath, 'utf8');
  if (!agent.includes(`docs/editor-user-guide/${guideMarkdownFile}`)) fail(`agent.md: missing ${guideMarkdownFile} workflow rule`);
  if (!agent.includes('HTML-first')) fail('agent.md: missing HTML-first policy');
  if (!agent.includes('自包含') || !agent.includes('其他电脑')) fail('agent.md: missing portable export policy');
}

if (!ok) process.exit(1);
console.log('Editor user docs check passed');
