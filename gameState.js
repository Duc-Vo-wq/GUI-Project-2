// js/gameState.js
// Game state management, win/lose conditions, room progression

import { enemies } from './enemies.js';
import { clearProjectiles } from './projectiles.js';
import { clearTreasureChests } from './items.js';
import { clearParticles } from './particles.js';
import { showMessage, showDamageEffect, updateUI } from './ui.js';
import { showUpgradeScreen } from './upgrades.js';
import { buildRoom, currentRoom, clearCurrentRoom } from './rooms.js';
import { setLook } from './camera.js';
import { startTutorial, cleanupTutorialState } from './tutorial.js';

export const gameState = {
  currentRoomIndex: 1,
  gameRunning: false,
  gameStarted: false,
  gamePaused: false,
  totalRooms: 10,
  bossRoom: 10,
  roomStartTime: 0,  // Track when room started
  totalGameTime: 0,  // Track total game time
  roomClearTimes: [], // Track time for each room
  pauseStartTime: 0  // Track when game was paused
};

export function damagePlayer(player, scene, amount) {
  if (!player.alive) return;
  
  player.health -= amount;
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
    gameOver(player);
  }
  
  // Screen flash effect
  scene.background.setHex(0x330000);
  setTimeout(() => scene.background.setHex(0x0b0f1a), 100);
  
  showDamageEffect();
  updateUI(player, gameState.currentRoomIndex, enemies.length);
}

export function checkRoomComplete(player, playerObject) {
  // Don't check room completion in tutorial (room 0)
  if (gameState.currentRoomIndex === 0) return;
  
  if (enemies.length === 0 && gameState.gameRunning) {
    // Calculate room clear time
    const roomTime = (Date.now() - gameState.roomStartTime) / 1000; // in seconds
    gameState.roomClearTimes.push(roomTime);
    
    // Base room score
    const baseScore = 500 * gameState.currentRoomIndex;
    
    // Time bonus: Award bonus points for clearing quickly
    // Perfect time thresholds (in seconds): 30s = max bonus
    let timeBonus = 0;
    if (roomTime <= 30) {
      timeBonus = 500; // Fast clear!
    } else if (roomTime <= 45) {
      timeBonus = 300; // Good time
    } else if (roomTime <= 60) {
      timeBonus = 150; // Decent time
    }
    // Over 60 seconds = no time bonus
    
    const totalRoomScore = baseScore + timeBonus;
    player.score += totalRoomScore;
    
    updateUI(player, gameState.currentRoomIndex, enemies.length);
    
    // Show simple "Room Cleared" message
    showMessage('ROOM CLEARED!', 0x00ff00);
    
    setTimeout(() => {
      if (gameState.currentRoomIndex >= gameState.totalRooms) {
        gameWin(player);
      } else {
        // Show upgrade screen every 3 rooms
        if (gameState.currentRoomIndex % 3 === 0) {
          gameState.gameRunning = false;
          showUpgradeScreen(player, () => nextRoom(player, playerObject));
        } else {
          nextRoom(player, playerObject);
        }
      }
    }, 2000);
  }
}

function nextRoom(player, playerObject) {
  gameState.currentRoomIndex++;
  gameState.gameRunning = true;
  gameState.roomStartTime = Date.now(); // Start timer for new room
  clearProjectiles(playerObject.parent);
  clearTreasureChests(playerObject.parent);
  buildRoom(gameState.currentRoomIndex);
  playerObject.position.copy(player.pos);
  
  // Reset camera to face forward
  setLook(185.34, 0);
  
  player.health = Math.min(player.maxHealth + player.maxHealthBonus, player.health + 20);
  updateUI(player, gameState.currentRoomIndex, enemies.length);
}

