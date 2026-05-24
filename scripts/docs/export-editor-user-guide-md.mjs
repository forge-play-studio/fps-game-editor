import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const guideHtmlFile = 'fps-game-editor使用指南.html';
const guideMarkdownFile = 'fps-game-editor使用指南.md';
const htmlPath = resolve(root, 'docs/editor-user-guide', guideHtmlFile);
const markdownPath = resolve(root, 'docs/editor-user-guide', guideMarkdownFile);

const html = readFileSync(htmlPath, 'utf8');

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function inline(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<(code|kbd)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, body) => `\`${stripTags(body)}\``)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, body) => `**${stripTags(body)}**`)
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => `[${stripTags(body)}](${href})`)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function convertLists(markup) {
  let result = markup.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, body) => {
    const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match, index) => `${index + 1}. ${inline(match[1])}`);
    return `\n${items.join('\n')}\n`;
  });

  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, body) => {
    const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => `- ${inline(match[1])}`);
    return `\n${items.join('\n')}\n`;
  });

  return result;
}

function convertWorkspaceMap(markup) {
  if (!markup.includes('workspace-map')) return markup;
  const mapItems = [...markup.matchAll(/<div\s+class="map-block[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
    .map(match => `- ${inline(match[1])}`);
  const start = markup.indexOf('<div class="workspace-map"');
  if (start < 0) return markup;
  let end = start;
  for (let i = 0; i < 5; i += 1) {
    const next = markup.indexOf('</div>', end);
    if (next < 0) return markup;
    end = next + '</div>'.length;
  }
  return `${markup.slice(0, start)}\n工作区布局：\n${mapItems.join('\n')}\n${markup.slice(end)}`;
}

function convertTables(markup) {
  return markup.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((rowMatch) => [...rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(cellMatch => inline(cellMatch[2]).replace(/\|/g, '\\|')))
      .filter(row => row.length > 0);

    if (rows.length === 0) return '';

    const width = Math.max(...rows.map(row => row.length));
    const normalizeRow = row => Array.from({ length: width }, (_, index) => row[index] ?? '');
    const header = normalizeRow(rows[0]);
    const divider = header.map(() => '---');
    const bodyRows = rows.slice(1).map(normalizeRow);
    const tableLines = [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...bodyRows.map(row => `| ${row.join(' | ')} |`),
    ];

    return `\n${tableLines.join('\n')}\n`;
  });
}

function convertBlocks(markup) {
  let result = convertWorkspaceMap(markup);
  result = convertTables(result);
  result = convertLists(result);
  result = result
    .replace(/<div\s+class="(?:callout|check|callout warn)"[^>]*>([\s\S]*?)<\/div>/gi, (_, body) => `\n> ${inline(body)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, body) => `\n### ${inline(body)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, body) => {
      const text = inline(body);
      return text ? `\n${text}\n` : '\n';
    })
    .replace(/<\/?(article|div|table|thead|tbody|tr|th|td)[^>]*>/gi, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return result;
}

const title = inline(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? 'fps-game-editor使用指南');
const heroCopy = inline(html.match(/<p\s+class="hero-copy"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');

const sections = [...html.matchAll(/<section[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi)]
  .map(([, id, body]) => {
    const headingMatch = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!headingMatch) return null;
    const heading = inline(headingMatch[1]);
    const rest = body.slice(headingMatch.index + headingMatch[0].length);
    return { id, heading, content: convertBlocks(rest) };
  })
  .filter(Boolean);

const lines = [
  `# ${title}`,
  '',
  `> 这是 \`docs/editor-user-guide/${guideHtmlFile}\` 的 Markdown 发布副本，方便上传到其他文档平台。维护时以 \`${guideHtmlFile}\` 为准；修改用户指南后，再同步更新本文件。`,
  '',
];

if (heroCopy) {
  lines.push(heroCopy, '');
}

for (const section of sections) {
  lines.push(`## ${section.heading}`, '');
  if (section.content) lines.push(section.content, '');
}

writeFileSync(markdownPath, `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`);
console.log(`Exported ${markdownPath}`);
