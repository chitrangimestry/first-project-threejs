import * as THREE from "three";

const badgeBacking = new THREE.MeshStandardMaterial({
  color: "#63432c",
  roughness: 0.82,
  metalness: 0.12,
});
const brass = new THREE.MeshStandardMaterial({
  color: "#d6a64e",
  roughness: 0.42,
  metalness: 0.68,
  emissive: "#70451b",
  emissiveIntensity: 0.22,
});
const innerFace = new THREE.MeshStandardMaterial({
  color: "#e7c17c",
  roughness: 0.78,
});
const leafMaterial = new THREE.MeshStandardMaterial({
  color: "#477342",
  roughness: 0.72,
  side: THREE.DoubleSide,
  emissive: "#1f351d",
  emissiveIntensity: 0.12,
});
const leafHighlight = new THREE.MeshStandardMaterial({
  color: "#78a450",
  roughness: 0.68,
  side: THREE.DoubleSide,
});

const leafShape = new THREE.Shape();
leafShape.moveTo(0, -0.21);
leafShape.bezierCurveTo(-0.27, -0.11, -0.25, 0.16, 0, 0.25);
leafShape.bezierCurveTo(0.25, 0.13, 0.29, -0.12, 0, -0.21);
leafShape.closePath();

function addLeaf(group, position, scale, rotation, material) {
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 10), material);
  leaf.position.set(...position);
  leaf.scale.setScalar(scale);
  leaf.rotation.z = rotation;
  group.add(leaf);
  return leaf;
}

export function makeNatureBadge(scene, id, x, z, getTerrainHeight) {
  const group = new THREE.Group();
  group.scale.setScalar(0.88);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: "#ffd477",
    emissive: "#e29a36",
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.48,
    roughness: 0.35,
    metalness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 36), glowMaterial);
  glowRing.position.z = -0.085;
  glowRing.renderOrder = 1;
  group.add(glowRing);
  const glowLight = new THREE.PointLight("#ffc665", 0.75, 4.2, 2);
  glowLight.position.z = 0.45;
  group.add(glowLight);

  const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.13, 32), badgeBacking);
  backing.rotation.x = Math.PI / 2;
  backing.castShadow = true;
  group.add(backing);

  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.405, 0.055, 10, 36),
    brass,
  );
  outerRim.position.z = 0.075;
  group.add(outerRim);

  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.035, 32), innerFace);
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.071;
  group.add(face);

  const insetRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.315, 0.012, 6, 32),
    badgeBacking,
  );
  insetRim.position.z = 0.099;
  group.add(insetRim);

  addLeaf(group, [-0.1, -0.015, 0.105], 0.83, -0.78, leafMaterial);
  addLeaf(group, [0.105, 0.07, 0.108], 0.72, 0.77, leafHighlight);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.39, 7), badgeBacking);
  stem.position.set(0.005, -0.035, 0.115);
  stem.rotation.z = -0.48;
  group.add(stem);

  const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.18, 5), innerFace);
  vein.position.set(-0.14, 0.055, 0.12);
  vein.rotation.z = -0.81;
  group.add(vein);

  for (const side of [-1, 1]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 6), brass);
    rivet.position.set(side * 0.365, 0, 0.079);
    group.add(rivet);
  }

  group.position.set(x, getTerrainHeight(x, z) + 1.1, z);
  scene.add(group);
  return {
    id,
    group,
    phase: id * 1.71,
    nextSpawnAt: 0,
    setNightMode(isNight) {
      glowMaterial.emissiveIntensity = isNight ? 1.8 : 0.65;
      glowMaterial.opacity = isNight ? 0.8 : 0.48;
      glowLight.intensity = isNight ? 2.2 : 0.75;
    },
    updateHighlight(time, isNight) {
      const pulse = 0.9 + Math.sin(time * 2.8 + this.phase) * 0.1;
      glowRing.scale.setScalar(pulse);
      glowMaterial.emissiveIntensity = (isNight ? 1.8 : 0.65) * pulse;
      glowMaterial.opacity = isNight ? 0.8 : 0.48;
      glowLight.intensity = (isNight ? 2.2 : 0.75) * pulse;
    },
  };
}
