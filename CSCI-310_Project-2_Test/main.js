// js/main.js
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';
import { createPlayerObject, initPointerLock, applyLookRotation } from './camera.js';
import { createPlayerState, updateMovement } from './movement.js';
import { initRooms, buildRoom, clearCurrentRoom, world, ROOM_SIZE } from './rooms.js';

// --- basic setup (your existing code) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

// --- Player state (create the object rooms.js expects) ---
const player = {
  pos: new THREE.Vector3(0, 1.6, 0),
  velocity: new THREE.Vector3(),
  speed: 4.0,
  jumpSpeed: 6.0,
  radius: 0.25,
  onGround: false,
  health: 100,
  alive: true
};

// create playerObject and attach camera (visual / transform)
const playerObject = createPlayerObject(player.pos.clone()); // create at same position
scene.add(playerObject);
playerObject.add(camera);
camera.position.set(0, 0, 0);

initPointerLock(renderer.domElement);
const playerState = createPlayerState(); // movement module state (if different from `player`)

// simple floor for collisions (so raycast hits)
const floorMat = new THREE.MeshStandardMaterial({ color: 0x22272f });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Initialize rooms module with required dependencies (pass the `player` object)
initRooms({
  scene,
  floorMaterial: floorMat,
  camera,
  player,
  // spawnEnemies: optional callback if you have one
});

// Build the first room and sync positions
buildRoom(1);
playerObject.position.copy(player.pos);

// --- animation / update loop ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, clock.getDelta());

  // Update movement: pass the object used by movement module (playerObject) and playerState
  updateMovement(playerObject, playerState, camera, scene, delta);

  // Movement module likely updates playerObject.position; keep player.pos in sync
  // If your movement module updates playerState.velocity and playerObject, mirror to player.pos
  player.pos.copy(playerObject.position);

  // Apply camera rotation from pointer-lock (yaw/pitch stored in camera module)
  applyLookRotation(playerObject, camera);

  renderer.render(scene, camera);
}

// Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);
animate();

// --- resize handler ---
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});