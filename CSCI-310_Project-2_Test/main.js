// main.js
import { createPlayerObject, initPointerLock, applyLookRotation, setLook } from './camera.js';
import { createPlayerState, updateMovement } from './movement.js';
import { initRooms, buildRoom, clearCurrentRoom, world, ROOM_SIZE, currentRoom } from './rooms.js';

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
    pos: new THREE.Vector3(0, 1.2, 0),  // Lowered from 1.6 to 1.2
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
    // Upgrade stats
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealthBonus: 0
  };

  const playerObject = createPlayerObject(player.pos.clone());
  scene.add(playerObject);
  playerObject.add(camera);
  
  // Camera must be at exact origin with no rotation or offset
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.quaternion.set(0, 0, 0, 1);

  initPointerLock(renderer.domElement);
  const playerState = createPlayerState();
  
  // Set initial camera look direction (your preferred starting angle)
  setLook(185.34, 0); // yaw=185.34 (facing forward in your scene), pitch=0 (level)

  // === GAME STATE ===
  let currentRoomIndex = 1;
  let enemies = [];
  let projectiles = [];
  let particleEffects = [];
  let treasureChests = [];
  let gameRunning = true;
  const totalRooms = 10; // Increased from 5
  const bossRoom = 10;

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

  // Point light that follows player
  const playerLight = new THREE.PointLight(0x6688ff, 0.6, 8);
  playerLight.position.copy(player.pos);
  scene.add(playerLight);
  
  console.log('Lights added');

  // === ENEMY CLASS ===
  class Enemy {
    constructor(position, roomIndex, type = 'normal') {
      this.type = type;
      this.setupStats(roomIndex, type);
      
      const geometry = this.getGeometry(type);
      const material = this.getMaterial(type);
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(position);
      this.mesh.castShadow = true;
      scene.add(this.mesh);
      
      // Store original emissive color for damage flash
      this.originalEmissive = this.mesh.material.emissive.getHex();
      
      // Health bar
      this.createHealthBar();
    }
    
    setupStats(roomIndex, type) {
      switch(type) {
        case 'fast':
          this.health = 20 + roomIndex * 3;
          this.maxHealth = this.health;
          this.speed = 2.5 + roomIndex * 0.15;
          this.damage = 5 + roomIndex;
          break;
        case 'tank':
          this.health = 60 + roomIndex * 10;
          this.maxHealth = this.health;
          this.speed = 0.8 + roomIndex * 0.05;
          this.damage = 15 + roomIndex * 3;
          break;
        case 'boss':
          this.health = 200 + roomIndex * 50;
          this.maxHealth = this.health;
          this.speed = 1.5;
          this.damage = 20;
          this.canShoot = true;
          this.shootCooldown = 0;
          break;
        default: // normal
          this.health = 30 + roomIndex * 5;
          this.maxHealth = this.health;
          this.speed = 1.2 + roomIndex * 0.1;
          this.damage = 10 + roomIndex * 2;
      }
      this.attackCooldown = 0;
      this.hitCooldown = 0;
    }
    
    getGeometry(type) {
      switch(type) {
        case 'fast':
          return new THREE.BoxGeometry(0.4, 0.8, 0.4);
        case 'tank':
          return new THREE.BoxGeometry(0.9, 1.5, 0.9);
        case 'boss':
          return new THREE.BoxGeometry(1.5, 2.5, 1.5);
        default:
          return new THREE.BoxGeometry(0.6, 1.2, 0.6);
      }
    }
    
    getMaterial(type) {
      const materials = {
        fast: new THREE.MeshStandardMaterial({ 
          color: 0xff6633, emissive: 0x442200, roughness: 0.6 
        }),
        tank: new THREE.MeshStandardMaterial({ 
          color: 0x666666, emissive: 0x000044, roughness: 0.8, metalness: 0.5 
        }),
        boss: new THREE.MeshStandardMaterial({ 
          color: 0x8800ff, emissive: 0x440088, roughness: 0.4, metalness: 0.3 
        }),
        normal: enemyMat.clone()
      };
      return materials[type] || materials.normal;
    }
    
    createHealthBar() {
      const barWidth = 0.8;
      const barHeight = 0.12;
      
      // Container for both bars to keep them grouped
      this.healthBarContainer = new THREE.Group();
      this.healthBarContainer.position.set(0, 0.9, 0);
      this.mesh.add(this.healthBarContainer);
      
      // Background (dark red)
      const barGeo = new THREE.PlaneGeometry(barWidth, barHeight);
      this.healthBarBg = new THREE.Mesh(barGeo, 
        new THREE.MeshBasicMaterial({ 
          color: 0x220000,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        }));
      this.healthBarBg.renderOrder = 999; // Render on top
      this.healthBarContainer.add(this.healthBarBg);
      
      // Foreground (bright red) - positioned slightly forward to avoid z-fighting
      this.healthBarFg = new THREE.Mesh(barGeo,
        new THREE.MeshBasicMaterial({ 
          color: 0xff0000,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        }));
      this.healthBarFg.position.z = 0.001; // Slight offset to always render in front
      this.healthBarFg.renderOrder = 1000; // Render on top of background
      this.healthBarContainer.add(this.healthBarFg);
      
      // Start hidden - will show on first damage
      this.healthBarContainer.visible = false;
    }
    
    update(delta) {
      if (this.hitCooldown > 0) this.hitCooldown -= delta;
      if (this.attackCooldown > 0) this.attackCooldown -= delta;
      if (this.shootCooldown) this.shootCooldown -= delta;
      
      // Show health bar only if damaged
      const isDamaged = this.health < this.maxHealth;
      this.healthBarContainer.visible = isDamaged;
      
      if (isDamaged) {
        // Update health bar scale
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFg.scale.x = healthPercent;
        
        // Adjust position so it scales from the left edge
        const barWidth = 0.8;
        this.healthBarFg.position.x = -(barWidth / 2) * (1 - healthPercent);
        
        // Billboard the entire container to face camera
        this.healthBarContainer.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      }
      
      // AI: Move toward player
      const toPlayer = new THREE.Vector3().subVectors(player.pos, this.mesh.position);
      const dist = toPlayer.length();
      
      // Boss can shoot from distance
      if (this.type === 'boss' && dist > 3 && dist < 15 && this.shootCooldown <= 0) {
        this.shootAtPlayer();
        this.shootCooldown = 2.0;
      }
      
      const attackRange = this.type === 'tank' ? 2.0 : 1.5;
      
      if (dist > attackRange) {
        // Move toward player
        toPlayer.y = 0;
        toPlayer.normalize();
        const movement = toPlayer.multiplyScalar(this.speed * delta);
        
        const newPos = this.mesh.position.clone().add(movement);
        if (!checkCollisionWithWalls(newPos, 0.3)) {
          this.mesh.position.copy(newPos);
        }
      } else if (dist < attackRange && this.attackCooldown <= 0 && player.alive) {
        // Attack player
        this.attack();
      }
    }
    
    shootAtPlayer() {
      const shootOrigin = this.mesh.position.clone();
      shootOrigin.y += 1.0; // Shoot from center height
      const shootDir = new THREE.Vector3().subVectors(player.pos, shootOrigin).normalize();
      
      // Create enemy projectile
      const enemyProj = new EnemyProjectile(shootOrigin, shootDir);
      projectiles.push(enemyProj);
    }
    
    attack() {
      this.attackCooldown = 1.5;
      damagePlayer(this.damage);
      
      // Visual feedback - flash red
      this.mesh.material.emissive.setHex(0xff0000);
      setTimeout(() => {
        if (this.mesh.material) this.mesh.material.emissive.setHex(this.originalEmissive);
      }, 200);
    }
    
    takeDamage(amount) {
      if (this.hitCooldown > 0) return false;
      
      this.health -= amount;
      this.hitCooldown = 0.1;
      
      // Flash white and return to original color
      this.mesh.material.emissive.setHex(0xffffff);
      setTimeout(() => {
        if (this.mesh.material) {
          this.mesh.material.emissive.setHex(this.originalEmissive);
        }
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
      this.damage = 25 * player.damageMultiplier;
      this.isPlayerProjectile = true;
      
      // Add glow
      const light = new THREE.PointLight(0xffaa00, 0.5, 3);
      this.mesh.add(light);
    }
    
    update(delta) {
      this.lifetime -= delta;
      if (this.lifetime <= 0) return false;
      
      const movement = this.velocity.clone().multiplyScalar(delta);
      this.mesh.position.add(movement);
      
      // Check collision with walls (but not for first 0.1 seconds to avoid spawning inside player)
      if (this.lifetime < 2.9 && checkCollisionWithWalls(this.mesh.position, 0.1)) {
        createParticleExplosion(this.mesh.position, 0xffff00);
        scene.remove(this.mesh);
        return false;
      }
      
      // Check collision with enemies (only for player projectiles)
      if (this.isPlayerProjectile) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i];
          const dist = this.mesh.position.distanceTo(enemy.mesh.position);
          if (dist < 0.5) {
            const killed = enemy.takeDamage(this.damage);
            if (killed) {
              enemies.splice(i, 1);
              updateUI(); // Update UI immediately when enemy dies
              checkRoomComplete();
            }
            createParticleExplosion(this.mesh.position, 0xffaa00);
            scene.remove(this.mesh);
            return false;
          }
        }
      }
      
      return true;
    }
  }

  // === ENEMY PROJECTILE CLASS ===
  class EnemyProjectile {
    constructor(position, direction) {
      const geometry = new THREE.SphereGeometry(0.12, 8, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.9
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(position);
      scene.add(this.mesh);
      
      this.velocity = direction.normalize().multiplyScalar(12);
      this.lifetime = 5;
      this.damage = 15;
      this.isPlayerProjectile = false;
      
      const light = new THREE.PointLight(0xff0000, 0.6, 3);
      this.mesh.add(light);
    }
    
    update(delta) {
      this.lifetime -= delta;
      if (this.lifetime <= 0) return false;
      
      const movement = this.velocity.clone().multiplyScalar(delta);
      this.mesh.position.add(movement);
      
      // Check collision with walls
      if (checkCollisionWithWalls(this.mesh.position, 0.1)) {
        createParticleExplosion(this.mesh.position, 0xff0000);
        scene.remove(this.mesh);
        return false;
      }
      
      // Check collision with player
      const dist = this.mesh.position.distanceTo(player.pos);
      if (dist < 0.5) {
        damagePlayer(this.damage);
        createParticleExplosion(this.mesh.position, 0xff0000);
        scene.remove(this.mesh);
        return false;
      }
      
      return true;
    }
  }

  // === TREASURE CHEST CLASS ===
  class TreasureChest {
    constructor(position) {
      const geometry = new THREE.BoxGeometry(0.6, 0.5, 0.4);
      this.mesh = new THREE.Mesh(geometry, treasureMat.clone());
      this.mesh.position.copy(position);
      this.mesh.position.y = 0.25;
      this.mesh.castShadow = true;
      scene.add(this.mesh);
      
      this.opened = false;
      
      // Add glow
      const light = new THREE.PointLight(0xffaa00, 0.8, 4);
      light.position.y = 0.5;
      this.mesh.add(light);
      
      // Bobbing animation
      this.bobTime = Math.random() * Math.PI * 2;
    }
    
    update(delta) {
      if (this.opened) return;
      
      // Bob up and down
      this.bobTime += delta * 2;
      this.mesh.position.y = 0.25 + Math.sin(this.bobTime) * 0.1;
      
      // Rotate slowly
      this.mesh.rotation.y += delta * 0.5;
      
      // Check if player is near
      const dist = this.mesh.position.distanceTo(player.pos);
      if (dist < 1.5) {
        this.open();
      }
    }
    
    open() {
      this.opened = true;
      
      // Visual feedback
      createParticleExplosion(this.mesh.position, 0xffd700);
      scene.remove(this.mesh);
      
      // Give reward
      const heal = 30;
      player.health = Math.min(player.maxHealth + player.maxHealthBonus, player.health + heal);
      player.score += 250;
      updateUI();
      
      // Show message
      showMessage('+30 Health!', 0x00ff00);
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
      const fireRate = 250 / player.fireRateMultiplier;
      setTimeout(() => canShoot = true, fireRate);
    }
  });

  function shoot() {
    const shootDir = new THREE.Vector3();
    camera.getWorldDirection(shootDir);
    
    // Spawn projectile in front of player to avoid self-collision
    const shootOrigin = playerObject.position.clone().add(shootDir.clone().multiplyScalar(0.5));
    
    projectiles.push(new Projectile(shootOrigin, shootDir));
    
    // Muzzle flash
    const flashPos = shootOrigin.clone().add(shootDir.clone().multiplyScalar(0.2));
    createParticleExplosion(flashPos, 0xffaa00);
  }

  // === MESSAGE SYSTEM ===
  function showMessage(text, color = 0xffffff) {
    const msgEl = document.getElementById('roomClearedMsg');
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.style.color = '#' + color.toString(16).padStart(6, '0');
      msgEl.classList.add('show');
      setTimeout(() => msgEl.classList.remove('show'), 2000);
    }
  }

  // === ENEMY SPAWNING ===
  function spawnEnemies(count, roomIndex) {
    enemies = [];
    
    // Boss room
    if (roomIndex === bossRoom) {
      const bossPos = new THREE.Vector3(0, 1.25, 0);
      enemies.push(new Enemy(bossPos, roomIndex, 'boss'));
      // Add some minions
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const pos = new THREE.Vector3(
          Math.cos(angle) * 5,
          0.6,
          Math.sin(angle) * 5
        );
        enemies.push(new Enemy(pos, roomIndex, 'normal'));
      }
      updateUI();
      showMessage('BOSS FIGHT!', 0xff00ff);
      return;
    }
    
    // Get spawn zones from current room
    const spawnZones = currentRoom.spawnZones || [];
    if (spawnZones.length === 0) {
      console.warn('No spawn zones defined for room');
      return;
    }
    
    // Normal rooms - mix of enemy types
    for (let i = 0; i < count; i++) {
      let position;
      let attempts = 0;
      let validPosition = false;
      
      do {
        // Pick a random spawn zone
        const zone = spawnZones[Math.floor(Math.random() * spawnZones.length)];
        
        // Generate position within this zone
        position = new THREE.Vector3(
          zone.minX + Math.random() * (zone.maxX - zone.minX),
          0.6,
          zone.minZ + Math.random() * (zone.maxZ - zone.minZ)
        );
        attempts++;
        
        // Check if position is valid (not in walls, not too close to player, not in obstacles)
        const tooCloseToPlayer = position.distanceTo(player.pos) < 4;
        const inWall = checkCollisionWithWalls(position, 0.5);
        
        validPosition = !tooCloseToPlayer && !inWall;
        
      } while (!validPosition && attempts < 50);
      
      // Skip this enemy if we couldn't find a valid position
      if (!validPosition) {
        console.warn('Could not find valid spawn position for enemy');
        continue;
      }
      
      // Determine enemy type based on room progression
      let type = 'normal';
      if (roomIndex >= 3) {
        const rand = Math.random();
        if (rand < 0.3) type = 'fast';
        else if (rand < 0.5) type = 'tank';
      }
      
      enemies.push(new Enemy(position, roomIndex, type));
    }
    
    // Spawn treasure chest (50% chance after room 2)
    if (roomIndex >= 2 && Math.random() < 0.5) {
      let chestPos;
      let attempts = 0;
      let validPosition = false;
      
      do {
        // Pick a random spawn zone
        const zone = spawnZones[Math.floor(Math.random() * spawnZones.length)];
        
        chestPos = new THREE.Vector3(
          zone.minX + Math.random() * (zone.maxX - zone.minX),
          0,
          zone.minZ + Math.random() * (zone.maxZ - zone.minZ)
        );
        attempts++;
        
        const tooCloseToPlayer = chestPos.distanceTo(player.pos) < 4;
        const inWall = checkCollisionWithWalls(chestPos, 0.4);
        
        validPosition = !tooCloseToPlayer && !inWall;
        
      } while (!validPosition && attempts < 50);
      
      if (validPosition) {
        treasureChests.push(new TreasureChest(chestPos));
      }
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
    
    // UI damage indicator - red tint
    const uiElement = document.getElementById('ui');
    if (uiElement) {
      uiElement.style.background = 'linear-gradient(135deg, rgba(150,0,0,0.9), rgba(100,0,20,0.9))';
      uiElement.style.borderColor = 'rgba(255, 50, 50, 0.8)';
      uiElement.style.transition = 'all 0.1s ease';
      
      setTimeout(() => {
        uiElement.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.7), rgba(20,20,40,0.7))';
        uiElement.style.borderColor = 'rgba(100, 150, 255, 0.3)';
        uiElement.style.transition = 'all 0.5s ease';
      }, 400);
    }
    
    // Screen vignette effect
    const body = document.body;
    body.style.boxShadow = 'inset 0 0 100px 50px rgba(255, 0, 0, 0.5)';
    body.style.transition = 'box-shadow 0.1s ease';
    
    setTimeout(() => {
      body.style.boxShadow = 'none';
      body.style.transition = 'box-shadow 0.5s ease';
    }, 400);
    
    updateUI();
  }

  // === ROOM PROGRESSION ===
  function checkRoomComplete() {
    if (enemies.length === 0 && gameRunning) {
      // Room cleared!
      player.score += 500 * currentRoomIndex;
      updateUI();
      
      // Show "Room Cleared" message
      showMessage('ROOM CLEARED!', 0x00ff00);
      
      setTimeout(() => {
        if (currentRoomIndex >= totalRooms) {
          gameWin();
        } else {
          // Show upgrade screen every 3 rooms
          if (currentRoomIndex % 3 === 0) {
            showUpgradeScreen();
          } else {
            nextRoom();
          }
        }
      }, 2000);
    }
  }

  function nextRoom() {
    currentRoomIndex++;
    clearProjectiles();
    clearTreasureChests();
    buildRoom(currentRoomIndex);
    playerObject.position.copy(player.pos);
    
    // Reset camera to face forward
    setLook(185.34, 0);
    
    player.health = Math.min(player.maxHealth + player.maxHealthBonus, player.health + 20); // Heal between rooms
    updateUI();
  }

  function clearProjectiles() {
    projectiles.forEach(p => scene.remove(p.mesh));
    projectiles = [];
  }

  function clearTreasureChests() {
    treasureChests.forEach(c => scene.remove(c.mesh));
    treasureChests = [];
  }

  // === UPGRADE SYSTEM ===
  function showUpgradeScreen() {
    gameRunning = false;
    
    const overlay = document.getElementById('overlay');
    const upgradeDiv = document.getElementById('upgradeScreen');
    
    if (!upgradeDiv) {
      createUpgradeScreen();
      return;
    }
    
    // Generate 3 random upgrades
    const allUpgrades = [
      { name: 'Increased Damage', desc: '+25% damage', apply: () => player.damageMultiplier *= 1.25 },
      { name: 'Faster Fire Rate', desc: '+30% fire rate', apply: () => player.fireRateMultiplier *= 1.3 },
      { name: 'Movement Speed', desc: '+20% move speed', apply: () => { player.speed *= 1.2; player.speedMultiplier *= 1.2; } },
      { name: 'Max Health Up', desc: '+30 max health', apply: () => { player.maxHealthBonus += 30; player.health += 30; } },
      { name: 'Full Heal', desc: 'Restore to full health', apply: () => player.health = player.maxHealth + player.maxHealthBonus },
      { name: 'Double Damage', desc: '+50% damage', apply: () => player.damageMultiplier *= 1.5 }
    ];
    
    const chosen = [];
    while (chosen.length < 3) {
      const upgrade = allUpgrades[Math.floor(Math.random() * allUpgrades.length)];
      if (!chosen.includes(upgrade)) chosen.push(upgrade);
    }
    
    // Display upgrades
    const container = document.getElementById('upgradeOptions');
    container.innerHTML = '';
    
    chosen.forEach((upgrade, idx) => {
      const btn = document.createElement('button');
      btn.className = 'upgradeOption';
      btn.innerHTML = `<strong>${upgrade.name}</strong><br><span>${upgrade.desc}</span>`;
      btn.onclick = () => selectUpgrade(upgrade);
      container.appendChild(btn);
    });
    
    overlay.classList.add('active');
    upgradeDiv.style.display = 'block';
  }

  function selectUpgrade(upgrade) {
    upgrade.apply();
    updateUI();
    
    const overlay = document.getElementById('overlay');
    const upgradeDiv = document.getElementById('upgradeScreen');
    
    overlay.classList.remove('active');
    upgradeDiv.style.display = 'none';
    
    gameRunning = true;
    nextRoom();
  }

  function createUpgradeScreen() {
    const upgradeHTML = `
      <div id="upgradeScreen" style="display:none; pointer-events:auto; background: linear-gradient(135deg, rgba(20, 40, 60, 0.95), rgba(40, 20, 80, 0.95)); color: #fff; padding: 40px; border-radius: 15px; text-align: center; width: 600px; border: 3px solid rgba(100, 150, 255, 0.4); box-shadow: 0 0 40px rgba(100, 150, 255, 0.3);">
        <h1 style="font-size: 36px; margin: 0 0 10px 0; color: #4af;">Choose an Upgrade</h1>
        <p style="margin: 0 0 30px 0; color: #aaa;">Select one to enhance your abilities</p>
        <div id="upgradeOptions" style="display: flex; gap: 20px; justify-content: center;"></div>
      </div>
    `;
    
    document.getElementById('overlay').insertAdjacentHTML('beforeend', upgradeHTML);
    
    // Add CSS for upgrade buttons
    const style = document.createElement('style');
    style.textContent = `
      .upgradeOption {
        background: linear-gradient(135deg, #2a4a6a, #1a3a5a);
        border: 2px solid #4a90e2;
        color: white;
        padding: 30px 20px;
        border-radius: 10px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        transition: all 0.3s ease;
        min-width: 160px;
      }
      .upgradeOption:hover {
        background: linear-gradient(135deg, #3a5a8a, #2a4a7a);
        border-color: #6ab0ff;
        transform: translateY(-5px) scale(1.05);
        box-shadow: 0 10px 30px rgba(100, 180, 255, 0.4);
      }
      .upgradeOption strong {
        display: block;
        font-size: 18px;
        margin-bottom: 10px;
        color: #4af;
      }
      .upgradeOption span {
        color: #aaa;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    
    showUpgradeScreen();
  }

  // === UI UPDATES ===
  function updateUI() {
    const health = Math.max(0, player.health);
    const maxHealth = player.maxHealth + player.maxHealthBonus;
    
    document.getElementById('health').textContent = Math.floor(health);
    document.getElementById('maxHealth').textContent = maxHealth;
    document.getElementById('room').textContent = currentRoomIndex;
    document.getElementById('enemiesCount').textContent = enemies.length;
    document.getElementById('score').textContent = player.score;
    
    // Update health bar (based on current max health, not base 100)
    const healthPercent = (health / maxHealth) * 100;
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
    player.health = 100;
    player.maxHealth = 100;
    player.alive = true;
    player.score = 0;
    player.kills = 0;
    player.damageMultiplier = 1.0;
    player.fireRateMultiplier = 1.0;
    player.speed = 4.0;
    player.speedMultiplier = 1.0;
    player.maxHealthBonus = 0;
    
    enemies.forEach(e => scene.remove(e.mesh));
    enemies = [];
    clearProjectiles();
    clearTreasureChests();
    particleEffects.forEach(p => scene.remove(p.mesh));
    particleEffects = [];
    
    const overlay = document.getElementById('overlay');
    const gameOverDiv = document.getElementById('gameOver');
    const upgradeDiv = document.getElementById('upgradeScreen');
    if (overlay) overlay.classList.remove('active');
    if (gameOverDiv) gameOverDiv.style.display = 'none';
    if (upgradeDiv) upgradeDiv.style.display = 'none';
    
    setLook(185.34, 0); // Reset to starting look direction
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
    
    // Keep player.pos perfectly in sync with playerObject
    player.pos.copy(playerObject.position);
    
    // Apply camera rotation (this also enforces camera position)
    applyLookRotation(playerObject, camera);
    
    // Update player light to follow exactly
    playerLight.position.copy(playerObject.position);
    
    // Update enemies
    enemies.forEach(enemy => enemy.update(delta));
    
    // Update projectiles (both player and enemy)
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!projectiles[i].update(delta)) {
        projectiles.splice(i, 1);
      }
    }
    
    // Update treasure chests
    for (let i = treasureChests.length - 1; i >= 0; i--) {
      treasureChests[i].update(delta);
      if (treasureChests[i].opened) {
        treasureChests.splice(i, 1);
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