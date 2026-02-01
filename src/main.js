import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const QUALITY_SCALE = 1.6;
const FXAA_SCALE = 5.0;
const MAX_INSTANCES = 350000;
const BEVEL_RADIUS = 0.18;
const BEVEL_SEGMENTS = 4;

const settings = {
  speed: 8,
  density: 0.35,
  seed: 42,
  wrapEdges: true,
  neighborMode: 'moore',
  rule: 'B3/S23',
  voxelSize: 0.14,
  gridX: 22,
  gridZ: 22,
  generations: 200,
  baseColor: '#ff6b4a',
  emissiveStrength: 0,
  bloom: 0,
};

const rulePresets = {
  b3s23: 'B3/S23',
  b36s23: 'B36/S23',
  b2s: 'B2/S',
  b3678s34678: 'B3678/S34678',
};

const neighborOffsets = {
  moore: [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
  vonneumann: [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ],
};

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const getPixelRatio = () => Math.min(window.devicePixelRatio * QUALITY_SCALE, 3);
renderer.setPixelRatio(getPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
environment.dispose();
pmremGenerator.dispose();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, 0.15, 5.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.target.set(0, 0, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.update();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffd5c0, 1.2);
keyLight.position.set(3.5, 4.2, 2.4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x83b8ff, 0.7);
rimLight.position.set(-3.2, 1.8, -3.6);
scene.add(rimLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  settings.bloom,
  0.6,
  0.15
);
composer.addPass(bloomPass);
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.enabled = false;
composer.addPass(fxaaPass);

const voxelGroup = new THREE.Group();
scene.add(voxelGroup);

const material = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(settings.baseColor),
  roughness: 0.22,
  metalness: 0.08,
  clearcoat: 0.7,
  clearcoatRoughness: 0.12,
  emissive: new THREE.Color(settings.baseColor),
  emissiveIntensity: settings.emissiveStrength,
});

let voxelMesh = null;
let voxelGeometry = null;
let instanceCapacity = 0;
let gridWidth = settings.gridX;
let gridDepth = settings.gridZ;
let maxGenerations = settings.generations;
let currentGrid = null;
let layers = [];
let birthMask = new Array(9).fill(false);
let surviveMask = new Array(9).fill(false);
const tempMatrix = new THREE.Matrix4();
const tempPos = new THREE.Vector3();
const tempScale = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const tempColor = new THREE.Color();

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function parseRuleString(value) {
  const sanitized = value.toUpperCase().replace(/\s+/g, '');
  const matchB = sanitized.match(/B([0-8]+)/);
  const matchS = sanitized.match(/S([0-8]+)/);
  let birthDigits = matchB ? matchB[1] : '';
  let surviveDigits = matchS ? matchS[1] : '';

  if (!matchB && !matchS && sanitized.includes('/')) {
    const parts = sanitized.split('/');
    birthDigits = (parts[0] || '').replace(/[^0-8]/g, '');
    surviveDigits = (parts[1] || '').replace(/[^0-8]/g, '');
  }

  if (birthDigits === '' && surviveDigits === '') {
    birthDigits = '3';
    surviveDigits = '23';
  }

  return {
    normalized: `B${birthDigits}/S${surviveDigits}`,
    birthDigits,
    surviveDigits,
  };
}

function updateRuleMasks(ruleValue) {
  const { normalized, birthDigits, surviveDigits } = parseRuleString(ruleValue);
  birthMask = new Array(9).fill(false);
  surviveMask = new Array(9).fill(false);

  birthDigits.split('').forEach((digit) => {
    const count = Number(digit);
    if (!Number.isNaN(count) && count <= 8) {
      birthMask[count] = true;
    }
  });

  surviveDigits.split('').forEach((digit) => {
    const count = Number(digit);
    if (!Number.isNaN(count) && count <= 8) {
      surviveMask[count] = true;
    }
  });

  settings.rule = normalized;
  return normalized;
}

function updateLayerColors() {}

