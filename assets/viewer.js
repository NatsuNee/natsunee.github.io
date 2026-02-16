// -----------------------------------------------------
// IMPORTS
// -----------------------------------------------------
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { RGBELoader } from "https://unpkg.com/three@0.164.0/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { PMREMGenerator } from 'three';

// -----------------------------------------------------
// BASE SETUP: Scene, Renderer, Camera
// -----------------------------------------------------

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const container = document.getElementById('viewer');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const cinematicCamera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
cinematicCamera.position.set(120, 120, 120);
cinematicCamera.lookAt(93, 79, 110); // your spawn area

let gameState = "cinematic"; 
// other state: "firstPerson, cinematic"

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);


// -----------------------------------------------------
// SKYBOX
// -----------------------------------------------------
const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('/assets/skybox/');
const skyboxTexture = cubeLoader.load([
  'px.png','nx.png','py.png','ny.png','pz.png','nz.png'
]);


let envMap;

const pmrem = new THREE.PMREMGenerator(renderer);

new EXRLoader().load('assets/skybox/107_hdrmaps_com_free_1K.exr?v=2', (exrTexture) => {
    exrTexture.mapping = THREE.EquirectangularReflectionMapping;

    envMap = pmrem.fromEquirectangular(exrTexture).texture;

    scene.environment = envMap;
    scene.background = envMap;

    exrTexture.dispose();
    pmrem.dispose();
});

// -----------------------------------------------------
// PLAYER CONTROLS (Pointer Lock)
// -----------------------------------------------------
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Lock pointer on click
// document.body.addEventListener('click', () => controls.lock());

const playButton = document.getElementById("playButton");
let hasStarted = false;

playButton.addEventListener("click", () => {
    const fade = document.getElementById("fade");

    if (!hasStarted) {
        hasStarted = true;

        fade.style.opacity = 1;

        setTimeout(() => {
            gameState = "firstPerson";

            camera.position.copy(playerCollider.position);
            controls.lock();

            fade.style.opacity = 0;
        }, 1500);

        return;
    }

    // After first time: no fade, just lock instantly
    gameState = "firstPerson";
    camera.position.copy(playerCollider.position);
    controls.lock();
});


// -----------------------------------------------------
// CINEMATIC SHOTS (Predefined Camera Paths)
// -----------------------------------------------------
const cinematicShots = [
  {
    pos: new THREE.Vector3(-5, 0, -50),
    rot: new THREE.Euler(0, 3.4, 0),
    duration: 100,
    transition: 2000,
    fade: false,
    fadeStart: 0 // no fade
  },
  {
    pos: new THREE.Vector3(-10, 60, 200),
    rot: new THREE.Euler(0, 5, 0),
    duration: 1000,
    transition: 40000,
    fade: true,
    fadeStart: 1500 // start fading 1.5s BEFORE the shot ends
  },
  {
    pos: new THREE.Vector3(20, 130, 110),
    rot: new THREE.Euler(0, 5.1, 0),
    duration: 100,
    transition: 2000,
    fade: false,
    fadeStart: 0 // no fade
  },
  {
    pos: new THREE.Vector3(20, 20, 110),
    rot: new THREE.Euler(0, 5, 0),
    duration: 1000,
    transition: 40000,
    fade: true,
    fadeStart: 1500 // start fading 1.5s BEFORE the shot ends
  },
  {
    pos: new THREE.Vector3(98, 60, 110),
    rot: new THREE.Euler(0, 1, 0),
    duration: 100,
    transition: 2000,
    fade: false,
    fadeStart: 0 // no fade
  },
  {
    pos: new THREE.Vector3(0, 20, 0),
    rot: new THREE.Euler(1, 0.8, 0),
    duration: 1000,
    transition: 40000,
    fade: true,
    fadeStart: 1500 // start fading 1.5s BEFORE the shot ends
  }
];


let currentShot = 0;
let shotStartTime = performance.now();
let transitioning = false;

window.addEventListener("load", () => {
    document.getElementById("fade").style.opacity = 0;
});


