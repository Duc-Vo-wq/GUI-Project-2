// js/rooms.js
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';

// Exports:
// initRooms({ scene, floorMat, camera, player, spawnEnemies? })
// buildRoom(index)
// clearCurrentRoom()
// world  (simple collision AABB array)
// currentRoom (room state including spawn zones)
// ROOM_SIZE constant

export const ROOM_SIZE = 18; // Increased from 12 to 18
export const WALL_THICKNESS = 1;

export const world = { walls: [] }; // AABB walls for collision: {min:Vector3, max:Vector3, mesh?}

let roomIndex = 1;
export let currentRoom = { enemies: [], sceneObjs: [], obstacles: [], spawnZones: [] };

let scene, floorMat, camera, player, spawnEnemiesCb;
export let floorMesh = null;

export function initRooms({ scene: s, floorMaterial, camera: cam, player: pl, spawnEnemies }) {
  scene = s;
  floorMat = floorMaterial;
  camera = cam;
  player = pl;
  spawnEnemiesCb = spawnEnemies;
}

export function clearCurrentRoom() {
  if (!scene) throw new Error('rooms.js not initialized: call initRooms(...) first');
  currentRoom.sceneObjs.forEach(o => {
    if (o.parent) o.parent.remove(o);
    scene.remove(o);
  });
  currentRoom.sceneObjs = [];
  currentRoom.enemies = [];
  currentRoom.obstacles = [];
  currentRoom.spawnZones = [];
  world.walls = [];
  if (floorMesh && floorMesh.parent) {
    scene.remove(floorMesh);
    floorMesh = null;
  }
}

export function buildRoom(index) {
  if (!scene) throw new Error('rooms.js not initialized: call initRooms(...) first');

  clearCurrentRoom();
  roomIndex = index;
  
  // Update UI if present
  const roomEl = document.getElementById('room');
  if (roomEl) roomEl.textContent = roomIndex;

  // Boss room is always type 'large'
  const roomType = index === 10 ? 'large' : getRandomRoomType();
  
  // Build the room based on type
  switch(roomType) {
    case 'small':
      buildSmallRoom();
      break;
    case 'large':
      buildLargeRoom();
      break;
    case 'lshaped':
      buildLShapedRoom();
      break;
    default:
      buildLargeRoom();
  }

  // Spawn enemies (if callback provided)
  if (typeof spawnEnemiesCb === 'function') {
    // Reduced enemy count scaling - caps at 10 instead of 15
    const enemyCount = Math.min(2 + Math.floor(index * 0.8), 10);
    spawnEnemiesCb(enemyCount, index);
  }
}

function getRandomRoomType() {
  const rand = Math.random();
  if (rand < 0.33) return 'small';
  if (rand < 0.66) return 'large';
  return 'lshaped';
}