function clampInstanceBudget() {
  const requested = settings.gridX * settings.gridZ * settings.generations;
  if (requested <= MAX_INSTANCES) {
    return;
  }
  const maxLayers = Math.max(4, Math.floor(MAX_INSTANCES / (settings.gridX * settings.gridZ)));
  settings.generations = Math.min(settings.generations, maxLayers);
  const gridY = document.getElementById('grid-y');
  const gridYValue = document.getElementById('grid-y-value');
  if (gridY && gridYValue) {
    gridY.value = settings.generations.toString();
    gridYValue.textContent = settings.generations.toFixed(0);
  }
}

function buildVoxelMesh() {
  if (voxelMesh) {
    voxelGroup.remove(voxelMesh);
    voxelGeometry.dispose();
  }

  instanceCapacity = settings.gridX * settings.gridZ * settings.generations;
  voxelGeometry = new RoundedBoxGeometry(1, 1, 1, BEVEL_SEGMENTS, BEVEL_RADIUS);
  voxelMesh = new THREE.InstancedMesh(voxelGeometry, material, instanceCapacity);
  voxelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  voxelMesh.frustumCulled = false;
  voxelGroup.add(voxelMesh);
}

function seedGrid() {
  const rand = mulberry32(settings.seed + 1);
  currentGrid = new Uint8Array(gridWidth * gridDepth);
  for (let z = 0; z < gridDepth; z += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const idx = x + z * gridWidth;
      currentGrid[idx] = rand() < settings.density ? 1 : 0;
    }
  }
}

function resetSimulation() {
  gridWidth = settings.gridX;
  gridDepth = settings.gridZ;
  maxGenerations = settings.generations;
  updateRuleMasks(settings.rule);
  seedGrid();
  layers = [currentGrid.slice()];
  stepAccumulator = 0;
  updateVoxelInstances();
}

function rebuildSimulation() {
  clampInstanceBudget();
  buildVoxelMesh();
  resetSimulation();
}

function countNeighbors(grid, x, z) {
  const offsets = neighborOffsets[settings.neighborMode] || neighborOffsets.moore;
  let count = 0;

  for (let i = 0; i < offsets.length; i += 1) {
    const [dx, dz] = offsets[i];
    let nx = x + dx;
    let nz = z + dz;

    if (settings.wrapEdges) {
      nx = (nx + gridWidth) % gridWidth;
      nz = (nz + gridDepth) % gridDepth;
    } else if (nx < 0 || nx >= gridWidth || nz < 0 || nz >= gridDepth) {
      continue;
    }

    if (grid[nx + nz * gridWidth] === 1) {
      count += 1;
    }
  }

  return count;
}

function stepSimulation() {
  const nextGrid = new Uint8Array(gridWidth * gridDepth);
  for (let z = 0; z < gridDepth; z += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const idx = x + z * gridWidth;
      const alive = currentGrid[idx] === 1;
      const neighbors = countNeighbors(currentGrid, x, z);
      if (alive) {
        nextGrid[idx] = surviveMask[neighbors] ? 1 : 0;
      } else {
        nextGrid[idx] = birthMask[neighbors] ? 1 : 0;
      }
    }
  }

  currentGrid = nextGrid;
  layers.push(nextGrid);
  if (layers.length > maxGenerations) {
    layers.shift();
  }
  updateVoxelInstances();
}

function updateVoxelInstances() {
  if (!voxelMesh) {
    return;
  }

  const scaleValue = settings.voxelSize;
  tempScale.set(scaleValue, scaleValue, scaleValue);
  const baseX = -(gridWidth - 1) * settings.voxelSize * 0.5;
  const baseZ = -(gridDepth - 1) * settings.voxelSize * 0.5;
  const baseY = 0;

  let instanceIndex = 0;

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    for (let z = 0; z < gridDepth; z += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const idx = x + z * gridWidth;
        if (layer[idx] !== 1) {
          continue;
        }

        const y = baseY + layerIndex * settings.voxelSize;
        tempPos.set(baseX + x * settings.voxelSize, y, baseZ + z * settings.voxelSize);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        voxelMesh.setMatrixAt(instanceIndex, tempMatrix);
        instanceIndex += 1;
      }
    }
  }

  voxelMesh.count = instanceIndex;
  voxelMesh.instanceMatrix.needsUpdate = true;
}

