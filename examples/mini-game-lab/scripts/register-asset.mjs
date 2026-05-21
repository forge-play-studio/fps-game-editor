#!/usr/bin/env node

import { runAssetRegistryCli } from './asset-registry/core.mjs';
import { lumberOrderAssetRegistryConfig } from './asset-registry/lumber-order-config.mjs';

await runAssetRegistryCli(lumberOrderAssetRegistryConfig);
