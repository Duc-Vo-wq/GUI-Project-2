// js/particles.js
// Particle effects system for explosions and visual feedback

export const particleEffects = [];

export function createParticleExplosion(scene, position, color) {
  const particleCount = 15;
  for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    scene.add(particle);
    
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      Math.random() * 3,
      (Math.random() - 0.5) * 3
    );
    
    particleEffects.push({
      mesh: particle,
      velocity,
      lifetime: 0.5,
      maxLifetime: 0.5
    });
  }
}

export function updateParticles(scene, delta) {
  for (let i = particleEffects.length - 1; i >= 0; i--) {
    const p = particleEffects[i];
    p.lifetime -= delta;
    
    if (p.lifetime <= 0) {
      scene.remove(p.mesh);
      particleEffects.splice(i, 1);
      continue;
    }
    
    p.velocity.y -= 5 * delta; // Gravity
    p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
    
    const alpha = p.lifetime / p.maxLifetime;
    p.mesh.scale.setScalar(alpha);
  }
}

export function clearParticles(scene) {
  particleEffects.forEach(p => scene.remove(p.mesh));
  particleEffects.length = 0;
}