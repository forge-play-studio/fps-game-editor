import type { SceneDocument } from './document';

export const sampleDocument: SceneDocument = {
  version: 1,
  prefabs: [
    {
      id: 'prefab.crate',
      label: 'Blue Crate',
      primitive: 'box',
      color: '#2f73e6',
      dimensions: { size: 1.2 },
    },
    {
      id: 'prefab.orb',
      label: 'Green Orb',
      primitive: 'sphere',
      color: '#33c875',
      dimensions: { diameter: 1.1 },
    },
    {
      id: 'prefab.marker',
      label: 'Yellow Marker',
      primitive: 'cylinder',
      color: '#efb338',
      dimensions: { diameter: 0.55, height: 1.8 },
    },
  ],
  nodes: [
    {
      id: 'node.crate.01',
      name: 'Crate 01',
      prefabId: 'prefab.crate',
      transform: {
        position: { x: -1.4, y: 0.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scaling: { x: 1, y: 1, z: 1 },
      },
    },
    {
      id: 'node.orb.01',
      name: 'Orb 01',
      prefabId: 'prefab.orb',
      transform: {
        position: { x: 1.35, y: 0.55, z: 0.2 },
        rotation: { x: 0, y: 0, z: 0 },
        scaling: { x: 1, y: 1, z: 1 },
      },
    },
    {
      id: 'node.marker.01',
      name: 'Marker 01',
      prefabId: 'prefab.marker',
      transform: {
        position: { x: 0.1, y: 0.9, z: -1.55 },
        rotation: { x: 0, y: 0.25, z: 0 },
        scaling: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  previewSnapshots: [
    {
      id: 'snapshot.base',
      label: 'Base Scene',
      previewTime: 0,
      overrides: [],
    },
    {
      id: 'snapshot.camp-start',
      label: 'Camp Start Frame',
      previewTime: 0.2,
      overrides: [
        {
          nodeId: 'node.marker.01',
          visible: false,
        },
        {
          nodeId: 'node.crate.01',
          transform: {
            position: { x: -2.15, y: 0.6, z: -0.15 },
          },
        },
      ],
    },
    {
      id: 'snapshot.camp-built',
      label: 'Camp Built Clip',
      previewTime: 1.5,
      overrides: [
        {
          nodeId: 'node.marker.01',
          visible: true,
          transform: {
            position: { x: 0.1, y: 0.9, z: -2.2 },
            rotation: { x: 0, y: 0.8, z: 0 },
          },
        },
        {
          nodeId: 'node.orb.01',
          transform: {
            position: { x: 2.1, y: 0.55, z: 0.95 },
            scaling: { x: 1.25, y: 1.25, z: 1.25 },
          },
        },
      ],
    },
  ],
};
