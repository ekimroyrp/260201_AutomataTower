# 260201_AutomataTower

260201_AutomataTower is a Three.js cellular automata tower generator that stacks each generation into a voxel tower with beveled cubes, dramatic lighting, a draggable control panel, top-to-base gradient coloring, and both 2D Life-like and 1D Elementary (ECA) modes.

## Features
- Vite + Three.js scaffold with postprocessing (bloom/FXAA) and shadowed lighting rig
- Instanced voxel renderer with beveled cubes and orientation toggle (vertical/horizontal)
- Rule mode switching between 2D Life-like and 1D Elementary (ECA) with presets + custom rules
- Floating UI to control grid, simulation, rendering, and gradient colors

## Getting Started
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the local URL printed by Vite.

## Controls
- **Simulation:** Orientation (vertical/horizontal), Speed, Generations, plus Play/Step/Reset controls.
- **Rules (Life-like 2D):** Rule preset + Custom Rule input, Neighbors, and Wrap Edges.
- **Rules (Elementary 1D):** Rule preset, Custom Rule (0–255), Start mode, and Wrap Edges.
- **Grid:** Voxel size, Voxels X/Y, Density, and Seed.
- **Rendering:** Top/Base colors for the vertical gradient, Bloom, and Emissive.

## Deployment
- **Local production preview:** `npm install`, then `npm run build` followed by `npm run preview` to inspect the compiled bundle.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base=./`. Checkout (or create) the `gh-pages` branch in a separate worktree, copy everything inside `dist/` plus a `.nojekyll` marker to its root, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260201_AutomataTower/
