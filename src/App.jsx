import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./App.css";

const palette = {
  bark: ["#77563b", "#916c48", "#684a35"],
  leaf: ["#668d58", "#789b5c", "#496f52", "#9eaa62"],
};

const treeTypes = [
  { id: "oak", name: "Canopy oak", color: "#789b5c" },
  { id: "pine", name: "Pine", color: "#54755e" },
  { id: "birch", name: "Silver birch", color: "#b6c18b" },
  { id: "willow", name: "Golden willow", color: "#c7aa61" },
];

const saveKey = "fernwake-world-save";

function readWorldSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
    return {
      badges: Number.isInteger(saved.badges) ? Math.max(0, saved.badges) : 0,
      collectedBadges: Array.isArray(saved.collectedBadges)
        ? saved.collectedBadges
        : [],
      plantedTrees: Array.isArray(saved.plantedTrees) ? saved.plantedTrees : [],
      nightMode: Boolean(saved.nightMode),
      selectedTree: treeTypes.some((tree) => tree.id === saved.selectedTree)
        ? saved.selectedTree
        : treeTypes[0].id,
    };
  } catch {
    return {
      badges: 0,
      collectedBadges: [],
      plantedTrees: [],
      nightMode: false,
      selectedTree: treeTypes[0].id,
    };
  }
}

function saveWorldProgress(progress) {
  try {
    localStorage.setItem(saveKey, JSON.stringify(progress));
  } catch {
    return;
  }
}

function terrainHeight(x, z) {
  return (
    Math.sin(x * 0.032) * 1.15 +
    Math.sin(z * 0.046 + x * 0.015) * 0.8 +
    Math.cos((x + z) * 0.02) * 0.55
  );
}

function makeAnimal(scene, kind, x, z, scale = 1) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({
    color: kind.color,
    roughness: 0.9,
  });
  const darkFur = new THREE.MeshStandardMaterial({
    color: kind.dark,
    roughness: 1,
  });
  const eye = new THREE.MeshStandardMaterial({
    color: "#29291f",
    roughness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), fur);
  body.scale.set(1.05, 0.8, 1.55);
  body.position.y = 0.9;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), fur);
  head.position.set(0, 1.15, -0.9);
  group.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), darkFur);
  muzzle.position.set(0, 0.98, -1.2);
  group.add(muzzle);

  const legs = [];
  for (const side of [-1, 1]) {
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eye);
    eyeMesh.position.set(side * 0.25, 1.27, -1.12);
    group.add(eyeMesh);

    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.075, 0.55, 7),
      darkFur,
    );
    leg.position.set(side * 0.34, 0.38, -0.48);
    group.add(leg);
    const rearLeg = leg.clone();
    rearLeg.position.z = 0.62;
    group.add(rearLeg);
    legs.push(leg, rearLeg);
  }

  if (kind.ears) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.48, 7), fur);
      ear.position.set(side * 0.27, 1.62, -0.78);
      ear.rotation.z = side * -0.16;
      group.add(ear);
    }
  }

  if (kind.antlers) {
    for (const side of [-1, 1]) {
      const antler = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.06, 0.65, 6),
        darkFur,
      );
      antler.add(stem);
      for (const branch of [-1, 1]) {
        const tine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.04, 0.34, 5),
          darkFur,
        );
        tine.position.set(branch * 0.13, 0.12, 0);
        tine.rotation.z = branch * 0.55;
        antler.add(tine);
      }
      antler.position.set(side * 0.25, 1.48, -0.82);
      antler.rotation.z = side * -0.3;
      group.add(antler);
    }
  }

  group.position.set(x, terrainHeight(x, z), z);
  group.scale.setScalar(scale);
  group.rotation.y = Math.atan2(-x, z) + Math.PI;
  scene.add(group);
  return {
    group,
    legs,
    homeX: x,
    homeZ: z,
    wanderRadius: 3 + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.16 + Math.random() * 0.14,
  };
}

function makeTree(scene, x, z, scale, variant, species = "oak") {
  const tree = new THREE.Group();
  const barkColor = species === "birch" ? "#d9d1b2" : palette.bark[variant % palette.bark.length];
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      (species === "birch" ? 0.14 : 0.2) * scale,
      (species === "birch" ? 0.22 : 0.34) * scale,
      2.8 * scale,
      7,
    ),
    new THREE.MeshStandardMaterial({
      color: barkColor,
      roughness: 1,
    }),
  );
  trunk.position.y = 1.4 * scale;
  tree.add(trunk);

  if (species === "birch") {
    const markingMaterial = new THREE.MeshStandardMaterial({ color: "#49483b", roughness: 1 });
    for (let mark = 0; mark < 4; mark += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.055 * scale, 0.025 * scale), markingMaterial);
      stripe.position.set(0, (0.65 + mark * 0.42) * scale, -0.16 * scale);
      tree.add(stripe);
    }
  }

  const leafMaterial = new THREE.MeshStandardMaterial({
    color:
      species === "birch"
        ? "#aabd7a"
        : species === "willow"
          ? "#c5a85f"
          : palette.leaf[variant % palette.leaf.length],
    roughness: 1,
  });

  if (species === "pine") {
    for (let layer = 0; layer < 4; layer += 1) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry((1.35 - layer * 0.22) * scale, 1.65 * scale, 8),
        leafMaterial,
      );
      crown.position.y = (2.2 + layer * 0.72) * scale;
      tree.add(crown);
    }
  } else if (species === "willow") {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 * scale, 1), leafMaterial);
    crown.position.y = 3.45 * scale;
    crown.scale.set(1.25, 0.8, 1.15);
    tree.add(crown);
    for (let branch = 0; branch < 7; branch += 1) {
      const angle = (branch / 7) * Math.PI * 2;
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.27 * scale, 7, 6), leafMaterial);
      foliage.position.set(Math.cos(angle) * 1.15 * scale, (2.05 + (branch % 3) * 0.26) * scale, Math.sin(angle) * 1.15 * scale);
      foliage.scale.set(0.72, 1.7, 0.72);
      tree.add(foliage);
    }
  } else {
    const layers = species === "birch" ? 3 : 2 + (variant % 2);
    for (let layer = 0; layer < layers; layer += 1) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry((species === "birch" ? 0.92 : 1.25 - layer * 0.24) * scale, 1),
        leafMaterial,
      );
      crown.position.set(
        (Math.random() - 0.5) * 0.35 * scale,
        (2.8 + layer * 0.88) * scale,
        (Math.random() - 0.5) * 0.3 * scale,
      );
      crown.scale.y = 1.05;
      tree.add(crown);
    }
  }
  tree.position.set(x, 0, z);
  scene.add(tree);
  return tree;
}