function gameOver(player) {
  gameState.gameRunning = false;
  const overlay = document.getElementById('overlay');
  const gameOverDiv = document.getElementById('gameOver');
  const title = document.getElementById('gameOverTitle');
  
  title.textContent = 'Game Over';
  title.classList.remove('win');
  
  // Calculate scoring breakdown
  const enemyScore = player.kills * 100;
  const roomsCleared = gameState.currentRoomIndex - 1; // Died on current room
  let roomScore = 0;
  for (let i = 1; i <= roomsCleared; i++) {
    roomScore += 500 * i;
  }
  
  // Calculate time bonuses from cleared rooms
  let timeBonuses = 0;
  gameState.roomClearTimes.forEach(time => {
    if (time <= 30) timeBonuses += 500;
    else if (time <= 45) timeBonuses += 300;
    else if (time <= 60) timeBonuses += 150;
  });
  
  document.getElementById('gameOverText').innerHTML = 
    `You died on room ${gameState.currentRoomIndex}<br><br>` +
    `<strong>Score Breakdown:</strong><br>` +
    `Enemies Killed: ${player.kills} × 100 = ${enemyScore}<br>` +
    `Rooms Cleared: ${roomsCleared} = ${roomScore}<br>` +
    `Time Bonuses: ${timeBonuses}<br>` +
    `<br><strong>Total Score: ${player.score}</strong>`;
  
  if (overlay) overlay.classList.add('active');
  if (gameOverDiv) gameOverDiv.style.display = 'block';
}

function gameWin(player) {
  gameState.gameRunning = false;
  const overlay = document.getElementById('overlay');
  const gameOverDiv = document.getElementById('gameOver');
  const title = document.getElementById('gameOverTitle');
  
  title.textContent = 'Victory!';
  title.classList.add('win');
  
  // Calculate scoring breakdown
  const enemyScore = player.kills * 100;
  const roomsCleared = gameState.totalRooms;
  let roomScore = 0;
  for (let i = 1; i <= roomsCleared; i++) {
    roomScore += 500 * i;
  }
  
  // Calculate time bonuses
  let timeBonuses = 0;
  gameState.roomClearTimes.forEach(time => {
    if (time <= 30) timeBonuses += 500;
    else if (time <= 45) timeBonuses += 300;
    else if (time <= 60) timeBonuses += 150;
  });
  
  // Calculate total game time
  const totalTime = gameState.roomClearTimes.reduce((sum, time) => sum + time, 0);
  const minutes = Math.floor(totalTime / 60);
  const seconds = (totalTime % 60).toFixed(1);
  
  document.getElementById('gameOverText').innerHTML = 
    `You cleared all ${roomsCleared} rooms!<br>` +
    `Total Time: ${minutes}m ${seconds}s<br><br>` +
    `<strong>Score Breakdown:</strong><br>` +
    `Enemies Killed: ${player.kills} × 100 = ${enemyScore}<br>` +
    `Rooms Cleared: ${roomsCleared} = ${roomScore}<br>` +
    `Time Bonuses: ${timeBonuses}<br>` +
    `<br><strong>Final Score: ${player.score}</strong>`;
  
  if (overlay) overlay.classList.add('active');
  if (gameOverDiv) gameOverDiv.style.display = 'block';
}

