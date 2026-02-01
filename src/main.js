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
  ruleMode: 'llr',
  rule: 'B3/S23',
  ecaRule: 30,
  ecaStart: 'single',
  orientation: 'vertical',
  voxelSize: 0.14,
  gridX: 22,
  gridZ: 22,
  generations: 200,
  baseColor: '#4d52ff',
  topColor: '#ad4500',
  emissiveStrength: 0,
  bloom: 0.3,
};

const rulePresets = {
  b3s23: 'B3/S23',
  b36s23: 'B36/S23',
  b2s: 'B2/S',
  b3678s34678: 'B3678/S34678',
  morley: 'B368/S245',
  twox2: 'B36/S125',
  diamoeba: 'B35678/S5678',
  anneal: 'B4678/S35678',
  replicator: 'B1357/S1357',
  lifewithoutdeath: 'B3/S012345678',
  coral: 'B3/S45678',
  maze: 'B3/S12345',
  mazectric: 'B3/S1234',
  serviettes: 'B234/S',
  coagulations: 'B378/S235678',
  walledcities: 'B45678/S2345',
  assimilation: 'B345/S4567',
  stains: 'B3678/S235678',
};

const ecaPresets = {
  rule30: 30,
  rule90: 90,
  rule110: 110,
  rule54: 54,
  rule60: 60,
  rule22: 22,
  rule184: 184,
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffe1cc, 3.0);
keyLight.position.set(8.5, 14.5, 6.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 150;
keyLight.shadow.camera.left = -60;
keyLight.shadow.camera.right = 60;
keyLight.shadow.camera.top = 60;
keyLight.shadow.camera.bottom = -60;
keyLight.shadow.bias = 0.0006;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x7fb2ff, 0.35);
rimLight.position.set(-3.2, 1.8, -3.6);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xfff1e1, 0.2);
fillLight.position.set(-2.5, 3.2, 4.6);
scene.add(fillLight);

const sunLight = new THREE.DirectionalLight(0xfff4d9, 2.2);
sunLight.position.set(-12, 18, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
sunLight.shadow.camera.left = -80;
sunLight.shadow.camera.right = 80;
sunLight.shadow.camera.top = 80;
sunLight.shadow.camera.bottom = -80;
sunLight.shadow.bias = 0.0008;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

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
  color: new THREE.Color(0xffffff),
  roughness: 0.28,
  metalness: 0.0,
  clearcoat: 0.85,
  clearcoatRoughness: 0.1,
  emissive: new THREE.Color(0x000000),
  emissiveIntensity: settings.emissiveStrength,
  vertexColors: true,
  envMapIntensity: 0.3,
});

let voxelMesh = null;
let voxelGeometry = null;
let instanceCapacity = 0;
let instanceColorAttribute = null;
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
const orientationQuat = new THREE.Quaternion();

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
  instanceColorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity * 3), 3);
  instanceColorAttribute.setUsage(THREE.DynamicDrawUsage);
  voxelMesh.geometry.setAttribute('color', instanceColorAttribute);
  voxelMesh.castShadow = true;
  voxelMesh.receiveShadow = true;
  material.vertexColors = true;
  material.needsUpdate = true;
  voxelMesh.frustumCulled = false;
  voxelGroup.add(voxelMesh);
}

function seedLifeLikeGrid() {
  const rand = mulberry32(settings.seed + 1);
  currentGrid = new Uint8Array(gridWidth * gridDepth);
  for (let z = 0; z < gridDepth; z += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const idx = x + z * gridWidth;
      currentGrid[idx] = rand() < settings.density ? 1 : 0;
    }
  }
}

function seedEcaGrid() {
  const rand = mulberry32(settings.seed + 1);
  currentGrid = new Uint8Array(gridWidth * gridDepth);
  if (settings.ecaStart === 'single') {
    const center = Math.floor(gridWidth / 2);
    for (let z = 0; z < gridDepth; z += 1) {
      currentGrid[center + z * gridWidth] = 1;
    }
  } else {
    for (let z = 0; z < gridDepth; z += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const idx = x + z * gridWidth;
        currentGrid[idx] = rand() < settings.density ? 1 : 0;
      }
    }
  }
}

