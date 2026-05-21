import fs from 'node:fs/promises';
import path from 'node:path';

export async function writeSceneJsonCommit({ workspaceRoot, sceneJsonText }) {
  const scenePath = path.join(workspaceRoot, 'src/config/scene.json');
  const previous = await readJson(scenePath, {});
  const next = JSON.parse(sceneJsonText);
  const version = typeof previous.version === 'number' ? previous.version + 1 : 1;
  const updatedAt = new Date().toISOString();
  next.version = version;
  next.updatedAt = updatedAt;
  const savedText = `${JSON.stringify(next, null, 2)}\n`;
  await fs.writeFile(scenePath, savedText, 'utf8');
  const readback = await fs.readFile(scenePath, 'utf8');
  return {
    scenePath,
    version,
    updatedAt,
    sceneJsonText: readback,
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