export function resetGame(player, scene, playerObject) {
  // Check if we're in the tutorial (room 0)
  const wasInTutorial = gameState.currentRoomIndex === 0;
  
  gameState.gameStarted = true;
  gameState.gameRunning = true;
  gameState.currentRoomIndex = wasInTutorial ? 0 : 1;
  gameState.roomStartTime = Date.now(); // Reset room timer
  gameState.totalGameTime = 0;
  gameState.roomClearTimes = [];
  
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
  enemies.length = 0;
  clearProjectiles(scene);
  clearTreasureChests(scene);
  clearParticles(scene);
  
  // CRITICAL: Clean up tutorial state if tutorial was active
  cleanupTutorialState(scene);
  
  const overlay = document.getElementById('overlay');
  const gameOverDiv = document.getElementById('gameOver');
  const upgradeDiv = document.getElementById('upgradeScreen');
  const startDiv = document.getElementById('startScreen');
  if (overlay) overlay.classList.remove('active');
  if (gameOverDiv) gameOverDiv.style.display = 'none';
  if (upgradeDiv) upgradeDiv.style.display = 'none';
  if (startDiv) startDiv.style.display = 'none';
  
  setLook(185.34, 0);
  
  // If was in tutorial, restart tutorial, otherwise start main game
  if (wasInTutorial) {
    // Get camera from playerObject
    const camera = playerObject.children[0];
    // Restart tutorial
    startTutorial(scene, player, playerObject, camera);
  } else {
    buildRoom(1);
    playerObject.position.copy(player.pos);
  }
  
  updateUI(player, gameState.currentRoomIndex, enemies.length);
}

export function returnToMainMenu(scene, player, playerObject) {
  // Stop game
  gameState.gamePaused = false;
  gameState.gameRunning = false;
  gameState.gameStarted = false;
  gameState.currentRoomIndex = 1;
  
  // Reset player
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
  
  // Clean up all game objects
  enemies.forEach(e => scene.remove(e.mesh));
  enemies.length = 0;
  clearProjectiles(scene);
  clearTreasureChests(scene);
  clearParticles(scene);
  
  // CRITICAL: Clean up tutorial state if tutorial was active
  cleanupTutorialState(scene);
  
  // Then clear the current room
  clearCurrentRoom();
  
  // Hide pause screen
  const overlay = document.getElementById('overlay');
  const pauseDiv = document.getElementById('pauseScreen');
  if (overlay) overlay.classList.remove('active');
  if (pauseDiv) pauseDiv.style.display = 'none';
  
  // Show start screen
  setTimeout(() => {
    const canvas = document.querySelector('canvas');
    const cam = canvas && playerObject ? playerObject.children[0] : null;
    // Get renderer from canvas - we need it to have scene reference
    const renderer = canvas ? { domElement: canvas } : null;
    showStartScreen(player, playerObject, renderer, cam);
  }, 100);
}