function updateCinematic() {
    const now = performance.now();
    const shot = cinematicShots[currentShot];
    const elapsed = now - shotStartTime;

    // -----------------------------------------
    // TRANSITIONING BETWEEN SHOTS
    // -----------------------------------------
    if (transitioning) {
        const nextIndex = (currentShot + 1) % cinematicShots.length;
        const nextShot = cinematicShots[nextIndex];

        const t = Math.min(elapsed / nextShot.transition, 1);

        // Smooth position interpolation
        cinematicCamera.position.lerpVectors(shot.pos, nextShot.pos, t);

        // Smooth rotation interpolation
        cinematicCamera.rotation.set(
            THREE.MathUtils.lerp(shot.rot.x, nextShot.rot.x, t),
            THREE.MathUtils.lerp(shot.rot.y, nextShot.rot.y, t),
            THREE.MathUtils.lerp(shot.rot.z, nextShot.rot.z, t)
        );

        // Transition finished
        if (t >= 1) {
            currentShot = nextIndex;
            shotStartTime = now;
            transitioning = false;

            // Reset fade trigger for the new shot
            cinematicShots[currentShot]._fadeTriggered = false;

            // Fade back in AFTER transition is complete
            fade.style.opacity = 0;
        }

        return;
    }

    // -----------------------------------------
    // HOLD CURRENT SHOT
    // -----------------------------------------
    cinematicCamera.position.copy(shot.pos);
    cinematicCamera.rotation.copy(shot.rot);

    // -----------------------------------------
    // EARLY FADE START (BEFORE shot ends)
    // -----------------------------------------
    if (shot.fade && !shot._fadeTriggered && elapsed >= (shot.duration - shot.fadeStart)) {

        shot._fadeTriggered = true;

        fade.style.opacity = 1; // fade to black

        // AFTER fade completes, start transition
        setTimeout(() => {
            transitioning = true;
            shotStartTime = performance.now();
            // DO NOT teleport camera — lerp will handle it
        }, 2500); // match CSS fade duration

        return;
    }

    // -----------------------------------------
    // NORMAL TRANSITION (no fade)
    // -----------------------------------------
    if (!shot.fade && elapsed >= shot.duration) {
        transitioning = true;
        shotStartTime = now;
        return;
    }
}

// -----------------------------------------------------
// LIGHTING
// -----------------------------------------------------
THREE.MeshStandardMaterial.prototype.shadowSide = THREE.FrontSide;

// SUN LIGHT (Directional Light)
const sun = new THREE.DirectionalLight(0xe0f0ff, 0.4);
sun.position.set(100, 50, 180); // high + angled like real sun
sun.castShadow = true;

// Shadow quality
sun.shadow.mapSize.width = 4048;
sun.shadow.mapSize.height = 4048;

// Shadow camera bounds (VERY important)
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;

sun.shadow.camera.left = -100;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -100;



// Slight softness
sun.shadow.radius = 0;
sun.shadow.normalBias = 0.05;


// Add to scene
scene.add(sun);

const fill = new THREE.PointLight(0xffaa88, 0.05, 200);
fill.position.set(0, 10, 0);
scene.add(fill);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.45; // lower = darker, more dramatic

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));


const ssaoPass = new SSAOPass(
    scene,
    camera,
    window.innerWidth,
    window.innerHeight
);

ssaoPass.originalColorSpace = THREE.SRGBColorSpace; // ⭐ FIXES PINK TINT

ssaoPass.enabled = false;
ssaoPass.kernelRadius = 0.3;
ssaoPass.minDistance = 0.0001;
ssaoPass.maxDistance = 0.03;
ssaoPass.aoClamp = 10;
ssaoPass.lumInfluence = 0;
ssaoPass.onlyAO = false;
ssaoPass.output = SSAOPass.OUTPUT.Default;

composer.addPass(ssaoPass);

const spot = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot.position.set(105, 80, 110);

// Aim straight at the ground
spot.target.position.set(105, 76, 110);

spot.castShadow = true;
spot.shadow.mapSize.width = 2048;
spot.shadow.mapSize.height = 2048;

scene.add(spot);
scene.add(spot.target);

const spot2 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot2.position.set(103, 80, 93);

// Aim straight at the ground
spot2.target.position.set(103, 76, 93);

spot2.castShadow = true;
spot2.shadow.mapSize.width = 2048;
spot2.shadow.mapSize.height = 2048;

scene.add(spot2);
scene.add(spot2.target);

const spot3 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot3.position.set(90, 80, 92);

// Aim straight at the ground
spot3.target.position.set(90, 76, 92);

