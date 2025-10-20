// js/rooms.js
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';

// Exports:
// initRooms({ scene, floorMat, camera, player, spawnEnemies? })
// buildRoom(index)
// clearCurrentRoom()
// world  (simple collision AABB array)
// ROOM_SIZE constant

export const ROOM_SIZE = 12;
export const WALL_THICKNESS = 1;

export const world = { walls: [] }; // AABB walls for collision: {min:Vector3, max:Vector3, mesh?}

let roomIndex = 1;
export let currentRoom = { enemies: [], sceneObjs: [] };

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
  // optional: update a UI element if present
  const roomEl = document.getElementById('room');
  if (roomEl) roomEl.textContent = roomIndex;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  currentRoom.sceneObjs.push(floorMesh);

  // Walls and door frame
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x444a56 });
  const half = ROOM_SIZE / 2;
  const w = WALL_THICKNESS;

  // Door visual frame on +Z
  const doorSize = 2;
  const frameGeo = new THREE.BoxGeometry(doorSize, 3, 0.2);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 1.5, half - 0.2);
  scene.add(frame);
  currentRoom.sceneObjs.push(frame);

  // Random crates + AABBs
  for (let i = 0; i < 4; i++) {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.castShadow = true;
    const rx = (Math.random() * ROOM_SIZE - ROOM_SIZE / 2) * 0.6;
    const rz = (Math.random() * ROOM_SIZE - ROOM_SIZE / 2) * 0.6;
    box.position.set(rx, 0.5, rz);
    scene.add(box);
    currentRoom.sceneObjs.push(box);
    const min = new THREE.Vector3(rx - 0.5, 0, rz - 0.5);
    const max = new THREE.Vector3(rx + 0.5, 1, rz + 0.5);
    world.walls.push({ min, max, mesh: box });
  }

  // Build wall segments (leave gap at +Z center for door)
  const halfDoor = doorSize / 2;
  createWallSegment(-half + (ROOM_SIZE - doorSize) / 4, 1.5, half + w / 2, (ROOM_SIZE - doorSize - 0.8) / 2, 3, w, wallMat); // left side
  createWallSegment(half - (ROOM_SIZE - doorSize) / 4, 1.5, half + w / 2, (ROOM_SIZE - doorSize - 0.8) / 2, 3, w, wallMat); // right side
  // full -Z wall
  createWallSegment(0, 1.5, -half - w / 2, ROOM_SIZE, 3, w, wallMat);
  // full +/- X walls
  createWallSegment(half + w / 2, 1.5, 0, w, 3, ROOM_SIZE + w * 2, wallMat);
  createWallSegment(-half - w / 2, 1.5, 0, w, 3, ROOM_SIZE + w * 2, wallMat);

  // Player starting position just inside -Z
  player.pos.set(0, 1.6, -half + 1.2);
  // If camera is attached to playerObject, you probably want to set playerObject position instead;
  // this file assumes caller syncs playerObject/camera as needed after buildRoom.
  if (camera) camera.position.copy(player.pos);

  // Spawn enemies (if callback provided)
  if (typeof spawnEnemiesCb === 'function') {
    spawnEnemiesCb(Math.min(1 + Math.floor(index * 0.8), 12), index);
  }
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