export function showStartScreen(player, playerObject, renderer, camera) {
  console.log('showStartScreen called with:', { player, playerObject, renderer, camera });
  
  const overlay = document.getElementById('overlay');
  
  // Always recreate the start screen to ensure handlers are fresh
  const existingScreen = document.getElementById('startScreen');
  if (existingScreen) {
    console.log('Removing existing start screen');
    existingScreen.remove();
  }
  
  const startHTML = `
    <div id="startScreen" style="display:none; pointer-events:auto; background: linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(30, 10, 60, 0.95)); color: #fff; padding: 60px 40px; border-radius: 20px; text-align: center; width: 600px; border: 4px solid rgba(100, 150, 255, 0.5); box-shadow: 0 0 60px rgba(100, 150, 255, 0.4);">
      <h1 style="font-size: 56px; margin: 0 0 20px 0; color: #4af; text-shadow: 0 0 20px rgba(70, 170, 255, 0.8); font-weight: bold;">DUNGEON CRAWLER</h1>
      <p style="margin: 0 0 40px 0; color: #aaa; font-size: 18px;">Fight through 10 rooms of enemies and defeat the boss!</p>
      
      <div style="background: rgba(0, 0, 0, 0.3); padding: 25px; border-radius: 10px; margin-bottom: 30px; border: 1px solid rgba(100, 150, 255, 0.2);">
        <h3 style="color: #4af; margin-top: 0; font-size: 20px;">Controls</h3>
        <p style="margin: 8px 0; font-size: 16px;"><strong>WASD</strong> - Move</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>Mouse</strong> - Look around</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>Left Click</strong> - Shoot</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>Space</strong> - Jump</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>TAB</strong> - Pause</p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>R</strong> - Restart (anytime)</p>
      </div>
      
      <button id="startBtn" style="background: linear-gradient(135deg, #2a6a4a, #1a5a3a); border: 3px solid #4ae290; color: white; padding: 20px 60px; border-radius: 12px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; transition: all 0.3s ease; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: block; margin: 10px auto; width: 80%;">
        START GAME
      </button>
      
      <button id="tutorialBtn" style="background: linear-gradient(135deg, #4a6a8a, #3a5a7a); border: 3px solid #6ab0ff; color: white; padding: 15px 50px; border-radius: 10px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; transition: all 0.3s ease; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: block; margin: 10px auto; width: 80%;">
        TUTORIAL
      </button>
    </div>
  `;
  
  overlay.insertAdjacentHTML('beforeend', startHTML);
  console.log('Start screen HTML added');
  
  // Add or update hover styles
  let existingStyle = document.getElementById('startScreenStyles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const style = document.createElement('style');
  style.id = 'startScreenStyles';
  style.textContent = `
    #startBtn:hover {
      background: linear-gradient(135deg, #3a7a5a, #2a6a4a) !important;
      border-color: #6af2b0 !important;
      transform: translateY(-3px) scale(1.05) !important;
      box-shadow: 0 10px 40px rgba(70, 220, 140, 0.5) !important;
    }
    #tutorialBtn:hover {
      background: linear-gradient(135deg, #5a7a9a, #4a6a8a) !important;
      border-color: #8ac0ff !important;
      transform: translateY(-3px) scale(1.05) !important;
      box-shadow: 0 10px 40px rgba(106, 176, 255, 0.5) !important;
    }
  `;
  document.head.appendChild(style);
  console.log('Hover styles added');
  
  // Add click handlers with proper references
  const startBtn = document.getElementById('startBtn');
  const tutBtn = document.getElementById('tutorialBtn');
  
  console.log('Buttons found:', { startBtn, tutBtn });
  
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      console.log('START GAME clicked');
      startGame(player, playerObject, renderer, camera);
    });
  }
  
  if (tutBtn) {
    tutBtn.addEventListener('click', () => {
      console.log('TUTORIAL BUTTON CLICKED!');
      const overlay = document.getElementById('overlay');
      const startDiv = document.getElementById('startScreen');
      
      overlay.classList.remove('active');
      startDiv.style.display = 'none';
      
      gameState.gameRunning = true;
      gameState.gameStarted = true;
      gameState.gamePaused = false;
      
      // Get the scene from renderer
      const scene = renderer ? renderer.domElement.scene : null;
      
      console.log('About to start tutorial with:', { scene, player, playerObject, camera });
      
      if (!scene) {
        console.error('No scene found!');
        return;
      }
      
      // Start tutorial with proper scene reference
      startTutorial(scene, player, playerObject, camera);
      
      setTimeout(() => {
        console.log('Requesting pointer lock');
        if (renderer) renderer.domElement.click();
      }, 100);
    });
  } else {
    console.error('Tutorial button not found!');
  }
  
  overlay.classList.add('active');
  document.getElementById('startScreen').style.display = 'block';
  console.log('Start screen displayed');
}

function startGame(player, playerObject, renderer, camera) {
  console.log('startGame called');
  const overlay = document.getElementById('overlay');
  const startDiv = document.getElementById('startScreen');
  
  overlay.classList.remove('active');
  startDiv.style.display = 'none';
  
  // Initialize game
  gameState.gameRunning = true;
  gameState.gameStarted = true;
  gameState.gamePaused = false;
  gameState.roomStartTime = Date.now(); // Start timer for room 1
  gameState.totalGameTime = 0;
  gameState.roomClearTimes = [];
  buildRoom(1);
  playerObject.position.copy(player.pos);
  updateUI(player, gameState.currentRoomIndex, enemies.length);
  
  // Request pointer lock after a brief delay
  setTimeout(() => {
    if (renderer) renderer.domElement.click();
  }, 100);
}

