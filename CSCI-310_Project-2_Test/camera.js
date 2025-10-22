// js/camera.js
export function createPlayerObject(initialPos = new THREE.Vector3(0, 1.2, 0)) {
  const playerObject = new THREE.Object3D();
  playerObject.position.copy(initialPos);
  return playerObject;
}

let yaw = 0;
let pitch = 0;
const sensitivity = 0.002;

export function initPointerLock(rendererDomElement) {
  rendererDomElement.addEventListener('click', () => {
    rendererDomElement.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === rendererDomElement) {
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
      pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitch));
    }
  });
}

export function applyLookRotation(playerObject, camera) {
  // Only rotate the playerObject around Y axis (yaw)
  playerObject.rotation.y = yaw;
  
  // Camera pitch (looking up/down) - apply directly without any offset
  camera.rotation.x = pitch;
  camera.rotation.y = 0; // Ensure no Y rotation on camera itself
  camera.rotation.z = 0; // Ensure no Z rotation
  
  // Force camera position to be exactly at origin of playerObject
  camera.position.set(0, 0, 0);
}

export function setLook(y, p) { 
  yaw = y; 
  pitch = p; 
}

export function getLook() { 
  return { yaw, pitch }; 
}