function seedGrid() {
  if (settings.ruleMode === 'eca') {
    seedEcaGrid();
  } else {
    seedLifeLikeGrid();
  }
}

function resetSimulation() {
  gridWidth = settings.gridX;
  gridDepth = settings.gridZ;
  maxGenerations = settings.generations;
  if (settings.ruleMode === 'llr') {
    updateRuleMasks(settings.rule);
  }
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

function stepLifeLike() {
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

function stepEca() {
  const nextGrid = new Uint8Array(gridWidth * gridDepth);
  for (let z = 0; z < gridDepth; z += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const leftIndex = x - 1;
      const rightIndex = x + 1;
      let left = 0;
      let right = 0;

      if (settings.wrapEdges) {
        const lx = (leftIndex + gridWidth) % gridWidth;
        const rx = (rightIndex + gridWidth) % gridWidth;
        left = currentGrid[lx + z * gridWidth];
        right = currentGrid[rx + z * gridWidth];
      } else {
        if (leftIndex >= 0) {
          left = currentGrid[leftIndex + z * gridWidth];
        }
        if (rightIndex < gridWidth) {
          right = currentGrid[rightIndex + z * gridWidth];
        }
      }

      const center = currentGrid[x + z * gridWidth];
      const pattern = (left << 2) | (center << 1) | right;
      const next = (settings.ecaRule >> pattern) & 1;
      nextGrid[x + z * gridWidth] = next;
    }
  }

  currentGrid = nextGrid;
  layers.push(nextGrid);
  if (layers.length > maxGenerations) {
    layers.shift();
  }
  updateVoxelInstances();
}

function stepSimulation() {
  if (settings.ruleMode === 'eca') {
    stepEca();
  } else {
    stepLifeLike();
  }
}

function updateVoxelInstances() {
  if (!voxelMesh || !instanceColorAttribute) {
    return;
  }

  updateOrientation();

  const scaleValue = settings.voxelSize;
  tempScale.set(scaleValue, scaleValue, scaleValue);
  const baseX = -(gridWidth - 1) * settings.voxelSize * 0.5;
  const baseZ = -(gridDepth - 1) * settings.voxelSize * 0.5;
  const baseY = 0;
  const baseColor = new THREE.Color(settings.baseColor).convertSRGBToLinear();
  const topColor = new THREE.Color(settings.topColor).convertSRGBToLinear();
  const layerSpan = Math.max(layers.length - 1, 1);

  let instanceIndex = 0;

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const t = layerIndex / layerSpan;
    tempColor.copy(baseColor).lerp(topColor, t);
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
        const colorIndex = instanceIndex * 3;
        instanceColorAttribute.array[colorIndex] = tempColor.r;
        instanceColorAttribute.array[colorIndex + 1] = tempColor.g;
        instanceColorAttribute.array[colorIndex + 2] = tempColor.b;
        instanceIndex += 1;
      }
    }
  }

  voxelMesh.count = instanceIndex;
  voxelMesh.instanceMatrix.needsUpdate = true;
  instanceColorAttribute.needsUpdate = true;

  shadowPlane.position.y = -settings.voxelSize * 0.55;
}

function updateMaterial() {
  material.color.set(0xffffff);
  material.emissive.set(settings.baseColor);
  material.emissiveIntensity = settings.emissiveStrength;
  updateVoxelInstances();
}

function updateOrientation() {
  if (!voxelGroup) {
    return;
  }
  if (settings.orientation === 'horizontal') {
    voxelGroup.setRotationFromQuaternion(orientationQuat.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)));
  } else {
    voxelGroup.setRotationFromQuaternion(orientationQuat.identity());
  }
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
  refreshRangeProgress();
}

window.addEventListener('resize', handleResize);
window.addEventListener('contextmenu', (event) => event.preventDefault());

