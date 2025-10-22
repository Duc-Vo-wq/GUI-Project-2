// main.js
import { createPlayerObject, initPointerLock, applyLookRotation, setLook } from './camera.js';
import { createPlayerState, updateMovement } from './movement.js';
import { initRooms, buildRoom, clearCurrentRoom, world, ROOM_SIZE } from './rooms.js';

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
  
  console.log('Renderer created');

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // === PLAYER STATE ===
  const player = {
    pos: new THREE.Vector3(0, 1.6, 0),
    velocity: new THREE.Vector3(),
    speed: 4.0,
    jumpSpeed: 6.0,
    radius: 0.25,
    onGround: false,
    health: 100,
    maxHealth: 100,
    alive: true,
    score: 0,
    kills: 0
  };

  const playerObject = createPlayerObject(player.pos.clone());
  scene.add(playerObject);
  playerObject.add(camera);
  camera.position.set(0, 0, 0);

  initPointerLock(renderer.domElement);
  const playerState = createPlayerState();

  // === GAME STATE ===
  let currentRoomIndex = 1;
  let enemies = [];
  let projectiles = [];
  let particleEffects = [];
  let gameRunning = true;

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

  // Point light that follows player
  const playerLight = new THREE.PointLight(0x6688ff, 0.6, 8);
  playerLight.position.copy(player.pos);
  scene.add(playerLight);
  
  console.log('Lights added');

  // === ENEMY CLASS ===
  class Enemy {
    constructor(position, roomIndex) {
      this.health = 30 + roomIndex * 5;
      this.maxHealth = this.health;
      this.speed = 1.2 + roomIndex * 0.1;
      this.damage = 10 + roomIndex * 2;
      this.attackCooldown = 0;
      this.hitCooldown = 0;
      
      const geometry = new THREE.BoxGeometry(0.6, 1.2, 0.6);
      this.mesh = new THREE.Mesh(geometry, enemyMat.clone());
      this.mesh.position.copy(position);
      this.mesh.castShadow = true;
      scene.add(this.mesh);
      
      // Health bar
      this.createHealthBar();
    }
    
    createHealthBar() {
      const barWidth = 0.8;
      const barHeight = 0.1;
      const barGeo = new THREE.PlaneGeometry(barWidth, barHeight);
      
      this.healthBarBg = new THREE.Mesh(barGeo, 
        new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide }));
      this.healthBarBg.position.set(0, 0.8, 0);
      this.mesh.add(this.healthBarBg);
      
      this.healthBarFg = new THREE.Mesh(barGeo,
        new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }));
      this.healthBarFg.position.set(0, 0.8, 0.01);
      this.mesh.add(this.healthBarFg);
    }
    
    update(delta) {
      if (this.hitCooldown > 0) this.hitCooldown -= delta;
      if (this.attackCooldown > 0) this.attackCooldown -= delta;
      
      // Update health bar
      const healthPercent = this.health / this.maxHealth;
      this.healthBarFg.scale.x = healthPercent;
      this.healthBarFg.position.x = -0.4 * (1 - healthPercent);
      
      // Billboard health bar to face camera
      this.healthBarBg.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      this.healthBarFg.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      
      // AI: Move toward player
      const toPlayer = new THREE.Vector3().subVectors(player.pos, this.mesh.position);
      const dist = toPlayer.length();
      
      if (dist > 1.5) {
        // Move toward player
        toPlayer.y = 0;
        toPlayer.normalize();
        const movement = toPlayer.multiplyScalar(this.speed * delta);
        
        const newPos = this.mesh.position.clone().add(movement);
        if (!checkCollisionWithWalls(newPos, 0.3)) {
          this.mesh.position.copy(newPos);
        }
      } else if (dist < 1.5 && this.attackCooldown <= 0 && player.alive) {
        // Attack player
        this.attack();
      }
    }
    
    attack() {
      this.attackCooldown = 1.5;
      damagePlayer(this.damage);
      
      // Visual feedback
      this.mesh.material.emissive.setHex(0xff0000);
      setTimeout(() => {
        if (this.mesh.material) this.mesh.material.emissive.setHex(0x440000);
      }, 200);
    }
    
    takeDamage(amount) {
      if (this.hitCooldown > 0) return false;
      
      this.health -= amount;
      this.hitCooldown = 0.1;
      
      // Flash white
      this.mesh.material.emissive.setHex(0xffffff);
      setTimeout(() => {
        if (this.mesh.material) this.mesh.material.emissive.setHex(0x440000);
      }, 100);
      
      if (this.health <= 0) {
        this.die();
        return true;
      }
      return false;
    }
    
    die() {
      createParticleExplosion(this.mesh.position, 0xff3333);
      scene.remove(this.mesh);
      player.kills++;
      player.score += 100;
      updateUI();
    }
  }

  // === PROJECTILE CLASS ===
  class Projectile {
    constructor(position, direction) {
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      this.mesh = new THREE.Mesh(geometry, projectileMat.clone());
      this.mesh.position.copy(position);
      this.mesh.castShadow = true;
      scene.add(this.mesh);
      
      this.velocity = direction.normalize().multiplyScalar(20);
      this.lifetime = 3;
      this.damage = 25;
      
      // Add glow
      const light = new THREE.PointLight(0xffaa00, 0.5, 3);
      this.mesh.add(light);
    }
    
    update(delta) {
      this.lifetime -= delta;
      if (this.lifetime <= 0) return false;
      
      const movement = this.velocity.clone().multiplyScalar(delta);
      this.mesh.position.add(movement);
      
      // Check collision with walls
      if (checkCollisionWithWalls(this.mesh.position, 0.1)) {
        createParticleExplosion(this.mesh.position, 0xffff00);
        scene.remove(this.mesh);
        return false;
      }
      
      // Check collision with enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dist = this.mesh.position.distanceTo(enemy.mesh.position);
        if (dist < 0.5) {
          if (enemy.takeDamage(this.damage)) {
            enemies.splice(i, 1);
            checkRoomComplete();
          }
          createParticleExplosion(this.mesh.position, 0xffaa00);
          scene.remove(this.mesh);
          return false;
        }
      }
      
      return true;
    }
  }

  // === PARTICLE EFFECTS ===
  function createParticleExplosion(position, color) {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.05, 4, 4);
      const material = new THREE.MeshBasicMaterial({ color });
      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);
      scene.add(particle);
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 3,
        (Math.random() - 0.5) * 3
      );
      
      particleEffects.push({
        mesh: particle,
        velocity,
        lifetime: 0.5,
        maxLifetime: 0.5
      });
    }
  }

  function updateParticles(delta) {
    for (let i = particleEffects.length - 1; i >= 0; i--) {
      const p = particleEffects[i];
      p.lifetime -= delta;
      
      if (p.lifetime <= 0) {
        scene.remove(p.mesh);
        particleEffects.splice(i, 1);
        continue;
      }
      
      p.velocity.y -= 5 * delta; // Gravity
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      
      const alpha = p.lifetime / p.maxLifetime;
      p.mesh.scale.setScalar(alpha);
    }
  }

  // === COLLISION DETECTION ===
  function checkCollisionWithWalls(position, radius) {
    for (const wall of world.walls) {
      if (aabbSphereCollision(wall.min, wall.max, position, radius)) {
        return true;
      }
    }
    return false;
  }

  function aabbSphereCollision(boxMin, boxMax, sphereCenter, sphereRadius) {
    const closestPoint = new THREE.Vector3(
      Math.max(boxMin.x, Math.min(sphereCenter.x, boxMax.x)),
      Math.max(boxMin.y, Math.min(sphereCenter.y, boxMax.y)),
      Math.max(boxMin.z, Math.min(sphereCenter.z, boxMax.z))
    );
    const dist = sphereCenter.distanceTo(closestPoint);
    return dist < sphereRadius;
  }

  // === SHOOTING ===
  let canShoot = true;
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && canShoot && player.alive && document.pointerLockElement) {
      shoot();
      canShoot = false;
      setTimeout(() => canShoot = true, 250); // Fire rate
    }
  });

  function shoot() {
    const shootOrigin = camera.getWorldPosition(new THREE.Vector3());
    const shootDir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    
    projectiles.push(new Projectile(shootOrigin, shootDir));
    
    // Muzzle flash
    createParticleExplosion(shootOrigin.add(shootDir.multiplyScalar(0.3)), 0xffaa00);
  }

  // === ENEMY SPAWNING ===
  function spawnEnemies(count, roomIndex) {
    enemies = [];
    const half = ROOM_SIZE / 2;
    
    for (let i = 0; i < count; i++) {
      let position;
      let attempts = 0;
      do {
        position = new THREE.Vector3(
          (Math.random() - 0.5) * ROOM_SIZE * 0.7,
          0.6,
          (Math.random() - 0.5) * ROOM_SIZE * 0.7
        );
        attempts++;
      } while (position.distanceTo(player.pos) < 3 && attempts < 20);
      
      enemies.push(new Enemy(position, roomIndex));
    }
    updateUI();
  }

  // === PLAYER DAMAGE ===
  function damagePlayer(amount) {
    if (!player.alive) return;
    
    player.health -= amount;
    if (player.health <= 0) {
      player.health = 0;
      player.alive = false;
      gameOver();
    }
    
    // Screen flash effect
    scene.background.setHex(0x330000);
    setTimeout(() => scene.background.setHex(0x0b0f1a), 100);
    
    updateUI();
  }

  // === ROOM PROGRESSION ===
  function checkRoomComplete() {
    if (enemies.length === 0 && gameRunning) {
      // Room cleared!
      player.score += 500 * currentRoomIndex;
      updateUI();
      
      // Show "Room Cleared" message
      const msg = document.getElementById('roomClearedMsg');
      if (msg) {
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 1500);
      }
      
      setTimeout(() => {
        if (currentRoomIndex >= 5) {
          gameWin();
        } else {
          nextRoom();
        }
      }, 2000);
    }
  }

  function nextRoom() {
    currentRoomIndex++;
    clearProjectiles();
    buildRoom(currentRoomIndex);
    playerObject.position.copy(player.pos);
    player.health = Math.min(player.maxHealth, player.health + 20); // Heal between rooms
    updateUI();
  }

  function clearProjectiles() {
    projectiles.forEach(p => scene.remove(p.mesh));
    projectiles = [];
  }

  // === UI UPDATES ===
  function updateUI() {
    const health = Math.max(0, player.health);
    document.getElementById('health').textContent = health;
    document.getElementById('room').textContent = currentRoomIndex;
    document.getElementById('enemiesCount').textContent = enemies.length;
    document.getElementById('score').textContent = player.score;
    
    // Update health bar
    const healthPercent = (health / player.maxHealth) * 100;
    const healthBar = document.getElementById('healthBar');
    if (healthBar) {
      healthBar.style.width = healthPercent + '%';
    }
  }

  // === GAME OVER / WIN ===
  function gameOver() {
    gameRunning = false;
    const overlay = document.getElementById('overlay');
    const gameOverDiv = document.getElementById('gameOver');
    const title = document.getElementById('gameOverTitle');
    
    title.textContent = 'Game Over';
    title.classList.remove('win');
    
    document.getElementById('gameOverText').textContent = 
      `You died on room ${currentRoomIndex}. Score: ${player.score} | Kills: ${player.kills}`;
    
    if (overlay) overlay.classList.add('active');
    if (gameOverDiv) gameOverDiv.style.display = 'block';
  }

  function gameWin() {
    gameRunning = false;
    const overlay = document.getElementById('overlay');
    const gameOverDiv = document.getElementById('gameOver');
    const title = document.getElementById('gameOverTitle');
    
    title.textContent = 'Victory!';
    title.classList.add('win');
    
    document.getElementById('gameOverText').textContent = 
      `You cleared all rooms! Final Score: ${player.score} | Total Kills: ${player.kills}`;
    
    if (overlay) overlay.classList.add('active');
    if (gameOverDiv) gameOverDiv.style.display = 'block';
  }

  // === RESET GAME ===
  function resetGame() {
    gameRunning = true;
    currentRoomIndex = 1;
    player.health = player.maxHealth;
    player.alive = true;
    player.score = 0;
    player.kills = 0;
    
    enemies.forEach(e => scene.remove(e.mesh));
    enemies = [];
    clearProjectiles();
    particleEffects.forEach(p => scene.remove(p.mesh));
    particleEffects = [];
    
    const overlay = document.getElementById('overlay');
    const gameOverDiv = document.getElementById('gameOver');
    if (overlay) overlay.classList.remove('active');
    if (gameOverDiv) gameOverDiv.style.display = 'none';
    
    setLook(0, 0); // Reset camera look
    buildRoom(1);
    playerObject.position.copy(player.pos);
    updateUI();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      resetGame();
    }
  });

  document.getElementById('restartBtn').addEventListener('click', resetGame);

  // === INITIALIZE ROOMS ===
  initRooms({
    scene,
    floorMaterial: floorMat,
    camera,
    player,
    spawnEnemies
  });

  buildRoom(1);
  playerObject.position.copy(player.pos);
  updateUI();
  
  console.log('Room built, starting animation loop');

  // === ANIMATION LOOP ===
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(0.05, clock.getDelta());
    
    if (!gameRunning) {
      renderer.render(scene, camera);
      return;
    }
    
    // Update movement
    updateMovement(playerObject, playerState, camera, scene, delta);
    player.pos.copy(playerObject.position);
    
    // Update player light
    playerLight.position.copy(player.pos);
    
    // Apply camera rotation
    applyLookRotation(playerObject, camera);
    
    // Update enemies
    enemies.forEach(enemy => enemy.update(delta));
    
    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!projectiles[i].update(delta)) {
        projectiles.splice(i, 1);
      }
    }
    
    // Update particles
    updateParticles(delta);
    
    renderer.render(scene, camera);
  }

  animate();
  console.log('Game started!');

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