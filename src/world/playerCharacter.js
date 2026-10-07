import * as THREE from "three";

const leafShape = new THREE.Shape();
leafShape.moveTo(0, -0.24);
leafShape.bezierCurveTo(-0.33, -0.12, -0.29, 0.2, 0, 0.31);
leafShape.bezierCurveTo(0.27, 0.16, 0.31, -0.12, 0, -0.24);
leafShape.closePath();

function addLeafEmblem(parent, material, position, scale = 1) {
  const emblem = new THREE.Group();
  emblem.position.set(...position);
  emblem.scale.setScalar(scale);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 10), material);
    leaf.position.set(side * 0.1, 0.055, 0.015);
    leaf.scale.set(0.4, 0.72, 1);
    leaf.rotation.z = side * 0.68;
    emblem.add(leaf);
  }

  const stemCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.01, -0.2, 0.026),
    new THREE.Vector3(-0.015, -0.03, 0.026),
    new THREE.Vector3(0, 0.2, 0.026),
  );
  emblem.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 10, 0.012, 5, false), material));
  parent.add(emblem);
  return emblem;
}

export function makePlayerCharacter(scene, x, z, getTerrainHeight) {
  const explorer = new THREE.Group();
  const hoodie = new THREE.MeshStandardMaterial({ color: "#4d7047", roughness: 0.91 });
  const hoodieShade = new THREE.MeshStandardMaterial({ color: "#344d36", roughness: 0.96 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#b99b70", roughness: 0.98 });
  const trouserShade = new THREE.MeshStandardMaterial({ color: "#9e8059", roughness: 1 });
  const boots = new THREE.MeshStandardMaterial({ color: "#594332", roughness: 0.92 });
  const sole = new THREE.MeshStandardMaterial({ color: "#332b23", roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: "#d89b73", roughness: 0.87 });
  const hair = new THREE.MeshStandardMaterial({ color: "#30231d", roughness: 0.98 });
  const hairLight = new THREE.MeshStandardMaterial({ color: "#493127", roughness: 0.95 });
  const canvas = new THREE.MeshStandardMaterial({ color: "#405c3b", roughness: 0.96 });
  const canvasLight = new THREE.MeshStandardMaterial({ color: "#66814d", roughness: 0.94 });
  const bottleMaterial = new THREE.MeshStandardMaterial({
    color: "#547e83",
    roughness: 0.46,
    metalness: 0.08,
  });
  const bottleCapMaterial = new THREE.MeshStandardMaterial({
    color: "#d0c29a",
    roughness: 0.7,
  });
  const trim = new THREE.MeshStandardMaterial({ color: "#d2bc8c", roughness: 0.82 });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: "#d9e5aa",
    roughness: 0.76,
    side: THREE.DoubleSide,
  });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: "#fff4dc", roughness: 0.45 });
  const iris = new THREE.MeshStandardMaterial({ color: "#573b28", roughness: 0.45 });
  const pupil = new THREE.MeshStandardMaterial({ color: "#201915", roughness: 0.38 });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: "#844a3d", roughness: 0.85 });
  const cheekMaterial = new THREE.MeshStandardMaterial({
    color: "#d48669",
    roughness: 0.9,
    transparent: true,
    opacity: 0.52,
  });

  const addEllipsoid = (parent, material, position, scale, segments = [16, 12]) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, segments[0], segments[1]),
      material,
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };

  const addBox = (parent, material, position, size) => {
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const hips = addEllipsoid(explorer, trousers, [0, 0.77, 0], [0.31, 0.23, 0.23]);
  const torso = addEllipsoid(explorer, hoodie, [0, 1.2, 0], [0.35, 0.47, 0.27]);
  const shoulders = addEllipsoid(explorer, hoodie, [0, 1.45, 0.005], [0.43, 0.2, 0.27]);

  const hood = addEllipsoid(explorer, hoodieShade, [0, 1.48, 0.19], [0.27, 0.29, 0.17]);
  hood.rotation.x = -0.16;
  const hoodOpening = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 7, 16),
    trim,
  );
  hoodOpening.position.set(0, 1.49, -0.005);
  hoodOpening.rotation.x = Math.PI / 2;
  explorer.add(hoodOpening);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.19, 12), skin);
  neck.position.y = 1.61;
  explorer.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.86, -0.02);
  head.scale.setScalar(1.1);
  explorer.add(head);
  const addHeadEllipsoid = (material, position, scale, segments = [16, 12]) => (
    addEllipsoid(
      head,
      material,
      [position[0], position[1] - 1.86, position[2] + 0.02],
      scale,
      segments,
    )
  );
  addHeadEllipsoid(skin, [0, 1.86, -0.02], [0.255, 0.3, 0.225], [24, 18]);
  addHeadEllipsoid(hair, [0, 2.025, 0.005], [0.25, 0.17, 0.235], [20, 14]);
  addHeadEllipsoid(hair, [0, 1.88, 0.135], [0.235, 0.24, 0.125], [20, 14]);

  const curls = [
    [-0.19, 2.06, -0.01, 0.095],
    [-0.1, 2.14, 0.005, 0.09],
    [0.015, 2.16, 0, 0.095],
    [0.12, 2.11, 0.005, 0.1],
    [0.2, 2.04, 0.025, 0.09],
    [-0.2, 1.96, -0.005, 0.075],
    [0.19, 1.96, 0, 0.08],
  ];
  curls.forEach(([cx, cy, cz, size], index) => {
    const curl = addHeadEllipsoid(
      index % 2 === 0 ? hair : hairLight,
      [cx, cy, cz],
      [size, size * 0.79, size * 0.82],
      [12, 9],
    );
    curl.rotation.z = cx * -0.8;
  });

  const fringe = addHeadEllipsoid(hairLight, [-0.015, 2.005, -0.16], [0.19, 0.085, 0.09]);
  fringe.rotation.z = -0.18;
  addHeadEllipsoid(hair, [-0.125, 1.965, -0.17], [0.105, 0.075, 0.07]);
  addHeadEllipsoid(hair, [0.105, 1.98, -0.165], [0.11, 0.065, 0.065]);

  for (const side of [-1, 1]) {
    addHeadEllipsoid(skin, [side * 0.24, 1.85, -0.005], [0.062, 0.08, 0.05], [12, 9]);
    addHeadEllipsoid(eyeWhite, [side * 0.09, 1.87, -0.218], [0.06, 0.075, 0.02], [14, 10]);
    addHeadEllipsoid(iris, [side * 0.09, 1.867, -0.237], [0.031, 0.04, 0.013], [12, 9]);
    addHeadEllipsoid(pupil, [side * 0.09, 1.867, -0.248], [0.016, 0.026, 0.009], [10, 8]);
    addHeadEllipsoid(eyeWhite, [side * 0.082, 1.882, -0.256], [0.008, 0.01, 0.006], [8, 6]);
    const brow = addHeadEllipsoid(
      hairLight,
      [side * 0.09, 1.95, -0.218],
      [0.052, 0.013, 0.012],
      [10, 7],
    );
    brow.rotation.z = side * -0.12;
  }
  addHeadEllipsoid(skin, [0, 1.82, -0.238], [0.033, 0.04, 0.032], [10, 8]);
  const smile = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.065, 1.76 - 1.86, -0.23 + 0.02),
    new THREE.Vector3(0, 1.72 - 1.86, -0.24 + 0.02),
    new THREE.Vector3(0.065, 1.76 - 1.86, -0.23 + 0.02),
  );
  head.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 12, 0.009, 6, false), mouthMaterial));
  for (const side of [-1, 1]) {
    addHeadEllipsoid(cheekMaterial, [side * 0.15, 1.79, -0.192], [0.05, 0.025, 0.008], [10, 8]);
  }

  const drawstrings = [];
  for (const side of [-1, 1]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.22, 6), trim);
    cord.position.set(side * 0.055, 1.38, -0.262);
    cord.rotation.z = side * -0.12;
    explorer.add(cord);
    drawstrings.push(cord);
  }
  const pocket = addEllipsoid(explorer, hoodieShade, [0, 1.05, -0.235], [0.22, 0.105, 0.055]);
  pocket.rotation.x = -0.08;
  addLeafEmblem(explorer, leafMaterial, [0, 1.2, -0.276], 0.46);

  const backpack = new THREE.Group();
  explorer.add(backpack);
  addEllipsoid(backpack, canvas, [0, 1.22, 0.31], [0.26, 0.34, 0.19]);
  const packFlap = addBox(backpack, canvasLight, [0, 1.45, 0.47], [0.34, 0.16, 0.045]);
  packFlap.rotation.x = -0.12;
  addBox(backpack, canvasLight, [0, 1.17, 0.49], [0.23, 0.2, 0.045]);
  const packBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.025), trim);
  packBuckle.position.set(0, 1.38, 0.51);
  backpack.add(packBuckle);
  addLeafEmblem(backpack, leafMaterial, [0, 1.23, 0.525], 0.48);
  const bedrollMaterial = new THREE.MeshStandardMaterial({ color: "#627b48", roughness: 0.95 });
  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.48, 14), bedrollMaterial);
  bedroll.position.set(0, 1.56, 0.37);
  bedroll.rotation.z = Math.PI / 2;
  backpack.add(bedroll);
  for (const side of [-1, 1]) {
    const rollStrap = addBox(backpack, canvasLight, [side * 0.15, 1.56, 0.37], [0.035, 0.19, 0.19]);
    rollStrap.rotation.z = Math.PI / 2;
  }
  const waterBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.28, 12), bottleMaterial);
  waterBottle.position.set(-0.285, 1.13, 0.49);
  backpack.add(waterBottle);
  const bottleShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.06, 10), bottleMaterial);
  bottleShoulder.position.set(-0.285, 1.3, 0.49);
  backpack.add(bottleShoulder);
  const bottleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 10), bottleCapMaterial);
  bottleCap.position.set(-0.285, 1.352, 0.49);
  backpack.add(bottleCap);
  const bottleLoop = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 5, 10), canvasLight);
  bottleLoop.position.set(-0.285, 1.38, 0.49);
  backpack.add(bottleLoop);
  for (const side of [-1, 1]) {
    const strap = addBox(backpack, canvasLight, [side * 0.21, 1.24, -0.17], [0.07, 0.58, 0.045]);
    strap.rotation.z = side * -0.12;
    const packSidePocket = addEllipsoid(
      backpack,
      hoodieShade,
      [side * 0.235, 1.08, 0.31],
      [0.055, 0.13, 0.1],
    );
    packSidePocket.rotation.z = side * 0.08;
  }

  const jacketHem = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 6, 18), hoodieShade);
  jacketHem.position.y = 0.91;
  jacketHem.rotation.x = Math.PI / 2;
  explorer.add(jacketHem);

  const legs = [];
  const feet = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15, 0.69, 0);
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), trousers);
    thigh.position.y = -0.17;
    thigh.scale.set(0.145, 0.27, 0.16);
    leg.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), trousers);
    knee.position.set(0, -0.39, -0.015);
    knee.scale.set(0.135, 0.12, 0.15);
    leg.add(knee);
    const cargoPocket = addBox(leg, trouserShade, [side * 0.105, -0.34, -0.11], [0.09, 0.16, 0.055]);
    cargoPocket.rotation.z = side * -0.08;
    const pocketFlap = addBox(leg, canvasLight, [side * 0.105, -0.275, -0.144], [0.095, 0.045, 0.018]);
    pocketFlap.rotation.z = side * -0.08;
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.3, 12), trousers);
    calf.position.y = -0.56;
    leg.add(calf);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 6, 12), trouserShade);
    cuff.position.y = -0.68;
    cuff.rotation.x = Math.PI / 2;
    leg.add(cuff);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.065, 0.34), sole);
    bootSole.position.set(0, -0.76, -0.07);
    leg.add(bootSole);
    const boot = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), boots);
    boot.position.set(0, -0.715, -0.085);
    boot.scale.set(0.13, 0.105, 0.2);
    leg.add(boot);
    feet.push({ boot, sole: bootSole });
    for (let lace = 0; lace < 3; lace += 1) {
      const bootLace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.014), trim);
      bootLace.position.set(0, -0.68 - lace * 0.025, -0.19);
      leg.add(bootLace);
    }
    explorer.add(leg);
    legs.push(leg);
  }

  const arms = [];
  const hands = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.37, 1.46, 0);

    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), hoodie);
    sleeve.position.set(side * 0.035, -0.2, 0);
    sleeve.scale.set(0.14, 0.25, 0.15);
    arm.add(sleeve);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), hoodie);
    elbow.position.set(side * 0.045, -0.38, 0);
    elbow.scale.set(0.11, 0.12, 0.13);
    arm.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.23, 10), hoodie);
    forearm.position.set(side * 0.055, -0.5, 0);
    arm.add(forearm);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.022, 6, 12), hoodieShade);
    cuff.position.set(side * 0.055, -0.61, 0);
    cuff.rotation.x = Math.PI / 2;
    arm.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), skin);
    hand.position.set(side * 0.055, -0.7, -0.01);
    hand.scale.set(0.09, 0.1, 0.075);
    arm.add(hand);
    hands.push(hand);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), skin);
    thumb.position.set(side * 0.105, -0.69, -0.04);
    thumb.scale.set(0.04, 0.055, 0.045);
    arm.add(thumb);

    explorer.add(arm);
    arms.push(arm);
  }

  explorer.position.set(x, getTerrainHeight(x, z), z);
  scene.add(explorer);
  return {
    group: explorer,
    legs,
    feet,
    arms,
    hands,
    head,
    torso,
    shoulders,
    hips,
    backpack,
    drawstrings,
  };
}
