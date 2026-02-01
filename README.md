# 260201_AutomataTower

260201_AutomataTower is a Three.js cellular automata tower generator that stacks each 2D generation into a glowing voxel column with a draggable control panel and a top-to-base color gradient.

## Features
- Vite + Three.js project scaffold with postprocessing (bloom/FXAA)
- Instanced voxel renderer for stacked cellular automata generations
- Floating UI to control grid size, voxel scale, rules, playback, and gradient colors

## Getting Started
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the local URL printed by Vite.

## Controls
- Speed, density, and seed sliders control simulation pacing and initialization.
- Rule preset + custom rule input adjust B/S cellular automata rules.
- Grid X/Z and Generations define the tower footprint and height.
- Voxel size, bloom, emissive, base color, and top color tune rendering.
- Play/Pause, Step Once, and Reset + Reseed manage playback.
