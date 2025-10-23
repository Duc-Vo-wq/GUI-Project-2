// js/ui.js
// UI update and message system

import { gameState } from './gameState.js';

export function updateUI(player, currentRoomIndex, enemyCount) {
  const health = Math.max(0, player.health);
  const maxHealth = player.maxHealth + player.maxHealthBonus;
  
  document.getElementById('health').textContent = Math.floor(health);
  document.getElementById('maxHealth').textContent = maxHealth;
  document.getElementById('room').textContent = currentRoomIndex;
  document.getElementById('enemiesCount').textContent = enemyCount;
  document.getElementById('score').textContent = player.score;
  
  // Update health bar (based on current max health, not base 100)
  const healthPercent = (health / maxHealth) * 100;
  const healthBar = document.getElementById('healthBar');
  if (healthBar) {
    healthBar.style.width = healthPercent + '%';
  }
  
  // Update timer (if in an active room, not tutorial)
  if (currentRoomIndex > 0 && gameState.gameRunning && !gameState.gamePaused) {
    const elapsed = (Date.now() - gameState.roomStartTime) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    let timerEl = document.getElementById('roomTimer');
    if (!timerEl) {
      // Create timer element above health bar
      const hud = document.getElementById('hud');
      timerEl = document.createElement('div');
      timerEl.id = 'roomTimer';
      timerEl.style.cssText = 'text-align: center; color: #4af; font-size: 18px; font-weight: bold; margin-bottom: 8px;';
      hud.insertBefore(timerEl, hud.firstChild);
    }
    timerEl.textContent = `Time: ${timerText}`;
  } else {
    // Hide timer in tutorial or when paused
    const timerEl = document.getElementById('roomTimer');
    if (timerEl) timerEl.textContent = '';
  }
}

export function showMessage(text, color = 0xffffff) {
  const msgEl = document.getElementById('roomClearedMsg');
  if (msgEl) {
    msgEl.textContent = text;
    msgEl.style.color = '#' + color.toString(16).padStart(6, '0');
    msgEl.classList.add('show');
    setTimeout(() => msgEl.classList.remove('show'), 2000);
  }
}

export function showDamageEffect() {
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
}