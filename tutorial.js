// js/tutorial.js
// Expanded tutorial with multiple sections teaching all game mechanics

import { clearCurrentRoom, world } from './rooms.js';
import { gameState } from './gameState.js';
import { updateUI, updateUIVisibility } from './ui.js';
import { TreasureChest, treasureChests } from './items.js';

let tutorialActive = false;
let skipButton = null;
let tutorialObjects = [];
let tutorialEnemies = []; // Display enemies (not real enemies)

export function startTutorial(scene, player, playerObject, camera) {
  console.log('=== STARTING EXPANDED TUTORIAL ===');
  
  tutorialActive = true;
  gameState.currentRoomIndex = 0;
  gameState.gameRunning = true;
  gameState.gameStarted = true;

  // Update UI visibility (will show HUD and instructions for tutorial)
  updateUIVisibility();

  // Disable fog for tutorial
  if (scene.fog) {
    scene.fog.far = 150;
  }
  
  // Clear world.walls BEFORE clearing the room
  world.walls = [];
  
  // Clean up
  clearCurrentRoom();
  cleanupTutorial(scene);
  tutorialObjects = [];
  tutorialEnemies = [];
  
  // Build expanded tutorial room
  buildExpandedTutorialRoom(scene, player, camera);
  
  // Set playerObject position
  playerObject.position.copy(player.pos);
  
  // Reset camera look
  import('./camera.js').then(({ setLook }) => {
    setLook(Math.PI, 0); // Look forward
  });
  
  // Show initial tutorial message
  showTutorialMessage("Welcome! Walk through each colored section to learn the game.", 5000);
  
  // Create skip button
  createSkipButton(scene, player);
  
  updateUI(player, 0, 0);
  
  console.log('=== TUTORIAL READY ===');
}

function buildExpandedTutorialRoom(scene, player, camera) {
  const roomWidth = 70;
  const roomDepth = 22;
  const halfW = roomWidth / 2;
  const halfD = roomDepth / 2;
  
  // Lighting - optimized for performance
  const ambient = new THREE.AmbientLight(0x404866, 0.7);  // Slightly brighter to compensate for fewer lights
  scene.add(ambient);
  tutorialObjects.push(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);  // PERFORMANCE: Reduced intensity
  dirLight.position.set(5, 10, -5);
  dirLight.castShadow = false;  // PERFORMANCE: Disabled shadows for better performance
  scene.add(dirLight);
  tutorialObjects.push(dirLight);
  
  // Floor
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x1a1f2f,
    roughness: 0.8 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);
  tutorialObjects.push(floor);
  
  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a });
  const wallHeight = 4;
  const wallThickness = 1;
  
  createWall(scene, 0, wallHeight/2, -halfD - wallThickness/2, roomWidth, wallHeight, wallThickness, wallMat);
  createWall(scene, 0, wallHeight/2, halfD + wallThickness/2, roomWidth, wallHeight, wallThickness, wallMat);
  createWall(scene, -halfW - wallThickness/2, wallHeight/2, 0, wallThickness, wallHeight, roomDepth + wallThickness*2, wallMat);
  createWall(scene, halfW + wallThickness/2, wallHeight/2, 0, wallThickness, wallHeight, roomDepth + wallThickness*2, wallMat);
  
  // === SECTION 1: CONTROLS (-25, 0) ===
  const sec1X = -25;
  createSectionMarker(scene, sec1X, 0, "CONTROLS", 0x4ae290);
  createPracticeTargets(scene, sec1X, halfD - 6);
  createInfoDisplay(scene, sec1X, -halfD + 3, [
    "WASD - Move",
    "Mouse - Look Around",
    "Left Click - Shoot", 
    "Space - Jump",
    "TAB - Pause",
    "",
    "Try shooting the targets!"
  ]);
  
  // === SECTION 2: ENEMY TYPES (-8, 0) ===
  const sec2X = -8;
  createSectionMarker(scene, sec2X, 0, "ENEMIES", 0xff6633);
  createEnemyDisplays(scene, sec2X);
  createInfoDisplay(scene, sec2X, -halfD + 3, [
    "5 Goon Types:",
    "Thug - Balanced",
    "Runner - Quick & Weak",
    "Shooter - Guns!",
    "Enforcer - Slow & Tough",
    "Head Honcho - Deadly!"
  ]);
  
  // === SECTION 3: ITEMS (10, 0) ===
  const sec3X = 10;
  createSectionMarker(scene, sec3X, 0, "ITEMS", 0xffd700);
  createTreasureDisplays(scene, sec3X, player);
  createInfoDisplay(scene, sec3X, -halfD + 3, [
    "Medical Supplies:",
    "+30 Health",
    "",
    "Spawns randomly",
    "after Room 2",
    "",
    "Walk close to collect!"
  ]);
  
  // === SECTION 4: UPGRADES (27, 0) ===
  const sec4X = 27;
  createSectionMarker(scene, sec4X, 0, "UPGRADES", 0x9966ff);
  createUpgradeDisplay(scene, sec4X);
  createUpgradePreview(scene, sec4X);
  createInfoDisplay(scene, sec4X, -halfD + 3, [
    "UPGRADE SYSTEM",
    "",
    "Every 3 rooms cleared:",
    "Choose 1 of 3 upgrades!",
    "",
    "Options include:",
    "• Damage Boost",
    "• Fire Rate Increase",
    "• Max Health Bonus",
    "• Movement Speed",
    "• Full Heal",
    "",
    "Stack upgrades to get stronger!"
  ]);
  
  // Set player starting position in section 1
  player.pos.set(sec1X, 1.2, -halfD + 3);
  if (camera) camera.position.copy(player.pos);
}