function makeBadge(scene, id, x, z) {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: "#e5c979",
    emissive: "#9c8b34",
    emissiveIntensity: 1.5,
    metalness: 0.28,
    roughness: 0.38,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: "#d8e69b",
    emissive: "#536b2d",
    emissiveIntensity: 1.25,
    roughness: 0.5,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.075, 8, 20), ringMaterial);
  group.add(ring);
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), leafMaterial);
  leaf.scale.set(0.62, 1.2, 0.35);
  group.add(leaf);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 5), ringMaterial);
  stem.rotation.z = -0.55;
  group.add(stem);
  group.position.set(x, terrainHeight(x, z) + 1.1, z);
  scene.add(group);
  return { id, group, phase: id * 1.71 };
}

function makeNest(tree, scale) {
  const nest = new THREE.Group();
  const twigs = new THREE.MeshStandardMaterial({ color: "#644936", roughness: 1 });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.38 * scale, 0.07 * scale, 5, 14),
    twigs,
  );
  rim.rotation.x = Math.PI / 2;
  nest.add(rim);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 * scale, 0.035 * scale, 0.9 * scale, 4),
      twigs,
    );
    twig.position.set(Math.cos(angle) * 0.28 * scale, 0, Math.sin(angle) * 0.28 * scale);
    twig.rotation.set(Math.cos(angle) * 0.35, angle, Math.sin(angle) * 0.35);
    nest.add(twig);
  }
  nest.position.set(0, (4.15 + Math.random() * 1.15) * scale, 0);
  tree.add(nest);
  return nest;
}

function makeBird(scene, index, materials, nest) {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    materials.body,
  );
  body.scale.set(0.8, 0.7, 1.6);
  bird.add(body);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.2, 5),
    materials.beak,
  );
  beak.position.z = -0.25;
  beak.rotation.x = -Math.PI / 2;
  bird.add(beak);
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.045, 0.23),
      materials.wing,
    );
    wing.position.x = side * 0.3;
    wing.rotation.z = side * 0.16;
    bird.add(wing);
    wings.push(wing);
  }
  scene.add(bird);
  return {
    bird,
    wings,
    nest,
    roostPosition: new THREE.Vector3(),
    flightPosition: new THREE.Vector3(),
    phase: index * 0.82,
    radius: 14 + (index % 4) * 5,
    height: 9 + (index % 5) * 1.4,
  };
}

function makeOwl(scene, x, y, z, scale = 1) {
  const owl = new THREE.Group();
  const feathers = new THREE.MeshStandardMaterial({ color: "#70523c", roughness: 0.95 });
  const breast = new THREE.MeshStandardMaterial({ color: "#d7c79e", roughness: 1 });
  const eyeRing = new THREE.MeshStandardMaterial({ color: "#e2b94f", emissive: "#5c3f12", emissiveIntensity: 0.5 });
  const pupil = new THREE.MeshStandardMaterial({ color: "#171b1c", roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), feathers);
  body.scale.set(0.82, 1.18, 0.7);
  body.position.y = 0.58;
  owl.add(body);
  const bib = new THREE.Mesh(new THREE.SphereGeometry(0.37, 10, 8), breast);
  bib.scale.set(0.82, 1.1, 0.28);
  bib.position.set(0, 0.56, 0.34);
  owl.add(bib);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), feathers);
  head.position.set(0, 1.24, 0.03);
  owl.add(head);
  const wings = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), eyeRing);
    eye.position.set(side * 0.19, 1.27, 0.42);
    owl.add(eye);
    const eyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), pupil);
    eyePupil.position.set(side * 0.19, 1.27, 0.58);
    owl.add(eyePupil);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), feathers);
    tuft.position.set(side * 0.31, 1.65, 0.02);
    tuft.rotation.z = side * -0.42;
    owl.add(tuft);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.31, 9, 7), feathers);
    wing.scale.set(1.35, 0.48, 0.3);
    wing.position.set(side * 0.48, 0.7, 0.04);
    wing.rotation.z = side * 0.18;
    owl.add(wing);
    wings.push(wing);
  }
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.24, 5),
    new THREE.MeshStandardMaterial({ color: "#d29a42", roughness: 0.7 }),
  );
  beak.position.set(0, 1.06, 0.51);
  beak.rotation.x = Math.PI / 2;
  owl.add(beak);
  owl.position.set(x, y, z);
  owl.scale.setScalar(scale);
  scene.add(owl);
  return { group: owl, wings, phase: Math.random() * Math.PI * 2 };
}

function makeWorker(scene, x, z, shirtColor, phase) {
  const person = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#394b43", roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: "#c58c65", roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.33, 0.85, 8), shirt);
  body.position.y = 1.13;
  person.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 9, 8), skin);
  head.position.y = 1.82;
  person.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.25, 0.13, 8), new THREE.MeshStandardMaterial({ color: "#8b6844", roughness: 1 }));
  hat.position.y = 2.05;
  person.add(hat);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.62, 6), trousers);
    leg.position.set(side * 0.13, 0.39, 0);
    person.add(leg);
  }
  const arm = new THREE.Group();
  arm.position.set(0.25, 1.42, 0);
  const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.53, 6), shirt);
  upperArm.position.y = -0.25;
  arm.add(upperArm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), skin);
  hand.position.y = -0.53;
  arm.add(hand);
  const toolHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.15, 5), new THREE.MeshStandardMaterial({ color: "#806243", roughness: 1 }));
  toolHandle.position.set(0.12, -0.77, 0.02);
  toolHandle.rotation.z = -0.18;
  arm.add(toolHandle);
  const rakeHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: "#73776b", metalness: 0.35, roughness: 0.75 }));
  rakeHead.position.set(0.22, -1.24, 0.02);
  arm.add(rakeHead);
  person.add(arm);
  const otherArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.55, 6), shirt);
  otherArm.position.set(-0.27, 1.17, 0.03);
  otherArm.rotation.z = -0.28;
  person.add(otherArm);
  person.position.set(x, terrainHeight(x, z), z);
  person.rotation.y = -0.42;
  scene.add(person);
  return { group: person, arm, phase };
}

