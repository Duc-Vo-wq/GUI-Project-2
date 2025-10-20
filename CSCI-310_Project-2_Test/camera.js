// js/camera.js
//import * as THREE from 'three';

export function createPlayerObject(initialPos = new THREE.Vector3(0, 1.6, 0)) {
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
  playerObject.rotation.y = yaw;
  camera.rotation.x = pitch;
}

export function setLook(y, p) { yaw = y; pitch = p; }
export function getLook() { return { yaw, pitch }; }