// ===== HELPER FUNCTIONS =====

function createWall(scene, x, y, z, width, height, depth, mat) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, mat.clone());
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  tutorialObjects.push(mesh);
  
  const min = new THREE.Vector3(x - width / 2, y - height / 2, z - depth / 2);
  const max = new THREE.Vector3(x + width / 2, y + height / 2, z + depth / 2);
  world.walls.push({ min, max, mesh });
}

function createSectionMarker(scene, x, z, text, color) {
  // Floor marker
  const markerGeo = new THREE.PlaneGeometry(14, 18);
  const markerMat = new THREE.MeshStandardMaterial({ 
    color: color,
    transparent: true,
    opacity: 0.25,
    emissive: color,
    emissiveIntensity: 0.2
  });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(x, 0.01, z);
  scene.add(marker);
  tutorialObjects.push(marker);
  
  // Floating title text
  createFloatingText(scene, x, 3.5, z, text, color, 6, 1.5);

  // PERFORMANCE: Reduced corner lights from 4 to 2 for better performance
  for (let i = 0; i < 2; i++) {
    const angle = (i / 2) * Math.PI * 2;
    const light = new THREE.PointLight(color, 0.4, 8);
    light.position.set(x + Math.cos(angle) * 7, 1, z + Math.sin(angle) * 9);
    scene.add(light);
    tutorialObjects.push(light);
  }
}

function createFloatingText(scene, x, y, z, text, color, scaleX = 8, scaleY = 2) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 256;
  
  context.fillStyle = '#' + color.toString(16).padStart(6, '0');
  context.font = 'bold 90px Courier New';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 512, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ 
    map: texture,
    depthTest: true,  // Enable depth testing so text respects object positions
    depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(x, y, z);
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 100; // Lower render order
  scene.add(sprite);
  tutorialObjects.push(sprite);
}

function createInfoDisplay(scene, x, z, lines) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 512;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, 512, 512);
  
  context.strokeStyle = '#4af';
  context.lineWidth = 4;
  context.strokeRect(10, 10, 492, 492);
  
  context.fillStyle = '#4af';
  context.font = 'bold 28px Courier New';
  context.textAlign = 'center';
  
  const startY = 80;
  const lineHeight = 45;
  lines.forEach((line, i) => {
    if (line === "") {
      // Empty line for spacing
      return;
    }
    context.fillText(line, 256, startY + i * lineHeight);
  });
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ 
    map: texture,
    depthTest: true,  // Enable depth testing
    depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(x, 2.2, z);
  sprite.scale.set(3.5, 3.5, 1);
  sprite.renderOrder = 100;
  scene.add(sprite);
  tutorialObjects.push(sprite);
}

function createPracticeTargets(scene, x, z) {
  const targetMat = new THREE.MeshStandardMaterial({ 
    color: 0xff6633,
    emissive: 0x442200,
    emissiveIntensity: 0.4
  });
  
  for (let i = 0; i < 3; i++) {
    const targetGeo = new THREE.BoxGeometry(1, 1.5, 1);
    const target = new THREE.Mesh(targetGeo, targetMat.clone());
    target.position.set(x - 3 + i * 3, 0.75, z);
    target.castShadow = false;  // PERFORMANCE: Disabled shadows
    scene.add(target);
    tutorialObjects.push(target);
  }
}

