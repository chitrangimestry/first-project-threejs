import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./App.css";
import { makeNatureBadge } from "./world/natureBadge";
import { makePlayerCharacter } from "./world/playerCharacter";
import { animateVillagers, createVillage } from "./world/village";

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
const seasons = ["Spring", "Summer", "Autumn", "Winter"];
const weathers = ["Clear", "Rain", "Mist", "Snow"];
const temperatures = {
  Spring: { day: "18°", night: "11°" },
  Summer: { day: "26°", night: "16°" },
  Autumn: { day: "14°", night: "8°" },
  Winter: { day: "3°", night: "-2°" },
};
const landmarks = [
  { id: "village", name: "Fernwake village", x: 0, z: -35, note: "A small village finding its rhythm beside the recovering forest." },
  { id: "old-oak", name: "The old oak", x: -48, z: -22, note: "An ancient canopy shelters birds and the first signs of new growth." },
  { id: "quiet-pond", name: "Quiet pond", x: 54, z: -58, note: "A secluded pond draws thirsty wildlife from across the meadow." },
  { id: "high-meadow", name: "High meadow", x: 40, z: 44, note: "Wildflowers bloom here when the season is kind." },
  { id: "fox-den", name: "Fox den", x: -72, z: 62, note: "A sheltered den is tucked beneath the roots beyond the meadow." },
  { id: "stone-ruins", name: "Mosslight ruins", x: 82, z: 24, note: "Old standing stones mark a forgotten gathering place." },
];
const wildlifeProfiles = [
  { id: "deer", name: "Red deer", fact: "Deer browse on woodland shoots and move quietly through the forest edge." },
  { id: "fox", name: "Red fox", fact: "Foxes are adaptable hunters that help balance small-animal populations." },
  { id: "rabbit", name: "Woodland rabbit", fact: "Rabbits spread seeds and provide an important link in the food web." },
  { id: "bear", name: "Brown bear", fact: "Bears disperse seeds over long distances as they forage." },
  { id: "badger", name: "European badger", fact: "Badgers dig setts and aerate soil while searching for food." },
  { id: "boar", name: "Wild boar", fact: "Boars turn over soil as they forage, creating space for new plants." },
  { id: "owl", name: "Tawny owl", fact: "Owls hunt at night and use soft-edged feathers for quiet flight." },
];
const relicDefinitions = [
  { id: "moonstone", name: "Moonstone fragment", x: 82, z: 24 },
  { id: "acorn-charm", name: "Carved acorn charm", x: -72, z: 62 },
];
const initialControls = { forward: "w", left: "a", backward: "s", right: "d", interact: "f", journal: "j", night: "n", photo: "p" };

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
      season: seasons.includes(saved.season) ? saved.season : "Spring",
      weather: weathers.includes(saved.weather) ? saved.weather : "Clear",
      discoveries: Array.isArray(saved.discoveries) ? saved.discoveries : [],
      forage: Number.isInteger(saved.forage) ? Math.max(0, saved.forage) : 0,
      questComplete: Boolean(saved.questComplete),
      questAccepted: Boolean(saved.questAccepted),
      questStage: Number.isInteger(saved.questStage) ? Math.max(0, Math.min(4, saved.questStage)) : saved.questComplete ? 4 : saved.questAccepted ? 1 : 0,
      questPath: saved.questPath === "wildlife" ? "wildlife" : "habitat",
      observedAnimals: Array.isArray(saved.observedAnimals) ? saved.observedAnimals : [],
      relics: Array.isArray(saved.relics) ? saved.relics : [],
      villageLevel: Number.isInteger(saved.villageLevel) ? Math.max(0, Math.min(2, saved.villageLevel)) : 0,
      dayTime: Number.isFinite(saved.dayTime) ? ((saved.dayTime % 24) + 24) % 24 : 8,
      autoTime: saved.autoTime !== false,
      reducedMotion: saved.reducedMotion === undefined
        ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false
        : Boolean(saved.reducedMotion),
      audioVolume: Number.isFinite(saved.audioVolume) ? Math.min(1, Math.max(0, saved.audioVolume)) : 0.55,
      controls: { ...initialControls, ...(saved.controls || {}) },
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
      season: "Spring",
      weather: "Clear",
      discoveries: [],
      forage: 0,
      questComplete: false,
      questAccepted: false,
      questStage: 0,
      questPath: "habitat",
      observedAnimals: [],
      relics: [],
      villageLevel: 0,
      dayTime: 8,
      autoTime: true,
      reducedMotion: false,
      audioVolume: 0.55,
      controls: initialControls,
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

function makeSurfaceTextures() {
  const makeTexture = (paint, size = 256) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    paint(context, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  };

  const bark = makeTexture((context, size) => {
    context.fillStyle = "#9b8060";
    context.fillRect(0, 0, size, size);
    for (let line = 0; line < 190; line += 1) {
      const x = Math.random() * size;
      context.strokeStyle = `rgba(${line % 3 === 0 ? "48,34,23" : "238,207,157"},${0.035 + Math.random() * 0.14})`;
      context.lineWidth = 1 + Math.random() * 3;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(
        x + (Math.random() - 0.5) * 12,
        size * 0.3,
        x + (Math.random() - 0.5) * 12,
        size * 0.68,
        x + (Math.random() - 0.5) * 8,
        size,
      );
      context.stroke();
    }
    for (let knot = 0; knot < 9; knot += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      context.strokeStyle = "rgba(53,37,25,0.22)";
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(x, y, 3 + Math.random() * 3, 7 + Math.random() * 7, 0.1, 0, Math.PI * 2);
      context.stroke();
    }
  });

  const leaves = makeTexture((context, size) => {
    context.fillStyle = "#e4ebd3";
    context.fillRect(0, 0, size, size);
    for (let leaf = 0; leaf < 480; leaf += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = 3 + Math.random() * 11;
      const width = 1.5 + Math.random() * 4;
      context.save();
      context.translate(x, y);
      context.rotate(Math.random() * Math.PI);
      context.fillStyle = `rgba(${52 + Math.floor(Math.random() * 50)},${83 + Math.floor(Math.random() * 67)},${37 + Math.floor(Math.random() * 35)},${0.12 + Math.random() * 0.5})`;
      context.beginPath();
      context.ellipse(0, 0, width, length, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(244,238,190,0.22)";
      context.lineWidth = 0.7;
      context.beginPath();
      context.moveTo(0, -length);
      context.lineTo(0, length);
      context.stroke();
      context.restore();
    }
  });

  const ground = makeTexture((context, size) => {
    context.fillStyle = "#f5f2df";
    context.fillRect(0, 0, size, size);
    for (let mark = 0; mark < 15000; mark += 1) {
      const shade = Math.random();
      context.fillStyle = shade > 0.58
        ? `rgba(49,76,43,${Math.random() * 0.16})`
        : `rgba(128,103,65,${Math.random() * 0.1})`;
      const radius = 0.25 + Math.random() * 1.8;
      context.beginPath();
      context.ellipse(
        Math.random() * size,
        Math.random() * size,
        radius,
        radius * (0.45 + Math.random()),
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  });

  const fur = makeTexture((context, size) => {
    context.fillStyle = "#f2e7d4";
    context.fillRect(0, 0, size, size);
    for (let strand = 0; strand < 3600; strand += 1) {
      context.strokeStyle = `rgba(67,49,33,${Math.random() * 0.17})`;
      context.lineWidth = 0.35 + Math.random() * 0.8;
      const x = Math.random() * size;
      const y = Math.random() * size;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (Math.random() - 0.5) * 2.5, y + 2 + Math.random() * 5);
      context.stroke();
    }
  });

  return { bark, leaves, ground, fur };
}

function makeAnimal(scene, kind, x, z, scale = 1, furTexture) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({
    color: kind.color,
    roughness: 0.96,
    ...(furTexture ? { map: furTexture } : {}),
  });
  const darkFur = new THREE.MeshStandardMaterial({
    color: kind.dark,
    roughness: 1,
    ...(furTexture ? { map: furTexture } : {}),
  });
  const lightFur = new THREE.MeshStandardMaterial({
    color: kind.belly || "#d8c8a4",
    roughness: 1,
  });
  const innerEar = new THREE.MeshStandardMaterial({ color: kind.innerEar || "#a66f65", roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: "#211d18", roughness: 0.32 });
  const nose = new THREE.MeshStandardMaterial({ color: kind.nose || "#302821", roughness: 0.55 });
  const antlerMaterial = new THREE.MeshStandardMaterial({ color: "#b7a27a", roughness: 0.95 });
  const shape = kind.shape || "fox";
  const isDeer = shape === "deer";
  const isRabbit = shape === "rabbit";
  const isBear = shape === "bear";
  const isBoar = shape === "boar";
  const isBadger = shape === "badger";
  const isFox = shape === "fox";
  const torsoLength = isRabbit ? 0.86 : isBear ? 1.02 : isBadger ? 1.08 : 1.18;
  const shoulderHeight = isDeer ? 1.16 : isRabbit ? 0.74 : isBear ? 1.04 : isBadger ? 0.81 : 0.91;
  const bodyY = isDeer ? 0.96 : isRabbit ? 0.67 : isBear ? 0.83 : isBadger ? 0.72 : isBoar ? 0.78 : 0.78;
  const bodyRadius = isBear
    ? [0.62, 0.58, 0.83]
    : isDeer
      ? [0.42, 0.5, 0.72]
      : isFox
        ? [0.4, 0.37, 0.66]
        : isBadger
          ? [0.48, 0.4, 0.68]
          : isBoar
            ? [0.56, 0.48, 0.76]
            : [0.47, 0.43, torsoLength * 0.57];

  const ellipsoid = (material, position, dimensions) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), material);
    mesh.position.set(...position);
    mesh.scale.set(...dimensions);
    group.add(mesh);
    return mesh;
  };
  const body = ellipsoid(fur, [0, bodyY, 0.12], bodyRadius);
  const rump = ellipsoid(
    fur,
    [0, bodyY + (isRabbit ? 0.08 : 0), torsoLength * 0.34],
    [bodyRadius[0] * (isDeer ? 1.02 : 1.1), bodyRadius[1] * 1.04, bodyRadius[2] * 0.63],
  );
  const shoulder = ellipsoid(
    fur,
    [0, shoulderHeight * 0.73, -torsoLength * 0.25],
    [bodyRadius[0] * 0.94, bodyRadius[1] * 0.9, bodyRadius[2] * 0.52],
  );
  if (!isDeer && !isRabbit) {
    const bib = ellipsoid(
      lightFur,
      [0, bodyY - bodyRadius[1] * 0.25, -torsoLength * 0.18],
      [bodyRadius[0] * 0.68, bodyRadius[1] * 0.64, bodyRadius[2] * 0.75],
    );
    bib.rotation.x = -0.18;
  }
  body.rotation.x = isBear ? -0.08 : 0.04;
  rump.rotation.x = -0.12;
  shoulder.rotation.x = -0.22;

  const neck = ellipsoid(
    fur,
    [0, shoulderHeight * 0.87, -torsoLength * 0.42],
    [isDeer ? 0.24 : 0.31, isDeer ? 0.4 : 0.31, isDeer ? 0.3 : 0.37],
  );
  neck.rotation.x = -0.54;
  const headY = isDeer ? 1.52 : isRabbit ? 1.03 : isBear ? 1.19 : isBadger ? 1.02 : isBoar ? 1.04 : 1.12;
  const headZ = -torsoLength * (isBadger ? 0.62 : 0.65);
  const head = ellipsoid(
    fur,
    [0, headY, headZ],
    isDeer
      ? [0.25, 0.32, 0.3]
      : isBear
        ? [0.36, 0.34, 0.37]
        : isBadger
          ? [0.28, 0.24, 0.42]
          : isBoar
            ? [0.33, 0.29, 0.4]
            : [0.3, 0.29, 0.34],
  );
  head.rotation.x = -0.1;
  const muzzleLength = isDeer ? 0.32 : isBear ? 0.25 : isBoar || isBadger ? 0.4 : 0.38;
  ellipsoid(
    isDeer || isRabbit ? lightFur : kind.mask ? lightFur : darkFur,
    [0, headY - 0.12, headZ - 0.29],
    [isBear ? 0.2 : isBoar ? 0.24 : 0.17, isBoar ? 0.18 : 0.15, muzzleLength],
  );
  ellipsoid(nose, [0, headY - 0.07, headZ - 0.56], [0.09, 0.065, 0.075]);
  if (isRabbit) {
    ellipsoid(lightFur, [-0.065, headY - 0.2, headZ - 0.48], [0.075, 0.065, 0.08]);
    ellipsoid(lightFur, [0.065, headY - 0.2, headZ - 0.48], [0.075, 0.065, 0.08]);
  }

  if (kind.mask) {
    for (const side of [-1, 1]) {
      const patch = ellipsoid(lightFur, [side * 0.17, headY + 0.015, headZ - 0.13], [0.1, 0.12, 0.09]);
      patch.rotation.z = side * -0.12;
    }
  }
  for (const side of [-1, 1]) {
    const eyePosition = [side * (isBear ? 0.23 : 0.19), headY + 0.08, headZ - 0.23];
    ellipsoid(eye, eyePosition, [0.035, 0.045, 0.027]);
    if (kind.ears) {
      const earHeight = isRabbit ? 0.65 : isDeer ? 0.52 : 0.36;
        const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), fur);
        ear.position.set(side * (isRabbit ? 0.15 : 0.23), headY + earHeight * 0.55, headZ + 0.03);
        ear.scale.set(isRabbit ? 0.1 : isBoar ? 0.16 : 0.13, earHeight * 0.62, isRabbit ? 0.075 : isBoar ? 0.1 : 0.09);
      if (!isRabbit) ear.rotation.z = side * -0.23;
      group.add(ear);
      const earInset = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), innerEar);
      earInset.position.set(side * (isRabbit ? 0.15 : 0.23), headY + earHeight * 0.57, headZ - 0.025);
      earInset.scale.set(isRabbit ? 0.045 : 0.06, earHeight * 0.4, 0.025);
      group.add(earInset);
    }
  }

  if (kind.tail) {
    const tail = ellipsoid(
      kind.tailColor ? new THREE.MeshStandardMaterial({ color: kind.tailColor, roughness: 1 }) : fur,
      [0, bodyY + (isRabbit ? 0.02 : 0.12), torsoLength * 0.88],
      [isRabbit ? 0.16 : isBoar ? 0.07 : 0.22, isRabbit ? 0.17 : isBoar ? 0.07 : 0.22, isRabbit ? 0.18 : isBoar ? 0.28 : 0.53],
    );
    tail.rotation.x = isRabbit ? 0.25 : isBoar ? -0.75 : -0.38;
  }

  if (isBear) {
    for (const side of [-1, 1]) {
      ellipsoid(fur, [side * 0.28, 1.42, headZ + 0.04], [0.13, 0.15, 0.12]);
    }
  }

  if (kind.antlers) {
    for (const side of [-1, 1]) {
      const antler = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.54, 8), antlerMaterial);
      stem.position.y = 0.24;
      antler.add(stem);
      for (const tineIndex of [-1, 0, 1]) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.28, 7), antlerMaterial);
        tine.position.set(tineIndex * 0.12, 0.37 + Math.abs(tineIndex) * 0.06, 0);
        tine.rotation.z = tineIndex === 0 ? 0 : tineIndex * 0.42;
        antler.add(tine);
      }
      antler.position.set(side * 0.15, headY + 0.25, headZ + 0.04);
      antler.rotation.z = side * -0.2;
      group.add(antler);
    }
  }

  if (isBoar) {
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), lightFur);
      tusk.position.set(side * 0.17, headY - 0.18, headZ - 0.42);
      tusk.rotation.x = Math.PI;
      group.add(tusk);
    }
  }

  const legs = [];
  const legPositions = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [side, fore] of legPositions) {
    const leg = new THREE.Group();
    const hipZ = fore < 0 ? -torsoLength * 0.34 : torsoLength * 0.48;
    const topY = isDeer ? 0.74 : isRabbit ? 0.49 : isBear ? 0.65 : 0.58;
    leg.position.set(side * bodyRadius[0] * 0.58, topY, hipZ);
    const upperLength = isDeer ? 0.36 : isRabbit && fore > 0 ? 0.22 : 0.29;
    const lowerLength = isDeer ? 0.39 : isBear ? 0.31 : 0.27;
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(isDeer ? 0.07 : 0.12, 0.075, upperLength, 9),
      fur,
    );
    upper.position.y = -upperLength * 0.46;
    leg.add(upper);
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(isDeer ? 0.075 : 0.11, 9, 7),
      fur,
    );
    joint.position.y = -upperLength * 0.9;
    leg.add(joint);
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, isDeer ? 0.05 : 0.085, lowerLength, 8),
      fur,
    );
    lower.position.y = -upperLength - lowerLength * 0.45;
    leg.add(lower);
    const hoof = new THREE.Mesh(
      new THREE.SphereGeometry(1, 9, 7),
      isDeer || isBoar ? darkFur : kind.paw ? darkFur : fur,
    );
    hoof.position.set(0, -upperLength - lowerLength + 0.02, -0.055);
    hoof.scale.set(isDeer ? 0.075 : 0.13, 0.08, isDeer ? 0.12 : 0.17);
    leg.add(hoof);
    group.add(leg);
    legs.push(leg);
  }

  group.position.set(x, terrainHeight(x, z), z);
  group.scale.setScalar(scale);
  group.visible = false;
  group.rotation.y = Math.atan2(-x, z) + Math.PI;
  scene.add(group);
  return {
    group,
    species: kind.shape,
    legs,
    homeX: x,
    homeZ: z,
    wanderRadius: 3 + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.16 + Math.random() * 0.14,
    spawnAt: 0,
    appeared: false,
    nocturnal: Boolean(kind.nocturnal),
    baseScale: scale,
  };
}

