// js/items.js
// Treasure chest and item pickup system

import { createParticleExplosion } from './particles.js';
import { showMessage } from './ui.js';

export const treasureChests = [];

export class TreasureChest {
  constructor(scene, position, treasureMat) {
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
  
  update(delta, player, scene, updateUICallback) {
    if (this.opened) return;
    
    // Bob up and down
    this.bobTime += delta * 2;
    this.mesh.position.y = 0.25 + Math.sin(this.bobTime) * 0.1;
    
    // Rotate slowly
    this.mesh.rotation.y += delta * 0.5;
    
    // Check if player is near
    const dist = this.mesh.position.distanceTo(player.pos);
    if (dist < 1.5) {
      this.open(player, scene, updateUICallback);
    }
  }
  
  open(player, scene, updateUICallback) {
    this.opened = true;
    
    // Visual feedback
    createParticleExplosion(scene, this.mesh.position, 0xffd700);
    scene.remove(this.mesh);
    
    // Give reward
    const heal = 30;
    player.health = Math.min(player.maxHealth + player.maxHealthBonus, player.health + heal);
    player.score += 250;
    updateUICallback();
    
    // Show message
    showMessage('+30 Health!', 0x00ff00);
  }
}

export function clearTreasureChests(scene) {
  treasureChests.forEach(c => scene.remove(c.mesh));
  treasureChests.length = 0;
}