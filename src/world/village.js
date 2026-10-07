import * as THREE from "three";

function addBox(parent, material, dimensions, position, rotationY = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...dimensions),
    material,
  );
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  parent.add(mesh);
  return mesh;
}

function enableShadows(group) {
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function makeHouse(scene, x, z, rotation, groundHeight) {
  const house = new THREE.Group();
  const plaster = new THREE.MeshStandardMaterial({ color: "#c9b58d", roughness: 1 });
  const timber = new THREE.MeshStandardMaterial({ color: "#604533", roughness: 1 });
  const roof = new THREE.MeshStandardMaterial({ color: "#59634b", roughness: 0.98 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#e9c77f",
    emissive: "#362614",
    emissiveIntensity: 0.3,
    roughness: 0.38,
  });

  addBox(house, plaster, [5.2, 3.25, 4.4], [0, 1.72, 0]);
  addBox(house, timber, [0.14, 3.4, 0.16], [-2.48, 1.7, 2.22]);
  addBox(house, timber, [0.14, 3.4, 0.16], [2.48, 1.7, 2.22]);
  const leftRoof = addBox(house, roof, [3.4, 0.2, 5.1], [-1.45, 3.75, 0]);
  const rightRoof = addBox(house, roof, [3.4, 0.2, 5.1], [1.45, 3.75, 0]);
  leftRoof.rotation.z = 0.48;
  rightRoof.rotation.z = -0.48;
  leftRoof.castShadow = true;
  rightRoof.castShadow = true;
  addBox(house, timber, [1.1, 2.25, 0.15], [0, 1.15, 2.27]);
  const doorKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: "#d9b66a", metalness: 0.45, roughness: 0.5 }),
  );
  doorKnob.position.set(0.34, 1.15, 2.37);
  house.add(doorKnob);
  for (const side of [-1, 1]) {
    addBox(house, glass, [0.85, 0.86, 0.08], [side * 1.53, 2.13, 2.25]);
    addBox(house, timber, [0.1, 0.98, 0.13], [side * 1.53, 2.13, 2.32]);
    addBox(house, timber, [0.95, 0.09, 0.13], [side * 1.53, 2.13, 2.32]);
    addBox(house, timber, [0.08, 0.9, 0.12], [side * 1.53, 2.13, 2.32]);
    addBox(house, timber, [0.13, 1.1, 0.13], [side * 2.62, 2.1, 0]);
    addBox(house, glass, [0.08, 0.74, 0.78], [side * 2.63, 2.14, -0.15]);
    addBox(house, timber, [0.12, 0.09, 0.9], [side * 2.68, 2.14, -0.15]);
    addBox(house, timber, [0.12, 0.78, 0.09], [side * 2.68, 2.14, -0.15]);
  }
  const chimney = addBox(house, timber, [0.66, 1.65, 0.72], [-1.65, 4.35, -0.8]);
  addBox(house, timber, [0.85, 0.16, 0.9], [-1.65, 5.2, -0.8]);
  chimney.castShadow = true;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(5.55, 0.34, 4.7),
    new THREE.MeshStandardMaterial({ color: "#817968", roughness: 1 }),
  );
  foundation.position.y = 0.08;
  house.add(foundation);
  house.position.set(x, groundHeight, z);
  house.rotation.y = rotation;
  enableShadows(house);
  scene.add(house);
  return house;
}

function makeMarket(scene, x, z, groundHeight) {
  const market = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#76513a", roughness: 1 });
  const canvas = new THREE.MeshStandardMaterial({ color: "#b96f4c", roughness: 0.95 });
  const fruitMaterials = ["#bb6842", "#d7b75e", "#738b53"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
  );
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.8, 8), wood);
    post.position.set(side * 2.25, 1.4, 0);
    market.add(post);
  }
  addBox(market, wood, [5.2, 0.2, 1.35], [0, 1.25, -0.05]);
  addBox(market, canvas, [5.7, 0.18, 2.5], [0, 2.95, 0]);
  for (const side of [-1, 1]) {
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.4, 0.42, 10, 1, true),
      wood,
    );
    basket.position.set(side * 1.35, 1.58, 0);
    market.add(basket);
    for (let fruit = 0; fruit < 5; fruit += 1) {
      const produce = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 7), fruitMaterials[(fruit + (side + 1)) % fruitMaterials.length]);
      produce.position.set(
        side * 1.35 + (Math.random() - 0.5) * 0.58,
        1.88 + Math.random() * 0.12,
        (Math.random() - 0.5) * 0.55,
      );
      market.add(produce);
    }
  }
  market.position.set(x, groundHeight, z);
  enableShadows(market);
  scene.add(market);
  return market;
}