function makeTree(scene, x, z, scale, variant, species = "oak", textures = {}) {
  const tree = new THREE.Group();
  const barkColor = species === "birch" ? "#d9d1b2" : palette.bark[variant % palette.bark.length];
  const barkMaterial = new THREE.MeshStandardMaterial({
    color: barkColor,
    roughness: 0.94,
    bumpScale: 0.08,
    ...(textures.bark ? { map: textures.bark } : {}),
  });
  const trunkRadius = species === "birch" ? 0.15 : 0.2;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      trunkRadius * scale,
      (species === "birch" ? 0.24 : 0.37) * scale,
      2.8 * scale,
      12,
    ),
    barkMaterial,
  );
  trunk.position.y = 1.4 * scale;
  tree.add(trunk);

  if (species !== "birch" && species !== "pine") {
    for (let root = 0; root < 5; root += 1) {
      const angle = (root / 5) * Math.PI * 2 + variant * 0.37;
      const buttress = new THREE.Mesh(
        new THREE.ConeGeometry(0.17 * scale, 0.76 * scale, 7),
        barkMaterial,
      );
      buttress.position.set(
        Math.cos(angle) * 0.32 * scale,
        0.34 * scale,
        Math.sin(angle) * 0.32 * scale,
      );
      buttress.rotation.z = Math.cos(angle) * 0.48;
      buttress.rotation.x = -Math.sin(angle) * 0.48;
      tree.add(buttress);
    }
  }

  if (species === "oak" || species === "willow") {
    for (let branch = 0; branch < 4; branch += 1) {
      const angle = (branch / 4) * Math.PI * 2 + variant * 0.61;
      const limb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045 * scale, 0.11 * scale, 1.45 * scale, 8),
        barkMaterial,
      );
      limb.position.set(
        Math.cos(angle) * 0.72 * scale,
        2.8 * scale,
        Math.sin(angle) * 0.72 * scale,
      );
      limb.rotation.z = Math.cos(angle) * 0.74;
      limb.rotation.x = -Math.sin(angle) * 0.74;
      tree.add(limb);
    }
  }

  if (species === "birch") {
    const markingMaterial = new THREE.MeshStandardMaterial({ color: "#49483b", roughness: 1 });
    for (let mark = 0; mark < 4; mark += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.055 * scale, 0.025 * scale), markingMaterial);
      stripe.position.set(0, (0.65 + mark * 0.42) * scale, -0.17 * scale);
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
    roughness: 0.88,
    metalness: 0,
    ...(textures.leaves ? { map: textures.leaves } : {}),
  });
  tree.userData.foliageMaterials = [leafMaterial];

  if (species === "pine") {
    for (let layer = 0; layer < 5; layer += 1) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry((1.55 - layer * 0.2) * scale, 1.72 * scale, 12, 2),
        leafMaterial,
      );
      crown.position.y = (2.05 + layer * 0.66) * scale;
      crown.rotation.y = variant * 0.27 + layer * 0.13;
      tree.add(crown);
    }
  } else if (species === "willow") {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.15 * scale, 20, 14), leafMaterial);
    crown.position.y = 3.45 * scale;
    crown.scale.set(1.25, 0.8, 1.15);
    tree.add(crown);
    for (let branch = 0; branch < 9; branch += 1) {
      const angle = (branch / 9) * Math.PI * 2;
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 12, 10), leafMaterial);
      foliage.position.set(Math.cos(angle) * 1.12 * scale, (2.1 + (branch % 4) * 0.23) * scale, Math.sin(angle) * 1.12 * scale);
      foliage.scale.set(0.72, 1.85, 0.72);
      tree.add(foliage);
    }
  } else {
    const clusterCount = species === "birch" ? 5 : 7;
    const crownCenterY = species === "birch" ? 4.0 : 3.75;
    const crownMaterial = (cluster) => {
      if (cluster % 3 === 0) return leafMaterial;
      const foliageColor = species === "birch"
        ? ["#8da86e", "#9caf73", "#819a63"][cluster % 3]
        : palette.leaf[(variant + cluster) % palette.leaf.length];
      const material = new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.9,
        ...(textures.leaves ? { map: textures.leaves } : {}),
      });
      tree.userData.foliageMaterials.push(material);
      return material;
    };
    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      const angle = cluster * 2.399963 + variant * 0.43;
      const isCenter = cluster === 0;
      const radius = species === "birch" ? 0.82 : isCenter ? 1.22 : 0.78 + (cluster % 2) * 0.12;
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(radius * scale, 18, 14),
        crownMaterial(cluster),
      );
      const offset = isCenter ? 0 : species === "birch" ? 0.38 : 0.82;
      crown.position.set(
        Math.cos(angle) * offset * scale,
        (crownCenterY + (isCenter ? 0.18 : Math.sin(angle * 1.7) * 0.38)) * scale,
        Math.sin(angle) * offset * scale,
      );
      crown.scale.set(
        species === "birch" ? 0.8 : 1.12,
        species === "birch" ? 1.22 : 0.86 + (cluster % 2) * 0.14,
        species === "birch" ? 0.82 : 1.06,
      );
      tree.add(crown);
    }
  }
  tree.traverse((part) => {
    if (!part.isMesh) return;
    part.castShadow = part.material === barkMaterial;
    part.receiveShadow = part.material === leafMaterial;
  });
  tree.position.set(x, terrainHeight(x, z), z);
  tree.rotation.y = (variant * 2.399963) % (Math.PI * 2);
  scene.add(tree);
  return tree;
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
  bird.visible = false;
  return {
    bird,
    wings,
    nest,
    roostPosition: new THREE.Vector3(),
    flightPosition: new THREE.Vector3(),
    phase: index * 0.82,
    centerX: (Math.random() - 0.5) * 130,
    centerZ: -50 + (Math.random() - 0.5) * 100,
    radiusX: 9 + Math.random() * 20,
    radiusZ: 7 + Math.random() * 15,
    height: 13 + Math.random() * 12,
    speed: 0.035 + Math.random() * 0.035,
    direction: Math.random() < 0.5 ? -1 : 1,
    spawnAt: 2 + Math.random() * 38,
    appeared: false,
  };
}

function makeCloud(scene, index, geometry, material) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(geometry, material);
  base.scale.set(9, 2.8, 3.8);
  group.add(base);
  const puffCount = 5 + (index % 4);
  for (let puff = 0; puff < puffCount; puff += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    const width = 2.5 + Math.random() * 2;
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 2.4,
      (Math.random() - 0.5) * 5,
    );
    mesh.scale.set(width, width * (0.68 + Math.random() * 0.16), width * 0.78);
    group.add(mesh);
  }
  group.position.set(
    (Math.random() - 0.5) * 240,
    19 + Math.random() * 8,
    -60 + (Math.random() - 0.5) * 75,
  );
  scene.add(group);
  return {
    group,
    phase: Math.random() * Math.PI * 2,
    speed: 0.7 + Math.random() * 0.8,
    baseY: group.position.y,
  };
}

function makeWeatherParticles(scene) {
  const count = 620;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 90;
    positions[index * 3 + 1] = Math.random() * 34;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#e3edf0",
    size: 0.11,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(geometry, material);
  particles.visible = false;
  scene.add(particles);
  return { particles, positions, material, count };
}