function setRangeProgress(range) {
  const min = Number(range.min);
  const max = Number(range.max);
  const value = Number(range.value);
  const percent = (value - min) / (max - min);
  const thumbSize = 16;
  const trackWidth = range.clientWidth || 1;
  const usable = Math.max(trackWidth - thumbSize, 1);
  const px = percent * usable + thumbSize * 0.5;
  range.style.setProperty('--range-progress', `${px}px`);
}

function refreshRangeProgress() {
  document.querySelectorAll('input[type="range"]').forEach((range) => {
    setRangeProgress(range);
  });
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

const ruleModeSelect = document.getElementById('rule-mode');
const rulePresetSelect = document.getElementById('rule-preset');
const ruleInput = document.getElementById('rule-input');
const ruleValue = document.getElementById('rule-value');
const ruleModeGroups = document.querySelectorAll('[data-rule-mode]');
const ecaPresetSelect = document.getElementById('eca-preset');
const ecaRuleRange = document.getElementById('eca-rule');
const ecaRuleValue = document.getElementById('eca-rule-value');
const ecaStartSelect = document.getElementById('eca-start');
const orientationSelect = document.getElementById('orientation');

function syncRuleDisplay(value) {
  const normalized = updateRuleMasks(value);
  ruleValue.textContent = normalized;
  ruleInput.value = normalized;
}

function updateRuleModeUI() {
  ruleModeGroups.forEach((group) => {
    const mode = group.getAttribute('data-rule-mode');
    const isActive = mode === settings.ruleMode;
    group.classList.toggle('is-hidden', !isActive);
  });
  requestAnimationFrame(() => {
    refreshRangeProgress();
  });
}

function setEcaRule(value) {
  const nextValue = Math.max(0, Math.min(255, Math.round(value)));
  settings.ecaRule = nextValue;
  if (ecaRuleRange) {
    ecaRuleRange.value = nextValue.toString();
    setRangeProgress(ecaRuleRange);
  }
  if (ecaRuleValue) {
    ecaRuleValue.textContent = nextValue.toString();
  }
}

if (ruleModeSelect) {
  ruleModeSelect.addEventListener('change', () => {
    settings.ruleMode = ruleModeSelect.value;
    updateRuleModeUI();
    resetSimulation();
  });
}

if (orientationSelect) {
  orientationSelect.addEventListener('change', () => {
    settings.orientation = orientationSelect.value;
    updateOrientation();
  });
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

if (ecaPresetSelect) {
  ecaPresetSelect.addEventListener('change', () => {
    const key = ecaPresetSelect.value;
    if (key === 'custom') {
      return;
    }
    const preset = ecaPresets[key];
    if (typeof preset === 'number') {
      setEcaRule(preset);
    }
  });
}

if (ecaRuleRange) {
  ecaRuleRange.addEventListener('input', () => {
    setEcaRule(Number(ecaRuleRange.value));
    if (ecaPresetSelect) {
      ecaPresetSelect.value = 'custom';
    }
  });
}

if (ecaStartSelect) {
  ecaStartSelect.addEventListener('change', () => {
    settings.ecaStart = ecaStartSelect.value;
    resetSimulation();
  });
}

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

bindColor('top-color', 'top-color-value', 'top-color-chip', (value) => {
  settings.topColor = value;
  updateVoxelInstances();
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
const sectionHeadings = document.querySelectorAll('.panel-section .panel-heading');

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

sectionHeadings.forEach((heading) => {
  heading.addEventListener('click', () => {
    const section = heading.closest('.panel-section');
    if (!section) {
      return;
    }
    const collapsed = section.classList.toggle('is-collapsed');
    heading.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
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

if (ruleModeSelect) {
  ruleModeSelect.value = settings.ruleMode;
}
if (orientationSelect) {
  orientationSelect.value = settings.orientation;
}
updateRuleModeUI();
setEcaRule(settings.ecaRule);
syncRuleDisplay(settings.rule);
rebuildSimulation();
clampPanelToViewport();
handleResize();