function makeWell(scene, x, z, groundHeight) {
  const well = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#898879", roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: "#5d4935", roughness: 1 });
  const water = new THREE.MeshStandardMaterial({
    color: "#668f91",
    roughness: 0.3,
    metalness: 0.12,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.19, 8, 20), stone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.85;
  well.add(rim);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.72, 18), water);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.7;
  well.add(surface);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 2.65, 7), wood);
    post.position.set(side * 0.82, 1.75, 0);
    well.add(post);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 7), wood);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 2.9;
  well.add(beam);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), wood);
  roof.position.y = 3.45;
  roof.rotation.y = Math.PI / 4;
  well.add(roof);
  well.position.set(x, groundHeight, z);
  scene.add(well);
  return well;
}

function makeGarden(scene, x, z, groundHeight) {
  const garden = new THREE.Group();
  const soil = new THREE.MeshStandardMaterial({ color: "#75583c", roughness: 1 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.12, 4.2), soil);
  bed.position.y = 0.08;
  garden.add(bed);
  const timber = new THREE.MeshStandardMaterial({ color: "#6a5038", roughness: 1 });
  for (const side of [-1, 1]) {
    const border = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.24, 0.16), timber);
    border.position.set(0, 0.18, side * 2.1);
    garden.add(border);
  }
  const greens = ["#55764a", "#6b8b4e", "#87954e"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  for (let row = 0; row < 3; row += 1) {
    for (let plant = 0; plant < 9; plant += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 6), greens[row]);
      stem.position.set(-3.1 + plant * 0.78, 0.34, -1.25 + row * 1.25);
      garden.add(stem);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), greens[(row + 1) % greens.length]);
      leaves.position.set(-3.1 + plant * 0.78, 0.52, -1.25 + row * 1.25);
      leaves.scale.set(1.25, 0.65, 0.9);
      garden.add(leaves);
    }
  }
  garden.position.set(x, groundHeight, z);
  scene.add(garden);
  return garden;
}

function makeVillager(scene, x, z, shirtColor, phase, role, groundHeight) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.94 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#465044", roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: "#c58c65", roughness: 0.92 });
  const hair = new THREE.MeshStandardMaterial({ color: "#4a392d", roughness: 1 });
  const boots = new THREE.MeshStandardMaterial({ color: "#574433", roughness: 1 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.48, 4, 8), shirt);
  torso.position.y = 1.2;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.set(0, 1.83, -0.025);
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 7), hair);
  hairCap.scale.set(1, 0.55, 1);
  hairCap.position.set(0, 1.95, 0.005);
  group.add(hairCap);

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15, 0.83, 0);
    const trousersLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 6), trousers);
    trousersLeg.position.y = -0.23;
    leg.add(trousersLeg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.27), boots);
    foot.position.set(0, -0.48, -0.045);
    leg.add(foot);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.33, 1.48, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 6), shirt);
    sleeve.position.y = -0.2;
    arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), skin);
    hand.position.y = -0.48;
    arm.add(hand);
    group.add(arm);
    arms.push(arm);
  }
  group.position.set(x, groundHeight, z);
  enableShadows(group);
  scene.add(group);
  return {
    group,
    legs,
    arms,
    homeX: x,
    homeZ: z,
    phase,
    role,
    speed: role === "market" ? 0.34 : 0.2,
  };
}