spot3.castShadow = true;
spot3.shadow.mapSize.width = 2048;
spot3.shadow.mapSize.height = 2048;

scene.add(spot3);
scene.add(spot3.target);


const spot4 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot4.position.set(117, 80, 110);

// Aim straight at the ground
spot4.target.position.set(118, 76, 110);

spot4.castShadow = true;
spot4.shadow.mapSize.width = 2048;
spot4.shadow.mapSize.height = 2048;

scene.add(spot4);
scene.add(spot4.target);

const spot5 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot5.position.set(117, 80, 110);

// Aim straight at the ground
spot5.target.position.set(117, 76, 100);

spot5.castShadow = true;
spot5.shadow.mapSize.width = 2048;
spot5.shadow.mapSize.height = 2048;

scene.add(spot5);
scene.add(spot5.target);

const spot6 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot6.position.set(118, 80, 91);

// Aim straight at the ground
spot6.target.position.set(118, 76, 91);

spot6.castShadow = true;
spot6.shadow.mapSize.width = 2048;
spot6.shadow.mapSize.height = 2048;

scene.add(spot6);
scene.add(spot6.target);



const spot7 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot7.position.set(118, 80, 91);

// Aim straight at the ground
spot7.target.position.set(118, 76, 91);

spot7.castShadow = true;
spot7.shadow.mapSize.width = 2048;
spot7.shadow.mapSize.height = 2048;

scene.add(spot7);
scene.add(spot7.target);

const spot8 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot8.position.set(132, 80, 109);

// Aim straight at the ground
spot8.target.position.set(132, 76, 109);

spot8.castShadow = true;
spot8.shadow.mapSize.width = 2048;
spot8.shadow.mapSize.height = 2048;

scene.add(spot8);
scene.add(spot8.target);

const spot9 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot9.position.set(137, 80, 116);

// Aim straight at the ground
spot9.target.position.set(137, 76, 116);

spot9.castShadow = true;
spot9.shadow.mapSize.width = 2048;
spot9.shadow.mapSize.height = 2048;

scene.add(spot9);
scene.add(spot9.target);

const spot10 = new THREE.SpotLight(
    0xffffff,   // color
    1,        // intensity (bright enough to fill a room)
    13,        // distance (how far the light reaches)
    Math.PI / 0.2, // angle (wide cone)
    0.3,        // penumbra (soft edges)
    1.0         // decay (realistic falloff)
);

// Position the light on the ceiling
spot10.position.set(135, 80, 98);

// Aim straight at the ground
spot10.target.position.set(135, 76, 98);

spot10.castShadow = true;
spot10.shadow.mapSize.width = 2048;
spot10.shadow.mapSize.height = 2048;

scene.add(spot10);
scene.add(spot10.target);



// -----------------------------------------------------
// PLAYER COLLIDER (Capsule)
// -----------------------------------------------------
const colliders = [];
const platforms = [];
const floors = [];


const playerCollider = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.2, 1.0, 4, 8),
  new THREE.MeshBasicMaterial({ visible: false })
);
playerCollider.position.set(93, 79, 110); //SPAWN
controls.getObject().rotation.y = 90;
scene.add(playerCollider);

function checkCollision() {
    const playerBox = new THREE.Box3().setFromObject(playerCollider);

    for (const c of colliders) {
        const box = new THREE.Box3().setFromObject(c);
        if (playerBox.intersectsBox(box)) {
            return true;
        }
    }
    return false;
}

// -----------------------------------------------------
// SNOW PARTICLES
// -----------------------------------------------------
const snowCount = 500;
const snowGeometry = new THREE.BufferGeometry();

const positions = new Float32Array(snowCount * 3);
const velocities = new Float32Array(snowCount);

const buildingMin = new THREE.Vector3(81.3093, 0, 85.0997);
const buildingMax = new THREE.Vector3(140.5057, 100, 118.7813);


function randomSnowPosition() {
    let x, y, z;

    while (true) {
        x = (Math.random() - 0.5) * 300;
        y = Math.random() * 250 + 10;
        z = (Math.random() - 0.5) * 300 + 50;

        // reject positions inside the building
        if (
            x < buildingMin.x || x > buildingMax.x ||
            z < buildingMin.z || z > buildingMax.z
        ) {
            return { x, y, z };
        }
    }
}

