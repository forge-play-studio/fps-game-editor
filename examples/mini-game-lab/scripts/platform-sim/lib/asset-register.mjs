import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function runAssetRegister({ workspaceRoot, plan, sourcePath }) {
  const result = await executeTransportPlan(workspaceRoot, withSourcePath(plan, sourcePath));
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim().split('\n').at(-1));
  } catch (error) {
    throw new Error(`asset_register_invalid_stdout:${result.stdout}\n${result.stderr}`);
  }
  if (!parsed?.ok) {
    throw new Error(`asset_register_failed:${JSON.stringify(parsed)}`);
  }
  return parsed;
}

export async function runAssetUnregister({ workspaceRoot, plan }) {
  const result = await executeTransportPlan(workspaceRoot, plan);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.trim().split('\n').at(-1));
  } catch (error) {
    throw new Error(`asset_unregister_invalid_stdout:${result.stdout}\n${result.stderr}`);
  }
  if (!parsed?.ok) {
    throw new Error(`asset_unregister_failed:${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function executeTransportPlan(workspaceRoot, plan) {
  const transportPlan = plan?.transportPlan;
  const writes = Array.isArray(transportPlan?.writes) ? transportPlan.writes : [];
  const commands = Array.isArray(transportPlan?.commands) ? transportPlan.commands : [];
  if (!writes.length || !commands.length) {
    throw new Error(`invalid_transport_plan:${JSON.stringify(plan)}`);
  }

  for (const write of writes) {
    const payloadPath = normalizeTransportPath(workspaceRoot, write?.path);
    const content = write?.content;
    const text = typeof content === 'string'
      ? content
      : `${JSON.stringify(content ?? {}, null, 2)}\n`;
    await fs.mkdir(path.dirname(payloadPath), { recursive: true });
    await fs.writeFile(payloadPath, text, 'utf8');
  }

  let result = null;
  for (const command of commands) {
    result = await runCommand(String(command?.cmd ?? ''), workspaceRoot);
  }
  return result;
}

function withSourcePath(plan, sourcePath) {
  const next = JSON.parse(JSON.stringify(plan));
  const write = next.transportPlan?.writes?.[0];
  if (write?.content && typeof write.content === 'object') {
    write.content.sourcePath = sourcePath;
    write.content.assetPath = sourcePath;
    write.content.assetName = write.content.assetName || path.basename(sourcePath);
  }
  return next;
}

function normalizeTransportPath(workspaceRoot, filePath) {
  if (typeof filePath === 'string' && filePath.startsWith('/tmp/')) return filePath;
  if (typeof filePath === 'string' && path.isAbsolute(filePath)) return filePath;
  return path.join(workspaceRoot, '.platform-sim', filePath || 'asset-payload.json');
}

function runCommand(cmd, cwd) {
  if (!cmd.trim()) throw new Error('missing_transport_command');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${cmd} failed with ${code}\n${stdout}\n${stderr}`));
    });
  });
}
