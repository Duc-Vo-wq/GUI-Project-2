// js/projectiles.js
// Player and enemy projectile classes

import { createParticleExplosion } from './particles.js';
import { world } from './rooms.js';

export const projectiles = [];

// Collision detection helper
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

// === PLAYER PROJECTILE CLASS ===
export class Projectile {
  constructor(scene, position, direction, projectileMat, damage) {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    this.mesh = new THREE.Mesh(geometry, projectileMat.clone());
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    
    this.velocity = direction.normalize().multiplyScalar(20);
    this.lifetime = 3;
    this.damage = damage;
    this.isPlayerProjectile = true;
    
    // Add glow
    const light = new THREE.PointLight(0xffaa00, 0.5, 3);
    this.mesh.add(light);
  }
  
  update(delta, scene, enemies, checkRoomCompleteCallback, updateUICallback) {
    this.lifetime -= delta;
    if (this.lifetime <= 0) {
      scene.remove(this.mesh);
      return false;
    }
    
    const movement = this.velocity.clone().multiplyScalar(delta);
    this.mesh.position.add(movement);
    
    // Remove if too far from origin (safety bounds check)
    const distFromOrigin = this.mesh.position.length();
    if (distFromOrigin > 100) {
      scene.remove(this.mesh);
      return false;
    }
    
    // Check collision with walls (but not for first 0.1 seconds to avoid spawning inside player)
    if (this.lifetime < 2.9 && checkCollisionWithWalls(this.mesh.position, 0.1)) {
      createParticleExplosion(scene, this.mesh.position, 0xffff00);
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
            updateUICallback();
            checkRoomCompleteCallback();
          }
          createParticleExplosion(scene, this.mesh.position, 0xffaa00);
          scene.remove(this.mesh);
          return false;
        }
      }
    }
    
    return true;
  }
}

// === ENEMY PROJECTILE CLASS ===
export class EnemyProjectile {
  constructor(scene, position, direction) {
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
  
  update(delta, scene, player, damagePlayerCallback) {
    this.lifetime -= delta;
    if (this.lifetime <= 0) {
      scene.remove(this.mesh);
      return false;
    }
    
    const movement = this.velocity.clone().multiplyScalar(delta);
    this.mesh.position.add(movement);
    
    // Remove if too far from origin (safety bounds check)
    const distFromOrigin = this.mesh.position.length();
    if (distFromOrigin > 100) {
      scene.remove(this.mesh);
      return false;
    }
    
    // Check collision with walls
    if (checkCollisionWithWalls(this.mesh.position, 0.1)) {
      createParticleExplosion(scene, this.mesh.position, 0xff0000);
      scene.remove(this.mesh);
      return false;
    }
    
    // Check collision with player
    const dist = this.mesh.position.distanceTo(player.pos);
    if (dist < 0.5) {
      damagePlayerCallback(this.damage);
      createParticleExplosion(scene, this.mesh.position, 0xff0000);
      scene.remove(this.mesh);
      return false;
    }
    
    return true;
  }
}

export function clearProjectiles(scene) {
  projectiles.forEach(p => scene.remove(p.mesh));
  projectiles.length = 0;
}