function addVillageExpansion(scene, level) {
  if (level < 1) return [];
  const materials = {
    wood: new THREE.MeshStandardMaterial({ color: "#76513a", roughness: 1 }),
    roof: new THREE.MeshStandardMaterial({ color: "#78875c", roughness: 0.95 }),
    canvas: new THREE.MeshStandardMaterial({ color: "#d3b878", roughness: 0.95 }),
  };
  const expansion = new THREE.Group();
  const shed = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.8, 3.7), materials.wood);
  shed.position.y = 1.4;
  expansion.add(shed);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.65, 1.7, 4), materials.roof);
  roof.position.y = 3.55;
  roof.rotation.y = Math.PI / 4;
  expansion.add(roof);
  const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.16, 4.8), materials.canvas);
  greenhouse.position.set(5.3, 2.75, 0);
  expansion.add(greenhouse);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.7, 7), materials.wood);
    post.position.set(5.3 + side * 2.55, 1.35, 0);
    expansion.add(post);
  }
  expansion.position.set(8, terrainHeight(8, -48), -48);
  expansion.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(expansion);
  return [expansion];
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
  const [nurseryOpen, setNurseryOpen] = useState(true);
  const isExploringRef = useRef(false);
  const introWalkRemainingRef = useRef(0);
  const [badgeCount, setBadgeCount] = useState(worldSave.badges);
  const [plantedTrees, setPlantedTrees] = useState(worldSave.plantedTrees);
  const [selectedTree, setSelectedTree] = useState(worldSave.selectedTree);
  const [nightMode, setNightMode] = useState(worldSave.nightMode);
  const [season, setSeason] = useState(worldSave.season);
  const [weather, setWeather] = useState(worldSave.weather);
  const [discoveries, setDiscoveries] = useState(worldSave.discoveries);
  const [forage, setForage] = useState(worldSave.forage);
  const [questComplete, setQuestComplete] = useState(worldSave.questComplete);
  const [questStage, setQuestStage] = useState(worldSave.questStage);
  const [questPath, setQuestPath] = useState(worldSave.questPath);
  const [observedAnimals, setObservedAnimals] = useState(worldSave.observedAnimals);
  const [relics, setRelics] = useState(worldSave.relics);
  const [villageLevel, setVillageLevel] = useState(worldSave.villageLevel);
  const [dayTime, setDayTime] = useState(worldSave.dayTime);
  const [autoTime, setAutoTime] = useState(worldSave.autoTime);
  const [reducedMotion, setReducedMotion] = useState(worldSave.reducedMotion);
  const [audioVolume, setAudioVolume] = useState(worldSave.audioVolume);
  const [controls, setControls] = useState(worldSave.controls);
  const [journalOpen, setJournalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [questChoiceOpen, setQuestChoiceOpen] = useState(false);
  const [rebindControl, setRebindControl] = useState("");
  const [photoMode, setPhotoMode] = useState(false);
  const [playerMap, setPlayerMap] = useState({ x: 0, z: 12, heading: 0 });
  const [interactionHint, setInteractionHint] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [notice, setNotice] = useState("");
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const badgeCountRef = useRef(worldSave.badges);
  const collectedBadgesRef = useRef(new Set(worldSave.collectedBadges));
  const plantedTreesRef = useRef(worldSave.plantedTrees);
  const selectedTreeRef = useRef(worldSave.selectedTree);
  const nightModeRef = useRef(worldSave.nightMode);
  const seasonRef = useRef(worldSave.season);
  const weatherRef = useRef(worldSave.weather);
  const discoveriesRef = useRef(new Set(worldSave.discoveries));
  const forageRef = useRef(worldSave.forage);
  const questCompleteRef = useRef(worldSave.questComplete);
  const questAcceptedRef = useRef(worldSave.questAccepted);
  const questStageRef = useRef(worldSave.questStage);
  const questPathRef = useRef(worldSave.questPath);
  const observedAnimalsRef = useRef(new Set(worldSave.observedAnimals));
  const relicsRef = useRef(new Set(worldSave.relics));
  const villageLevelRef = useRef(worldSave.villageLevel);
  const dayTimeRef = useRef(worldSave.dayTime);
  const autoTimeRef = useRef(worldSave.autoTime);
  const reducedMotionRef = useRef(worldSave.reducedMotion);
  const audioVolumeRef = useRef(worldSave.audioVolume);
  const controlsRef = useRef(worldSave.controls);
  const worldRef = useRef(null);
  const plantActionRef = useRef(null);
  const chooseTreeRef = useRef(null);
  const toggleNightModeRef = useRef(null);
  const ambientAudioRef = useRef(null);
  const interactActionRef = useRef(null);
  const downloadPhotoRef = useRef(null);
  const ambientEnvironmentRef = useRef("forest");
  const pauseWorldRef = useRef(false);
  const rebindControlRef = useRef("");
  const updateControlsRef = useRef(null);
  const modalStateRef = useRef({});

  const persistProgress = useCallback(() => {
    saveWorldProgress({
      badges: badgeCountRef.current,
      collectedBadges: [...collectedBadgesRef.current],
      plantedTrees: plantedTreesRef.current,
      selectedTree: selectedTreeRef.current,
      nightMode: nightModeRef.current,
      season: seasonRef.current,
      weather: weatherRef.current,
      discoveries: [...discoveriesRef.current],
      forage: forageRef.current,
      questComplete: questCompleteRef.current,
      questAccepted: questAcceptedRef.current,
      questStage: questStageRef.current,
      questPath: questPathRef.current,
      observedAnimals: [...observedAnimalsRef.current],
      relics: [...relicsRef.current],
      villageLevel: villageLevelRef.current,
      dayTime: dayTimeRef.current,
      autoTime: autoTimeRef.current,
      reducedMotion: reducedMotionRef.current,
      audioVolume: audioVolumeRef.current,
      controls: controlsRef.current,
    });
    setSaveState("Saved just now");
  }, []);

  const chooseQuestPath = (path) => {
    questPathRef.current = path;
    questStageRef.current = 1;
    questAcceptedRef.current = true;
    setQuestPath(path);
    setQuestStage(1);
    setQuestChoiceOpen(false);
    setNotice(path === "wildlife"
      ? "Chapter 1 · The village asks you to protect the animals. Plant a grove to begin."
      : "Chapter 1 · The village asks you to restore the habitats. Plant a grove to begin.");
    persistProgress();
  };
  const updateControls = useCallback((action, key) => {
    const existingAction = Object.entries(controlsRef.current).find(([name, value]) =>
      name !== action && value === key,
    )?.[0];
    const nextControls = { ...controlsRef.current, [action]: key };
    if (existingAction) nextControls[existingAction] = controlsRef.current[action];
    controlsRef.current = nextControls;
    setControls(nextControls);
    setRebindControl("");
    persistProgress();
  }, [persistProgress]);

  const updateAudioVolume = (value) => {
    const nextVolume = Number(value);
    audioVolumeRef.current = nextVolume;
    setAudioVolume(nextVolume);
    ambientAudioRef.current?.setVolume(nextVolume);
    persistProgress();
  };

  const updateReducedMotion = (enabled) => {
    reducedMotionRef.current = enabled;
    setReducedMotion(enabled);
    if (worldRef.current?.weatherParticles) {
      worldRef.current.weatherParticles.particles.visible =
        !enabled && (weatherRef.current === "Rain" || weatherRef.current === "Snow");
    }
    persistProgress();
  };

  useEffect(() => {
    modalStateRef.current = { journalOpen, settingsOpen, questChoiceOpen, photoMode };
    updateControlsRef.current = updateControls;
  }, [journalOpen, settingsOpen, questChoiceOpen, photoMode, updateControls]);

  const importSave = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) {
        throw new Error("The save file is larger than the supported 1 MB limit.");
      }
      const imported = JSON.parse(await file.text());
      if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
        throw new Error("The selected file is not a Fernwake save.");
      }
      if (imported.badges !== undefined && (!Number.isInteger(imported.badges) || imported.badges < 0)) {
        throw new Error("The save contains an invalid badge count.");
      }
      if (imported.nightMode !== undefined && typeof imported.nightMode !== "boolean") {
        throw new Error("The save contains an invalid day/night setting.");
      }
      if (imported.selectedTree !== undefined && !treeTypes.some((tree) => tree.id === imported.selectedTree)) {
        throw new Error("The save contains an invalid selected tree.");
      }
      if (imported.plantedTrees !== undefined && (!Array.isArray(imported.plantedTrees) || imported.plantedTrees.some((tree) =>
        !tree || !Number.isFinite(tree.x) || !Number.isFinite(tree.z) || !treeTypes.some((type) => type.id === tree.species),
      ))) {
        throw new Error("The save contains invalid planted tree data.");
      }
      for (const key of ["discoveries", "collectedBadges", "observedAnimals", "relics"]) {
        if (imported[key] !== undefined && !Array.isArray(imported[key])) {
          throw new Error(`The save contains invalid ${key} data.`);
        }
      }
      if (imported.controls !== undefined && (!imported.controls || typeof imported.controls !== "object" || Array.isArray(imported.controls))) {
        throw new Error("The save contains invalid keyboard controls.");
      }
      const allowed = readWorldSave();
      const sanitized = { ...allowed };
      for (const key of Object.keys(allowed)) {
        if (Object.hasOwn(imported, key)) sanitized[key] = imported[key];
      }
      sanitized.badges = Math.max(0, Math.floor(sanitized.badges));
      sanitized.plantedTrees = sanitized.plantedTrees
        .filter((tree) =>
          Number.isFinite(tree.x) && Math.abs(tree.x) <= 145 &&
          Number.isFinite(tree.z) && Math.abs(tree.z) <= 145 &&
          treeTypes.some((type) => type.id === tree.species),
        )
        .map((tree) => ({
          ...tree,
          scale: Number.isFinite(tree.scale) ? Math.min(1.5, Math.max(0.25, tree.scale)) : 1.15,
        }));
      sanitized.discoveries = sanitized.discoveries.filter((id) => landmarks.some((landmark) => landmark.id === id));
      sanitized.collectedBadges = sanitized.collectedBadges.filter((id) => Number.isInteger(id) && id >= 0 && id < 40);
      sanitized.observedAnimals = sanitized.observedAnimals.filter((id) => wildlifeProfiles.some((profile) => profile.id === id));
      sanitized.relics = sanitized.relics.filter((id) => relicDefinitions.some((relic) => relic.id === id));
      sanitized.controls = { ...initialControls, ...Object.fromEntries(
        Object.entries(sanitized.controls).filter(([action, key]) =>
          Object.hasOwn(initialControls, action) && typeof key === "string" && /^[a-z]$/i.test(key),
        ).map(([action, key]) => [action, key.toLowerCase()]),
      ) };
      const usedBindings = new Set();
      for (const action of Object.keys(initialControls)) {
        if (usedBindings.has(sanitized.controls[action])) sanitized.controls[action] = initialControls[action];
        usedBindings.add(sanitized.controls[action]);
      }
      sanitized.audioVolume = Number.isFinite(sanitized.audioVolume) ? Math.min(1, Math.max(0, sanitized.audioVolume)) : 0.55;
      sanitized.forage = Number.isInteger(sanitized.forage) ? Math.max(0, sanitized.forage) : 0;
      sanitized.villageLevel = Number.isInteger(sanitized.villageLevel) ? Math.max(0, Math.min(2, sanitized.villageLevel)) : 0;
      sanitized.questStage = Number.isInteger(sanitized.questStage) ? Math.max(0, Math.min(4, sanitized.questStage)) : 0;
      sanitized.dayTime = Number.isFinite(sanitized.dayTime) ? ((sanitized.dayTime % 24) + 24) % 24 : 8;
      if (!seasons.includes(sanitized.season) || !weathers.includes(sanitized.weather)) {
        throw new Error("The save contains an unsupported season or weather value.");
      }
      localStorage.setItem(saveKey, JSON.stringify(sanitized));
      window.location.reload();
    } catch (error) {
      setNotice(`Could not import save: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (saveState !== "Saved just now") return undefined;
    const timer = window.setTimeout(() => setSaveState("Saved"), 2400);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    pauseWorldRef.current = journalOpen || photoMode || settingsOpen || questChoiceOpen;
  }, [journalOpen, photoMode, settingsOpen, questChoiceOpen]);

  const chooseTree = useCallback((treeId) => {
    selectedTreeRef.current = treeId;
    setSelectedTree(treeId);
    persistProgress();
  }, [persistProgress]);

  const toggleNightMode = useCallback(() => {
    autoTimeRef.current = false;
    setAutoTime(false);
    nightModeRef.current = !nightModeRef.current;
    dayTimeRef.current = nightModeRef.current ? 21 : 9;
    setDayTime(dayTimeRef.current);
    setNightMode(nightModeRef.current);
    persistProgress();
  }, [persistProgress]);

  const toggleTimeCycle = useCallback(() => {
    autoTimeRef.current = !autoTimeRef.current;
    setAutoTime(autoTimeRef.current);
    persistProgress();
  }, [persistProgress]);

  const cycleSeason = useCallback(() => {
    const next = seasons[(seasons.indexOf(seasonRef.current) + 1) % seasons.length];
    seasonRef.current = next;
    setSeason(next);
    persistProgress();
  }, [persistProgress]);

  const cycleWeather = useCallback(() => {
    const next = weathers[(weathers.indexOf(weatherRef.current) + 1) % weathers.length];
    weatherRef.current = next;
    setWeather(next);
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
    if (!AudioContextConstructor) {
      setNotice("Ambient audio is not supported by this browser.");
      return;
    }

    const context = new AudioContextConstructor();
    await context.resume();
    const master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);
    master.gain.setTargetAtTime(audioVolumeRef.current * 0.48, context.currentTime, 1.2);

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
    windVolume.gain.value = weatherRef.current === "Rain" ? 0.26 : 0.18;
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

    const seasonScales = {
      Spring: [523.25, 587.33, 659.25, 783.99],
      Summer: [440, 523.25, 659.25, 698.46],
      Autumn: [392, 440, 493.88, 587.33],
      Winter: [349.23, 392, 440, 523.25],
    };
    let noteIndex = 0;
    const playNote = () => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const now = context.currentTime;
      const notes = seasonScales[seasonRef.current] || seasonScales.Spring;
      oscillator.type = "sine";
      oscillator.frequency.value = notes[noteIndex % notes.length] * (nightModeRef.current ? 0.75 : 1);
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
        const frequencies = { forest: isNight ? 260 : 420, water: isNight ? 390 : 680, village: isNight ? 310 : 520, wildlife: isNight ? 280 : 460 };
        windFilter.frequency.setTargetAtTime(frequencies[ambientEnvironmentRef.current], context.currentTime, 1.4);
      },
      setWeather(nextWeather) {
        windVolume.gain.setTargetAtTime(nextWeather === "Rain" ? 0.26 : 0.18, context.currentTime, 0.8);
      },
      setVolume(volume) {
        master.gain.setTargetAtTime(volume * 0.48, context.currentTime, 0.2);
      },
      setEnvironment(environment) {
        ambientEnvironmentRef.current = environment;
        const frequencies = { forest: nightModeRef.current ? 260 : 420, water: nightModeRef.current ? 390 : 680, village: nightModeRef.current ? 310 : 520, wildlife: nightModeRef.current ? 280 : 460 };
        windFilter.frequency.setTargetAtTime(frequencies[environment], context.currentTime, 1.1);
      },
      stop() {
        window.clearInterval(noteTimer);
        master.gain.setTargetAtTime(0.0001, context.currentTime, 0.35);
        window.setTimeout(() => context.close(), 1800);
        droneOscillators.forEach((oscillator) => oscillator.stop(context.currentTime + 1.5));
        wind.stop(context.currentTime + 1.5);
      },
    };
    ambientAudioRef.current.setEnvironment(ambientEnvironmentRef.current);
    ambientAudioRef.current.setWeather(weatherRef.current);
    setAmbientPlaying(true);
  };

  const beginExploring = () => {
    isExploringRef.current = true;
    introWalkRemainingRef.current = 1.7;
    setNurseryOpen(false);
    setIsExploring(true);
  };

  const leaveExploring = () => {
    isExploringRef.current = false;
    introWalkRemainingRef.current = 0;
    setNurseryOpen(true);
    setIsExploring(false);
  };

  useEffect(() => {
    chooseTreeRef.current = chooseTree;
    toggleNightModeRef.current = toggleNightMode;
    if (!ambientPlaying) return;
    ambientAudioRef.current?.setWeather(weather);
  }, [chooseTree, toggleNightMode, weather, ambientPlaying]);

  useEffect(() => () => ambientAudioRef.current?.stop(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surfaceTextures = makeSurfaceTextures();
    surfaceTextures.ground.repeat.set(64, 64);
    surfaceTextures.bark.repeat.set(1, 1);
    surfaceTextures.leaves.repeat.set(1, 1);
    surfaceTextures.fur.repeat.set(2, 2);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b8cbc5");
    scene.fog = new THREE.Fog("#b8cbc5", 72, 170);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      250,
    );
    camera.position.set(0, 2.8, 18);
    camera.rotation.order = "YXZ";
    camera.rotation.x = -0.16;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const hemiLight = new THREE.HemisphereLight("#d9e7e0", "#46513a", 1.35);
    scene.add(hemiLight);
    const sun = new THREE.DirectionalLight("#ffe6bd", 2.6);
    sun.position.set(-34, 52, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -88;
    sun.shadow.camera.right = 88;
    sun.shadow.camera.top = 88;
    sun.shadow.camera.bottom = -88;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);

    const terrainGeometry = new THREE.PlaneGeometry(360, 360, 110, 110);
    terrainGeometry.rotateX(-Math.PI / 2);
    const positions = terrainGeometry.attributes.position;
    const groundColors = [];
    const lowland = new THREE.Color("#526c49");
    const meadow = new THREE.Color("#758451");
    const highland = new THREE.Color("#a39669");
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
        0.91 + (Math.sin(x * 1.72 + z * 2.16) * 0.5 + 0.5) * 0.13;
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
      map: surfaceTextures.ground,
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

    worldRef.current = { scene, hemiLight, sun, moonLight, moon, stars, groundMaterial };

    const hillMaterials = ["#819681", "#8b9a82", "#778d79"].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2;
      const distance = 100 + Math.random() * 32;
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        hillMaterials[index % hillMaterials.length],
      );
      hill.position.set(
        Math.cos(angle) * distance,
        1 + Math.random() * 3,
        Math.sin(angle) * distance - 25,
      );
      hill.scale.set(22 + Math.random() * 16, 13 + Math.random() * 10, 19 + Math.random() * 13);
      hill.rotation.y = Math.random() * Math.PI;
      hill.receiveShadow = true;
      scene.add(hill);
    }

    const treeNests = [];
    const swayingTrees = [];
    for (let index = 0; index < 190; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 11 + Math.sqrt(Math.random()) * 112;
      const x = Math.cos(angle) * distance;
      const z = 8 - Math.sin(angle) * distance;
      const scale = 0.68 + Math.random() * 1.1;
      const tree = makeTree(scene, x, z, scale, index, "oak", surfaceTextures);
      tree.userData.windPhase = Math.random() * Math.PI * 2;
      swayingTrees.push(tree);
      if (index % 18 === 3) treeNests.push(makeNest(tree, scale));
    }

    const growingTrees = [];
    const seasonalMaterials = [];
    for (const planted of plantedTreesRef.current) {
      const scale = planted.scale || 1.15;
      const tree = makeTree(
        scene,
        planted.x,
        planted.z,
        1,
        plantedTreesRef.current.length,
        planted.species,
        surfaceTextures,
      );
      tree.position.y = terrainHeight(planted.x, planted.z);
      tree.scale.setScalar(scale);
      tree.userData.windPhase = Math.random() * Math.PI * 2;
      swayingTrees.push(tree);
      tree.userData.foliageMaterials.forEach((material) => {
        material.userData.baseColor = material.color.clone();
        const seasonTint = {
          Spring: "#91b875",
          Summer: "#6f9556",
          Autumn: "#cf955d",
          Winter: "#b7c2b5",
        }[seasonRef.current];
        material.color.copy(material.userData.baseColor).lerp(
          new THREE.Color(seasonTint),
          seasonRef.current === "Autumn" ? 0.42 : seasonRef.current === "Winter" ? 0.32 : 0.2,
        );
        seasonalMaterials.push(material);
      });
    }
    swayingTrees.forEach((tree) => tree.userData.foliageMaterials.forEach((material) => {
      if (!material.userData.baseColor) material.userData.baseColor = material.color.clone();
      seasonalMaterials.push(material);
    }));

    let frame = 0;
    let nextWeatherChange = 115;
    let lastHudUpdate = 0;
    let lastClockUpdate = 0;
    let lastTimeSave = 0;
    const badges = Array.from({ length: 40 }, (_, id) => {
      const angle = id * 2.399963;
      const distance = 16 + ((id * 19) % 72);
      const x = id === 0 ? 0 : Math.cos(angle) * distance;
      const z = id === 0 ? 5.5 : 8 - Math.sin(angle) * distance;
      const badge = makeNatureBadge(scene, id, x, z, terrainHeight);
      badge.group.visible = false;
      return badge;
    });

    const grassGeometry = new THREE.BufferGeometry();
    const grassVertices = [];
    const addGrassBlade = (angle, lean) => {
      const axisX = Math.cos(angle);
      const axisZ = Math.sin(angle);
      const widthX = -axisZ * 0.075;
      const widthZ = axisX * 0.075;
      const base = [0, 0, 0];
      const middle = [axisX * lean * 0.45, 0.34, axisZ * lean * 0.45];
      const tip = [axisX * lean, 0.68, axisZ * lean];
      const leftBase = [base[0] + widthX, base[1], base[2] + widthZ];
      const rightBase = [base[0] - widthX, base[1], base[2] - widthZ];
      const leftMiddle = [middle[0] + widthX * 0.56, middle[1], middle[2] + widthZ * 0.56];
      const rightMiddle = [middle[0] - widthX * 0.56, middle[1], middle[2] - widthZ * 0.56];
      grassVertices.push(
        ...leftBase, ...rightBase, ...leftMiddle,
        ...rightBase, ...rightMiddle, ...leftMiddle,
        ...leftMiddle, ...rightMiddle, ...tip,
      );
    };
    addGrassBlade(0, 0.11);
    addGrassBlade(Math.PI / 2, 0.1);
    grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grassVertices, 3));
    grassGeometry.computeVertexNormals();
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.96,
      side: THREE.DoubleSide,
    });
    const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, 5200);
    worldRef.current.grassMaterial = grassMaterial;
    const grassDummy = new THREE.Object3D();
    for (let index = 0; index < 5200; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.sqrt(Math.random()) * 130;
      const grassX = Math.cos(angle) * distance;
      const grassZ = 6 - Math.sin(angle) * distance;
      grassDummy.position.set(grassX, terrainHeight(grassX, grassZ) - 0.06, grassZ);
      grassDummy.rotation.y = Math.random() * Math.PI;
      grassDummy.scale.setScalar(0.55 + Math.random() * 0.85);
      grassDummy.updateMatrix();
      grass.setMatrixAt(index, grassDummy.matrix);
      grass.setColorAt(
        index,
        new THREE.Color().setHSL(
          0.19 + Math.random() * 0.055,
          0.24 + Math.random() * 0.2,
          0.3 + Math.random() * 0.18,
        ),
      );
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.receiveShadow = true;
    scene.add(grass);

    const rockMaterial = new THREE.MeshStandardMaterial({ color: "#77796e", roughness: 0.96 });
    for (let index = 0; index < 95; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 125;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.8, 0),
        rockMaterial,
      );
      rock.position.set(
        Math.cos(angle) * distance,
        terrainHeight(Math.cos(angle) * distance, 6 - Math.sin(angle) * distance) + 0.12,
        6 - Math.sin(angle) * distance,
      );
      rock.scale.y = 0.55 + Math.random() * 0.6;
      rock.castShadow = true;
      rock.receiveShadow = true;
      rock.rotation.set(
        Math.random() * 0.6,
        Math.random() * Math.PI,
        Math.random() * 0.3,
      );
      scene.add(rock);
    }

    const animals = [
      {
        kind: { shape: "deer", color: "#9b6842", dark: "#4a372a", belly: "#e6d5b7", ears: true, antlers: true },
        x: -11, z: -20, scale: 1.08,
      },
      {
        kind: { shape: "fox", color: "#c66e35", dark: "#49342a", belly: "#f0dfc0", tail: true, tailColor: "#e7d5b5" },
        x: 15, z: -29, scale: 0.82,
      },
      {
        kind: { shape: "rabbit", color: "#98866d", dark: "#51473b", belly: "#e3d7c4", innerEar: "#b77c75", ears: true, tail: true },
        x: -23, z: -44, scale: 0.66,
      },
      {
        kind: { shape: "bear", color: "#59463a", dark: "#302923", belly: "#a58d71", ears: true, paw: true },
        x: 28, z: -50, scale: 1.12,
      },
      {
        kind: { shape: "badger", color: "#77736a", dark: "#3b3934", belly: "#d2cbbb", mask: true, ears: true, tail: true },
        x: 7, z: -67, scale: 0.74,
      },
      {
        kind: { shape: "boar", color: "#76513d", dark: "#403027", belly: "#b69678", ears: true, tail: true, paw: true },
        x: -36, z: -37, scale: 0.92,
      },
    ].map(({ kind, x, z, scale }) => {
      const animal = makeAnimal(
        scene,
        kind,
        x + (Math.random() - 0.5) * 12,
        z + (Math.random() - 0.5) * 12,
        scale,
        surfaceTextures.fur,
      );
      animal.spawnAt = 2 + Math.random() * 38;
      return animal;
    });

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
    const villageExpansions = addVillageExpansion(scene, villageLevelRef.current);
    const cloudGeometry = new THREE.SphereGeometry(1, 20, 14);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: "#f4f4ed",
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const clouds = Array.from({ length: 9 }, (_, index) =>
      makeCloud(scene, index, cloudGeometry, cloudMaterial),
    );
    const weatherParticles = makeWeatherParticles(scene);
    const forageItems = Array.from({ length: 28 }, (_, index) => {
      const group = new THREE.Group();
      const stemMaterial = new THREE.MeshStandardMaterial({ color: "#64834c", roughness: 1 });
      const fruitMaterial = new THREE.MeshStandardMaterial({
        color: ["#d27254", "#b8a75b", "#8d6689"][index % 3],
        roughness: 0.78,
        emissive: ["#d27254", "#b8a75b", "#8d6689"][index % 3],
        emissiveIntensity: 0.12,
      });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.34, 6), stemMaterial);
      stem.position.y = 0.18;
      group.add(stem);
      for (let fruit = 0; fruit < 3; fruit += 1) {
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), fruitMaterial);
        berry.position.set((fruit - 1) * 0.17, 0.38 + (fruit % 2) * 0.09, (fruit % 2) * 0.08);
        group.add(berry);
      }
      const angle = Math.random() * Math.PI * 2;
      const distance = 16 + Math.random() * 94;
      const x = Math.cos(angle) * distance;
      const z = 8 - Math.sin(angle) * distance;
      group.position.set(x, terrainHeight(x, z), z);
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
      return { group, fruitMaterial, x, z, active: true, phase: Math.random() * Math.PI * 2 };
    });
    const flowerMaterials = ["#e8d9a0", "#d7a7a0", "#c0d29b"].map((color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.12 }),
    );
    const flowerStemMaterial = new THREE.MeshStandardMaterial({ color: "#5f7c49", roughness: 1 });
    const flowers = Array.from({ length: 92 }, (_, index) => {
      const group = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.42, 5), flowerStemMaterial);
      stem.position.y = 0.21;
      group.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flowerMaterials[index % flowerMaterials.length]);
      bloom.position.y = 0.46;
      bloom.scale.set(1, 0.72, 1);
      group.add(bloom);
      const angle = index * 2.399963;
      const distance = 9 + (index % 27) * 2.4;
      const x = 39 + Math.cos(angle) * distance * 0.48;
      const z = 43 + Math.sin(angle) * distance * 0.42;
      group.position.set(x, terrainHeight(x, z), z);
      scene.add(group);
      return { group, phase: index * 0.71, active: true };
    });
    flowerMaterials.forEach((material, index) => {
      material.userData.baseColor = material.color.clone();
      material.userData.paletteIndex = index;
    });
    const mushroomMaterial = new THREE.MeshStandardMaterial({ color: "#bd7861", roughness: 0.9 });
    const mushroomStemMaterial = new THREE.MeshStandardMaterial({ color: "#d4c9aa", roughness: 1 });
    for (let cluster = 0; cluster < 24; cluster += 1) {
      const angle = cluster * 2.399963;
      const radius = 12 + (cluster % 8) * 2.8;
      const x = -72 + Math.cos(angle) * radius;
      const z = 62 + Math.sin(angle) * radius;
      for (let mushroom = 0; mushroom < 3; mushroom += 1) {
        const shroom = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.35, 7), mushroomStemMaterial);
        stem.position.y = 0.17;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 6), mushroomMaterial);
        cap.position.y = 0.35;
        cap.scale.y = 0.5;
        shroom.add(stem, cap);
        const px = x + (Math.random() - 0.5) * 1.4;
        const pz = z + (Math.random() - 0.5) * 1.4;
        shroom.position.set(px, terrainHeight(px, pz), pz);
        scene.add(shroom);
      }
    }
    const butterflyMaterial = new THREE.MeshStandardMaterial({ color: "#e7c277", roughness: 0.65, side: THREE.DoubleSide });
    const butterflies = Array.from({ length: 7 }, (_, index) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 2, 5), flowerStemMaterial);
      group.add(body);
      const wings = [];
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), butterflyMaterial);
        wing.position.x = side * 0.11;
        wing.scale.set(1, 0.18, 1.5);
        group.add(wing);
        wings.push(wing);
      }
      const flower = flowers[(index * 13) % flowers.length];
      scene.add(group);
      return { group, wings, flower, phase: index * 1.7, radius: 1.4 + (index % 3) * 0.5 };
    });
    const relicObjects = relicDefinitions.map((relic, index) => {
      const geometry = index === 0
        ? new THREE.OctahedronGeometry(0.56, 0)
        : new THREE.DodecahedronGeometry(0.48, 0);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: index === 0 ? "#a9c9cb" : "#c7a966",
        emissive: index === 0 ? "#6d9c9f" : "#98733a",
        emissiveIntensity: 0.65,
        roughness: 0.42,
      }));
      mesh.position.set(relic.x, terrainHeight(relic.x, relic.z) + 1.1, relic.z);
      mesh.visible = !relicsRef.current.has(relic.id);
      scene.add(mesh);
      return { ...relic, mesh };
    });
    const landmarkMarkers = landmarks.map((landmark) => {
      if (landmark.id === "quiet-pond") {
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(7.8, 32),
          new THREE.MeshStandardMaterial({
            color: "#5d9290",
            roughness: 0.24,
            metalness: 0.08,
            transparent: true,
            opacity: 0.88,
          }),
        );
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(landmark.x, terrainHeight(landmark.x, landmark.z) + 0.08, landmark.z);
        scene.add(pond);
        for (let reedIndex = 0; reedIndex < 12; reedIndex += 1) {
          const angle = (reedIndex / 12) * Math.PI * 2;
          const reed = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 1.1 + Math.random() * 0.5, 5),
            new THREE.MeshStandardMaterial({ color: "#728c53", roughness: 1 }),
          );
          reed.position.set(
            landmark.x + Math.cos(angle) * (8.6 + Math.random()),
            terrainHeight(landmark.x + Math.cos(angle) * 8.6, landmark.z + Math.sin(angle) * 8.6) + 0.5,
            landmark.z + Math.sin(angle) * 8.6,
          );
          scene.add(reed);
        }
        if (landmark.id === "fox-den") {
          const stone = new THREE.MeshStandardMaterial({ color: "#655d4f", roughness: 1 });
          for (const side of [-1, 1]) {
            const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8, 1), stone);
            boulder.position.set(landmark.x + side * 4.2, terrainHeight(landmark.x + side * 4.2, landmark.z) + 1.2, landmark.z);
            boulder.scale.set(1.1, 0.9, 1.3);
            scene.add(boulder);
          }
          const den = new THREE.Mesh(new THREE.CircleGeometry(2.7, 20), new THREE.MeshBasicMaterial({ color: "#171c18" }));
          den.position.set(landmark.x, terrainHeight(landmark.x, landmark.z) + 0.4, landmark.z);
          scene.add(den);
        }
        if (landmark.id === "stone-ruins") {
          const stone = new THREE.MeshStandardMaterial({ color: "#827f6c", roughness: 0.98 });
          for (let pillar = 0; pillar < 5; pillar += 1) {
            const angle = (pillar / 5) * Math.PI * 2;
            const x = landmark.x + Math.cos(angle) * 5.4;
            const z = landmark.z + Math.sin(angle) * 5.4;
            const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.86, 4.3 + (pillar % 2) * 0.9, 6), stone);
            column.position.set(x, terrainHeight(x, z) + 2, z);
            column.rotation.z = (pillar % 2 ? 1 : -1) * 0.04;
            scene.add(column);
          }
        }
      }
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.06, 7, 24),
        new THREE.MeshBasicMaterial({ color: "#eadb99", transparent: true, opacity: 0.65 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      marker.add(ring);
      marker.position.set(landmark.x, terrainHeight(landmark.x, landmark.z), landmark.z);
      marker.visible = !discoveriesRef.current.has(landmark.id);
      scene.add(marker);
      return { ...landmark, marker };
    });
    const streamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-43, terrainHeight(-43, 34) + 0.08, 34),
      new THREE.Vector3(-29, terrainHeight(-29, 18) + 0.08, 18),
      new THREE.Vector3(-20, terrainHeight(-20, -4) + 0.08, -4),
      new THREE.Vector3(-2, terrainHeight(-2, -25) + 0.08, -25),
      new THREE.Vector3(21, terrainHeight(21, -43) + 0.08, -43),
      new THREE.Vector3(45, terrainHeight(45, -68) + 0.08, -68),
      new THREE.Vector3(61, terrainHeight(61, -98) + 0.08, -98),
    ]);
    const streamSegments = 160;
    const streamHalfWidth = 1.05;
    const streamPositions = [];
    const streamUvs = [];
    const streamIndices = [];
    for (let index = 0; index <= streamSegments; index += 1) {
      const progress = index / streamSegments;
      const center = streamCurve.getPointAt(progress);
      const tangent = streamCurve.getTangentAt(progress);
      const sideX = tangent.z;
      const sideZ = -tangent.x;
      const sideLength = Math.hypot(sideX, sideZ) || 1;
      const normalX = sideX / sideLength;
      const normalZ = sideZ / sideLength;
      for (const side of [-1, 1]) {
        const x = center.x + normalX * streamHalfWidth * side;
        const z = center.z + normalZ * streamHalfWidth * side;
        streamPositions.push(x, terrainHeight(x, z) + 0.1, z);
        streamUvs.push(progress * 12, side === -1 ? 0 : 1);
      }
      if (index < streamSegments) {
        const vertex = index * 2;
        streamIndices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }
    }
    const streamGeometry = new THREE.BufferGeometry();
    streamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(streamPositions, 3));
    streamGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(streamUvs, 2));
    streamGeometry.setIndex(streamIndices);
    streamGeometry.computeVertexNormals();
    const streamMaterial = new THREE.MeshStandardMaterial({
      color: "#527e78",
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const stream = new THREE.Mesh(streamGeometry, streamMaterial);
    stream.receiveShadow = true;
    stream.renderOrder = 1;
    scene.add(stream);
    worldRef.current.cloudMaterial = cloudMaterial;
    worldRef.current.weatherParticles = weatherParticles;
    worldRef.current.forageItems = forageItems;
    worldRef.current.flowers = flowers;
    worldRef.current.butterflies = butterflies;
    worldRef.current.relicObjects = relicObjects;
    worldRef.current.flowerMaterials = flowerMaterials;
    worldRef.current.streamMaterial = streamMaterial;
    worldRef.current.landmarkMarkers = landmarkMarkers;
    worldRef.current.seasonalMaterials = seasonalMaterials;

    const cabin = makeCabin(scene, 2, -28);
    const villagers = createVillage(scene, terrainHeight);
    const player = makePlayerCharacter(scene, 0, 12, terrainHeight);
    camera.position.set(0, player.group.position.y + 2.8, 18);
    const spawnBadge = (badge) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 18 + Math.random() * 24;
      const x = THREE.MathUtils.clamp(
        player.group.position.x + Math.cos(angle) * distance,
        -140,
        140,
      );
      const z = THREE.MathUtils.clamp(
        player.group.position.z + Math.sin(angle) * distance,
        -140,
        140,
      );
      badge.group.position.set(x, terrainHeight(x, z) + 1.1, z);
      badge.phase = Math.random() * Math.PI * 2;
      badge.group.visible = true;
      badge.nextSpawnAt = Infinity;
    };
    const activeBadgeLimit = 5;
    const waitingBadges = [...badges];
    for (let index = 0; index < activeBadgeLimit; index += 1) {
      const badgeIndex = Math.floor(Math.random() * waitingBadges.length);
      spawnBadge(waitingBadges.splice(badgeIndex, 1)[0]);
    }
    waitingBadges.forEach((badge) => {
      badge.nextSpawnAt = Math.random() * 16;
    });

    const workers = [
      makeWorker(scene, -4, -19, "#b96749", 0.4),
      makeWorker(scene, 8, -20, "#758b67", 1.8),
    ];
    workers.forEach(({ group }) => group.scale.setScalar(1.5));
    villagers.forEach(({ group }) => { group.visible = !nightModeRef.current; });
    const owls = [
      makeOwl(scene, -8, terrainHeight(-8, -22) + 5.1, -22, 0.9),
      makeOwl(scene, 29, terrainHeight(29, -43) + 6.5, -43, 1.05),
    ];
    owls.forEach((owl) => {
      owl.spawnAt = 8 + Math.random() * 30;
      owl.appeared = false;
      owl.group.visible = false;
    });
    const nightAnimals = [
      makeAnimal(scene, {
        shape: "fox", color: "#bd7241", dark: "#593c2c", belly: "#e5d0ad",
        tail: true, tailColor: "#eee0c5", nocturnal: true,
      }, -5, -15, 0.85, surfaceTextures.fur),
      makeAnimal(scene, {
        shape: "badger", color: "#827b63", dark: "#48443a", belly: "#d4c9ae",
        mask: true, ears: true, tail: true, nocturnal: true,
      }, 10, -19, 0.7, surfaceTextures.fur),
    ];
    nightAnimals.forEach((animal) => {
      animal.spawnAt = 4 + Math.random() * 34;
    });
    const wildlife = [...animals, ...nightAnimals];
    owls.forEach(({ group }) => { group.visible = false; });
    Object.assign(worldRef.current, { cabin, player, animals, workers, owls, nightAnimals, villagers });

    const keys = new Set();
    let lookPointer = null;
    const keyDown = (event) => {
      const key = event.key.toLowerCase();
      if (rebindControlRef.current) {
        if (key === "escape") {
          rebindControlRef.current = "";
          setRebindControl("");
          return;
        }
        event.preventDefault();
        updateControlsRef.current?.(rebindControlRef.current, key);
        return;
      }
      if (key === "escape" && pauseWorldRef.current) {
        if (modalStateRef.current.journalOpen) setJournalOpen(false);
        if (modalStateRef.current.settingsOpen) setSettingsOpen(false);
        if (modalStateRef.current.questChoiceOpen) setQuestChoiceOpen(false);
        if (modalStateRef.current.photoMode) setPhotoMode(false);
        return;
      }
      if (pauseWorldRef.current) return;
      const bindings = controlsRef.current;
      if (key === bindings.interact && isExploringRef.current) {
        event.preventDefault();
        interactActionRef.current?.();
        return;
      }
      if (key === bindings.journal) {
        event.preventDefault();
        setJournalOpen((open) => !open);
        return;
      }
      if (key === bindings.photo) {
        event.preventDefault();
        setPhotoMode((active) => !active);
        return;
      }
      if (key === "escape" && isExploringRef.current) {
        isExploringRef.current = false;
        introWalkRemainingRef.current = 0;
        keys.clear();
        setNurseryOpen(true);
        setInteractionHint("");
        setIsExploring(false);
        return;
      }
      if (key === "e") {
        event.preventDefault();
        plantActionRef.current?.();
      }
      if (key === bindings.night) {
        event.preventDefault();
        toggleNightModeRef.current?.();
      }
      const treeIndex = Number(key) - 1;
      if (treeIndex >= 0 && treeIndex < treeTypes.length) {
        chooseTreeRef.current?.(treeTypes[treeIndex].id);
      }
      if (
        [
          bindings.forward,
          bindings.left,
          bindings.backward,
          bindings.right,
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
    const finishQuest = () => {
      questStageRef.current = 4;
      questCompleteRef.current = true;
      setQuestStage(4);
      setQuestComplete(true);
      villageLevelRef.current = Math.max(1, villageLevelRef.current);
      setVillageLevel(villageLevelRef.current);
      villageExpansions.push(...addVillageExpansion(scene, villageLevelRef.current));
      badgeCountRef.current += 8;
      setBadgeCount(badgeCountRef.current);
      setNotice("Final chapter · The village and forest thrive together. +8 nature badges");
      persistProgress();
    };
    const checkQuestProgress = () => {
      if (questStageRef.current === 2) {
        const branchComplete = questPathRef.current === "wildlife"
          ? observedAnimalsRef.current.size >= 2
          : discoveriesRef.current.size >= 2;
        if (branchComplete) {
          questStageRef.current = 3;
          setQuestStage(3);
          setNotice(questPathRef.current === "wildlife"
            ? "Chapter 2 · The animals trust the grove. Find and recover one ancient relic."
            : "Chapter 2 · The habitats are mapped. Gather three berry harvests to help the village.");
          persistProgress();
        }
      }
      if (questStageRef.current === 3) {
        const endingReady = questPathRef.current === "wildlife"
          ? relicsRef.current.size >= 1
          : forageRef.current >= 3;
        if (endingReady) finishQuest();
      }
    };
    const plantSelectedTree = () => {
      if (badgeCountRef.current < 10) {
        setNotice("Gather ten nature badges before planting.");
        return;
      }
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      const x = THREE.MathUtils.clamp(player.group.position.x + direction.x * 5, -145, 145);
      const z = THREE.MathUtils.clamp(player.group.position.z + direction.z * 5, -145, 145);
      const species = selectedTreeRef.current;
      const grove = [{ x, z, species, scale: 1.15 }];
      for (let sapling = 0; sapling < 3; sapling += 1) {
        const angle = (sapling / 3) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 4 + Math.random() * 4;
        grove.push({
          x: THREE.MathUtils.clamp(x + Math.cos(angle) * distance, -140, 140),
          z: THREE.MathUtils.clamp(z + Math.sin(angle) * distance, -140, 140),
          species: treeTypes[Math.floor(Math.random() * treeTypes.length)].id,
          scale: 0.58 + Math.random() * 0.22,
        });
      }
      const groveTrees = grove.map((planted, index) => {
        const tree = makeTree(
          scene,
          planted.x,
          planted.z,
          1,
          plantedTreesRef.current.length + index,
          planted.species,
          surfaceTextures,
        );
        tree.position.y = terrainHeight(planted.x, planted.z);
        tree.scale.setScalar(0.025);
        tree.userData.windPhase = Math.random() * Math.PI * 2;
        swayingTrees.push(tree);
        growingTrees.push({ tree, start: frame, scale: planted.scale });
        tree.userData.foliageMaterials.forEach((material) => {
          material.userData.baseColor = material.color.clone();
          seasonalMaterials.push(material);
        });
        return planted;
      });
      const nextTrees = [...plantedTreesRef.current, ...groveTrees];
      plantedTreesRef.current = nextTrees;
      badgeCountRef.current -= 10;
      if (questStageRef.current === 1) {
        questStageRef.current = 2;
        setQuestStage(2);
        setNotice("Chapter 1 complete · Your grove is growing. Continue the village story.");
      } else {
        setNotice("A young grove takes root.");
      }
      setBadgeCount(badgeCountRef.current);
      setPlantedTrees(nextTrees);
      checkQuestProgress();
      persistProgress();
    };
    plantActionRef.current = plantSelectedTree;
    const interact = () => {
      const nearbyRelic = relicObjects
        .filter(({ mesh }) => mesh.visible)
        .sort((a, b) => player.group.position.distanceTo(a.mesh.position) - player.group.position.distanceTo(b.mesh.position))[0];
      if (nearbyRelic && player.group.position.distanceTo(nearbyRelic.mesh.position) < 4.5) {
        relicsRef.current.add(nearbyRelic.id);
        setRelics([...relicsRef.current]);
        nearbyRelic.mesh.visible = false;
        badgeCountRef.current += 1;
        setBadgeCount(badgeCountRef.current);
        setNotice(`Recovered ${nearbyRelic.name}. Added to your journal.`);
        checkQuestProgress();
        persistProgress();
        return;
      }
      const nearbyAnimal = wildlife
        .filter(({ appeared, group, species }) => appeared && group.visible && !observedAnimalsRef.current.has(species))
        .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
      const nearbyOwl = owls.find((owl) => owl.appeared && owl.group.visible && player.group.position.distanceTo(owl.group.position) < 7);
      if (nearbyAnimal && player.group.position.distanceTo(nearbyAnimal.group.position) < 6) {
        const species = nearbyAnimal.species;
        observedAnimalsRef.current.add(species);
        setObservedAnimals([...observedAnimalsRef.current]);
        badgeCountRef.current += 1;
        setBadgeCount(badgeCountRef.current);
        const profile = wildlifeProfiles.find((animal) => animal.id === species);
        setNotice(`Observed ${profile?.name || species}. Field notes added · +1 badge`);
        checkQuestProgress();
        persistProgress();
        return;
      }
      if (nearbyOwl && !observedAnimalsRef.current.has("owl")) {
        observedAnimalsRef.current.add("owl");
        setObservedAnimals([...observedAnimalsRef.current]);
        badgeCountRef.current += 1;
        setBadgeCount(badgeCountRef.current);
        setNotice("Observed a tawny owl. Field notes added · +1 badge");
        checkQuestProgress();
        persistProgress();
        return;
      }
      const nearbyForage = forageItems
        .filter((item) => item.active)
        .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
      if (nearbyForage && player.group.position.distanceTo(nearbyForage.group.position) < 4.2) {
        nearbyForage.active = false;
        nearbyForage.group.visible = false;
        forageRef.current += 1;
        setForage(forageRef.current);
        setNotice("Wild berries gathered. Trade three harvests with a villager for a nature badge.");
        checkQuestProgress();
        persistProgress();
        return;
      }
      const villager = villagers
        .slice()
        .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
      if (villager && player.group.position.distanceTo(villager.group.position) < 5.5) {
        if (questStageRef.current === 0) {
          setQuestChoiceOpen(true);
          setNotice("The village keeper has a story to tell. Choose how to help Fernwake.");
        } else if (forageRef.current >= 3) {
          forageRef.current -= 3;
          badgeCountRef.current += 1;
          setForage(forageRef.current);
          setBadgeCount(badgeCountRef.current);
          setNotice("The market traded your harvest for a nature badge.");
          checkQuestProgress();
          persistProgress();
        } else if (questCompleteRef.current) {
          setNotice("The villagers thank you for helping Fernwake recover.");
        } else {
          setNotice(questStageRef.current === 1
            ? "Chapter 1 · Plant a grove to begin the restoration."
            : questPathRef.current === "wildlife"
              ? questStageRef.current === 2
                ? `Chapter 2 · Observe wildlife (${observedAnimalsRef.current.size}/2 species).`
                : `Final chapter · Recover a relic (${relicsRef.current.size}/1).`
              : questStageRef.current === 2
                ? `Chapter 2 · Discover landmarks (${discoveriesRef.current.size}/2).`
                : `Final chapter · Gather berries (${forageRef.current}/3).`);
        }
        return;
      }
      setNotice("Explore the meadow. F observes wildlife, gathers berries, or speaks with villagers.");
    };
    interactActionRef.current = interact;
    downloadPhotoRef.current = () => {
      const link = document.createElement("a");
      link.download = `fernwake-${seasonRef.current.toLowerCase()}-${Date.now()}.png`;
      link.href = renderer.domElement.toDataURL("image/png");
      link.click();
    };

    const applyNightMode = (isNight) => {
      const sky = isNight ? "#101b2b" : "#b8cbc5";
      scene.background.set(sky);
      scene.fog.color.set(sky);
      hemiLight.color.set(isNight ? "#839dc7" : "#d9e7e0");
      hemiLight.groundColor.set(isNight ? "#22283c" : "#46513a");
      hemiLight.intensity = isNight ? 0.62 : 1.35;
      sun.intensity = isNight ? 0.1 : 2.6;
      moonLight.intensity = isNight ? 1.4 : 0;
      moon.visible = isNight;
      stars.visible = isNight;
      worldRef.current.animals.forEach(({ group, appeared }) => { group.visible = appeared && !isNight; });
      worldRef.current.workers.forEach(({ group }) => { group.visible = !isNight; });
      worldRef.current.owls.forEach(({ group, appeared }) => { group.visible = appeared && isNight; });
      worldRef.current.nightAnimals.forEach(({ group, appeared }) => { group.visible = appeared && isNight; });
      worldRef.current.villagers.forEach(({ group }) => { group.visible = !isNight; });
      cloudMaterial.color.set(isNight ? "#8291a7" : weatherRef.current === "Clear" ? "#f4f4ed" : "#c6d0ce");
      badges.forEach((badge) => badge.setNightMode(isNight));
      worldRef.current.cabin.flames.forEach((flame) => { flame.visible = isNight; });
      worldRef.current.cabin.smokePuffs.forEach(({ mesh }) => { mesh.visible = isNight; });
      worldRef.current.cabin.fireLight.intensity = isNight ? 2.2 : 0;
    };
    applyNightMode(nightModeRef.current);

    const clock = new THREE.Timer();
    const forwardDirection = new THREE.Vector3();
    const rightDirection = new THREE.Vector3();
    const movementDirection = new THREE.Vector3();
    const nightSkyColor = new THREE.Color("#101b2b");
    const daySkyColor = new THREE.Color("#b8cbc5");
    const dawnColor = new THREE.Color("#ddad8b");
    const sunBaseColor = new THREE.Color("#fff4df");
    const sunsetColor = new THREE.Color("#f1a96d");
    const nightGroundColor = new THREE.Color("#22283c");
    const dayGroundColor = new THREE.Color("#46513a");
    const animate = () => {
      clock.update();
      const delta = Math.min(clock.getDelta(), 0.05);
      frame += delta;
      if (frame >= nextWeatherChange) {
        const nextWeather = weathers.filter((option) => option !== weatherRef.current)[
          Math.floor(Math.random() * (weathers.length - 1))
        ];
        weatherRef.current = nextWeather;
        setWeather(nextWeather);
        persistProgress();
        nextWeatherChange = frame + 105 + Math.random() * 75;
      }
      if (autoTimeRef.current) {
        dayTimeRef.current = (dayTimeRef.current + delta * 0.05) % 24;
        if (frame - lastClockUpdate > 1.2) {
          lastClockUpdate = frame;
          setDayTime(dayTimeRef.current);
        }
        if (frame - lastTimeSave > 15) {
          lastTimeSave = frame;
          persistProgress();
        }
        const hour = dayTimeRef.current;
        const daylight = THREE.MathUtils.clamp((Math.sin(((hour - 6) / 12) * Math.PI) + 0.14) * 1.15, 0, 1);
        const warmLight = THREE.MathUtils.clamp(1 - Math.min(Math.abs(hour - 6), Math.abs(hour - 18)) / 2.3, 0, 1);
        const skyColor = nightSkyColor.clone().lerp(daySkyColor, daylight).lerp(dawnColor, warmLight * 0.26);
        scene.background.copy(skyColor);
        scene.fog.color.copy(skyColor);
        hemiLight.color.copy(new THREE.Color("#839dc7")).lerp(new THREE.Color("#d9e7e0"), daylight);
        hemiLight.groundColor.copy(nightGroundColor).lerp(dayGroundColor, daylight);
        hemiLight.intensity = 0.42 + daylight * 0.95;
        sun.intensity = 0.05 + daylight * 2.45;
        sun.color.copy(sunBaseColor).lerp(sunsetColor, warmLight * 0.48);
        sun.position.set(Math.cos((hour / 24) * Math.PI * 2) * 50, 8 + daylight * 50, Math.sin((hour / 24) * Math.PI * 2) * 30);
        moonLight.intensity = (1 - daylight) * 1.25;
        moon.visible = daylight < 0.24;
        stars.visible = daylight < 0.12;
        const isNightNow = daylight < 0.17;
        if (isNightNow !== nightModeRef.current) {
          nightModeRef.current = isNightNow;
          setNightMode(isNightNow);
          ambientAudioRef.current?.setNight(isNightNow);
          worldRef.current.animals.forEach(({ group, appeared }) => { group.visible = appeared && !isNightNow; });
          worldRef.current.workers.forEach(({ group }) => { group.visible = !isNightNow; });
          worldRef.current.owls.forEach(({ group, appeared }) => { group.visible = appeared && isNightNow; });
          worldRef.current.nightAnimals.forEach(({ group, appeared }) => { group.visible = appeared && isNightNow; });
          villagers.forEach(({ group }) => { group.visible = !isNightNow; });
          cabin.flames.forEach((flame) => { flame.visible = isNightNow; });
          cabin.smokePuffs.forEach(({ mesh }) => { mesh.visible = isNightNow; });
          persistProgress();
        }
      }
      let moving = false;
      if (isExploringRef.current && !pauseWorldRef.current) {
        let forward =
          Number(keys.has(controlsRef.current.forward) || keys.has("arrowup")) -
          Number(keys.has(controlsRef.current.backward) || keys.has("arrowdown"));
        let sideways =
          Number(keys.has(controlsRef.current.right) || keys.has("arrowright")) -
          Number(keys.has(controlsRef.current.left) || keys.has("arrowleft"));
        if (forward === 0 && sideways === 0 && introWalkRemainingRef.current > 0) {
          forward = 1;
          introWalkRemainingRef.current = Math.max(0, introWalkRemainingRef.current - delta);
        }
        const length = Math.hypot(forward, sideways) || 1;
        forward /= length;
        sideways /= length;
        moving = forward !== 0 || sideways !== 0;
        if (pauseWorldRef.current) moving = false;
        const speed = keys.has("shift") ? 13 : 7;
        camera.getWorldDirection(forwardDirection);
        forwardDirection.y = 0;
        forwardDirection.normalize();
        rightDirection.crossVectors(forwardDirection, camera.up).normalize();
        movementDirection
          .copy(forwardDirection)
          .multiplyScalar(forward)
          .addScaledVector(rightDirection, sideways);
        if (moving) {
          player.group.position.addScaledVector(movementDirection, speed * delta);
          player.group.rotation.y = Math.atan2(-movementDirection.x, -movementDirection.z);
        }
      }
      player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -145, 145);
      player.group.position.z = THREE.MathUtils.clamp(player.group.position.z, -145, 145);
      player.group.position.y = terrainHeight(player.group.position.x, player.group.position.z);
      if (frame - lastHudUpdate > 0.8) {
        lastHudUpdate = frame;
        setPlayerMap({
          x: Math.round(player.group.position.x),
          z: Math.round(player.group.position.z),
          heading: player.group.rotation.y,
        });
        const closestForage = forageItems
          .filter((item) => item.active)
          .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
        const nearestAnimal = wildlife
          .filter(({ appeared, group }) => appeared && group.visible)
          .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
        const nearestRelic = relicObjects
          .filter(({ mesh }) => mesh.visible)
          .sort((a, b) => player.group.position.distanceTo(a.mesh.position) - player.group.position.distanceTo(b.mesh.position))[0];
        const nearestVillager = villagers
          .slice()
          .sort((a, b) => player.group.position.distanceTo(a.group.position) - player.group.position.distanceTo(b.group.position))[0];
        const nearWater = Math.hypot(player.group.position.x - 54, player.group.position.z + 58) < 15;
        const nearVillage = nearestVillager && player.group.position.distanceTo(nearestVillager.group.position) < 13;
        const nearWildlife = wildlife.some(({ group, appeared }) =>
          appeared && player.group.position.distanceTo(group.position) < 12,
        );
        const environment = nearWater ? "water" : nearVillage ? "village" : nearWildlife ? "wildlife" : "forest";
        if (environment !== ambientEnvironmentRef.current) {
          ambientAudioRef.current?.setEnvironment(environment);
          ambientEnvironmentRef.current = environment;
        }
        const hint = closestForage && player.group.position.distanceTo(closestForage.group.position) < 4.2
          ? "F · Gather wild berries"
          : nearestRelic && player.group.position.distanceTo(nearestRelic.mesh.position) < 4.5
            ? "F · Recover relic"
          : nearestVillager && player.group.position.distanceTo(nearestVillager.group.position) < 5.5
            ? "F · Speak with villager"
            : nearestAnimal && player.group.position.distanceTo(nearestAnimal.group.position) < 6 &&
              !observedAnimalsRef.current.has(nearestAnimal.species)
              ? "F · Observe wildlife"
            : "";
        setInteractionHint((current) => current === hint ? current : hint);
      }
      landmarks.forEach((landmark) => {
        if (discoveriesRef.current.has(landmark.id)) return;
        if (Math.hypot(player.group.position.x - landmark.x, player.group.position.z - landmark.z) < 9) {
          discoveriesRef.current.add(landmark.id);
          setDiscoveries([...discoveriesRef.current]);
          landmarkMarkers.find((marker) => marker.id === landmark.id).marker.visible = false;
          setNotice(`Discovered: ${landmark.name}. Added to your field journal.`);
          persistProgress();
          checkQuestProgress();
        }
      });
      camera.getWorldDirection(forwardDirection);
      forwardDirection.y = 0;
      forwardDirection.normalize();
      camera.position.set(
        player.group.position.x - forwardDirection.x * 5,
        player.group.position.y + 2.8 + (moving && !reducedMotionRef.current ? Math.sin(frame * 11) * 0.045 : 0),
        player.group.position.z - forwardDirection.z * 5,
      );
      const walkCycle = Math.sin(frame * 10);
      player.legs[0].rotation.x = moving ? walkCycle * 0.48 : 0;
      player.legs[1].rotation.x = moving ? -walkCycle * 0.48 : 0;
      player.arms[0].rotation.x = moving ? -walkCycle * 0.32 : 0;
      player.arms[1].rotation.x = moving ? walkCycle * 0.32 : 0;

      badges.forEach((badge) => {
        badge.updateHighlight(frame, nightModeRef.current);
        if (!badge.group.visible) {
          if (badge.nextSpawnAt <= frame) {
            const visibleCount = badges.reduce(
              (count, candidate) => count + Number(candidate.group.visible),
              0,
            );
            if (visibleCount < activeBadgeLimit) spawnBadge(badge);
          }
          return;
        }
        badge.group.position.y = terrainHeight(badge.group.position.x, badge.group.position.z) + 1.1 + Math.sin(frame * 2.2 + badge.phase) * 0.16;
        badge.group.rotation.y = frame * 0.7 + badge.phase;
        if (isExploringRef.current && player.group.position.distanceTo(badge.group.position) < 2.1) {
          badgeCountRef.current += 1;
          setBadgeCount(badgeCountRef.current);
          persistProgress();
          badge.group.visible = false;
          badge.nextSpawnAt = frame + 3 + Math.random() * 9;
        }
      });

      growingTrees.forEach(({ tree, start, scale }) => {
        const growth = THREE.MathUtils.clamp((frame - start) / 8, 0, 1);
        tree.scale.setScalar(0.025 + (scale - 0.025) * growth);
      });
      swayingTrees.forEach((tree) => {
        const amount = reducedMotionRef.current ? 0.25 : 1;
        tree.rotation.z = Math.sin(frame * 0.62 + tree.userData.windPhase) * 0.012 * amount;
        tree.rotation.x = Math.cos(frame * 0.47 + tree.userData.windPhase) * 0.009 * amount;
      });

      wildlife.forEach((animal) => {
        const { group, legs, homeX, homeZ, wanderRadius, phase, speed } = animal;
        const activeForTime = Boolean(animal.nocturnal) === nightModeRef.current;
        if (!animal.appeared && frame >= animal.spawnAt) {
          animal.appeared = true;
          animal.arrivedAt = frame;
          group.visible = activeForTime;
          group.scale.setScalar(0.025);
        }
        if (!animal.appeared) return;
        group.visible = activeForTime;
        const arrival = THREE.MathUtils.clamp((frame - animal.arrivedAt) / 1.3, 0, 1);
        group.scale.setScalar(animal.baseScale * arrival);
        const weatherPace = weatherRef.current === "Rain" ? 0.65 : weatherRef.current === "Snow" ? 0.5 : 1;
        const seasonPace = seasonRef.current === "Winter" ? 0.72 : 1;
        const walkCycle = frame * speed * weatherPace * seasonPace + phase;
        const closeToPlayer = isExploringRef.current && player.group.position.distanceTo(group.position) < 11;
        const foodTarget = forageItems
          .filter((item) => item.active)
          .sort((a, b) => group.position.distanceTo(a.group.position) - group.position.distanceTo(b.group.position))[0];
        const foraging = foodTarget && group.position.distanceTo(foodTarget.group.position) < 18 && !closeToPlayer;
        const escapeX = closeToPlayer ? group.position.x - player.group.position.x : 0;
        const escapeZ = closeToPlayer ? group.position.z - player.group.position.z : 0;
        const escapeLength = Math.hypot(escapeX, escapeZ) || 1;
        const fleeDistance = closeToPlayer ? 10 : 0;
        const nextX = homeX + Math.sin(walkCycle) * wanderRadius +
          (escapeX / escapeLength) * fleeDistance +
          (foraging ? (foodTarget.x - homeX) * 0.24 : 0);
        const nextZ = homeZ + Math.sin(walkCycle * 0.62) * wanderRadius * 0.58 +
          (escapeZ / escapeLength) * fleeDistance +
          (foraging ? (foodTarget.z - homeZ) * 0.24 : 0);
        const directionX = nextX - group.position.x;
        const directionZ = nextZ - group.position.z;
        group.position.set(
          nextX,
          terrainHeight(nextX, nextZ) + Math.abs(Math.sin(walkCycle * 2)) * 0.04,
          nextZ,
        );
        if (foraging && group.position.distanceTo(foodTarget.group.position) < 2.2) {
          foodTarget.active = false;
          foodTarget.group.visible = false;
        }
        if (Math.hypot(directionX, directionZ) > 0.001) {
          group.rotation.y = Math.atan2(directionX, directionZ) + Math.PI;
        }
        legs.forEach((leg, index) => {
          leg.rotation.x = Math.sin(walkCycle * 5 + (index % 2) * Math.PI) * 0.22;
        });
      });

      birds.forEach((birdState) => {
        const {
          bird, wings, phase, centerX, centerZ, radiusX, radiusZ, height,
          speed, direction, nest, roostPosition, flightPosition,
        } = birdState;
        if (!birdState.appeared && frame >= birdState.spawnAt) {
          birdState.appeared = true;
          bird.visible = true;
        }
        if (!birdState.appeared) return;
        const angle = frame * speed * direction + phase;
        flightPosition.set(
          centerX + Math.cos(angle) * radiusX,
          height + Math.sin(frame * 1.8 + phase) * 0.6,
          centerZ + Math.sin(angle) * radiusZ,
        );
        const isNight = nightModeRef.current;
        let target = flightPosition;
        if (isNight) {
          nest.getWorldPosition(roostPosition);
          roostPosition.y += 0.28;
          target = roostPosition;
        }
        bird.position.lerp(target, 1 - Math.exp(-delta * (isNight ? 1.2 : 1.8)));
        bird.rotation.y = isNight ? Math.PI : -angle * direction;
        const settled = isNight && bird.position.distanceTo(target) < 0.42;
        const flap = settled || reducedMotionRef.current ? 0 : Math.sin(frame * 10 + phase) * 0.52;
        wings[0].rotation.z = 0.16 + flap;
        wings[1].rotation.z = -0.16 - flap;
      });
      clouds.forEach(({ group, phase, speed, baseY }) => {
        group.position.x += speed * delta;
        if (group.position.x > 150) group.position.x = -150;
        group.position.y = baseY + Math.sin(frame * 0.12 + phase) * 0.45;
      });
      if (weatherParticles.particles.visible && !reducedMotionRef.current) {
        const fallSpeed = weatherRef.current === "Snow" ? 4.2 : 19;
        for (let index = 0; index < weatherParticles.count; index += 1) {
          const offset = index * 3;
          weatherParticles.positions[offset + 1] -= fallSpeed * delta;
          if (weatherRef.current === "Snow") {
            weatherParticles.positions[offset] += Math.sin(frame + index) * delta * 0.65;
          }
          if (
            weatherParticles.positions[offset + 1] < player.group.position.y - 3 ||
            Math.abs(weatherParticles.positions[offset] - player.group.position.x) > 52 ||
            Math.abs(weatherParticles.positions[offset + 2] - player.group.position.z) > 52
          ) {
            weatherParticles.positions[offset] = player.group.position.x + (Math.random() - 0.5) * 90;
            weatherParticles.positions[offset + 1] = player.group.position.y + 22 + Math.random() * 14;
            weatherParticles.positions[offset + 2] = player.group.position.z + (Math.random() - 0.5) * 90;
          }
        }
        weatherParticles.particles.geometry.attributes.position.needsUpdate = true;
      }
      forageItems.forEach(({ group, phase, active }) => {
        if (active) group.rotation.y += delta * 0.3;
        if (active) group.position.y = terrainHeight(group.position.x, group.position.z) + Math.sin(frame * 2 + phase) * 0.06;
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
      animateVillagers(villagers, reducedMotionRef.current ? 0 : frame, terrainHeight);
      owls.forEach((owl) => {
        const { group, wings, phase } = owl;
        if (!owl.appeared && frame >= owl.spawnAt) {
          owl.appeared = true;
          group.visible = nightModeRef.current;
        }
        if (!owl.appeared) return;
        group.visible = nightModeRef.current;
        const flap = Math.sin(frame * 1.2 + phase) * 0.08;
        wings[0].rotation.z = -0.18 - flap;
        wings[1].rotation.z = 0.18 + flap;
        group.rotation.y = Math.sin(frame * 0.35 + phase) * 0.12;
      });
      butterflies.forEach(({ group, wings, flower, phase, radius }) => {
        const target = flower.group.position;
        group.visible = !nightModeRef.current && weatherRef.current !== "Snow" && seasonRef.current !== "Winter";
        if (!reducedMotionRef.current) {
          group.position.set(
            target.x + Math.sin(frame * 1.4 + phase) * radius,
            target.y + 0.75 + Math.sin(frame * 2.1 + phase) * 0.3,
            target.z + Math.cos(frame * 1.2 + phase) * radius,
          );
          wings[0].rotation.z = Math.sin(frame * 13 + phase) * 0.72;
          wings[1].rotation.z = -Math.sin(frame * 13 + phase) * 0.72;
        }
      });

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    return () => {
      renderer.setAnimationLoop(null);
      plantActionRef.current = null;
      interactActionRef.current = null;
      downloadPhotoRef.current = null;
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
      Object.values(surfaceTextures).forEach((texture) => texture.dispose());
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
    seasonRef.current = season;
    const seasonTint = {
      Spring: new THREE.Color("#91b875"),
      Summer: new THREE.Color("#6f9556"),
      Autumn: new THREE.Color("#cf955d"),
      Winter: new THREE.Color("#b7c2b5"),
    }[season];
    world.seasonalMaterials.forEach((material) => {
      material.color.copy(material.userData.baseColor).lerp(seasonTint, season === "Autumn" ? 0.42 : season === "Winter" ? 0.32 : 0.2);
    });
    const forageColors = {
      Spring: "#dc9cba",
      Summer: "#b6a34f",
      Autumn: "#c36f45",
      Winter: "#d6d7c5",
    };
    world.forageItems.forEach(({ fruitMaterial }) => fruitMaterial.color.set(forageColors[season]));
    const blossomPalettes = {
      Spring: ["#e8d9a0", "#d7a7a0", "#c0d29b"],
      Summer: ["#f0d879", "#d7bd89", "#e5e4b3"],
      Autumn: ["#d88d62", "#c77f79", "#b5a05c"],
      Winter: ["#d4ddd0", "#c9d0cf", "#d9d3c8"],
    };
    world.flowerMaterials.forEach((material, index) => material.color.set(blossomPalettes[season][index]));
    world.groundMaterial.color.copy(seasonTint).lerp(new THREE.Color("#ffffff"), 0.35);
    world.grassMaterial.color.copy(seasonTint);
  }, [season]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    weatherRef.current = weather;
    const isPrecipitating = weather === "Rain" || weather === "Snow";
    world.weatherParticles.particles.visible = isPrecipitating && !reducedMotionRef.current;
    world.weatherParticles.material.color.set(weather === "Snow" ? "#fffdf3" : "#dce8ed");
    world.weatherParticles.material.size = weather === "Snow" ? 0.2 : 0.075;
    world.weatherParticles.material.opacity = weather === "Snow" ? 0.82 : 0.6;
    world.cloudMaterial.color.set(weather === "Clear" ? "#f4f4ed" : "#c6d0ce");
    world.cloudMaterial.opacity = weather === "Clear" ? 0.72 : 0.88;
    if (weather === "Mist") {
      world.scene.fog.near = 22;
      world.scene.fog.far = 112;
    } else if (weather === "Rain") {
      world.scene.fog.near = 48;
      world.scene.fog.far = 142;
    } else {
      world.scene.fog.near = 72;
      world.scene.fog.far = 170;
    }
    ambientAudioRef.current?.setWeather(weather);
  }, [weather]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const sky = nightMode ? "#101b2b" : "#b8cbc5";
    world.scene.background.set(sky);
    world.scene.fog.color.set(sky);
    world.hemiLight.color.set(nightMode ? "#839dc7" : "#d9e7e0");
    world.hemiLight.groundColor.set(nightMode ? "#22283c" : "#46513a");
    world.hemiLight.intensity = nightMode ? 0.62 : 1.35;
    world.sun.intensity = nightMode ? 0.1 : 2.6;
    world.cloudMaterial.color.set(nightMode ? "#8291a7" : weather === "Clear" ? "#f4f4ed" : "#c6d0ce");
    world.moonLight.intensity = nightMode ? 1.4 : 0;
    world.moon.visible = nightMode;
    world.stars.visible = nightMode;
    world.animals.forEach(({ group, appeared }) => { group.visible = appeared && !nightMode; });
    world.workers.forEach(({ group }) => { group.visible = !nightMode; });
    world.owls.forEach(({ group, appeared }) => { group.visible = appeared && nightMode; });
    world.nightAnimals.forEach(({ group, appeared }) => { group.visible = appeared && nightMode; });
    world.villagers.forEach(({ group }) => { group.visible = !nightMode; });
    world.cabin.flames.forEach((flame) => { flame.visible = nightMode; });
    world.cabin.smokePuffs.forEach(({ mesh }) => { mesh.visible = nightMode; });
    world.cabin.fireLight.intensity = nightMode ? 2.2 : 0;
    ambientAudioRef.current?.setNight(nightMode);
  }, [nightMode, weather]);

  const localTime = `${String(Math.floor(dayTime)).padStart(2, "0")}:${String(Math.floor((dayTime % 1) * 60)).padStart(2, "0")}`;

  return (
    <main className={`world-shell${nightMode ? " is-night" : ""}${isExploring ? " is-exploring" : ""}${photoMode ? " is-photo" : ""}`}>
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
          <span className="status-divider" /> LOCAL TIME {localTime}
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
            <kbd>{controls.night.toUpperCase()}</kbd>
          </button>
          <button className="field-tool" type="button" onClick={cycleSeason} title="Change season">
            {season} <span aria-hidden="true">↻</span>
          </button>
          <button className="field-tool" type="button" onClick={cycleWeather} title="Change weather">
            {weather} <span aria-hidden="true">↻</span>
          </button>
          <button className="field-tool" type="button" onClick={() => setJournalOpen(true)} title="Open field journal (J)">
            Journal <kbd>J</kbd>
          </button>
          <button className="field-tool" type="button" onClick={() => setPhotoMode(true)} title="Enter photo mode (P)">
            Photo <kbd>{controls.photo.toUpperCase()}</kbd>
          </button>
          <button className="field-tool" type="button" onClick={toggleTimeCycle} title="Toggle gradual day/night cycle">
            {autoTime ? "Cycle on" : "Cycle off"}
          </button>
          <button className="field-tool" type="button" onClick={() => setSettingsOpen(true)} title="Accessibility and controls">
            Settings
          </button>
        </div>
      </header>

      {!isExploring && <section className="location-card" aria-label="Current location">
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
          <span>{temperatures[season][nightMode ? "night" : "day"]}</span>
          <span className="weather-note">
            {weather === "Rain" ? "Rain showers" : weather === "Mist" ? "Low mist" : weather === "Snow" ? "Snowfall" : nightMode ? "Moonlit sky" : "Clear skies"}
            <br />
            {weather === "Clear" ? nightMode ? "Quiet breeze" : "Soft breeze" : `${season} weather`}
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
      </section>}

      <aside className={`tree-nursery${nurseryOpen ? " is-open" : " is-collapsed"}`} aria-label="Tree planting tools">
        <div className="nursery-heading">
          <div>
            <p className="eyebrow">Restoration kit</p>
            <h2>Plant a tree</h2>
          </div>
          <div className="badge-wallet" aria-label={`${badgeCount} nature badges`}>
            <span className="badge-glyph" aria-hidden="true">✳</span>
            <strong>{String(badgeCount).padStart(2, "0")}</strong>
            <span className="badge-wallet-label">badges</span>
          </div>
          <button
            className="nursery-toggle"
            type="button"
            aria-expanded={nurseryOpen}
            aria-label={nurseryOpen ? "Collapse tree planting tools" : "Expand tree planting tools"}
            onClick={() => setNurseryOpen((open) => !open)}
          >
            <span aria-hidden="true">{nurseryOpen ? "−" : "+"}</span>
          </button>
        </div>
        {nurseryOpen && <>
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
        </>}
      </aside>

      {isExploring && <aside className="field-map" aria-label="Exploration map">
        <div className="map-heading">
          <span className="eyebrow">Field map</span>
          <span>{saveState}</span>
        </div>
        <div className="map-grid">
          {discoveries.map((id) => {
            const landmark = landmarks.find((entry) => entry.id === id);
            if (!landmark) return null;
            return (
              <span
                className="map-landmark"
                key={id}
                title={landmark.name}
                style={{
                  left: `${50 + landmark.x / 3.2}%`,
                  top: `${50 + landmark.z / 3.2}%`,
                }}
              />
            );
          })}
          <span
            className="map-player"
            style={{
              left: `${THREE.MathUtils.clamp(50 + playerMap.x / 3.2, 8, 92)}%`,
              top: `${THREE.MathUtils.clamp(50 + playerMap.z / 3.2, 8, 92)}%`,
            }}
          >
            <i style={{ transform: `rotate(${-playerMap.heading}rad)` }} />
          </span>
        </div>
        <p className="map-coordinates">X {playerMap.x} · Z {playerMap.z}</p>
        {interactionHint && <p className="interaction-hint">{interactionHint}</p>}
      </aside>}

      {notice && !photoMode && (
        <button className="world-notice" type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
          {notice}
        </button>
      )}

      {journalOpen && (
        <div className="journal-backdrop" role="presentation" onClick={() => setJournalOpen(false)}>
          <section
            className="field-journal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="journal-heading">
              <div>
                <p className="eyebrow">Field notes · {season}</p>
                <h2 id="journal-title">Fernwake journal</h2>
              </div>
              <div className="journal-actions">
                <button
                  type="button"
                  className="journal-export"
                  onClick={() => {
                    const save = localStorage.getItem(saveKey) || "{}";
                    const blob = new Blob([save], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "fernwake-progress.json";
                    link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Export save
                </button>
                <button type="button" className="nursery-toggle" aria-label="Close journal" onClick={() => setJournalOpen(false)}>×</button>
              </div>
            </div>
            <div className="restoration-meter">
              <span>Restoration</span>
              <strong>{Math.min(100, plantedTrees.length * 3 + discoveries.length * 10 + (questComplete ? 15 : 0))}%</strong>
              <div><i style={{ width: `${Math.min(100, plantedTrees.length * 3 + discoveries.length * 10 + (questComplete ? 15 : 0))}%` }} /></div>
            </div>
            <div className="journal-stats">
              <span>{badgeCount}<small>badges</small></span>
              <span>{plantedTrees.length}<small>trees planted</small></span>
              <span>{forage}<small>harvests</small></span>
              <span>{new Set(plantedTrees.map((tree) => tree.species).filter(Boolean)).size}<small>tree species</small></span>
              <span>{discoveries.length}/{landmarks.length}<small>discoveries</small></span>
              <span>{observedAnimals.length}/{wildlifeProfiles.length}<small>wildlife</small></span>
            </div>
            <h3>Discoveries</h3>
            {discoveries.length ? (
              <ul className="discovery-list">
                {discoveries.map((id) => {
                  const landmark = landmarks.find((entry) => entry.id === id);
                  return landmark ? <li key={id}><strong>{landmark.name}</strong><span>{landmark.note}</span></li> : null;
                })}
              </ul>
            ) : <p className="journal-empty">Wander beyond the village to uncover field notes and new landmarks.</p>}
            <h3>Village request</h3>
            <p className="journal-empty">{questComplete
              ? "Complete — your choices brought Fernwake back to life. The village has expanded and rewarded you with 8 badges."
              : questStage === 0
                ? "Speak with the village keeper to begin a story and choose a path."
                : questStage === 1
                  ? "Chapter 1 · Plant a grove at the forest edge."
                  : questStage === 2
                    ? questPath === "wildlife"
                      ? `Chapter 2 · Observe two species (${observedAnimals.length}/2).`
                      : `Chapter 2 · Discover two landmarks (${discoveries.length}/2).`
                    : questPath === "wildlife"
                      ? `Final chapter · Recover an ancient relic (${relics.length}/1).`
                      : `Final chapter · Gather three berry harvests (${forage}/3).`}</p>
            <p className="journal-empty village-wellbeing">Village wellbeing · {villageLevel > 0 ? "thriving · new habitat house opened" : "waiting for restoration"}</p>
            <h3>Wildlife observations</h3>
            {observedAnimals.length ? (
              <ul className="discovery-list">
                {wildlifeProfiles.filter((profile) => observedAnimals.includes(profile.id)).map((profile) => (
                  <li key={profile.id}><strong>{profile.name}</strong><span>{profile.fact}</span></li>
                ))}
              </ul>
            ) : <p className="journal-empty">Approach wildlife carefully and press {controls.interact.toUpperCase()} to observe it.</p>}
            <h3>Relics</h3>
            <p className="journal-empty">{relics.length ? relics.map((id) => relicDefinitions.find((relic) => relic.id === id)?.name).filter(Boolean).join(" · ") : "Glowing relics are hidden near the den and the old stones."}</p>
            <p className="save-caption">Progress saves automatically in this browser · {saveState}</p>
          </section>
        </div>
      )}

      {questChoiceOpen && (
        <div className="journal-backdrop quest-backdrop" role="presentation">
          <section className="field-journal quest-choice" role="dialog" aria-modal="true" aria-labelledby="quest-title">
            <p className="eyebrow">Fernwake village · Chapter 1</p>
            <h2 id="quest-title">What should we restore first?</h2>
            <p className="journal-empty">The village keeper asks you to choose a path. Both choices help Fernwake, but lead to different discoveries.</p>
            <div className="quest-paths">
              <button type="button" onClick={() => chooseQuestPath("wildlife")}>
                <strong>Protect the wildlife</strong>
                <span>Observe forest animals, then seek an old relic with the keeper.</span>
              </button>
              <button type="button" onClick={() => chooseQuestPath("habitat")}>
                <strong>Restore the habitats</strong>
                <span>Map hidden places and gather berries for the village.</span>
              </button>
            </div>
            <button className="journal-cancel" type="button" onClick={() => setQuestChoiceOpen(false)}>Not yet</button>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="journal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <section
            className="field-journal settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="journal-heading">
              <div>
                <p className="eyebrow">Comfort and access</p>
                <h2 id="settings-title">Field settings</h2>
              </div>
              <button type="button" className="nursery-toggle" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <label className="setting-slider">
              <span>Ambient volume <strong>{Math.round(audioVolume * 100)}%</strong></span>
              <input type="range" min="0" max="1" step="0.05" value={audioVolume} onChange={(event) => updateAudioVolume(event.target.value)} />
            </label>
            <label className="setting-check">
              <input type="checkbox" checked={reducedMotion} onChange={(event) => updateReducedMotion(event.target.checked)} />
              <span><strong>Reduce motion</strong><small>Soften camera, wind, weather, and animal movement.</small></span>
            </label>
            <h3>Keyboard controls</h3>
            <div className="keybind-list">
              {Object.entries({
                forward: "Walk forward",
                left: "Walk left",
                backward: "Walk backward",
                right: "Walk right",
                interact: "Interact",
                journal: "Field journal",
                night: "Day / night",
                photo: "Photo mode",
              }).map(([action, label]) => (
                <div className="keybind-row" key={action}>
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      rebindControlRef.current = action;
                      setRebindControl(action);
                    }}
                  >
                    {rebindControl === action ? "Press a key…" : controls[action].toUpperCase()}
                  </button>
                </div>
              ))}
            </div>
            <div className="save-tools">
              <button className="journal-export" type="button" onClick={() => {
                const save = localStorage.getItem(saveKey) || "{}";
                const url = URL.createObjectURL(new Blob([save], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "fernwake-progress.json";
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>Export save</button>
              <label className="journal-export import-save">
                Import save
                <input type="file" accept="application/json,.json" onChange={importSave} />
              </label>
            </div>
            <p className="save-caption">Settings save automatically in this browser · {saveState}</p>
          </section>
        </div>
      )}

      {photoMode && (
        <div className="photo-controls">
          <span>Photo mode · {season} · {weather}</span>
          <button type="button" onClick={() => downloadPhotoRef.current?.()}>Save image</button>
          <button type="button" onClick={() => setPhotoMode(false)}>Exit photo mode</button>
        </div>
      )}

      <div className="crosshair" aria-hidden="true">
        <span />
        <span />
      </div>

      <footer className="bottom-bar">
        {!isExploring && <div className="wildlife-readout badge-readout">
          <span className="wildlife-count">{String(badgeCount).padStart(2, "0")}</span>
          <span className="readout-rule" />
          <span className="wildlife-label">
            nature badges
            <br />
            {badgeCount >= 10 ? "ready to plant" : `${10 - badgeCount} to next tree`}
          </span>
        </div>}
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
            <kbd>{controls.forward.toUpperCase()}</kbd>
            <kbd>{controls.left.toUpperCase()}</kbd>
            <kbd>{controls.backward.toUpperCase()}</kbd>
            <kbd>{controls.right.toUpperCase()}</kbd> walk
          </span>
          <span>
            <kbd>SHIFT</kbd> run
          </span>
          <span><kbd>{controls.interact.toUpperCase()}</kbd> interact · <kbd>{controls.journal.toUpperCase()}</kbd> journal</span>
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
