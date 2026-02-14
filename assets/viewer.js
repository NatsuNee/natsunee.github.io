// -----------------------------------------------------
// IMPORTS
// -----------------------------------------------------
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

// -----------------------------------------------------
// BASE SETUP: Scene, Renderer, Camera
// -----------------------------------------------------
const container = document.getElementById('viewer');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

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
scene.background = skyboxTexture;


// -----------------------------------------------------
// PLAYER CONTROLS (Pointer Lock)
// -----------------------------------------------------
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Lock pointer on click
document.body.addEventListener('click', () => controls.lock());


// -----------------------------------------------------
// LIGHTING
// -----------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
const hemi = new THREE.HemisphereLight(
  0xffffff,   // sky
  0xcccccc,   // ground (slightly gray, removes magenta bias)
  0.5
);
scene.add(hemi);

THREE.MeshStandardMaterial.prototype.shadowSide = THREE.FrontSide;

// SUN LIGHT (Directional Light)
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(20, 50, 180); // high + angled like real sun
sun.castShadow = true;

// Shadow quality
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

// Shadow camera bounds (VERY important)
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;

sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;



// Slight softness
sun.shadow.radius = 0;
sun.shadow.normalBias = 0.05;


// Add to scene
scene.add(sun);

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
playerCollider.position.set(93, 79, 110);  //SPAWN
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

        if (child.material) {
            child.material.envMap = envMap;
            child.material.envMapIntensity = 1.0;
        }
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

loadModel('/assets/Chill Guy.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(-93, -77, -99));
    scene.add(model);
});

loadModel('/assets/Ground.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    
    model.traverse((child) => {
        if (child.isMesh) {
            floors.push(child); 
        }
    });

    scene.add(model);
});

loadModel('/assets/HotelFloor.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));

    model.traverse((child) => {
    if (child.isMesh) {
        floors.push(child);
        child.visible = false;
    }
    });
    
    scene.add(model);
});

loadModel('/assets/HotelWalls.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls2.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls3.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls4.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls5.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});



loadModel('/assets/HotelWalls8.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls9.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls10.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls11.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls12.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls13.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls17.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});





// -----------------------------------------------------
// MAIN GAME LOOP
// -----------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const speed = 10;

  // Save old position BEFORE movement
  const oldPos = playerCollider.position.clone();

  // Apply friction
  velocity.x -= velocity.x * 10 * delta;
  velocity.z -= velocity.z * 10 * delta;

  // Apply gravity
  velocity.y -= gravity * delta;

  // Movement direction
  direction.z = Number(move.forward) - Number(move.backward);
  direction.x = Number(move.right) - Number(move.left);
  direction.normalize();

  // Camera forward/right vectors
  const forward = new THREE.Vector3();
  controls.getDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

  // Move player collider
  playerCollider.position.addScaledVector(forward, direction.z * speed * delta);
  playerCollider.position.addScaledVector(right, direction.x * speed * delta);

  // COLLISION CHECK
  if (checkCollision()) {
      playerCollider.position.copy(oldPos); // revert movement
      velocity.y = 0; // stop falling into walls
  }

  const ray = new THREE.Raycaster(
    playerCollider.position,
    new THREE.Vector3(0, -1, 0)
);

const hits = ray.intersectObjects(floors, true);

if (hits.length > 0) {
    const y = hits[0].point.y + playerHeight;

    // If player is at or below the floor height
    if (playerCollider.position.y <= y + 0.05) {
        playerCollider.position.y = y;
        velocity.y = 0;      // <— THIS stops infinite gravity
        canJump = true;      // <— allows jumping again
    }
}

  // Sync camera to collider
  controls.getObject().position.copy(playerCollider.position);

  composer.render();
}

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