function makeCabin(scene, x, z) {
  const cabin = new THREE.Group();
  const logs = new THREE.MeshStandardMaterial({ color: "#76563d", roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#4a3a2f", roughness: 1 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: "#48534a", roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: "#858276", roughness: 1 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 4.8), logs);
  wall.position.y = 2.05;
  cabin.add(wall);
  for (let row = 0; row < 6; row += 1) {
    const frontLog = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.8, 7), logs);
    frontLog.rotation.z = Math.PI / 2;
    frontLog.position.set(0, 0.58 + row * 0.52, 2.44);
    cabin.add(frontLog);
    const backLog = frontLog.clone();
    backLog.position.z = -2.44;
    cabin.add(backLog);
    for (const side of [-1, 1]) {
      const sideLog = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.1, 7), logs);
      sideLog.rotation.x = Math.PI / 2;
      sideLog.position.set(side * 3.2, 0.58 + row * 0.52, 0);
      cabin.add(sideLog);
    }
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.32, 5.8), darkWood);
  floor.position.set(0, 0.15, 0);
  cabin.add(floor);
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.28, 5.8), roofMaterial);
    roof.position.set(side * 1.72, 4.25, 0);
    roof.rotation.z = side * -0.58;
    cabin.add(roof);
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.86, 0.08),
      new THREE.MeshStandardMaterial({ color: "#d3b977", emissive: "#271e0e", emissiveIntensity: 0.2, roughness: 0.35 }),
    );
    pane.position.set(side * 1.82, 2.35, 2.49);
    cabin.add(pane);
    for (const edge of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.98, 0.12), darkWood);
      frame.position.set(side * 1.82 + edge * 0.47, 2.35, 2.56);
      cabin.add(frame);
    }
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 0.13), darkWood);
    crossbar.position.set(side * 1.82, 2.35, 2.56);
    cabin.add(crossbar);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.45, 0.16), darkWood);
  door.position.set(0, 1.38, 2.54);
  cabin.add(door);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({ color: "#d9b66a", metalness: 0.55, roughness: 0.4 }));
  handle.position.set(0.35, 1.35, 2.65);
  cabin.add(handle);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.74, 2.1, 0.86), stone);
  chimney.position.set(-1.8, 5.2, -0.75);
  cabin.add(chimney);
  const chimneyTop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 1.12), darkWood);
  chimneyTop.position.set(-1.8, 6.27, -0.75);
  cabin.add(chimneyTop);
  cabin.position.set(x, terrainHeight(x, z), z);
  scene.add(cabin);

  for (let stoneIndex = 0; stoneIndex < 5; stoneIndex += 1) {
    const angle = (stoneIndex / 5) * Math.PI * 2;
    const hearthStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stone);
    hearthStone.position.set(x - 1.45 + Math.cos(angle) * 0.58, terrainHeight(x, z) + 0.16, z + 3.18 + Math.sin(angle) * 0.38);
    hearthStone.scale.set(1.2, 0.72, 0.9);
    scene.add(hearthStone);
  }
  for (const side of [-1, 1]) {
    const firewood = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.95, 7), darkWood);
    firewood.rotation.z = Math.PI / 2;
    firewood.rotation.y = side * 0.34;
    firewood.position.set(x - 1.45, terrainHeight(x, z) + 0.23, z + 3.18 + side * 0.13);
    scene.add(firewood);
  }

  const flameMaterials = ["#e87935", "#ffbc58", "#fff0a2"].map((color) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.3, roughness: 0.35 }),
  );
  const flames = flameMaterials.map((material, index) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.31 - index * 0.055, 1.12 - index * 0.16, 8), material);
    flame.position.set(x - 1.65 + index * 0.2, terrainHeight(x, z) + 0.68, z + 3.2);
    scene.add(flame);
    return flame;
  });
  const fireLight = new THREE.PointLight("#ff9a45", 0, 15, 2);
  fireLight.position.set(x - 1.3, terrainHeight(x, z) + 1.15, z + 3.5);
  scene.add(fireLight);

  const smokePuffs = Array.from({ length: 9 }, (_, index) => {
    const material = new THREE.MeshStandardMaterial({ color: "#c7cbd0", emissive: "#414a58", emissiveIntensity: 0.18, transparent: true, opacity: 0.28, roughness: 1, depthWrite: false });
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 7), material);
    puff.visible = false;
    scene.add(puff);
    return { mesh: puff, phase: index / 9 };
  });
  return { cabin, flames, fireLight, smokePuffs, x, z };
}