const fogColor = new THREE.Color(0xdedede);
scene.fog = new THREE.FogExp2(fogColor, 0.005);
renderer.setClearColor(fogColor);

// INITIALIZE SNOW ONCE
for (let i = 0; i < snowCount; i++) {
    const p = randomSnowPosition();
    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    velocities[i] = 0.001 + Math.random() * 0.3;
}

snowGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
snowGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));

const snowMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
});

const snow = new THREE.Points(snowGeometry, snowMaterial);
scene.add(snow);

// -----------------------------------------------------
// MOVEMENT STATE + PHYSICS
// -----------------------------------------------------
const move = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();

const gravity = 0;
const playerHeight = 2.8;
let canJump = false;

// -----------------------------------------------------
// INPUT HANDLING (Keyboard)
// -----------------------------------------------------
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.left = true; break;
    case 'KeyD': move.right = true; break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left = false; break;
    case 'KeyD': move.right = false; break;
  }
});


// -----------------------------------------------------
// MOUSE SMOOTHING + CLAMPING (Universal Safe Method)
// -----------------------------------------------------
let rawDX = 0, rawDY = 0;
let smoothDX = 0, smoothDY = 0;

const MAX_DELTA = 50;   // Prevent insane flicks
const SMOOTHING = 0.4;  // Lower = smoother

// Capture raw deltas
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== document.body) return;

  rawDX = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, event.movementX));
  rawDY = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, event.movementY));
}, true);

// Override movementX/Y with smoothed values
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== document.body) return;

  smoothDX += (rawDX - smoothDX) * SMOOTHING;
  smoothDY += (rawDY - smoothDY) * SMOOTHING;

  Object.defineProperty(event, 'movementX', { value: smoothDX });
  Object.defineProperty(event, 'movementY', { value: smoothDY });

  rawDX = 0;
  rawDY = 0;
}, true);


// -----------------------------------------------------
// LOAD 3D OBJECTS (GLB Models)
// -----------------------------------------------------
const loader = new GLTFLoader();

function prepareModel(model, envMap) {
    model.traverse((child) => {
        if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // if (child.material) {
        //     child.material.envMap = envMap;
        //     child.material.envMapIntensity = 1.0;
        // }
    }
  });
}

function loadModel(path, envMap, onLoad) {
    loader.load(path, (gltf) => {
        const model = gltf.scene;
        prepareModel(model, envMap);
        onLoad(model);
  });
}

loadModel('/assets/ChillGuy.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(-85.5, -77, -94));
    model.rotation.y = -64;
    
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
            child.material.envMap = envMap;
            child.material.envMapIntensity = 1.0;
        }
    });

    scene.add(model);
});

loadModel('/assets/Ground.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
            floors.push(child); 
        }
    });

    scene.add(model);
});

loadModel('/assets/Buildings.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
        }
    });

    scene.add(model);
});

loadModel('/assets/HotelBase.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
            floors.push(child); 
        }
    });

    scene.add(model);
});

loadModel('/assets/HotelFloor.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
            floors.push(child); 
        }
    });

    scene.add(model);
});

loadModel('/assets/Decor.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
        }
    });

    scene.add(model);
});

loadModel('/assets/WallDecor.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
        }
    });

    scene.add(model);
});

loadModel('/assets/Hotel.001.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.001.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.003.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.004.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

// Replace all repeated loadModel('/assets/HotelWalls.007.glb', ...) calls with incrementing numbers
for (let i = 7; i <= 126; i++) {
    const num = i.toString().padStart(3, '0');
    loadModel(`/assets/HotelWalls.${num}.glb`, envMap, (model) => {
        model.position.sub(new THREE.Vector3(0, 2, 0));
        model.traverse((child) => {
            if (child.isMesh) {
                colliders.push(child);
            }
        });
        scene.add(model);
    });
}

loadModel('/assets/HotelWalls.128.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.145.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.146.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls.147.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/Cube.004.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            child.visible = false; 
            colliders.push(child);
        }
    });
    scene.add(model);
});

for (let i = 12; i <= 15; i++) {
    const num = i.toString().padStart(3, '0');
    const path = `/assets/Cube.${num}.glb`;

    loadModel(path, envMap, (model) => {
        if (!model) {
            console.warn(`Skipping missing: Cube.${num}.glb`);
            return;
        }

        model.position.sub(new THREE.Vector3(0, 2, 0));

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = false;   // ← makes the collider invisible
                colliders.push(child);
            }
        });

        scene.add(model);
    });
}

