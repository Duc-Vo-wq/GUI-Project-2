// js/enemies.js
// Enemy classes and AI system

import { createParticleExplosion } from './particles.js';
import { EnemyProjectile, projectiles } from './projectiles.js';
import { world } from './rooms.js';

export const enemies = [];

// Collision helper
function checkCollisionWithWalls(position, radius) {
  for (const wall of world.walls) {
    const closestPoint = new THREE.Vector3(
      Math.max(wall.min.x, Math.min(position.x, wall.max.x)),
      Math.max(wall.min.y, Math.min(position.y, wall.max.y)),
      Math.max(wall.min.z, Math.min(position.z, wall.max.z))
    );
    const dist = position.distanceTo(closestPoint);
    if (dist < radius) return true;
  }
  return false;
}

export class Enemy {
  constructor(scene, position, roomIndex, type, enemyMat, camera, player, damagePlayerCallback) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.damagePlayerCallback = damagePlayerCallback;
    this.type = type;
    this.setupStats(roomIndex, type);
    
    const geometry = this.getGeometry(type);
    const material = this.getMaterial(type, enemyMat);
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
      case 'ranged':
        this.health = 25 + roomIndex * 4;
        this.maxHealth = this.health;
        this.speed = 1.0 + roomIndex * 0.08; // Slower than normal
        this.damage = 8 + roomIndex;
        this.canShoot = true;
        this.shootCooldown = 0;
        this.shootRange = 12; // Shoots from medium-long range
        this.preferredDistance = 8; // Tries to stay at this distance
        break;
      case 'tank':
        this.health = 100 + roomIndex * 15;
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
        this.shootRange = 15;
        this.preferredDistance = 10;
        break;
      default: // normal
        this.health = 30 + roomIndex * 5;
        this.maxHealth = this.health;
        this.speed = 1.2 + roomIndex * 0.1;
        this.damage = 10 + roomIndex * 2;
    }
    this.attackCooldown = 0;
    this.hitCooldown = 0;
    this.spawnDelay = 1.5; // All enemies frozen for 1.5 seconds on spawn
  }
  
  getGeometry(type) {
    switch(type) {
      case 'fast':
        return new THREE.BoxGeometry(0.4, 0.8, 0.4);
      case 'ranged':
        return new THREE.BoxGeometry(0.5, 1.4, 0.5); // Taller! Same height as normal enemies
      case 'tank':
        return new THREE.BoxGeometry(0.9, 1.5, 0.9);
      case 'boss':
        return new THREE.BoxGeometry(1.5, 2.5, 1.5);
      default:
        return new THREE.BoxGeometry(0.6, 1.2, 0.6);
    }
  }
  
  getMaterial(type, enemyMat) {
    const materials = {
      fast: new THREE.MeshStandardMaterial({ 
        color: 0xff6633, emissive: 0x442200, roughness: 0.6 
      }),
      ranged: new THREE.MeshStandardMaterial({ 
        color: 0x33ff66, emissive: 0x226622, roughness: 0.5 
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
    this.healthBarBg.renderOrder = 999;
    this.healthBarContainer.add(this.healthBarBg);
    
    // Foreground (bright red)
    this.healthBarFg = new THREE.Mesh(barGeo,
      new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      }));
    this.healthBarFg.position.z = 0.001;
    this.healthBarFg.renderOrder = 1000;
    this.healthBarContainer.add(this.healthBarFg);
    
    // Start hidden - will show on first damage
    this.healthBarContainer.visible = false;
  }
  
  update(delta) {
    // Handle spawn delay - enemies are inactive for first 1.5 seconds
    if (this.spawnDelay > 0) {
      this.spawnDelay -= delta;
      return; // Don't move, shoot, or attack during spawn delay
    }
    
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
      this.healthBarContainer.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
    }
    
    // AI: Move toward player with obstacle avoidance
    const toPlayer = new THREE.Vector3().subVectors(this.player.pos, this.mesh.position);
    const dist = toPlayer.length();
    
    // Ranged enemies can shoot from distance
    if (this.canShoot && this.shootCooldown <= 0) {
      const minRange = this.type === 'boss' ? 3 : 4;
      const maxRange = this.shootRange || 15;
      
      if (dist > minRange && dist < maxRange) {
        this.shootAtPlayer();
        // Ranged enemies shoot faster than boss
        this.shootCooldown = this.type === 'ranged' ? 1.2 : 2.0;
      }
    }
    
    const attackRange = this.type === 'tank' ? 2.0 : 1.5;

    // Ranged enemies try to maintain optimal distance (but NOT the boss - it chases!)
    if (this.type === 'ranged') {
      const preferredDist = this.preferredDistance || 8;

      if (dist < preferredDist - 2) {
        // Too close - back away
        const awayDir = toPlayer.clone();
        awayDir.y = 0;
        awayDir.normalize().multiplyScalar(-1); // Reverse direction

        const backupPos = this.mesh.position.clone().add(awayDir.multiplyScalar(this.speed * delta));
        if (!checkCollisionWithWalls(backupPos, 0.3)) {
          this.mesh.position.copy(backupPos);
        }
      } else if (dist > preferredDist + 3) {
        // Too far - move closer
        const desiredDir = toPlayer.clone();
        desiredDir.y = 0;
        desiredDir.normalize();

        const testPos = this.mesh.position.clone().add(desiredDir.clone().multiplyScalar(this.speed * delta));

        if (!checkCollisionWithWalls(testPos, 0.3)) {
          this.mesh.position.copy(testPos);
        } else {
          // Try steering if blocked
          this.steerAroundObstacle(desiredDir, delta);
        }
      }
      // Otherwise stay put and keep shooting
    } else if (dist > attackRange) {
      // Non-ranged enemies chase the player
      const desiredDir = toPlayer.clone();
      desiredDir.y = 0;
      desiredDir.normalize();
      
      const testPos = this.mesh.position.clone().add(desiredDir.clone().multiplyScalar(this.speed * delta));
      
      if (!checkCollisionWithWalls(testPos, 0.3)) {
        this.mesh.position.copy(testPos);
      } else {
        this.steerAroundObstacle(desiredDir, delta);
      }
    } else if (dist < attackRange && this.attackCooldown <= 0 && this.player.alive) {
      // Attack player
      this.attack();
    }
  }
  
  steerAroundObstacle(desiredDir, delta) {
    // Try alternative directions (left and right)
    const steerAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, -(3 * Math.PI) / 4];
    let moved = false;
    
    for (const angle of steerAngles) {
      const steerDir = new THREE.Vector3(
        desiredDir.x * Math.cos(angle) - desiredDir.z * Math.sin(angle),
        0,
        desiredDir.x * Math.sin(angle) + desiredDir.z * Math.cos(angle)
      );
      
      const steerPos = this.mesh.position.clone().add(steerDir.multiplyScalar(this.speed * delta));
      
      if (!checkCollisionWithWalls(steerPos, 0.3)) {
        this.mesh.position.copy(steerPos);
        moved = true;
        break;
      }
    }
    
    // If still stuck, try moving backwards slightly
    if (!moved) {
      const backDir = desiredDir.clone().multiplyScalar(-0.5);
      const backPos = this.mesh.position.clone().add(backDir.multiplyScalar(this.speed * delta));
      if (!checkCollisionWithWalls(backPos, 0.3)) {
        this.mesh.position.copy(backPos);
      }
    }
  }
  
  shootAtPlayer() {
    const shootOrigin = this.mesh.position.clone();
    // Adjust shoot height based on enemy type
    if (this.type === 'ranged') {
      shootOrigin.y += 0.6; // Chest height for ranged enemies (height 1.4, so 0.6 is ~43% up)
    } else if (this.type === 'boss') {
      shootOrigin.y += 1.2; // Higher for boss
    } else {
      shootOrigin.y += 1.0; // Default
    }
    
    const shootDir = new THREE.Vector3().subVectors(this.player.pos, shootOrigin).normalize();
    
    // Create enemy projectile
    const enemyProj = new EnemyProjectile(this.scene, shootOrigin, shootDir);
    projectiles.push(enemyProj);
  }
  
  attack() {
    this.attackCooldown = 1.5;
    this.damagePlayerCallback(this.damage);
    
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
    createParticleExplosion(this.scene, this.mesh.position, 0xff3333);
    this.scene.remove(this.mesh);
    this.player.kills++;
    this.player.score += 100;
  }
}