function App() {
  const canvasRef = useRef(null);
  const [worldSave] = useState(readWorldSave);
  const [isExploring, setIsExploring] = useState(false);
  const isExploringRef = useRef(false);
  const introWalkRemainingRef = useRef(0);
  const [badgeCount, setBadgeCount] = useState(worldSave.badges);
  const [plantedTrees, setPlantedTrees] = useState(worldSave.plantedTrees);
  const [selectedTree, setSelectedTree] = useState(worldSave.selectedTree);
  const [nightMode, setNightMode] = useState(worldSave.nightMode);
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const badgeCountRef = useRef(worldSave.badges);
  const collectedBadgesRef = useRef(new Set(worldSave.collectedBadges));
  const plantedTreesRef = useRef(worldSave.plantedTrees);
  const selectedTreeRef = useRef(worldSave.selectedTree);
  const nightModeRef = useRef(worldSave.nightMode);
  const worldRef = useRef(null);
  const plantActionRef = useRef(null);
  const chooseTreeRef = useRef(null);
  const toggleNightModeRef = useRef(null);
  const ambientAudioRef = useRef(null);

  const persistProgress = useCallback(() =>
    saveWorldProgress({
      badges: badgeCountRef.current,
      collectedBadges: [...collectedBadgesRef.current],
      plantedTrees: plantedTreesRef.current,
      selectedTree: selectedTreeRef.current,
      nightMode: nightModeRef.current,
    }), []);

  const chooseTree = useCallback((treeId) => {
    selectedTreeRef.current = treeId;
    setSelectedTree(treeId);
    persistProgress();
  }, [persistProgress]);

  const toggleNightMode = useCallback(() => {
    nightModeRef.current = !nightModeRef.current;
    setNightMode(nightModeRef.current);
    persistProgress();
  }, [persistProgress]);

  const toggleAmbient = async () => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.stop();
      ambientAudioRef.current = null;
      setAmbientPlaying(false);
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    await context.resume();
    const master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);
    master.gain.setTargetAtTime(0.27, context.currentTime, 1.2);

    const windBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const windData = windBuffer.getChannelData(0);
    for (let index = 0; index < windData.length; index += 1) {
      windData[index] = (Math.random() * 2 - 1) * 0.35;
    }
    const wind = context.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = nightModeRef.current ? 260 : 420;
    const windVolume = context.createGain();
    windVolume.gain.value = 0.18;
    wind.connect(windFilter);
    windFilter.connect(windVolume);
    windVolume.connect(master);
    wind.start();

    const droneOscillators = [98, 146.83, 196].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      volume.gain.value = index === 0 ? 0.16 : 0.09;
      oscillator.connect(volume);
      volume.connect(master);
      oscillator.start();
      return oscillator;
    });

    const dayNotes = [523.25, 659.25, 783.99, 659.25, 587.33];
    const nightNotes = [392, 493.88, 587.33, 493.88, 440];
    let noteIndex = 0;
    const playNote = () => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const now = context.currentTime;
      const notes = nightModeRef.current ? nightNotes : dayNotes;
      oscillator.type = "sine";
      oscillator.frequency.value = notes[noteIndex % notes.length];
      noteIndex += 1;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.12, now + 0.5);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 3.25);
    };
    playNote();
    const noteTimer = window.setInterval(playNote, 3600);

    ambientAudioRef.current = {
      setNight(isNight) {
        windFilter.frequency.setTargetAtTime(isNight ? 260 : 420, context.currentTime, 1.4);
      },
      stop() {
        window.clearInterval(noteTimer);
        master.gain.setTargetAtTime(0.0001, context.currentTime, 0.35);
        window.setTimeout(() => context.close(), 1800);
        droneOscillators.forEach((oscillator) => oscillator.stop(context.currentTime + 1.5));
        wind.stop(context.currentTime + 1.5);
      },
    };
    setAmbientPlaying(true);
  };

  const beginExploring = () => {
    isExploringRef.current = true;
    introWalkRemainingRef.current = 1.7;
    setIsExploring(true);
  };

  const leaveExploring = () => {
    isExploringRef.current = false;
    introWalkRemainingRef.current = 0;
    setIsExploring(false);
  };

  useEffect(() => {
    chooseTreeRef.current = chooseTree;
    toggleNightModeRef.current = toggleNightMode;
  }, [chooseTree, toggleNightMode]);

  useEffect(() => () => ambientAudioRef.current?.stop(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bdd7d6");
    scene.fog = new THREE.Fog("#bdd7d6", 55, 185);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      250,
    );
    camera.position.set(0, 2.05, 12);
    camera.rotation.order = "YXZ";
    camera.rotation.x = -0.045;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;

    const hemiLight = new THREE.HemisphereLight("#e2f5ef", "#65764c", 2.15);
    scene.add(hemiLight);
    const sun = new THREE.DirectionalLight("#ffe4ac", 3.2);
    sun.position.set(-34, 52, 22);
    scene.add(sun);

    const terrainGeometry = new THREE.PlaneGeometry(360, 360, 110, 110);
    terrainGeometry.rotateX(-Math.PI / 2);
    const positions = terrainGeometry.attributes.position;
    const groundColors = [];
    const lowland = new THREE.Color("#829563");
    const meadow = new THREE.Color("#a5a86d");
    const highland = new THREE.Color("#c2ae79");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const height = terrainHeight(x, z);
      positions.setY(index, height);
      const color =
        height > 1.05
          ? highland.clone()
          : lowland.clone().lerp(meadow, (height + 2.4) / 5.1);
      const variation =
        0.96 + (Math.sin(x * 1.72 + z * 2.16) * 0.5 + 0.5) * 0.075;
      groundColors.push(
        color.r * variation,
        color.g * variation,
        color.b * variation,
      );
    }
    terrainGeometry.attributes.position.needsUpdate = true;
    terrainGeometry.computeVertexNormals();
    terrainGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(groundColors, 3),
    );
    const groundMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
    });
    const ground = new THREE.Mesh(terrainGeometry, groundMaterial);
    ground.receiveShadow = true;
    scene.add(ground);

    const moonLight = new THREE.DirectionalLight("#a9c9ff", 0);
    moonLight.position.set(24, 48, -16);
    scene.add(moonLight);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 20, 16),
      new THREE.MeshBasicMaterial({ color: "#e4e9d8" }),
    );
    moon.position.set(-46, 76, -135);
    moon.visible = false;
    scene.add(moon);
    const starPositions = [];
    for (let index = 0; index < 480; index += 1) {
      starPositions.push(
        (Math.random() - 0.5) * 340,
        42 + Math.random() * 118,
        -165 + Math.random() * 300,
      );
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: "#f0f1d9", size: 0.72, sizeAttenuation: false }),
    );
    stars.visible = false;
    scene.add(stars);

    worldRef.current = { scene, hemiLight, sun, moonLight, moon, stars };

    const hillMaterial = new THREE.MeshStandardMaterial({
      color: "#9eb6a1",
      roughness: 1,
    });
    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2;
      const distance = 100 + Math.random() * 32;
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(
          15 + Math.random() * 18,
          24 + Math.random() * 22,
          7,
        ),
        hillMaterial,
      );
      hill.position.set(
        Math.cos(angle) * distance,
        10,
        Math.sin(angle) * distance - 25,
      );
      hill.rotation.y = Math.random() * Math.PI;
      scene.add(hill);
    }

    const treeNests = [];
    for (let index = 0; index < 165; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 11 + Math.sqrt(Math.random()) * 112;
      const x = Math.cos(angle) * distance;
      const z = 8 - Math.sin(angle) * distance;
      const scale = 0.65 + Math.random() * 1.15;
      const tree = makeTree(scene, x, z, scale, index);
      if (index % 18 === 3) treeNests.push(makeNest(tree, scale));
    }

    const growingTrees = [];
    for (const planted of plantedTreesRef.current) {
      const tree = makeTree(scene, planted.x, planted.z, 1, plantedTreesRef.current.length, planted.species);
      tree.position.y = terrainHeight(planted.x, planted.z);
      tree.scale.setScalar(1.15);
    }

    const badges = Array.from({ length: 40 }, (_, id) => {
      const angle = id * 2.399963;
      const distance = 16 + ((id * 19) % 72);
      const x = id === 0 ? 0 : Math.cos(angle) * distance;
      const z = id === 0 ? 5.5 : 8 - Math.sin(angle) * distance;
      const badge = makeBadge(scene, id, x, z);
      badge.group.visible = true;
      return badge;
    });

    const grassGeometry = new THREE.ConeGeometry(0.11, 0.62, 3);
    grassGeometry.translate(0, 0.3, 0);
    const grass = new THREE.InstancedMesh(
      grassGeometry,
      new THREE.MeshStandardMaterial({ color: "#788d50", roughness: 1 }),
      3500,
    );
    const grassDummy = new THREE.Object3D();
    for (let index = 0; index < 3500; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.sqrt(Math.random()) * 130;
      grassDummy.position.set(
        Math.cos(angle) * distance,
        0,
        6 - Math.sin(angle) * distance,
      );
      grassDummy.rotation.y = Math.random() * Math.PI;
      grassDummy.scale.setScalar(0.55 + Math.random() * 0.85);
      grassDummy.updateMatrix();
      grass.setMatrixAt(index, grassDummy.matrix);
    }
    scene.add(grass);

    const rockMaterial = new THREE.MeshStandardMaterial({
      color: "#929286",
      roughness: 1,
    });
    for (let index = 0; index < 95; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 125;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.8, 0),
        rockMaterial,
      );
      rock.position.set(
        Math.cos(angle) * distance,
        0.27,
        6 - Math.sin(angle) * distance,
      );
      rock.scale.y = 0.55 + Math.random() * 0.6;
      rock.rotation.set(
        Math.random() * 0.6,
        Math.random() * Math.PI,
        Math.random() * 0.3,
      );
      scene.add(rock);
    }

    const animals = [
      {
        kind: { color: "#aa7144", dark: "#533e2c", ears: true, antlers: true },
        x: -11,
        z: -20,
        scale: 1.35,
      },
      {
        kind: { color: "#bc7950", dark: "#604436", ears: true },
        x: 15,
        z: -29,
        scale: 0.95,
      },
      {
        kind: { color: "#d5c49b", dark: "#70614d", ears: true },
        x: -23,
        z: -44,
        scale: 0.65,
      },
      {
        kind: { color: "#54443a", dark: "#312b24", ears: true },
        x: 28,
        z: -50,
        scale: 1.5,
      },
      {
        kind: { color: "#a79473", dark: "#60594d", ears: true },
        x: 7,
        z: -67,
        scale: 0.56,
      },
      {
        kind: { color: "#d39a58", dark: "#71452c", ears: true },
        x: -36,
        z: -37,
        scale: 0.78,
      },
    ].map(({ kind, x, z, scale }) => makeAnimal(scene, kind, x, z, scale));

    const birdMaterials = {
      body: new THREE.MeshStandardMaterial({
        color: "#415d54",
        roughness: 0.8,
      }),
      wing: new THREE.MeshStandardMaterial({
        color: "#293d38",
        side: THREE.DoubleSide,
        roughness: 0.9,
      }),
      beak: new THREE.MeshStandardMaterial({
        color: "#d59c52",
        roughness: 0.8,
      }),
    };
    const birds = Array.from({ length: 15 }, (_, index) =>
      makeBird(scene, index, birdMaterials, treeNests[index % treeNests.length]),
    );

    const cabin = makeCabin(scene, 2, -28);
    const workers = [
      makeWorker(scene, -4, -19, "#b96749", 0.4),
      makeWorker(scene, 8, -20, "#758b67", 1.8),
    ];
    workers.forEach(({ group }) => group.scale.setScalar(1.5));
    const owls = [
      makeOwl(scene, -8, terrainHeight(-8, -22) + 5.1, -22, 0.9),
      makeOwl(scene, 29, terrainHeight(29, -43) + 6.5, -43, 1.05),
    ];
    const nightAnimals = [
      makeAnimal(scene, { color: "#bd7241", dark: "#593c2c", ears: true }, -5, -15, 0.85),
      makeAnimal(scene, { color: "#827b63", dark: "#48443a", ears: true }, 10, -19, 0.7),
    ];
    nightAnimals.forEach(({ group }) => { group.visible = false; });
    owls.forEach(({ group }) => { group.visible = false; });
    Object.assign(worldRef.current, { cabin, workers, owls, nightAnimals });

    const keys = new Set();
    let lookPointer = null;
    const keyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === "escape" && isExploringRef.current) {
        isExploringRef.current = false;
        setIsExploring(false);
        return;
      }
      if (key === "e") {
        event.preventDefault();
        plantActionRef.current?.();
      }
      if (key === "n") {
        event.preventDefault();
        toggleNightModeRef.current?.();
      }
      const treeIndex = Number(key) - 1;
      if (treeIndex >= 0 && treeIndex < treeTypes.length) {
        chooseTreeRef.current?.(treeTypes[treeIndex].id);
      }
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "shift",
          " ",
        ].includes(key)
      ) {
        event.preventDefault();
        introWalkRemainingRef.current = 0;
      }
      keys.add(key);
    };
    const keyUp = (event) => keys.delete(event.key.toLowerCase());
    const handleTouchLookStart = (event) => {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const handleTouchLookMove = (event) => {
      if (!lookPointer || lookPointer.id !== event.pointerId) return;
      camera.rotation.y -= (event.clientX - lookPointer.x) * 0.003;
      camera.rotation.x = THREE.MathUtils.clamp(
        camera.rotation.x - (event.clientY - lookPointer.y) * 0.003,
        -1.25,
        1.25,
      );
      lookPointer.x = event.clientX;
      lookPointer.y = event.clientY;
    };
    const handleTouchLookEnd = (event) => {
      if (lookPointer?.id === event.pointerId) lookPointer = null;
    };
    const pressTouchKey = (event) => {
      const button = event.target.closest("[data-move]");
      if (!button) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(button.dataset.move);
    };
    const releaseTouchKey = (event) => {
      const button = event.target.closest?.("[data-move]");
      if (button) keys.delete(button.dataset.move);
    };
    document.addEventListener("pointerdown", pressTouchKey);
    document.addEventListener("pointerup", releaseTouchKey);
    document.addEventListener("pointercancel", releaseTouchKey);
    document.addEventListener("lostpointercapture", releaseTouchKey);
    canvas.addEventListener("pointerdown", handleTouchLookStart);
    canvas.addEventListener("pointermove", handleTouchLookMove);
    canvas.addEventListener("pointerup", handleTouchLookEnd);
    canvas.addEventListener("pointercancel", handleTouchLookEnd);
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("resize", handleResize);
    const plantSelectedTree = () => {
      if (badgeCountRef.current < 10) return;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const x = THREE.MathUtils.clamp(camera.position.x + direction.x * 5, -145, 145);
      const z = THREE.MathUtils.clamp(camera.position.z + direction.z * 5, -145, 145);
      const species = selectedTreeRef.current;
      const tree = makeTree(scene, x, z, 1, plantedTreesRef.current.length, species);
      tree.position.y = terrainHeight(x, z);
      tree.scale.setScalar(0.025);
      growingTrees.push({ tree, start: frame, scale: 1.15 });
      const nextTrees = [...plantedTreesRef.current, { x, z, species }];
      plantedTreesRef.current = nextTrees;
      badgeCountRef.current -= 10;
      setBadgeCount(badgeCountRef.current);
      setPlantedTrees(nextTrees);
      persistProgress();
    };
    plantActionRef.current = plantSelectedTree;

    const applyNightMode = (isNight) => {
      const sky = isNight ? "#101b2b" : "#bdd7d6";
      scene.background.set(sky);
      scene.fog.color.set(sky);
      hemiLight.color.set(isNight ? "#839dc7" : "#e2f5ef");
      hemiLight.groundColor.set(isNight ? "#22283c" : "#65764c");
      hemiLight.intensity = isNight ? 0.72 : 2.15;
      sun.intensity = isNight ? 0.12 : 3.2;
      moonLight.intensity = isNight ? 1.4 : 0;
      moon.visible = isNight;
      stars.visible = isNight;
      worldRef.current.workers.forEach(({ group }) => { group.visible = !isNight; });
      worldRef.current.owls.forEach(({ group }) => { group.visible = isNight; });
      worldRef.current.nightAnimals.forEach(({ group }) => { group.visible = isNight; });
      worldRef.current.cabin.flames.forEach((flame) => { flame.visible = isNight; });
      worldRef.current.cabin.smokePuffs.forEach(({ mesh }) => { mesh.visible = isNight; });
      worldRef.current.cabin.fireLight.intensity = isNight ? 2.2 : 0;
    };
    applyNightMode(nightModeRef.current);

    let frame = 0;
    const clock = new THREE.Timer();
    const forwardDirection = new THREE.Vector3();
    const rightDirection = new THREE.Vector3();
    const animate = () => {
      clock.update();
      const delta = Math.min(clock.getDelta(), 0.05);
      frame += delta;
      let moving = false;
      if (isExploringRef.current) {
        let forward =
          Number(keys.has("w") || keys.has("arrowup")) -
          Number(keys.has("s") || keys.has("arrowdown"));
        let sideways =
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft"));
        if (forward === 0 && sideways === 0 && introWalkRemainingRef.current > 0) {
          forward = 1;
          introWalkRemainingRef.current = Math.max(0, introWalkRemainingRef.current - delta);
        }
        const length = Math.hypot(forward, sideways) || 1;
        forward /= length;
        sideways /= length;
        moving = forward !== 0 || sideways !== 0;
        const speed = keys.has("shift") ? 13 : 7;
        camera.getWorldDirection(forwardDirection);
        forwardDirection.y = 0;
        forwardDirection.normalize();
        rightDirection.crossVectors(forwardDirection, camera.up).normalize();
        camera.position.addScaledVector(forwardDirection, forward * speed * delta);
        camera.position.addScaledVector(rightDirection, sideways * speed * delta);
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -145, 145);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -145, 145);
      }
      camera.position.y = 2.05 + (moving ? Math.sin(frame * 11) * 0.045 : 0);

      badges.forEach((badge) => {
        if (!badge.group.visible) return;
        badge.group.position.y = terrainHeight(badge.group.position.x, badge.group.position.z) + 1.1 + Math.sin(frame * 2.2 + badge.phase) * 0.16;
        badge.group.rotation.y = frame * 0.7 + badge.phase;
        if (isExploringRef.current && camera.position.distanceTo(badge.group.position) < 2.1) {
          badgeCountRef.current += 1;
          setBadgeCount(badgeCountRef.current);
          persistProgress();
          camera.getWorldDirection(forwardDirection);
          forwardDirection.y = 0;
          forwardDirection.normalize();
          rightDirection.crossVectors(forwardDirection, camera.up).normalize();
          const spawnDistance = 18 + Math.random() * 20;
          const lateralOffset = (Math.random() - 0.5) * spawnDistance * 0.7;
          const nextX = THREE.MathUtils.clamp(
            camera.position.x + forwardDirection.x * spawnDistance + rightDirection.x * lateralOffset,
            -140,
            140,
          );
          const nextZ = THREE.MathUtils.clamp(
            camera.position.z + forwardDirection.z * spawnDistance + rightDirection.z * lateralOffset,
            -140,
            140,
          );
          badge.group.position.set(nextX, terrainHeight(nextX, nextZ) + 1.1, nextZ);
          badge.phase = Math.random() * Math.PI * 2;
        }
      });

      growingTrees.forEach(({ tree, start, scale }) => {
        const growth = THREE.MathUtils.clamp((frame - start) / 8, 0, 1);
        tree.scale.setScalar(0.025 + (scale - 0.025) * growth);
      });

      animals.forEach(({ group, legs, homeX, homeZ, wanderRadius, phase, speed }) => {
        const walkCycle = frame * speed + phase;
        const nextX = homeX + Math.sin(walkCycle) * wanderRadius;
        const nextZ = homeZ + Math.sin(walkCycle * 0.62) * wanderRadius * 0.58;
        const directionX = nextX - group.position.x;
        const directionZ = nextZ - group.position.z;
        group.position.set(
          nextX,
          terrainHeight(nextX, nextZ) + Math.abs(Math.sin(walkCycle * 2)) * 0.04,
          nextZ,
        );
        if (Math.hypot(directionX, directionZ) > 0.001) {
          group.rotation.y = Math.atan2(directionX, directionZ) + Math.PI;
        }
        legs.forEach((leg, index) => {
          leg.rotation.x = Math.sin(walkCycle * 5 + (index % 2) * Math.PI) * 0.22;
        });
      });

      birds.forEach(({ bird, wings, phase, radius, height, nest, roostPosition, flightPosition }) => {
        const angle = frame * 0.11 + phase;
        flightPosition.set(
          Math.cos(angle) * radius,
          height + Math.sin(frame * 1.8 + phase) * 0.6,
          -22 + Math.sin(angle) * radius,
        );
        const isNight = nightModeRef.current;
        let target = flightPosition;
        if (isNight) {
          nest.getWorldPosition(roostPosition);
          roostPosition.y += 0.28;
          target = roostPosition;
        }
        bird.position.lerp(target, 1 - Math.exp(-delta * (isNight ? 1.2 : 1.8)));
        bird.rotation.y = isNight ? Math.PI : -angle;
        const settled = isNight && bird.position.distanceTo(target) < 0.42;
        const flap = settled ? 0 : Math.sin(frame * 10 + phase) * 0.52;
        wings[0].rotation.z = 0.16 + flap;
        wings[1].rotation.z = -0.16 - flap;
      });

      cabin.flames.forEach((flame, index) => {
        flame.scale.y = 0.82 + Math.sin(frame * 12 + index * 1.6) * 0.24;
        flame.rotation.y = Math.sin(frame * 8 + index) * 0.16;
      });
      cabin.fireLight.intensity = nightModeRef.current
        ? 1.9 + Math.sin(frame * 13) * 0.38
        : 0;
      cabin.smokePuffs.forEach(({ mesh, phase }) => {
        const rise = (frame * 0.16 + phase) % 1;
        mesh.position.set(
          cabin.x - 1.8 + Math.sin(frame * 0.8 + phase * 8) * 0.3,
          terrainHeight(cabin.x, cabin.z) + 6.4 + rise * 4.6,
          cabin.z - 0.75,
        );
        mesh.material.opacity = nightModeRef.current ? (1 - rise) * 0.36 : 0;
        mesh.scale.setScalar(0.7 + rise * 1.7);
      });
      workers.forEach(({ arm, phase }) => {
        arm.rotation.x = Math.sin(frame * 2.2 + phase) * 0.28;
        arm.rotation.z = 0.08 + Math.sin(frame * 2.2 + phase) * 0.16;
      });
      owls.forEach(({ group, wings, phase }) => {
        const flap = Math.sin(frame * 1.2 + phase) * 0.08;
        wings[0].rotation.z = -0.18 - flap;
        wings[1].rotation.z = 0.18 + flap;
        group.rotation.y = Math.sin(frame * 0.35 + phase) * 0.12;
      });

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    return () => {
      renderer.setAnimationLoop(null);
      plantActionRef.current = null;
      worldRef.current = null;
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", handleTouchLookStart);
      canvas.removeEventListener("pointermove", handleTouchLookMove);
      canvas.removeEventListener("pointerup", handleTouchLookEnd);
      canvas.removeEventListener("pointercancel", handleTouchLookEnd);
      document.removeEventListener("pointerdown", pressTouchKey);
      document.removeEventListener("pointerup", releaseTouchKey);
      document.removeEventListener("pointercancel", releaseTouchKey);
      document.removeEventListener("lostpointercapture", releaseTouchKey);
      clock.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [persistProgress]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const sky = nightMode ? "#101b2b" : "#bdd7d6";
    world.scene.background.set(sky);
    world.scene.fog.color.set(sky);
    world.hemiLight.color.set(nightMode ? "#839dc7" : "#e2f5ef");
    world.hemiLight.groundColor.set(nightMode ? "#22283c" : "#65764c");
    world.hemiLight.intensity = nightMode ? 0.72 : 2.15;
    world.sun.intensity = nightMode ? 0.12 : 3.2;
    world.moonLight.intensity = nightMode ? 1.4 : 0;
    world.moon.visible = nightMode;
    world.stars.visible = nightMode;
    world.workers.forEach(({ group }) => { group.visible = !nightMode; });
    world.owls.forEach(({ group }) => { group.visible = nightMode; });
    world.nightAnimals.forEach(({ group }) => { group.visible = nightMode; });
    world.cabin.flames.forEach((flame) => { flame.visible = nightMode; });
    world.cabin.smokePuffs.forEach(({ mesh }) => { mesh.visible = nightMode; });
    world.cabin.fireLight.intensity = nightMode ? 2.2 : 0;
    ambientAudioRef.current?.setNight(nightMode);
  }, [nightMode]);

  return (
    <main className={`world-shell${nightMode ? " is-night" : ""}${isExploring ? " is-exploring" : ""}`}>
      <canvas
        ref={canvasRef}
        className="world-canvas"
        aria-label="Walk through a living forest planet"
      />
      <div className="scene-grain" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div>
            <p className="eyebrow">A living world, afoot</p>
            <p className="brand-name">FIELD / 01</p>
          </div>
        </div>
        <div className="world-status">
          <span className="status-dot" /> WORLD STABLE{" "}
          <span className="status-divider" /> LOCAL TIME {nightMode ? "21:14" : "06:24"}
        </div>
        <div className="world-actions">
          <button
            className={`ambient-toggle${ambientPlaying ? " is-playing" : ""}`}
            type="button"
            aria-label={ambientPlaying ? "Turn ambient music off" : "Turn ambient music on"}
            aria-pressed={ambientPlaying}
            title="Ambient woodland soundtrack"
            onClick={toggleAmbient}
          >
            <span className="sound-bars" aria-hidden="true"><i /><i /><i /><i /></span>
            <span>{ambientPlaying ? "Sound on" : "Sound"}</span>
          </button>
          <button className="night-toggle" type="button" aria-pressed={nightMode} onClick={toggleNightMode}>
            <span className="night-toggle-mark" aria-hidden="true" />
            {nightMode ? "Night mode" : "Day mode"}
            <kbd>N</kbd>
          </button>
        </div>
      </header>

      <section className="location-card" aria-label="Current location">
        <p className="eyebrow">You are here</p>
        <h1>
          Fernwake
          <br />
          meadow
        </h1>
        <p className="location-coordinates">
          N 42° 08′ &nbsp; · &nbsp; E 16° 51′
        </p>
        <div className="weather-readout">
          <span className={`sun-symbol${nightMode ? " moon-symbol" : ""}`} aria-hidden="true" />
          <span>{nightMode ? "11°" : "18°"}</span>
          <span className="weather-note">
            {nightMode ? "Moonlit sky" : "Clear skies"}
            <br />
            {nightMode ? "Quiet breeze" : "Soft breeze"}
          </span>
        </div>
        <div className="mission-brief">
          <p className="eyebrow">Field mission 01</p>
          <p>
            {nightMode
              ? "Fernwake has gone quiet. Gather ten leaf badges, plant a young tree, and give the night creatures a place to call home."
              : "Fernwake is losing its wild edge. Gather ten leaf badges, plant a young tree, and bring the meadow back to life."}
          </p>
        </div>
      </section>

      <aside className="tree-nursery" aria-label="Tree planting tools">
        <div className="nursery-heading">
          <div>
            <p className="eyebrow">Restoration kit</p>
            <h2>Plant a tree</h2>
          </div>
          <div className="badge-wallet" aria-label={`${badgeCount} nature badges`}>
            <span className="badge-glyph" aria-hidden="true">✳</span>
            <strong>{String(badgeCount).padStart(2, "0")}</strong>
          </div>
        </div>
        <p className="badge-progress-label"><span>Nature badges</span><span>{Math.min(badgeCount, 10)} / 10</span></p>
        <div className="badge-progress-track"><span style={{ width: `${Math.min(badgeCount * 10, 100)}%` }} /></div>
        <div className="tree-options" role="group" aria-label="Choose a tree species">
          {treeTypes.map((tree, index) => (
            <button
              className={`tree-option${selectedTree === tree.id ? " is-selected" : ""}`}
              type="button"
              key={tree.id}
              aria-pressed={selectedTree === tree.id}
              onClick={() => chooseTree(tree.id)}
              title={`${tree.name}, shortcut ${index + 1}`}
            >
              <span className={`tree-swatch swatch-${tree.id}`} style={{ "--tree-color": tree.color }} aria-hidden="true" />
              <span>{tree.name}</span>
              <kbd>{index + 1}</kbd>
            </button>
          ))}
        </div>
        <button className="plant-button" type="button" disabled={badgeCount < 10} onClick={() => plantActionRef.current?.()}>
          <span>{badgeCount >= 10 ? `Plant ${treeTypes.find((tree) => tree.id === selectedTree)?.name}` : "Collect 10 badges to plant"}</span>
          <kbd>E</kbd>
        </button>
        <p className="planted-total">{plantedTrees.length} {plantedTrees.length === 1 ? "tree" : "trees"} planted in Fernwake</p>
      </aside>

      <div className="crosshair" aria-hidden="true">
        <span />
        <span />
      </div>

      <footer className="bottom-bar">
        <div className="wildlife-readout badge-readout">
          <span className="wildlife-count">{String(badgeCount).padStart(2, "0")}</span>
          <span className="readout-rule" />
          <span className="wildlife-label">
            nature badges
            <br />
            {badgeCount >= 10 ? "ready to plant" : `${10 - badgeCount} to next tree`}
          </span>
        </div>
        <button
          className={`explore-button${isExploring ? " is-active" : ""}`}
          onClick={() => isExploring ? leaveExploring() : beginExploring()}
          type="button"
        >
          {isExploring ? (
            <>
              <span className="button-indicator" /> Leave the field{" "}
              <kbd>ESC</kbd>
            </>
          ) : (
            <>
              Step into the field <span className="button-arrow">↗</span>
            </>
          )}
        </button>
        <div className="control-hint">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> walk
          </span>
          <span>
            <kbd>SHIFT</kbd> run
          </span>
          <span>Drag to look</span>
        </div>
      </footer>

      {!isExploring && (
        <button
          className="start-exploring"
          type="button"
          onClick={beginExploring}
        >
          <span className="start-orbit" aria-hidden="true">
            +
          </span>
          <span>Begin walking</span>
          <span className="start-note">Step into Fernwake</span>
        </button>
      )}
      {isExploring && (
        <p className="escape-hint">
          <kbd>ESC</kbd> to pause
        </p>
      )}
      {isExploring && (
        <div className="touch-controls" aria-label="Touch movement controls">
          <button className="touch-up" type="button" data-move="w" aria-label="Walk forward">↑</button>
          <button className="touch-left" type="button" data-move="a" aria-label="Walk left">←</button>
          <button className="touch-down" type="button" data-move="s" aria-label="Walk backward">↓</button>
          <button className="touch-right" type="button" data-move="d" aria-label="Walk right">→</button>
          <button className="touch-run" type="button" data-move="shift">Run</button>
        </div>
      )}
    </main>
  );
}

export default App;