loadModel('/assets/Cube.017.glb', envMap, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            child.visible = false; 
            colliders.push(child);
        }
    });
    scene.add(model);
});

for (let i = 19; i <= 22; i++) {
    const num = i.toString().padStart(3, '0');
    const path = `/assets/Cube.${num}.glb`;

    loadModel(path, envMap, (model) => {
        if (!model) {
            console.warn(`Skipping missing: Cube.${num}.glb`);
            return;
        }

        model.position.sub(new THREE.Vector3(0, 2, 0));

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = false;   // ← makes the collider invisible
                colliders.push(child);
            }
        });

        scene.add(model);
    });
}

for (let i = 24; i <= 26; i++) {
    const num = i.toString().padStart(3, '0');
    const path = `/assets/Cube.${num}.glb`;

    loadModel(path, envMap, (model) => {
        if (!model) {
            console.warn(`Skipping missing: Cube.${num}.glb`);
            return;
        }

        model.position.sub(new THREE.Vector3(0, 2, 0));

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = false;   // ← makes the collider invisible
                colliders.push(child);
            }
        });

        scene.add(model);
    });
}

for (let i = 29; i <= 33; i++) {
    const num = i.toString().padStart(3, '0');
    const path = `/assets/Cube.${num}.glb`;

    loadModel(path, envMap, (model) => {
        if (!model) {
            console.warn(`Skipping missing: Cube.${num}.glb`);
            return;
        }

        model.position.sub(new THREE.Vector3(0, 2, 0));

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = false;   // ← makes the collider invisible
                colliders.push(child);
            }
        });

        scene.add(model);
    });
}

for (let i = 35; i <= 91; i++) {
    const num = i.toString().padStart(3, '0');
    const path = `/assets/Cube.${num}.glb`;

    loadModel(path, envMap, (model) => {
        if (!model) {
            console.warn(`Skipping missing: Cube.${num}.glb`);
            return;
        }

        model.position.sub(new THREE.Vector3(0, 2, 0));

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = false;   // ← makes the collider invisible
                colliders.push(child);
            }
        });

        scene.add(model);
    });
}


// loadModel('/assets/Everything.glb', skyboxTexture, (model) => {
//     model.position.sub(new THREE.Vector3(0, 2, 0));
//     model.traverse((child) => {
//         if (child.isMesh) {
//             floors.push(child);
//         }
//     });
//     scene.add(model);
// });

// -----------------------------------------------------
// MAIN GAME LOOP
// -----------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    if (gameState === "cinematic") {
        updateCinematic();
        renderer.render(scene, cinematicCamera);
        return;
    }

    // -------------------------
    // PC NORMAL FPS CONTROLS
    // -------------------------
    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.normalize();

    const forward = new THREE.Vector3();
    controls.getDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    playerCollider.position.addScaledVector(forward, direction.z * speed * delta);
    playerCollider.position.addScaledVector(right, direction.x * speed * delta);
}

    if (checkCollision()) {
        playerCollider.position.copy(oldPos);
        velocity.y = 0;
    }

    const ray = new THREE.Raycaster(
        playerCollider.position,
        new THREE.Vector3(0, -1, 0)
    );

    const hits = ray.intersectObjects(floors, true);

    if (hits.length > 0) {
        const y = hits[0].point.y + playerHeight;
        if (playerCollider.position.y <= y + 0.05) {
            playerCollider.position.y = y;
            velocity.y = 0;
            canJump = true;
        }
    }

    const pos = snowGeometry.attributes.position;
    const vel = snowGeometry.attributes.velocity;

    for (let i = 0; i < snowCount; i++) {
        pos.array[i * 3 + 1] -= vel.array[i];

        if (pos.array[i * 3 + 1] < 0) {
            const p = randomSnowPosition();
            pos.array[i * 3 + 0] = p.x;
            pos.array[i * 3 + 1] = p.y;
            pos.array[i * 3 + 2] = p.z;
        }
    }

    console.log(playerCollider.position);

    pos.needsUpdate = true;

    controls.getObject().position.copy(playerCollider.position);

    composer.render();

// -----------------------------------------------------
// RESIZE HANDLING
// -----------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// -----------------------------------------------------
// START LOOP
// -----------------------------------------------------
animate();