function createEnemyDisplays(scene, x) {
  const enemyTypes = [
    { name: "Normal", color: 0xff3333, size: [0.6, 1.2, 0.6], zOffset: 6 },
    { name: "Fast", color: 0xff6633, size: [0.4, 0.8, 0.4], zOffset: 3 },
    { name: "Ranged", color: 0x33ff66, size: [0.5, 1.8, 0.5], zOffset: 0 },
    { name: "Tank", color: 0x1144cc, size: [0.9, 1.5, 0.9], zOffset: -3 },
    { name: "Boss", color: 0x8800ff, size: [1.3, 2.2, 1.3], zOffset: -7 }
  ];
  
  enemyTypes.forEach((type, i) => {
    const xPos = x;
    const zPos = type.zOffset;
    
    // Enemy display model
    const enemyGeo = new THREE.BoxGeometry(...type.size);
    const enemyMat = new THREE.MeshStandardMaterial({
      color: type.color,
      emissive: type.color,
      emissiveIntensity: 0.3  // PERFORMANCE: Reduced from 0.4
    });
    const enemy = new THREE.Mesh(enemyGeo, enemyMat);
    enemy.position.set(xPos, type.size[1] / 2, zPos);
    enemy.castShadow = false;  // PERFORMANCE: Disabled shadows
    scene.add(enemy);
    tutorialObjects.push(enemy);
    tutorialEnemies.push(enemy);

    // PERFORMANCE: Reduced light intensity
    const light = new THREE.PointLight(type.color, 0.3, 4);
    light.position.set(xPos, type.size[1] + 0.5, zPos);
    scene.add(light);
    tutorialObjects.push(light);
    
    // Label above enemy
    createFloatingText(scene, xPos, type.size[1] + 1.5, zPos, type.name.toUpperCase(), type.color, 2.5, 0.6);
  });
}

function createTreasureDisplays(scene, x, player) {
  // Create multiple treasure chests to demonstrate
  const chestPositions = [
    { x: x - 3, z: 4 },
    { x: x, z: 2 },
    { x: x + 3, z: 4 }
  ];
  
  const treasureMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xaa8800,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2
  });
  
  chestPositions.forEach(pos => {
    const chestPos = new THREE.Vector3(pos.x, 0, pos.z);
    const chest = new TreasureChest(scene, chestPos, treasureMat);
    treasureChests.push(chest);
    tutorialObjects.push(chest.mesh);
  });
}

function createUpgradePreview(scene, x) {
  // Create a mock upgrade screen preview
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 768;
  
  // Background
  context.fillStyle = 'rgba(20, 40, 60, 0.95)';
  context.fillRect(0, 0, 1024, 768);
  
  // Border
  context.strokeStyle = '#6ab0ff';
  context.lineWidth = 8;
  context.strokeRect(20, 20, 984, 728);
  
  // Title
  context.fillStyle = '#4af';
  context.font = 'bold 60px Courier New';
  context.textAlign = 'center';
  context.fillText('CHOOSE AN UPGRADE', 512, 100);
  
  // Three upgrade boxes
  const upgrades = [
    { name: 'DAMAGE +25%', x: 170, color: '#ff4444' },
    { name: 'FIRE RATE +30%', x: 512, color: '#ffaa44' },
    { name: 'MAX HEALTH +30', x: 854, color: '#44ff44' }
  ];
  
  upgrades.forEach(upgrade => {
    // Box
    context.fillStyle = 'rgba(42, 74, 106, 0.8)';
    context.fillRect(upgrade.x - 120, 200, 240, 400);
    
    context.strokeStyle = '#4a90e2';
    context.lineWidth = 4;
    context.strokeRect(upgrade.x - 120, 200, 240, 400);
    
    // Icon color
    context.fillStyle = upgrade.color;
    context.fillRect(upgrade.x - 80, 250, 160, 160);
    
    // Text
    context.fillStyle = '#fff';
    context.font = 'bold 28px Courier New';
    context.textAlign = 'center';
    
    const words = upgrade.name.split(' ');
    words.forEach((word, i) => {
      context.fillText(word, upgrade.x, 480 + i * 40);
    });
  });
  
  // Footer
  context.fillStyle = '#aaa';
  context.font = '24px Courier New';
  context.fillText('Choose wisely - only one per checkpoint!', 512, 680);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ 
    map: texture,
    depthTest: true,  // Enable depth testing
    depthWrite: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(x, 3, 2);
  sprite.scale.set(6, 4.5, 1);
  sprite.renderOrder = 100;
  scene.add(sprite);
  tutorialObjects.push(sprite);
}

