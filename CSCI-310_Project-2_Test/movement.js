// js/movement.js
//import * as THREE from 'three';

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

export function createPlayerState() {
  return {
    velocity: new THREE.Vector3(),
    speed: 4.0,
    jumpSpeed: 6.0,
    radius: 0.25,
    onGround: false
  };
}

export function updateMovement(playerObject, playerState, camera, scene, delta) {
  // ground check (simple raycast)
  const down = new THREE.Raycaster();
  const origin = playerObject.position.clone();
  origin.y += 0.1;
  down.set(origin, new THREE.Vector3(0, -1, 0));
  const intersects = down.intersectObjects(scene.children, true);
  let groundY = -Infinity;
  if (intersects.length) groundY = intersects[0].point.y;

  // Jump
  if (keys['Space'] && playerState.onGround) {
    playerState.velocity.y = playerState.jumpSpeed;
    playerState.onGround = false;
  }

  // Build move direction in local space using playerObject orientation
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerObject.quaternion);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const desired = new THREE.Vector3();
  if (keys['KeyW']) desired.add(forward);
  if (keys['KeyS']) desired.sub(forward);
  if (keys['KeyD']) desired.add(right);
  if (keys['KeyA']) desired.sub(right);
  if (desired.lengthSq() > 0) desired.normalize();

  // Simple damping to smooth movement
  const damping = 10.0;
  const target = desired.multiplyScalar(playerState.speed);
  playerState.velocity.x = THREE.MathUtils.damp(playerState.velocity.x, target.x, damping, delta);
  playerState.velocity.z = THREE.MathUtils.damp(playerState.velocity.z, target.z, damping, delta);

  // Gravity
  const gravity = 20.0;
  if (!playerState.onGround) playerState.velocity.y -= gravity * delta;

  // Apply displacement
  const disp = playerState.velocity.clone().multiplyScalar(delta);
  const nextY = playerObject.position.y + disp.y;
  if (groundY > -Infinity) {
    const eyeHeight = 1.6;
    const minY = groundY + eyeHeight;
    if (nextY <= minY) {
      playerObject.position.y = minY;
      playerState.velocity.y = 0;
      playerState.onGround = true;
    } else {
      playerObject.position.y = nextY;
      playerState.onGround = false;
    }
  } else {
    playerObject.position.y = nextY;
    playerState.onGround = false;
  }

  playerObject.position.x += disp.x;
  playerObject.position.z += disp.z;
}