function updateMaterial() {
  material.color.set(settings.baseColor);
  material.emissive.set(settings.baseColor);
  material.emissiveIntensity = settings.emissiveStrength;
  updateVoxelInstances();
}

let isPlaying = false;
let stepAccumulator = 0;
let lastTime = performance.now();

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  controls.update();

  if (isPlaying && settings.speed > 0) {
    stepAccumulator += dt * settings.speed;
    const steps = Math.min(8, Math.floor(stepAccumulator));
    if (steps > 0) {
      for (let i = 0; i < steps; i += 1) {
        stepSimulation();
      }
      stepAccumulator -= steps;
    }
  }

  composer.render();
}

renderer.setAnimationLoop(animate);

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = getPixelRatio();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  composer.setSize(width, height);
  composer.setPixelRatio(pixelRatio);
  bloomPass.setSize(width, height);
  fxaaPass.material.uniforms.resolution.value.set(
    1 / (width * pixelRatio * FXAA_SCALE),
    1 / (height * pixelRatio * FXAA_SCALE)
  );
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  clampPanelToViewport();
}

window.addEventListener('resize', handleResize);
window.addEventListener('contextmenu', (event) => event.preventDefault());

function setRangeProgress(range) {
  const min = Number(range.min);
  const max = Number(range.max);
  const value = Number(range.value);
  const percent = ((value - min) / (max - min)) * 100;
  range.style.setProperty('--range-progress', `${percent}%`);
}

function bindRange(rangeId, valueId, formatter, onChange) {
  const range = document.getElementById(rangeId);
  const valueEl = document.getElementById(valueId);
  const update = () => {
    const value = Number(range.value);
    valueEl.textContent = formatter(value);
    setRangeProgress(range);
    onChange(value);
  };
  range.addEventListener('input', update);
  update();
}

function bindColor(colorId, valueId, chipId, onChange) {
  const input = document.getElementById(colorId);
  const valueEl = document.getElementById(valueId);
  const chip = document.getElementById(chipId);
  if (!input || !valueEl || !chip) {
    return;
  }

  chip.addEventListener('click', () => input.click());
  const update = () => {
    const value = input.value.toLowerCase();
    valueEl.textContent = value;
    chip.style.setProperty('--chip-fill', value);
    onChange(value);
  };
  input.addEventListener('input', update);
  update();
}

const rulePresetSelect = document.getElementById('rule-preset');
const ruleInput = document.getElementById('rule-input');
const ruleValue = document.getElementById('rule-value');

function syncRuleDisplay(value) {
  const normalized = updateRuleMasks(value);
  ruleValue.textContent = normalized;
  ruleInput.value = normalized;
}

rulePresetSelect.addEventListener('change', () => {
  const key = rulePresetSelect.value;
  if (key === 'custom') {
    return;
  }
  const preset = rulePresets[key];
  if (preset) {
    syncRuleDisplay(preset);
  }
});

ruleInput.addEventListener('input', () => {
  rulePresetSelect.value = 'custom';
  const normalized = updateRuleMasks(ruleInput.value);
  ruleValue.textContent = normalized;
});

const neighborSelect = document.getElementById('neighbor-mode');
neighborSelect.addEventListener('change', () => {
  settings.neighborMode = neighborSelect.value;
});

const wrapToggle = document.getElementById('wrap-toggle');
wrapToggle.addEventListener('change', (event) => {
  settings.wrapEdges = event.target.checked;
});

bindRange('sim-speed', 'sim-speed-value', (v) => v.toFixed(2), (v) => {
  settings.speed = v;
});

bindRange('sim-density', 'sim-density-value', (v) => v.toFixed(2), (v) => {
  settings.density = v;
  resetSimulation();
});

bindRange('sim-seed', 'sim-seed-value', (v) => v.toFixed(0), (v) => {
  settings.seed = Math.round(v);
  resetSimulation();
});