// === HELPER FUNCTION FOR WALL TEXTURE ===
function createWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base wall color (dark stone)
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, 256, 256);

  // Draw brick pattern
  const brickWidth = 64;
  const brickHeight = 32;
  ctx.strokeStyle = '#252a30';
  ctx.lineWidth = 3;

  for (let y = 0; y < 256; y += brickHeight) {
    for (let x = 0; x < 256; x += brickWidth) {
      const offset = (y / brickHeight) % 2 === 0 ? 0 : brickWidth / 2;
      ctx.strokeRect(x + offset, y, brickWidth, brickHeight);

      // Add slight color variation
      const brightness = Math.random() * 20 - 10;
      ctx.fillStyle = `rgba(${58 + brightness}, ${64 + brightness}, ${72 + brightness}, 0.5)`;
      ctx.fillRect(x + offset + 2, y + 2, brickWidth - 4, brickHeight - 4);
    }
  }

  // Add weathering details
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = Math.random() * 4 + 1;
    const darkness = Math.random() * 40;
    ctx.fillStyle = `rgba(0, 0, 0, ${darkness / 100})`;
    ctx.fillRect(x, y, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// === SMALL ROOM (12x12) ===
function buildSmallRoom() {
  const size = 12;
  const wallMat = new THREE.MeshStandardMaterial({
    map: createWallTexture(),
    roughness: 0.9,
    metalness: 0.1
  });
  const w = WALL_THICKNESS;
  const half = size / 2;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(size, size);
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  currentRoom.sceneObjs.push(floorMesh);

  // Door frame on +Z
  const doorSize = 2.5;
  createDoorFrame(0, half, doorSize);

  // Build walls (leave gap at +Z center for door)
  const halfDoor = doorSize / 2;
  createWallSegment(-half + (size - doorSize) / 4, 1.5, half + w / 2, (size - doorSize - 0.8) / 2, 3, w, wallMat);
  createWallSegment(half - (size - doorSize) / 4, 1.5, half + w / 2, (size - doorSize - 0.8) / 2, 3, w, wallMat);
  createWallSegment(0, 1.5, -half - w / 2, size, 3, w, wallMat);
  createWallSegment(half + w / 2, 1.5, 0, w, 3, size + w * 2, wallMat);
  createWallSegment(-half - w / 2, 1.5, 0, w, 3, size + w * 2, wallMat);

  // Define spawn zone (simple rectangle)
  currentRoom.spawnZones = [
    { minX: -half + 1, maxX: half - 1, minZ: -half + 1, maxZ: half - 1 }
  ];

  // Fewer obstacles for small room
  createObstacles(2, size, currentRoom.spawnZones);
  
  // Player starting position
  player.pos.set(0, 1.2, -half + 1.5);
  if (camera) camera.position.copy(player.pos);
}

// === LARGE ROOM (18x18) ===
function buildLargeRoom() {
  const size = 18;
  const wallMat = new THREE.MeshStandardMaterial({
    map: createWallTexture(),
    roughness: 0.9,
    metalness: 0.1
  });
  const w = WALL_THICKNESS;
  const half = size / 2;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(size, size);
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  currentRoom.sceneObjs.push(floorMesh);

  // Door frame on +Z
  const doorSize = 2.5;
  createDoorFrame(0, half, doorSize);

  // Build walls
  createWallSegment(-half + (size - doorSize) / 4, 1.5, half + w / 2, (size - doorSize - 0.8) / 2, 3, w, wallMat);
  createWallSegment(half - (size - doorSize) / 4, 1.5, half + w / 2, (size - doorSize - 0.8) / 2, 3, w, wallMat);
  createWallSegment(0, 1.5, -half - w / 2, size, 3, w, wallMat);
  createWallSegment(half + w / 2, 1.5, 0, w, 3, size + w * 2, wallMat);
  createWallSegment(-half - w / 2, 1.5, 0, w, 3, size + w * 2, wallMat);

  // Define spawn zone (simple rectangle)
  currentRoom.spawnZones = [
    { minX: -half + 1, maxX: half - 1, minZ: -half + 1, maxZ: half - 1 }
  ];

  // More obstacles for large room
  createObstacles(6, size, currentRoom.spawnZones);
  
  // Player starting position
  player.pos.set(0, 1.2, -half + 1.5);
  if (camera) camera.position.copy(player.pos);
}

// === L-SHAPED ROOM ===
function buildLShapedRoom() {
  const size = 16;
  const wallMat = new THREE.MeshStandardMaterial({
    map: createWallTexture(),
    roughness: 0.9,
    metalness: 0.1
  });
  const w = WALL_THICKNESS;
  const half = size / 2;
  const cornerSize = size * 0.4; // Size of the cut-out corner

  // Create L-shaped floor using two rectangles
  const longSide = size;
  const shortSide = size - cornerSize;
  
  // Vertical part of L
  const floor1Geo = new THREE.PlaneGeometry(longSide, shortSide);
  const floor1 = new THREE.Mesh(floor1Geo, floorMat);
  floor1.rotation.x = -Math.PI / 2;
  floor1.position.set(0, 0, -cornerSize / 2);
  floor1.receiveShadow = true;
  scene.add(floor1);
  currentRoom.sceneObjs.push(floor1);

  // Horizontal part of L
  const floor2Geo = new THREE.PlaneGeometry(shortSide, cornerSize);
  const floor2 = new THREE.Mesh(floor2Geo, floorMat);
  floor2.rotation.x = -Math.PI / 2;
  floor2.position.set(-cornerSize / 2, 0, half - cornerSize / 2);
  floor2.receiveShadow = true;
  scene.add(floor2);
  currentRoom.sceneObjs.push(floor2);

  floorMesh = floor1; // Store reference

  // Door frame (on the horizontal part)
  const doorSize = 2.5;
  createDoorFrame(-cornerSize / 2, half, doorSize);

  // Build L-shaped walls
  // Bottom wall (full width)
  createWallSegment(0, 1.5, -half - w / 2, longSide, 3, w, wallMat);
  
  // Left wall (full height)
  createWallSegment(-half - w / 2, 1.5, 0, w, 3, longSide + w * 2, wallMat);
  
  // Right wall (only bottom part)
  createWallSegment(half + w / 2, 1.5, -cornerSize / 2, w, 3, shortSide + w, wallMat);
  
  // Top wall with door (only left part of horizontal section)
  const doorX = -cornerSize / 2;
  const topWallLeft = doorX - doorSize / 2 - (-half);
  const topWallRight = half - cornerSize - (doorX + doorSize / 2);
  
  createWallSegment(-half + topWallLeft / 2, 1.5, half + w / 2, topWallLeft, 3, w, wallMat);
  createWallSegment(doorX + doorSize / 2 + topWallRight / 2, 1.5, half + w / 2, topWallRight, 3, w, wallMat);
  
  // Inner corner walls (creating the L cutout)
  createWallSegment(half - cornerSize / 2, 1.5, half - cornerSize - w / 2, cornerSize, 3, w, wallMat);
  createWallSegment(half - cornerSize + w / 2, 1.5, half - cornerSize / 2, w, 3, cornerSize, wallMat);

  // Define spawn zones for L-shaped room (TWO separate rectangles)
  currentRoom.spawnZones = [
    // Vertical section (main long area)
    { 
      minX: -half + 1, 
      maxX: half - 1, 
      minZ: -half + 1, 
      maxZ: half - cornerSize - 1 
    },
    // Horizontal section (top left area)
    { 
      minX: -half + 1, 
      maxX: half - cornerSize - 1, 
      minZ: half - cornerSize + 1, 
      maxZ: half - 1 
    }
  ];

  // Obstacles in both sections of the L
  createObstacles(4, size * 0.7, currentRoom.spawnZones);
  
  // Player starting position (in the main vertical section)
  player.pos.set(0, 1.2, -half + 1.5);
  if (camera) camera.position.copy(player.pos);
}

// === HELPER FUNCTION FOR BOX/CRATE TEXTURE ===
function createBoxTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base wood crate color (lighter brown)
  ctx.fillStyle = '#8b6f47';
  ctx.fillRect(0, 0, 256, 256);

  // Draw wooden planks (horizontal)
  for (let y = 0; y < 256; y += 64) {
    ctx.strokeStyle = '#6b4f3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    // Wood grain texture
    for (let x = 0; x < 256; x += 15) {
      const offset = Math.random() * 8;
      ctx.strokeStyle = `rgba(107, 79, 58, ${Math.random() * 0.4 + 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x + 10 + offset, y + 20);
      ctx.stroke();
    }
  }

  // Add corner brackets (metal straps)
  ctx.fillStyle = '#4a4a4a';
  const bracketSize = 30;
  const bracketWidth = 8;

  // Top-left bracket
  ctx.fillRect(0, 0, bracketSize, bracketWidth);
  ctx.fillRect(0, 0, bracketWidth, bracketSize);

  // Top-right bracket
  ctx.fillRect(256 - bracketSize, 0, bracketSize, bracketWidth);
  ctx.fillRect(256 - bracketWidth, 0, bracketWidth, bracketSize);

  // Bottom-left bracket
  ctx.fillRect(0, 256 - bracketWidth, bracketSize, bracketWidth);
  ctx.fillRect(0, 256 - bracketSize, bracketWidth, bracketSize);

  // Bottom-right bracket
  ctx.fillRect(256 - bracketSize, 256 - bracketWidth, bracketSize, bracketWidth);
  ctx.fillRect(256 - bracketWidth, 256 - bracketSize, bracketWidth, bracketSize);

  // Add some rivets/nails
  ctx.fillStyle = '#2a2a2a';
  const rivetPositions = [
    [15, 15], [241, 15], [15, 241], [241, 241],
    [128, 32], [128, 96], [128, 160], [128, 224]
  ];

  rivetPositions.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// === HELPER FUNCTION FOR DOOR TEXTURE ===
function createDoorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base wood color (dark oak)
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(0, 0, 256, 256);

  // Wood grain (vertical planks)
  for (let x = 0; x < 256; x += 40) {
    ctx.strokeStyle = '#2a1b0f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();

    // Add wood grain lines
    for (let y = 0; y < 256; y += 20) {
      const offset = Math.random() * 10;
      ctx.strokeStyle = `rgba(42, 27, 15, ${Math.random() * 0.5 + 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + offset, y + 15);
      ctx.stroke();
    }
  }

  // Add metal bands
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 30, 256, 8);
  ctx.fillRect(0, 128, 256, 8);
  ctx.fillRect(0, 220, 256, 8);

  // Add rivets
  ctx.fillStyle = '#2a2a2a';
  for (let x = 20; x < 256; x += 40) {
    ctx.beginPath();
    ctx.arc(x, 34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, 132, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, 224, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// === HELPER FUNCTIONS ===
function createDoorFrame(x, z, doorSize) {
  const frameGeo = new THREE.BoxGeometry(doorSize, 3.5, 0.3);
  const frameMat = new THREE.MeshStandardMaterial({
    map: createDoorTexture(),
    roughness: 0.8,
    metalness: 0.3,
    color: 0xffffff
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(x, 1.75, z - 0.2);
  frame.castShadow = false;
  scene.add(frame);
  currentRoom.sceneObjs.push(frame);

  // Add collision for the door to make it solid
  const min = new THREE.Vector3(x - doorSize / 2, 1.75 - 3.5 / 2, z - 0.2 - 0.3 / 2);
  const max = new THREE.Vector3(x + doorSize / 2, 1.75 + 3.5 / 2, z - 0.2 + 0.3 / 2);
  world.walls.push({ min, max, mesh: frame });
}

function createObstacles(count, roomSize, spawnZones) {
  const obstacles = []; // Track obstacle positions for spawn checking
  const minSpacing = 3.0; // Minimum distance between obstacles
  
  for (let i = 0; i < count; i++) {
    const boxSize = 0.8 + Math.random() * 0.6;
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxMat = new THREE.MeshStandardMaterial({
      map: createBoxTexture(),
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.castShadow = true;
    
    // Try to find a valid position (not too close to other obstacles)
    let validPosition = false;
    let attempts = 0;
    let rx, rz;
    
    while (!validPosition && attempts < 50) {
      // Pick a random spawn zone
      const zone = spawnZones[Math.floor(Math.random() * spawnZones.length)];
      
      // Place obstacle within the chosen zone
      rx = zone.minX + Math.random() * (zone.maxX - zone.minX);
      rz = zone.minZ + Math.random() * (zone.maxZ - zone.minZ);
      
      // Check distance to all other obstacles
      validPosition = true;
      for (const obs of obstacles) {
        const obsCenter = new THREE.Vector3(
          (obs.min.x + obs.max.x) / 2,
          0,
          (obs.min.z + obs.max.z) / 2
        );
        const distance = Math.sqrt((rx - obsCenter.x) ** 2 + (rz - obsCenter.z) ** 2);
        
        if (distance < minSpacing) {
          validPosition = false;
          break;
        }
      }
      
      attempts++;
    }
    
    // If we couldn't find a valid position after 50 tries, skip this obstacle
    if (!validPosition) continue;
    
    box.position.set(rx, boxSize / 2, rz);
    
    scene.add(box);
    currentRoom.sceneObjs.push(box);
    
    const min = new THREE.Vector3(rx - boxSize / 2, 0, rz - boxSize / 2);
    const max = new THREE.Vector3(rx + boxSize / 2, boxSize, rz + boxSize / 2);
    world.walls.push({ min, max, mesh: box });
    
    // Store for enemy spawn checking
    obstacles.push({ min, max });
  }
  
  // Export obstacles for enemy spawning
  currentRoom.obstacles = obstacles;
}

function createWallSegment(x, y, z, width, height, depth, mat) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const m = mat.clone();
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  currentRoom.sceneObjs.push(mesh);

  const min = new THREE.Vector3(x - width / 2, y - height / 2, z - depth / 2);
  const max = new THREE.Vector3(x + width / 2, y + height / 2, z + depth / 2);
  world.walls.push({ min, max, mesh });
}