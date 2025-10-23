// js/upgrades.js
// Upgrade screen and power-up system

import { updateUI } from './ui.js';

export function showUpgradeScreen(player, nextRoomCallback) {
  const overlay = document.getElementById('overlay');
  const upgradeDiv = document.getElementById('upgradeScreen');
  
  if (!upgradeDiv) {
    createUpgradeScreen(player, nextRoomCallback);
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
    btn.onclick = () => selectUpgrade(upgrade, player, nextRoomCallback);
    container.appendChild(btn);
  });
  
  overlay.classList.add('active');
  upgradeDiv.style.display = 'block';

  // Exit pointer lock to show cursor for upgrade selection
  if (document.exitPointerLock) {
    document.exitPointerLock();
  }
}

function selectUpgrade(upgrade, player, nextRoomCallback) {
  upgrade.apply();
  updateUI(player, 0, 0); // Update with dummy values, will be refreshed
  
  const overlay = document.getElementById('overlay');
  const upgradeDiv = document.getElementById('upgradeScreen');
  
  overlay.classList.remove('active');
  upgradeDiv.style.display = 'none';

  // Re-request pointer lock after upgrade selection
  setTimeout(() => {
    const canvas = document.querySelector('canvas');
    if (canvas && canvas.requestPointerLock) {
      canvas.click();
    }
  }, 100);

  nextRoomCallback();
}

function createUpgradeScreen(player, nextRoomCallback) {
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
  
  showUpgradeScreen(player, nextRoomCallback);
}