bindRange('voxel-size', 'voxel-size-value', (v) => v.toFixed(2), (v) => {
  settings.voxelSize = v;
  rebuildSimulation();
});

bindRange('grid-x', 'grid-x-value', (v) => v.toFixed(0), (v) => {
  settings.gridX = Math.round(v);
  rebuildSimulation();
});

bindRange('grid-z', 'grid-z-value', (v) => v.toFixed(0), (v) => {
  settings.gridZ = Math.round(v);
  rebuildSimulation();
});

bindRange('grid-y', 'grid-y-value', (v) => v.toFixed(0), (v) => {
  settings.generations = Math.round(v);
  rebuildSimulation();
});

bindRange('bloom-strength', 'bloom-strength-value', (v) => v.toFixed(2), (v) => {
  settings.bloom = v;
  bloomPass.strength = v;
});

bindRange('emissive-strength', 'emissive-strength-value', (v) => v.toFixed(2), (v) => {
  settings.emissiveStrength = v;
  updateMaterial();
});

bindColor('base-color', 'base-color-value', 'base-color-chip', (value) => {
  settings.baseColor = value;
  updateMaterial();
});

const playToggle = document.getElementById('play-toggle');
playToggle.textContent = isPlaying ? 'Pause' : 'Play';
playToggle.classList.toggle('is-paused', !isPlaying);
playToggle.addEventListener('click', () => {
  isPlaying = !isPlaying;
  playToggle.textContent = isPlaying ? 'Pause' : 'Play';
  playToggle.classList.toggle('is-paused', !isPlaying);
});

const stepOnce = document.getElementById('step-once');
stepOnce.addEventListener('click', () => {
  stepSimulation();
});

const resetButton = document.getElementById('reset-sim');
resetButton.addEventListener('click', () => {
  rebuildSimulation();
});

const uiPanel = document.getElementById('ui-panel');
const uiHandle = document.getElementById('ui-handle');
const uiHandleBottom = document.getElementById('ui-handle-bottom');
const collapseToggle = document.getElementById('collapse-toggle');
let dragOffset = null;

function clampPanelToViewport() {
  const margin = 10;
  const minHeight = uiHandle.offsetHeight + uiHandleBottom.offsetHeight + 40;
  const available = window.innerHeight - uiPanel.offsetTop - margin;
  const maxHeight = Math.max(available, minHeight);
  uiPanel.style.maxHeight = `${maxHeight}px`;
  if (available < minHeight) {
    uiPanel.style.top = `${window.innerHeight - minHeight - margin}px`;
  }
}

collapseToggle.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
});

collapseToggle.addEventListener('click', () => {
  const collapsed = uiPanel.classList.toggle('is-collapsed');
  collapseToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
});

function startDrag(event) {
  if (event.target.closest('.collapse-button')) {
    return;
  }
  event.currentTarget.setPointerCapture(event.pointerId);
  dragOffset = {
    x: event.clientX - uiPanel.offsetLeft,
    y: event.clientY - uiPanel.offsetTop,
  };
}

function moveDrag(event) {
  if (!dragOffset) {
    return;
  }
  const nextX = Math.max(10, Math.min(window.innerWidth - uiPanel.offsetWidth - 10, event.clientX - dragOffset.x));
  const nextY = Math.max(10, event.clientY - dragOffset.y);
  uiPanel.style.left = `${nextX}px`;
  uiPanel.style.top = `${nextY}px`;
  clampPanelToViewport();
}

function endDrag() {
  dragOffset = null;
}

uiHandle.addEventListener('pointerdown', startDrag);
uiHandle.addEventListener('pointermove', moveDrag);
uiHandle.addEventListener('pointerup', endDrag);
uiHandle.addEventListener('pointercancel', endDrag);

uiHandleBottom.addEventListener('pointerdown', startDrag);
uiHandleBottom.addEventListener('pointermove', moveDrag);
uiHandleBottom.addEventListener('pointerup', endDrag);
uiHandleBottom.addEventListener('pointercancel', endDrag);

syncRuleDisplay(settings.rule);
rebuildSimulation();
clampPanelToViewport();
handleResize();