function createUpgradeDisplay(scene, x) {
  // Create visual representation of upgrade system with better spacing
  const upgradeIcons = [
    { name: "DAMAGE", desc: "+25%", color: 0xff4444, z: 6 },
    { name: "FIRE RATE", desc: "+30%", color: 0xffaa44, z: 3 },
    { name: "HEALTH", desc: "+30", color: 0x44ff44, z: 0 },
    { name: "SPEED", desc: "+20%", color: 0x4444ff, z: -3 },
    { name: "FULL HEAL", desc: "Restore", color: 0xff44ff, z: -6 }
  ];
  
  upgradeIcons.forEach(icon => {
    // Create a glowing box
    const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const boxMat = new THREE.MeshStandardMaterial({
      color: icon.color,
      emissive: icon.color,
      emissiveIntensity: 0.5,  // PERFORMANCE: Reduced from 0.7
      metalness: 0.4
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(x - 4, 0.6, icon.z);
    box.castShadow = false;  // PERFORMANCE: Disabled shadows
    scene.add(box);
    tutorialObjects.push(box);
    tutorialEnemies.push(box); // Add to rotating objects

    // PERFORMANCE: Reduced light intensity from 1.0 to 0.5 and distance from 7 to 5
    const light = new THREE.PointLight(icon.color, 0.5, 5);
    light.position.set(x - 4, 0.6, icon.z);
    scene.add(light);
    tutorialObjects.push(light);
    
    // Name label
    createFloatingText(scene, x - 4, 2, icon.z, icon.name, icon.color, 2.2, 0.5);
    
    // Description
    createFloatingText(scene, x - 4, 1.3, icon.z, icon.desc, 0xffffff, 1.5, 0.4);
  });
}

function createSkipButton(scene, player) {
  const buttonX = -30;
  const buttonY = 2;
  const buttonZ = -10;
  
  const buttonGeo = new THREE.BoxGeometry(3, 1.5, 0.3);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0x993333,
    emissiveIntensity: 0.9
  });
  
  skipButton = new THREE.Mesh(buttonGeo, buttonMat);
  skipButton.position.set(buttonX, buttonY, buttonZ);
  scene.add(skipButton);
  tutorialObjects.push(skipButton);

  // PERFORMANCE: Reduced skip button light intensity
  const light = new THREE.PointLight(0xff4444, 1.0, 8);
  light.position.set(buttonX, buttonY, buttonZ + 0.5);
  scene.add(light);
  tutorialObjects.push(light);
  
  createFloatingText(scene, buttonX, buttonY + 1.3, buttonZ, "SKIP →", 0xff4444, 3, 0.75);
  createFloatingText(scene, buttonX, buttonY - 1, buttonZ, "Shoot to Skip", 0xff8888, 2.5, 0.6);
}

function showTutorialMessage(text, duration) {
  let msgEl = document.getElementById('tutorialMsg');
  
  if (!msgEl) {
    const html = `
      <div id="tutorialMsg" style="position: absolute; top: 15%; left: 50%; transform: translate(-50%, -50%); 
           background: rgba(0, 0, 0, 0.9); color: #4af; padding: 20px 40px; border-radius: 12px; 
           font-size: 22px; font-weight: bold; text-align: center; z-index: 15; pointer-events: none;
           border: 3px solid #4ae290; box-shadow: 0 0 30px rgba(74, 226, 144, 0.7);
           max-width: 700px; transition: opacity 0.5s ease;"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    msgEl = document.getElementById('tutorialMsg');
  }
  
  msgEl.textContent = text;
  msgEl.style.opacity = '1';
  
  setTimeout(() => {
    if (msgEl) msgEl.style.opacity = '0';
  }, duration);
}

// ===== CLEANUP =====

function cleanupTutorial(scene) {
  tutorialObjects.forEach(obj => {
    if (obj && obj.parent) {
      scene.remove(obj);
    }
  });
  tutorialObjects = [];
  tutorialEnemies = [];
  
  if (skipButton) {
    scene.remove(skipButton);
    skipButton = null;
  }
  
  // Clear treasure chests
  treasureChests.forEach(c => scene.remove(c.mesh));
  treasureChests.length = 0;
  
  const msgEl = document.getElementById('tutorialMsg');
  if (msgEl) msgEl.remove();
}

export function cleanupTutorialState(scene) {
  tutorialActive = false;
  cleanupTutorial(scene);
  world.walls = [];
}

// ===== UPDATE =====

export function updateTutorial(scene, delta, projectiles, startGameCallback) {
  if (!tutorialActive || !skipButton) return;

  // PERFORMANCE: Disabled rotation animations to reduce lag on lower-end systems
  // tutorialEnemies.forEach(obj => {
  //   obj.rotation.y += delta * 0.8;
  // });

  // Animate treasure chests (float only, no spinning for performance)
  treasureChests.forEach(chest => {
    if (chest.mesh) {
      // Floating animation
      const time = Date.now() * 0.001;
      chest.mesh.position.y = 0.3 + Math.sin(time * 2) * 0.1;
    }
  });
  
  // Check if skip button was shot
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (!proj.isPlayerProjectile) continue;
    
    const dist = proj.mesh.position.distanceTo(skipButton.position);
    if (dist < 2) {
      skipTutorial(scene, startGameCallback);
      scene.remove(proj.mesh);
      projectiles.splice(i, 1);
      break;
    }
  }
}

function skipTutorial(scene, startGameCallback) {
  cleanupTutorialState(scene);
  gameState.currentRoomIndex = 1;
  startGameCallback();
}

export function isTutorialActive() {
  return tutorialActive;
}