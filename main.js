// main.js - Main entry point and game loop
import { createPlayerObject, initPointerLock, applyLookRotation } from './camera.js';
import { createPlayerState, updateMovement } from './movement.js';
import { initRooms, buildRoom } from './rooms.js';
import { updateUI } from './ui.js';
import { enemies } from './enemies.js';
import { projectiles } from './projectiles.js';
import { treasureChests } from './items.js';
import { updateParticles } from './particles.js';
import { initShooting } from './combat.js';
import { spawnEnemies } from './spawn.js';
import { gameState, resetGame, showStartScreen, damagePlayer, checkRoomComplete, togglePause, returnToMainMenu } from './gameState.js';
import { updateTutorial, isTutorialActive } from './tutorial.js';

console.log('main.js loaded');

// Wait for THREE to be available
function initGame() {
  if (typeof THREE === 'undefined') {
    console.error('THREE.js not loaded yet, retrying...');
    setTimeout(initGame, 100);
    return;
  }
  
  console.log('THREE.js loaded, initializing game...');

  // === SCENE SETUP ===
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1a);
  scene.fog = new THREE.Fog(0x0b0f1a, 1, 30);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  
  // Store references on canvas for cleanup
  renderer.domElement.scene = scene;
  renderer.domElement.player = null; // Will be set after player is created
  renderer.domElement.playerObject = null;
  
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // === PLAYER STATE ===
  const player = {
    pos: new THREE.Vector3(0, 1.2, 0),
    velocity: new THREE.Vector3(),
    speed: 4.0,
    jumpSpeed: 6.0,
    radius: 0.25,
    onGround: false,
    health: 100,
    maxHealth: 100,
    alive: true,
    score: 0,
    kills: 0,
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealthBonus: 0
  };

  const playerObject = createPlayerObject(player.pos.clone());
  scene.add(playerObject);
  playerObject.add(camera);
  
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.quaternion.set(0, 0, 0, 1);
  
  // Store references for cleanup
  renderer.domElement.player = player;
  renderer.domElement.playerObject = playerObject;

  initPointerLock(renderer.domElement);
  const playerState = createPlayerState();
  
  // Set initial camera look direction
  import('./camera.js').then(({ setLook }) => {
    setLook(185.34, 0);
  });

  // === MATERIALS ===
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x22272f,
    roughness: 0.8,
    metalness: 0.2
  });

  const enemyMat = new THREE.MeshStandardMaterial({ 
    color: 0xff3333,
    emissive: 0x440000,
    roughness: 0.6
  });

  const projectileMat = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8
  });

  const treasureMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xaa8800,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2
  });

  // === LIGHTING ===
  const ambient = new THREE.AmbientLight(0x404866, 0.4);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);

  const playerLight = new THREE.PointLight(0x6688ff, 0.6, 8);
  playerLight.position.copy(player.pos);
  scene.add(playerLight);

  // === DAMAGE PLAYER WRAPPER ===
  const damagePlayerWrapper = (amount) => damagePlayer(player, scene, amount);

  // === INITIALIZE SYSTEMS ===
  initRooms({
    scene,
    floorMaterial: floorMat,
    camera,
    player,
    spawnEnemies: (count, roomIndex) => spawnEnemies(
      scene, count, roomIndex, enemyMat, camera, player, treasureMat, damagePlayerWrapper
    )
  });

  initShooting(renderer, camera, playerObject, player, projectileMat, () => gameState.gameRunning);

  // === CONTROLS ===
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      if (gameState.gameStarted) {
        resetGame(player, scene, playerObject);
      }
    }
    if (e.code === 'Tab') {
      togglePause();
      e.preventDefault(); // Prevent tab from switching focus
    }
  });

  document.getElementById('restartBtn').addEventListener('click', () => resetGame(player, scene, playerObject));

  // === INITIALIZE ===
  updateUI(player, gameState.currentRoomIndex, enemies.length);
  showStartScreen(player, playerObject, renderer, camera);

  // === ANIMATION LOOP ===
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(0.05, clock.getDelta());
    
    // Render scene even when paused, but don't update game logic
    if (!gameState.gameRunning || gameState.gamePaused) {
      renderer.render(scene, camera);
      return;
    }
    
    // Update movement
    updateMovement(playerObject, playerState, camera, scene, delta);
    player.pos.copy(playerObject.position);
    
    // Apply camera rotation
    applyLookRotation(playerObject, camera);
    
    // Update player light
    playerLight.position.copy(playerObject.position);
    
    // Update projectiles BEFORE tutorial check (so bullets work in tutorial)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      let shouldRemove = false;
      
      if (proj.isPlayerProjectile) {
        shouldRemove = !proj.update(
          delta, scene, enemies, 
          () => checkRoomComplete(player, playerObject),
          () => updateUI(player, gameState.currentRoomIndex, enemies.length)
        );
      } else {
        shouldRemove = !proj.update(delta, scene, player, damagePlayerWrapper);
      }
      
      if (shouldRemove) {
        projectiles.splice(i, 1);
      }
    }
    
    // Update particles (needs to run in tutorial too!)
    updateParticles(scene, delta);
    
    // Update tutorial if active (checks for button hits)
    updateTutorial(scene, delta, projectiles, () => {
      buildRoom(1);
      playerObject.position.copy(player.pos);
      updateUI(player, gameState.currentRoomIndex, enemies.length);
    });
    
    // Skip other updates if in tutorial (no enemies or treasures)
    if (isTutorialActive()) {
      renderer.render(scene, camera);
      return;
    }
    
    // Update enemies
    enemies.forEach(enemy => enemy.update(delta));
    
    // Update treasure chests
    for (let i = treasureChests.length - 1; i >= 0; i--) {
      treasureChests[i].update(
        delta, player, scene,
        () => updateUI(player, gameState.currentRoomIndex, enemies.length)
      );
      if (treasureChests[i].opened) {
        treasureChests.splice(i, 1);
      }
    }
    
    renderer.render(scene, camera);
  }

  animate();

  // === RESIZE HANDLER ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Start game when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}