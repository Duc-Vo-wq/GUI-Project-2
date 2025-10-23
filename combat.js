// js/combat.js
// Shooting mechanics and damage system

import { Projectile, projectiles } from './projectiles.js';
import { createParticleExplosion } from './particles.js';

export function initShooting(renderer, camera, playerObject, player, projectileMat, checkIfCanShoot) {
  let canShoot = true;
  
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && canShoot && player.alive && document.pointerLockElement && checkIfCanShoot()) {
      shoot(camera, playerObject, player, projectileMat);
      canShoot = false;
      const fireRate = 250 / player.fireRateMultiplier;
      setTimeout(() => canShoot = true, fireRate);
    }
  });
}

function shoot(camera, playerObject, player, projectileMat) {
  const shootDir = new THREE.Vector3();
  camera.getWorldDirection(shootDir);
  
  // Spawn projectile in front of player to avoid self-collision
  const shootOrigin = playerObject.position.clone().add(shootDir.clone().multiplyScalar(0.5));
  
  const damage = 25 * player.damageMultiplier;
  const proj = new Projectile(camera.parent.parent, shootOrigin, shootDir, projectileMat, damage);
  projectiles.push(proj);
  
  // Muzzle flash
  const flashPos = shootOrigin.clone().add(shootDir.clone().multiplyScalar(0.2));
  createParticleExplosion(camera.parent.parent, flashPos, 0xffaa00);
}