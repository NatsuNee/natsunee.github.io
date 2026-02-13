// -----------------------------------------------------
// IMPORTS
// -----------------------------------------------------
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


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
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
keyLight.position.set(5, 5, 5);
keyLight.castShadow = true;
scene.add(keyLight);


// -----------------------------------------------------
// PLAYER COLLIDER (Capsule)
// -----------------------------------------------------
const colliders = [];
const platforms = [];
const floors = [];


const playerCollider = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1.0, 4, 8),
  new THREE.MeshBasicMaterial({ visible: false })
);
playerCollider.position.set(100, 79, 100);  //SPAWN
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
    case 'Space':
      if (canJump) {
        velocity.y = 10;
        canJump = false;
      }
      break;
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
    model.position.sub(new THREE.Vector3(0, 1, 0));
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

loadModel('/assets/HotelWalls6.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls7.glb', skyboxTexture, (model) => {
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

loadModel('/assets/HotelWalls14.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls15.glb', skyboxTexture, (model) => {
    model.position.sub(new THREE.Vector3(0, 2, 0));
    model.traverse((child) => {
        if (child.isMesh) {
            colliders.push(child);
        }
    });
    scene.add(model);
});

loadModel('/assets/HotelWalls16.glb', skyboxTexture, (model) => {
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

  // Apply vertical velocity
  playerCollider.position.y += velocity.y * delta;

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

  renderer.render(scene, camera);
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