export function togglePause() {
  if (!gameState.gameStarted || !gameState.gameRunning) return;
  
  gameState.gamePaused = !gameState.gamePaused;
  
  if (gameState.gamePaused) {
    // Record when pause started
    gameState.pauseStartTime = Date.now();
  } else {
    // When unpausing, add the paused time to roomStartTime
    const pauseDuration = Date.now() - gameState.pauseStartTime;
    gameState.roomStartTime += pauseDuration;
  }
  
  const overlay = document.getElementById('overlay');
  const pauseDiv = document.getElementById('pauseScreen');
  
  if (gameState.gamePaused) {
    // Show pause screen
    if (!pauseDiv) {
      createPauseScreen();
    }
    overlay.classList.add('active');
    document.getElementById('pauseScreen').style.display = 'block';
    
    // Exit pointer lock
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  } else {
    // Hide pause screen
    overlay.classList.remove('active');
    if (pauseDiv) pauseDiv.style.display = 'none';
    
    // Re-request pointer lock
    setTimeout(() => {
      document.querySelector('canvas').click();
    }, 100);
  }
}

function createPauseScreen() {
  const pauseHTML = `
    <div id="pauseScreen" style="display:none; pointer-events:auto; background: linear-gradient(135deg, rgba(10, 20, 40, 0.95), rgba(30, 10, 60, 0.95)); color: #fff; padding: 60px 40px; border-radius: 20px; text-align: center; width: 500px; border: 4px solid rgba(100, 150, 255, 0.5); box-shadow: 0 0 60px rgba(100, 150, 255, 0.4);">
      <h1 style="font-size: 48px; margin: 0 0 20px 0; color: #4af; text-shadow: 0 0 20px rgba(70, 170, 255, 0.8); font-weight: bold;">PAUSED</h1>
      <p style="margin: 0 0 40px 0; color: #aaa; font-size: 18px;">Press TAB or click Resume to continue</p>
      
      <button id="resumeBtn" style="background: linear-gradient(135deg, #2a6a4a, #1a5a3a); border: 3px solid #4ae290; color: white; padding: 15px 50px; border-radius: 10px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; transition: all 0.3s ease; text-shadow: 0 2px 4px rgba(0,0,0,0.3); margin: 10px;">
        RESUME
      </button>
      
      <button id="mainMenuBtn" style="background: linear-gradient(135deg, #6a4a2a, #5a3a1a); border: 3px solid #e2a04a; color: white; padding: 15px 50px; border-radius: 10px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; transition: all 0.3s ease; text-shadow: 0 2px 4px rgba(0,0,0,0.3); margin: 10px;">
        MAIN MENU
      </button>
      
      <div style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 10px; margin-top: 30px; border: 1px solid rgba(100, 150, 255, 0.2);">
        <h3 style="color: #4af; margin-top: 0; font-size: 18px;">Controls</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>WASD</strong> - Move</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Mouse</strong> - Look</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Left Click</strong> - Shoot</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Space</strong> - Jump</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>TAB</strong> - Pause</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>R</strong> - Restart</p>
      </div>
    </div>
  `;
  
  document.getElementById('overlay').insertAdjacentHTML('beforeend', pauseHTML);
  
  // Add button styles
  const style = document.createElement('style');
  style.textContent = `
    #resumeBtn:hover, #mainMenuBtn:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 10px 30px rgba(70, 220, 140, 0.4);
    }
  `;
  document.head.appendChild(style);
  
  // Add button handlers
  document.getElementById('resumeBtn').addEventListener('click', togglePause);
  
  // Store scene reference for cleanup
  const mainMenuHandler = () => {
    const canvas = document.querySelector('canvas');
    if (canvas && canvas.scene) {
      returnToMainMenu(canvas.scene, canvas.player, canvas.playerObject);
    }
  };
  document.getElementById('mainMenuBtn').addEventListener('click', mainMenuHandler);
}