function makeVillagePath(scene, getGroundHeight) {
  const points = [
    new THREE.Vector3(0, 0, -24),
    new THREE.Vector3(-2, 0, -29),
    new THREE.Vector3(-7, 0, -33),
    new THREE.Vector3(-8, 0, -39),
    new THREE.Vector3(-3, 0, -42),
    new THREE.Vector3(3, 0, -42),
    new THREE.Vector3(10, 0, -39),
    new THREE.Vector3(14, 0, -35),
  ];
  const path = new THREE.CatmullRomCurve3(points);
  const stoneGeometry = new THREE.DodecahedronGeometry(1, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.97 });
  const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, 145);
  const transform = new THREE.Object3D();
  for (let index = 0; index < 145; index += 1) {
    const progress = index / 144;
    const point = path.getPoint(progress);
    const tangent = path.getTangent(progress);
    point.x += (Math.random() - 0.5) * 2.6;
    point.z += (Math.random() - 0.5) * 2.1;
    transform.position.set(point.x, getGroundHeight(point.x, point.z) + 0.035, point.z);
    transform.rotation.set(
      (Math.random() - 0.5) * 0.18,
      Math.atan2(tangent.x, tangent.z) + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.16,
    );
    transform.scale.set(0.24 + Math.random() * 0.27, 0.045 + Math.random() * 0.035, 0.18 + Math.random() * 0.18);
    transform.updateMatrix();
    stones.setMatrixAt(index, transform.matrix);
    stones.setColorAt(index, new THREE.Color().setHSL(0.11, 0.08, 0.38 + Math.random() * 0.18));
  }
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  stones.receiveShadow = true;
  stones.castShadow = true;
  scene.add(stones);
}

export function createVillage(scene, getGroundHeight) {
  makeVillagePath(scene, getGroundHeight);
  const placeHouse = (x, z, rotation) => makeHouse(scene, x, z, rotation, getGroundHeight(x, z));
  const place = (factory, x, z) => factory(scene, x, z, getGroundHeight(x, z));
  placeHouse(-15, -35, 0.08);
  placeHouse(14, -40, -0.12);
  placeHouse(-19, -10, Math.PI);
  place(makeMarket, 2, -42);
  place(makeWell, -7, -39);
  place(makeGarden, 12, -29);
  place(makeGarden, -10, -29);

  return [
    makeVillager(scene, -8, -31, "#b96749", 0.4, "garden", getGroundHeight(-8, -31)),
    makeVillager(scene, 7, -39, "#758b67", 1.8, "market", getGroundHeight(7, -39)),
    makeVillager(scene, 17, -31, "#627c91", 2.7, "garden", getGroundHeight(17, -31)),
    makeVillager(scene, -7, -39, "#b28b50", 4.3, "well", getGroundHeight(-7, -39)),
  ];
}

export function animateVillagers(villagers, time, getGroundHeight) {
  villagers.forEach(({ group, legs, arms, homeX, homeZ, phase, role, speed }) => {
    const step = time * speed + phase;
    const radius = role === "garden" ? 2.6 : role === "well" ? 0.75 : 4.5;
    const x = homeX + Math.sin(step) * radius;
    const z = homeZ + Math.sin(step * 0.63) * radius * 0.55;
    const directionX = x - group.position.x;
    const directionZ = z - group.position.z;
    group.position.set(x, getGroundHeight(x, z) + Math.abs(Math.sin(step * 2)) * 0.035, z);
    if (Math.hypot(directionX, directionZ) > 0.001) {
      group.rotation.y = Math.atan2(-directionX, -directionZ);
    }
    const walking = Math.abs(Math.cos(step)) > 0.22;
    legs[0].rotation.x = walking ? Math.sin(step * 4) * 0.36 : 0;
    legs[1].rotation.x = walking ? -Math.sin(step * 4) * 0.36 : 0;
    arms[0].rotation.x = role === "garden"
      ? Math.sin(time * 2.3 + phase) * 0.38
      : role === "well"
        ? -0.5 + Math.sin(time * 1.8 + phase) * 0.3
        : walking ? -Math.sin(step * 4) * 0.24 : Math.sin(time * 1.7 + phase) * 0.12;
    arms[1].rotation.x = role === "well"
      ? -0.5 + Math.sin(time * 1.8 + phase + Math.PI) * 0.3
      : walking ? Math.sin(step * 4) * 0.24 : Math.cos(time * 1.3 + phase) * 0.09;
  });
}
