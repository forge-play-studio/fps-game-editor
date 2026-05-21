#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkspace } from './lib/workspace.mjs';
import { findFreePort, assertPortAvailable } from './lib/ports.mjs';
import { createStaticServer } from './lib/servers.mjs';
import { startViteDevServer } from './lib/dev-server.mjs';
import { launchChrome } from './lib/cdp.mjs';
import { BridgeProtocol } from './lib/bridge-protocol.mjs';
import { getScenario, listScenarioNames, scenarios } from './scenarios/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarioName = args.case || 'asset-drop-save-commit';
  const write = Boolean(args.write);
  const headed = Boolean(args.headed);
  const selectedScenarios = resolveScenarios(scenarioName);

  await assertPortAvailable(8080);
  const workspace = await createWorkspace({ repoRoot, write });
  const devPort = await findFreePort(5173);
  const hostPort = await findFreePort(6190);

  const bridgeServer = createStaticServer({
    '/script/bridge.js': {
      path: path.join(__dirname, 'mock-bridge.js'),
      contentType: 'text/javascript; charset=utf-8',
    },
  });
  const hostServer = createStaticServer({
    '/': {
      path: path.join(__dirname, 'host.html'),
      contentType: 'text/html; charset=utf-8',
    },
  });

  let vite = null;
  let chrome = null;
  try {
    await bridgeServer.listen(8080);
    await hostServer.listen(hostPort);
    vite = await startViteDevServer({
      cwd: workspace.root,
      port: devPort,
    });

    const projectUrl = `http://127.0.0.1:${devPort}/`;
    const hostUrl = `http://127.0.0.1:${hostPort}/?target=${encodeURIComponent(projectUrl)}`;
    chrome = await launchChrome({ url: hostUrl, headed, tmpRoot: workspace.root });
    const bridge = new BridgeProtocol(chrome.cdp);

    const results = [];
    for (const item of selectedScenarios) {
      const scenario = await item.module();
      const result = await scenario.run({
        workspaceRoot: workspace.root,
        projectUrl,
        hostUrl,
        bridge,
        mode: workspace.mode,
      });
      results.push({ name: item.name, result });
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      scenario: scenarioName,
      mode: workspace.mode,
      workspaceRoot: workspace.root,
      results,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[platform-sim] failed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    if (chrome) {
      process.stderr.write(`[platform-sim] chrome output:\n${chrome.output()}\n`);
      process.stderr.write(`[platform-sim] cdp events:\n${JSON.stringify(chrome.cdp.recentEvents(), null, 2)}\n`);
    }
    if (vite) {
      process.stderr.write(`[platform-sim] vite output:\n${vite.output()}\n`);
    }
    process.exitCode = 1;
  } finally {
    await chrome?.close();
    await vite?.stop();
    await bridgeServer.close();
    await hostServer.close();
    await workspace.cleanup();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--case') {
      args.case = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--write') {
      args.write = true;
      continue;
    }
    if (item === '--headed') {
      args.headed = true;
      continue;
    }
    if (item === '--help' || item === '-h') {
      process.stdout.write([
        'Usage: npm run sim:platform -- [--case asset-drop-save-commit|all] [--write] [--headed]',
        '',
        'Defaults: --case asset-drop-save-commit, dry temp workspace, headless Chrome.',
        '',
        'Scenarios:',
        ...scenarios.map((scenario) => `  - ${scenario.name}: ${scenario.description}`),
        '',
      ].join('\n'));
      process.exit(0);
    }
  }
  return args;
}

function resolveScenarios(name) {
  if (name === 'all') return scenarios;
  const scenario = getScenario(name);
  if (scenario) return [scenario];
  throw new Error(`unknown_scenario:${name}\nKnown scenarios: ${listScenarioNames().join(', ')}, all`);
}

main();
