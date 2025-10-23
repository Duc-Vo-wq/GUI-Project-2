// js/spawn.js
// Enemy and treasure spawning system

import { Enemy, enemies } from './enemies.js';
import { TreasureChest, treasureChests } from './items.js';
import { updateUI, showMessage } from './ui.js';
import { world, currentRoom } from './rooms.js';
import { gameState } from './gameState.js';

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

export function spawnEnemies(scene, count, roomIndex, enemyMat, camera, player, treasureMat, damagePlayerCallback) {
  enemies.length = 0;
  
  // Boss room
  if (roomIndex === gameState.bossRoom) {
    const bossPos = new THREE.Vector3(0, 1.25, 0);
    enemies.push(new Enemy(scene, bossPos, roomIndex, 'boss', enemyMat, camera, player, damagePlayerCallback));
    // Add some minions
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pos = new THREE.Vector3(
        Math.cos(angle) * 5,
        0.6,
        Math.sin(angle) * 5
      );
      enemies.push(new Enemy(scene, pos, roomIndex, 'normal', enemyMat, camera, player, damagePlayerCallback));
    }
    updateUI(player, roomIndex, enemies.length);
    showMessage('BOSS FIGHT!', 0xff00ff);
    return;
  }
  
  // Get spawn zones from current room
  const spawnZones = currentRoom.spawnZones || [];
  
  if (spawnZones.length === 0) {
    console.error('No spawn zones defined for room!');
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
      
      // Check if position is valid
      const tooCloseToPlayer = position.distanceTo(player.pos) < 4;
      const inWall = checkCollisionWithWalls(position, 0.5);
      
      validPosition = !tooCloseToPlayer && !inWall;
      
    } while (!validPosition && attempts < 50);
    
    // Skip this enemy if we couldn't find a valid position
    if (!validPosition) continue;
    
    // Determine enemy type based on room progression
    let type = 'normal';
    if (roomIndex >= 3) {
      const rand = Math.random();
      if (rand < 0.25) type = 'fast';       // 25% fast
      else if (rand < 0.45) type = 'ranged'; // 20% ranged (new!)
      else if (rand < 0.6) type = 'tank';    // 15% tank
      // else normal (40%)
    }
    
    enemies.push(new Enemy(scene, position, roomIndex, type, enemyMat, camera, player, damagePlayerCallback));
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
      treasureChests.push(new TreasureChest(scene, chestPos, treasureMat));
    }
  }
  
  updateUI(player, roomIndex, enemies.length);
}