// Three.js 3D Renderer for iPhone mockups

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let phoneModel = null;
let phonePivot = null;  // Pivot group for rotation around screen center
let screenMesh = null;
let customScreenPlane = null;
let orbitControls = null;
let isThreeJSInitialized = false;
let phoneModelLoaded = false;
let phoneModelLoading = false;

// Screen texture for the screenshot
let screenTexture = null;

// Store original model scale
let baseModelScale = 1;

// Store base position offset to keep model centered after screen alignment
let basePositionOffset = { x: 0, y: 0, z: 0 };

// Current device model type
let currentDeviceModel = 'iphone';

// Cache for loaded phone models (for rendering different devices in side previews)
let phoneModelCache = {};  // { deviceType: { model, pivot, screenPlane, baseScale, loaded } }

// Device-specific configurations
const deviceConfigs = {
    iphone: {
        modelPath: 'models/iphone-15-pro-max.glb',
        aspectRatio: 1290 / 2796,
        screenHeightFactor: 0.826,
        screenOffset: { x: 0.027, y: 0.745, z: 0.098 },
        cornerRadiusFactor: 0.16,
        modelRotation: { x: 0, y: 0, z: 0 },  // No correction needed
        camera: { distance: 6, fov: 35 },
        type: 'phone',
        label: 'iPhone'
    },
    samsung: {
        modelPath: 'models/samsung-galaxy-s25-ultra.glb',
        aspectRatio: 1440 / 3120,
        screenHeightFactor: 0.66,
        screenOffset: { x: 0, y: 0.0, z: 0.08},  // Will need adjustment
        cornerRadiusFactor: 0.04,
        modelRotation: { x: 0, y: 0, z: 0 },  // Adjust to correct model tilt (in degrees)
        camera: { distance: 6, fov: 35 },
        type: 'phone',
        label: 'Samsung Galaxy'
    },
    ipad: {
        modelPath: 'models/apple_ipad_pro.glb',
        // Everything below is a first-pass guess pending visual calibration in-browser
        // 0.82 (down from an initial 0.85 guess) - measured empirically to sit as close to the
        // bezel edge as possible at rest without overflowing, and confirmed to still stay fully
        // contained at extreme rotation angles (pixel-level overflow measurement, not eyeballing).
        // The Screen Scale slider lets the user push it further if they want an edge-to-edge
        // look and are willing to accept the small overflow risk that comes with extreme
        // rotation + max scale together.
        screenHeightFactor: 0.82,
        screenOffset: { x: 0, y: 0, z: 0.05 },  // Will need adjustment
        aspectRatio: 2064 / 2752,  // iPad Pro portrait screen resolution
        cornerRadiusFactor: 0.06,
        modelRotation: { x: 0, y: 0, z: 0 },  // Adjust to correct model tilt (in degrees)
        camera: { distance: 7.5, fov: 35 },  // Pulled back further than phones to fit a larger device
        // This model's own "screen" mesh renders on top of our screenshot overlay regardless
        // of depth/side settings (likely a shader/material forcing it to always draw on top) -
        // hiding it lets our overlay show through cleanly. Confirmed by name via mesh listing.
        hideMeshNames: ['iPad_Pro_2020_screen_0'],
        type: 'tablet',
        label: 'iPad Pro'
    },
    galaxy_tab: {
        modelPath: 'models/samsung_tab_a8.glb',
        // This model's thin/depth axis is native X (not Z like the phone models) - its screen
        // mesh (Cube001_Material004_0, the only textured mesh, confirming it's the baked
        // lock-screen wallpaper) measures local center [0.033, 0.973, 0.060], face spanning
        // Y/Z. modelRotation reorients the body so that native X (screen-facing) maps to
        // world Z (camera-facing) - first-pass guess, needs visual confirmation like the rest.
        aspectRatio: 1.707 / 2.739,  // screen mesh's own Y/Z face dimensions
        // 0.80 (down from an initial 0.85 guess) - measured empirically to sit as close to the
        // bezel edge as possible at rest without overflowing, and confirmed to still stay fully
        // contained at extreme rotation angles (pixel-level overflow measurement, not eyeballing).
        screenHeightFactor: 0.80,
        screenOffset: { x: 0.033, y: 0.973, z: 0.060 },
        cornerRadiusFactor: 0.06,
        modelRotation: { x: -90, y: 0, z: -90 },  // rotates native X (screen-facing) to face camera, right-side up
        camera: { distance: 7.5, fov: 35 },  // Pulled back further than phones to fit a larger device
        // Same "screen mesh always renders on top" issue as the iPad model - hiding it lets
        // our screenshot overlay show through.
        hideMeshNames: ['Cube001_Material004_0'],
        type: 'tablet',
        label: 'Galaxy Tab A8'
    }
};

// Frame color presets per device (real device colors)
// Using var so it's accessible from app.js
var frameColorPresets = {
    iphone: [
        { id: 'natural', label: 'Natural Titanium', swatch: '#9d927f',
          materials: { backpanel: '#9d927f', metalframe: '#5f5950', gray: '#221f1b' } },
        { id: 'blue', label: 'Blue Titanium', swatch: '#3d4d5c',
          materials: { backpanel: '#394d5f', metalframe: '#3a4553', gray: '#1a1f24' } },
        { id: 'white', label: 'White Titanium', swatch: '#e3ddd4',
          materials: { backpanel: '#e3ddd4', metalframe: '#c4bdb4', gray: '#2a2825' } },
        { id: 'black', label: 'Black Titanium', swatch: '#3a3632',
          materials: { backpanel: '#3a3632', metalframe: '#2a2725', gray: '#1a1918' } },
        { id: 'desert', label: 'Desert Titanium', swatch: '#c4a882',
          materials: { backpanel: '#c4a882', metalframe: '#8a7560', gray: '#2a2218' } },
        { id: 'deep-purple', label: 'Deep Purple', swatch: '#5b4a6e',
          materials: { backpanel: '#5b4a6e', metalframe: '#3d3348', gray: '#1e1825' } },
        { id: 'gold', label: 'Gold', swatch: '#e3c8a0',
          materials: { backpanel: '#e3c8a0', metalframe: '#c9a96e', gray: '#2a2418' } },
        { id: 'red', label: 'Product Red', swatch: '#c1272d',
          materials: { backpanel: '#c1272d', metalframe: '#8a1c20', gray: '#1a0a0a' } },
    ],
    samsung: [
        { id: 'gray', label: 'Titanium Gray', swatch: '#8a8a8a',
          materials: { back_glass: '#4c4c4c', frame: '#cdcdcd', antenna: '#707070' } },
        { id: 'black', label: 'Titanium Black', swatch: '#2a2a2a',
          materials: { back_glass: '#1a1a1a', frame: '#3a3a3a', antenna: '#2a2a2a' } },
        { id: 'silverblue', label: 'Titanium Silverblue', swatch: '#a8b8c8',
          materials: { back_glass: '#8a9eb0', frame: '#b8c8d4', antenna: '#7a8ea0' } },
        { id: 'whitesilver', label: 'Titanium Whitesilver', swatch: '#e8e4df',
          materials: { back_glass: '#d8d4cf', frame: '#e8e4df', antenna: '#c0bcb7' } },
        { id: 'pinkgold', label: 'Titanium Pinkgold', swatch: '#d4a89a',
          materials: { back_glass: '#c89888', frame: '#d4b0a0', antenna: '#b08878' } },
        { id: 'jadegreen', label: 'Titanium Jadegreen', swatch: '#9aaa9c',
          materials: { back_glass: '#7a9a7c', frame: '#a8b8aa', antenna: '#6a8a6c' } },
        { id: 'jetblack', label: 'Titanium Jetblack', swatch: '#404040',
          materials: { back_glass: '#2a2a2a', frame: '#484848', antenna: '#353535' } },
    ]
};

// Store original material colors for the current model
let originalMaterialColors = {};

// Apply a frame color preset to the phone model
function setPhoneFrameColor(presetId, deviceType) {
    if (!phoneModel) return;

    deviceType = deviceType || currentDeviceModel;
    const presets = frameColorPresets[deviceType];
    if (!presets) return;

    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    phoneModel.traverse((child) => {
        if (child.isMesh && child.material) {
            const matName = (child.material.name || '').toLowerCase();
            if (preset.materials[matName]) {
                child.material.color.set(preset.materials[matName]);
            }
        }
    });

    requestThreeJSRender();
}

// Apply frame color to a cached model (for side previews)
function setCachedModelFrameColor(presetId, deviceType) {
    const cached = phoneModelCache[deviceType];
    if (!cached?.loaded) return;

    const presets = frameColorPresets[deviceType];
    if (!presets) return;

    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    cached.model.traverse((child) => {
        if (child.isMesh && child.material) {
            const matName = (child.material.name || '').toLowerCase();
            if (preset.materials[matName]) {
                child.material.color.set(preset.materials[matName]);
            }
        }
    });
}

// Initialize Three.js scene
function initThreeJS() {
    if (isThreeJSInitialized) return;

    const container = document.getElementById('threejs-container');
    if (!container) return;

    // Create scene with a gradient background color (we'll update this dynamically)
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x667eea); // Default gradient start color

    // Create camera
    const aspect = 400 / 700;
    threeCamera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    threeCamera.position.set(0, 0, 6);

    // Create renderer - disable antialiasing for faster interactive performance
    // Quality rendering is done at export time with higher resolution
    threeRenderer = new THREE.WebGLRenderer({
        antialias: false,  // Disable for better performance
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });
    threeRenderer.setSize(400, 700);
    // Use device pixel ratio of 1 for fastest interactive rendering
    threeRenderer.setPixelRatio(1);
    threeRenderer.outputEncoding = THREE.sRGBEncoding;
    threeRenderer.toneMapping = THREE.NoToneMapping;
    // Disable automatic clearing - we control this manually
    threeRenderer.autoClear = false;

    container.appendChild(threeRenderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    threeScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(2, 3, 4);
    threeScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 1, 2);
    threeScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -2, -3);
    threeScene.add(rimLight);

    // Add orbit controls (disabled - we use custom drag handling for better performance)
    // orbitControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
    // orbitControls.enableDamping = true;
    // orbitControls.dampingFactor = 0.05;
    // orbitControls.enableZoom = false;
    // orbitControls.enablePan = false;
    // orbitControls.rotateSpeed = 0.5;
    // orbitControls.minPolarAngle = Math.PI / 4;
    // orbitControls.maxPolarAngle = Math.PI * 3 / 4;
    // orbitControls.minAzimuthAngle = -Math.PI / 3;
    // orbitControls.maxAzimuthAngle = Math.PI / 3;

    isThreeJSInitialized = true;

    // Load the phone model - check state for which device to use
    let deviceToLoad = 'iphone';
    if (typeof state !== 'undefined' && typeof getScreenshotSettings === 'function') {
        const ss = getScreenshotSettings();
        if (ss?.device3D) {
            deviceToLoad = ss.device3D;
        }
    }
    currentDeviceModel = deviceToLoad;
    applyCameraForDevice(currentDeviceModel);
    loadPhoneModel();

    // Start animation loop
    animateThreeJS();
}

// Compute the screen plane's local position: the device's base screenOffset plus a small
// user-tunable nudge (screenAdjust, from the position fine-tune sliders), expressed as a
// fraction of the plane's own local size so the nudge scales sensibly across devices.
function computeScreenPlaneOffset(config, planeWidth, planeHeight, screenAdjust) {
    const adjust = screenAdjust || { x: 0, y: 0 };
    // Damping factor kept small (not a bigger "reposition" range) so that even at the slider's
    // extremes, the nudge stays within the safety margin already built into each device's
    // screenHeightFactor - the whole point of this control is a small fine-tune, not something
    // that can push the screenshot back out past the bezel.
    const nudgeX = (adjust.x / 100) * planeWidth * 0.08;
    const nudgeY = (adjust.y / 100) * planeHeight * 0.08;
    return {
        x: config.screenOffset.x + nudgeX,
        y: config.screenOffset.y + nudgeY,
        z: config.screenOffset.z
    };
}

// Live-update the screen plane's fine-tune position nudge (from the position sliders) without a
// full model reload - mirrors setThreeJSRotation()'s pattern for the rotation sliders.
function applyScreenAdjustOffset(offsetX, offsetY) {
    if (!customScreenPlane || !currentDeviceModel) return;
    const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;
    const planeHeight = (4.3 * config.screenHeightFactor) / baseModelScale;
    const planeWidth = planeHeight * config.aspectRatio;
    const pos = computeScreenPlaneOffset(config, planeWidth, planeHeight, { x: offsetX, y: offsetY });
    customScreenPlane.position.set(pos.x, pos.y, pos.z);
    requestThreeJSRender();
}

// Live-update the screen plane's fine-tune scale (from the Screen Scale slider) without a full
// model reload - mirrors setThreeJSRotation()'s pattern for the rotation sliders. Scaling the
// mesh itself (rather than recreating the geometry) keeps this cheap and always scales from the
// plane's own center, which is the intuitive behavior for a "make the screenshot bigger/smaller"
// control.
function applyScreenScale(scalePercent) {
    if (!customScreenPlane) return;
    customScreenPlane.scale.setScalar((scalePercent || 100) / 100);
    requestThreeJSRender();
}

// Apply the true inverse of a device's modelRotation to an object (the screen plane), so it
// cancels out the pivot's rotation and always ends up facing forward.
//
// Naively negating each Euler component (old approach: rotation.set(-rx, -ry, -rz)) only
// produces the correct inverse when modelRotation has a single non-zero axis - for a compound
// rotation (multiple non-zero axes, needed by models whose native axis layout doesn't already
// match the phone convention), negating each component independently is NOT the mathematical
// inverse, since Euler angle composition doesn't commute - it leaves a residual rotation that
// can point the plane's texture-bearing face away from the camera (rendering as backface-culled/
// invisible) even though position/sizing are all correct. Quaternion inversion is correct
// regardless of how many axes are involved.
function applyInverseModelRotation(object, modelRot) {
    const euler = new THREE.Euler(
        modelRot.x * Math.PI / 180,
        modelRot.y * Math.PI / 180,
        modelRot.z * Math.PI / 180,
        'XYZ'
    );
    const quat = new THREE.Quaternion().setFromEuler(euler).invert();
    object.quaternion.copy(quat);
}

// Hide any meshes a device config flags as needing to be hidden - e.g. a model's own baked
// "screen" mesh that would otherwise render on top of our synthetic screenshot overlay
function hideConfiguredMeshes(model, config) {
    const namesToHide = config.hideMeshNames || [];
    if (!namesToHide.length) return;
    model.traverse((child) => {
        if (child.isMesh && namesToHide.includes(child.name)) {
            child.visible = false;
        }
    });
}

// Apply a device's baseline camera distance/FOV (tablets need a wider/further framing than phones)
function applyCameraForDevice(deviceType) {
    if (!threeCamera) return;
    const config = deviceConfigs[deviceType] || deviceConfigs.iphone;
    const cam = config.camera || { distance: 6, fov: 35 };
    threeCamera.position.z = cam.distance;
    threeCamera.fov = cam.fov;
    threeCamera.updateProjectionMatrix();
}

// Load the phone 3D model based on currentDeviceModel
function loadPhoneModel() {
    if (phoneModelLoading) return; // Prevent double loading
    phoneModelLoading = true;

    const deviceType = currentDeviceModel;
    const config = deviceConfigs[deviceType] || deviceConfigs.iphone;
    const loader = new THREE.GLTFLoader();

    loader.load(
        config.modelPath,
        (gltf) => {
            phoneModelLoading = false;

            // See the matching guard/comment in switchPhoneModel() - discard this result if a
            // switch to a different device happened while this load was in flight.
            if (currentDeviceModel !== deviceType) {
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        child.material?.dispose();
                    }
                });
                return;
            }

            phoneModel = gltf.scene;

            // Center and scale the model
            const box = new THREE.Box3().setFromObject(phoneModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Center the model
            phoneModel.position.sub(center);

            // Scale to fit view (3.75 = 2.5 * 1.5 to match 2D scale at 100%)
            const maxDim = Math.max(size.x, size.y, size.z);
            baseModelScale = 3.75 / maxDim;
            phoneModel.scale.setScalar(baseModelScale);

            // Log all meshes to help identify the screen
            console.log('Phone model meshes:');
            let blackMeshes = [];
            phoneModel.traverse((child) => {
                if (child.isMesh) {
                    console.log('  Mesh:', child.name, '| Material:', child.material?.name);

                    // Look for screen mesh - in this model it's likely "black" material
                    const name = (child.name || '').toLowerCase();
                    const matName = (child.material?.name || '').toLowerCase();

                    if (matName === 'black') {
                        blackMeshes.push(child);
                    }

                    if (name.includes('screen') || name.includes('display') ||
                        matName.includes('screen') || matName.includes('display') ||
                        matName.includes('emission') || matName.includes('emissive')) {
                        screenMesh = child;
                        console.log('  -> Identified as screen mesh');
                    }
                }
            });

            // Find the front glass - that's where the screen actually is
            // Don't use black meshes, those are small elements like notch/dynamic island
            let glassMeshes = [];
            phoneModel.traverse((child) => {
                if (child.isMesh) {
                    const matName = (child.material?.name || '').toLowerCase();
                    if (matName === 'glass') {
                        child.geometry.computeBoundingBox();
                        const box = child.geometry.boundingBox;
                        const size = new THREE.Vector3();
                        box.getSize(size);
                        const area = size.x * size.y;
                        glassMeshes.push({ mesh: child, area, size });
                        console.log('  Glass mesh:', child.name, 'size:', size.x.toFixed(3), 'x', size.y.toFixed(3), 'area:', area.toFixed(3));
                    }
                }
            });

            // Use the largest glass mesh (front screen glass)
            if (glassMeshes.length > 0) {
                glassMeshes.sort((a, b) => b.area - a.area);
                screenMesh = glassMeshes[0].mesh;
                console.log('  -> Using largest glass mesh as screen:', screenMesh.name);
            }

            // Create a pivot group for rotation around screen center
            const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;
            const screenOffset = config.screenOffset;

            phonePivot = new THREE.Group();

            // Offset the phone model so the screen center is at the pivot's origin
            phoneModel.position.set(
                -screenOffset.x * baseModelScale,
                -screenOffset.y * baseModelScale,
                -screenOffset.z * baseModelScale
            );

            phonePivot.add(phoneModel);
            threeScene.add(phonePivot);

            // Create a custom screen plane overlay since the model's UV mapping may be incorrect
            createScreenOverlay();
            hideConfiguredMeshes(phoneModel, config);

            phoneModelLoaded = true;

            // Apply initial settings from state
            if (typeof state !== 'undefined') {
                updateThreeJSBackground();
                const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : state.defaults?.screenshot;
                const rotation3D = ss?.rotation3D || { x: 0, y: 0, z: 0 };
                setThreeJSRotation(rotation3D.x, rotation3D.y, rotation3D.z);

                // Apply frame color
                if (ss?.frameColor) {
                    setPhoneFrameColor(ss.frameColor, currentDeviceModel);
                }

                // Apply screenshot texture
                if (state.screenshots.length > 0) {
                    updateScreenTexture();
                }

                // Refresh canvas now that model is loaded (needed for side previews too)
                if (typeof updateCanvas === 'function') {
                    updateCanvas();
                }
            }

            console.log('Phone model loaded successfully');
        },
        (progress) => {
            const percent = Math.round(progress.loaded / progress.total * 100);
            console.log('Loading phone model... ' + percent + '%');
        },
        (error) => {
            console.error('Error loading phone model:', error);
        }
    );
}

// Switch to a different phone model
function switchPhoneModel(deviceType) {
    if (!deviceConfigs[deviceType]) {
        console.error('Unknown device type:', deviceType);
        return;
    }

    // Skip if same device and already loaded or loading
    if (currentDeviceModel === deviceType && (phoneModelLoaded || phoneModelLoading)) {
        return;
    }

    // Update current device type
    currentDeviceModel = deviceType;
    applyCameraForDevice(currentDeviceModel);
    phoneModelLoading = false; // Reset so we can load the new one

    // Remove current pivot (which contains the model) from scene
    if (phonePivot && threeScene) {
        threeScene.remove(phonePivot);
        phonePivot.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
        phonePivot = null;
        phoneModel = null;
    }

    // Clean up screen plane
    if (customScreenPlane) {
        if (customScreenPlane.parent) {
            customScreenPlane.parent.remove(customScreenPlane);
        }
        customScreenPlane.geometry?.dispose();
        customScreenPlane.material?.dispose();
        customScreenPlane = null;
    }

    screenMesh = null;
    phoneModelLoaded = false;

    // Load new model using the config
    const config = deviceConfigs[currentDeviceModel];
    const loader = new THREE.GLTFLoader();

    loader.load(
        config.modelPath,
        (gltf) => {
            // If a newer switchPhoneModel() call has already moved on to a different device by
            // the time this (slower) load finishes, discard it - otherwise this stale callback
            // would overwrite the current device's phoneModel/phonePivot with the wrong model's
            // geometry while createScreenOverlay() below reads the (by-then-current) OTHER
            // device's config, producing a corrupted mix of the two devices.
            if (currentDeviceModel !== deviceType) {
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        child.material?.dispose();
                    }
                });
                return;
            }

            phoneModel = gltf.scene;

            // Center and scale the model
            const box = new THREE.Box3().setFromObject(phoneModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            phoneModel.position.sub(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            baseModelScale = 3.75 / maxDim;
            phoneModel.scale.setScalar(baseModelScale);

            // Create a pivot group for rotation around screen center
            const screenOffset = config.screenOffset;
            phonePivot = new THREE.Group();

            // Offset the phone model so the screen center is at the pivot's origin
            phoneModel.position.set(
                -screenOffset.x * baseModelScale,
                -screenOffset.y * baseModelScale,
                -screenOffset.z * baseModelScale
            );

            phonePivot.add(phoneModel);
            threeScene.add(phonePivot);

            // Create screen overlay for this device
            createScreenOverlay();
            hideConfiguredMeshes(phoneModel, config);

            phoneModelLoaded = true;

            // Apply settings
            if (typeof state !== 'undefined') {
                updateThreeJSBackground();
                const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : state.defaults?.screenshot;
                const rotation3D = ss?.rotation3D || { x: 0, y: 0, z: 0 };
                setThreeJSRotation(rotation3D.x, rotation3D.y, rotation3D.z);

                // Apply frame color
                if (ss?.frameColor) {
                    setPhoneFrameColor(ss.frameColor, currentDeviceModel);
                }

                if (state.screenshots.length > 0) {
                    updateScreenTexture();
                }

                // Only call updateCanvas if not suppressed (e.g., during slide transitions)
                if (typeof updateCanvas === 'function' && !window.suppressSwitchModelUpdate) {
                    updateCanvas();
                }
            }

            console.log(deviceType + ' model loaded successfully');
        },
        (progress) => {
            const percent = Math.round(progress.loaded / progress.total * 100);
            console.log('Loading ' + deviceType + ' model... ' + percent + '%');
        },
        (error) => {
            console.error('Error loading ' + deviceType + ' model:', error);
        }
    );
}

// Load a phone model into the cache (for side preview rendering with different devices)
function loadCachedPhoneModel(deviceType) {
    if (!deviceConfigs[deviceType]) return Promise.reject('Unknown device type');

    // Already loaded or loading
    if (phoneModelCache[deviceType]?.loaded) {
        return Promise.resolve(phoneModelCache[deviceType]);
    }
    if (phoneModelCache[deviceType]?.loading) {
        return phoneModelCache[deviceType].loadingPromise;
    }

    const config = deviceConfigs[deviceType];
    const loader = new THREE.GLTFLoader();

    phoneModelCache[deviceType] = { loading: true, loaded: false };

    phoneModelCache[deviceType].loadingPromise = new Promise((resolve, reject) => {
        loader.load(
            config.modelPath,
            (gltf) => {
                const model = gltf.scene;

                // Center and scale the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                model.position.sub(center);

                const maxDim = Math.max(size.x, size.y, size.z);
                const modelBaseScale = 3.75 / maxDim;
                model.scale.setScalar(modelBaseScale);

                // Create pivot for this model
                const screenOffset = config.screenOffset;
                const pivot = new THREE.Group();

                model.position.set(
                    -screenOffset.x * modelBaseScale,
                    -screenOffset.y * modelBaseScale,
                    -screenOffset.z * modelBaseScale
                );

                pivot.add(model);

                // Create screen plane for this model
                // Divide by modelBaseScale since this plane is parented under model, which
                // already carries that scale - see the matching comment in createScreenOverlay().
                const aspectRatio = config.aspectRatio;
                const planeHeight = (4.3 * config.screenHeightFactor) / modelBaseScale;
                const planeWidth = planeHeight * aspectRatio;

                const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                const material = new THREE.MeshBasicMaterial({
                    color: 0x111111,
                    side: THREE.DoubleSide
                });

                const screenPlane = new THREE.Mesh(geometry, material);
                screenPlane.position.set(screenOffset.x, screenOffset.y, screenOffset.z);

                const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
                applyInverseModelRotation(screenPlane, modelRot);

                model.add(screenPlane);
                hideConfiguredMeshes(model, config);

                phoneModelCache[deviceType] = {
                    model: model,
                    pivot: pivot,
                    screenPlane: screenPlane,
                    baseScale: modelBaseScale,
                    loaded: true,
                    loading: false
                };

                console.log('Cached ' + deviceType + ' model for side previews');
                resolve(phoneModelCache[deviceType]);
            },
            undefined,
            (error) => {
                console.error('Error loading cached ' + deviceType + ' model:', error);
                phoneModelCache[deviceType] = { loading: false, loaded: false };
                reject(error);
            }
        );
    });

    return phoneModelCache[deviceType].loadingPromise;
}

// Preload all device models for side previews
function preloadAllPhoneModels() {
    const deviceTypes = Object.keys(deviceConfigs);
    return Promise.all(deviceTypes.map(type => loadCachedPhoneModel(type).catch(() => null)));
}

// Create a custom screen plane overlay with correct UV mapping
function createScreenOverlay() {
    if (customScreenPlane) {
        if (customScreenPlane.parent) {
            customScreenPlane.parent.remove(customScreenPlane);
        }
        customScreenPlane.geometry.dispose();
        customScreenPlane.material.dispose();
    }

    const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;

    // Use device-specific aspect ratio and screen size
    // Divide by baseModelScale since this plane is parented under phoneModel, which already
    // carries that scale - without this, the plane's world size is only correct by coincidence
    // for models whose native GLB scale happens to normalize to ~1 (e.g. the original iPhone/
    // Samsung models), and comes out wildly wrong-sized for any GLB authored at a different scale.
    const aspectRatio = config.aspectRatio;
    const planeHeight = (4.3 * config.screenHeightFactor) / baseModelScale;
    const planeWidth = planeHeight * aspectRatio;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
        color: 0x111111,
        side: THREE.DoubleSide
    });

    customScreenPlane = new THREE.Mesh(geometry, material);

    // Position at center of phone, slightly in front of glass, plus this screenshot's own
    // fine-tune position nudge (if any)
    const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : null;
    const initialPos = computeScreenPlaneOffset(config, planeWidth, planeHeight, ss?.screenAdjust);
    customScreenPlane.position.set(initialPos.x, initialPos.y, initialPos.z);
    customScreenPlane.scale.setScalar((ss?.screenScale || 100) / 100);

    // Counter-rotate the screen to cancel out the model's base rotation
    // This keeps the screen facing forward when the pivot applies the base rotation
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
    applyInverseModelRotation(customScreenPlane, modelRot);

    // Add directly to phoneModel so it moves with it
    phoneModel.add(customScreenPlane);

    // basePositionOffset is no longer needed since we use pivot-based rotation
    basePositionOffset.y = 0;

    console.log('Created screen overlay for ' + currentDeviceModel + ' at:', customScreenPlane.position);
    console.log('Plane size:', planeWidth.toFixed(4), 'x', planeHeight.toFixed(4));
}

// Create a rounded corner version of the screenshot
function createRoundedScreenImage(image, cornerRadius) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    // Draw rounded rectangle path
    const w = canvas.width;
    const h = canvas.height;
    const r = cornerRadius;

    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    // Clip to rounded rectangle and draw image
    ctx.clip();
    ctx.drawImage(image, 0, 0);

    return canvas;
}

// Update the screen texture with current screenshot
function updateScreenTexture() {
    if (!phoneModel) return;
    if (typeof state === 'undefined' || !state.screenshots.length) return;

    const screenshot = state.screenshots[state.selectedIndex];
    // Use getScreenshotImage() for localized image support
    const screenshotImage = typeof getScreenshotImage === 'function'
        ? getScreenshotImage(screenshot)
        : screenshot?.image;
    if (!screenshot || !screenshotImage) return;

    // Create texture from screenshot
    if (screenTexture) {
        screenTexture.dispose();
    }

    // Create rounded corner version of the image using device-specific corner radius
    const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;
    const cornerRadius = Math.round(screenshotImage.width * config.cornerRadiusFactor);
    const roundedImage = createRoundedScreenImage(screenshotImage, cornerRadius);

    screenTexture = new THREE.Texture(roundedImage);
    screenTexture.needsUpdate = true;
    screenTexture.encoding = THREE.sRGBEncoding;
    screenTexture.flipY = true;

    // Create a material for the screen with transparency for rounded corners
    const screenMaterial = new THREE.MeshBasicMaterial({
        map: screenTexture,
        side: THREE.FrontSide,
        transparent: true
    });

    // Apply to custom screen plane (preferred)
    if (customScreenPlane) {
        customScreenPlane.material.dispose();
        customScreenPlane.material = screenMaterial;
        console.log('Applied rounded texture to custom screen plane');
    }

    // Trigger render update
    requestThreeJSRender();
}

// Set 3D rotation from sliders (in degrees)
function setThreeJSRotation(rotX, rotY, rotZ) {
    if (!phonePivot) return;

    // Add the device's base model rotation to the user's rotation
    const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };

    console.log('setThreeJSRotation:', currentDeviceModel, 'modelRot:', modelRot, 'user:', rotX, rotY, rotZ);

    // Rotate the pivot (which rotates around the screen center)
    phonePivot.rotation.x = (rotX + modelRot.x) * Math.PI / 180;
    phonePivot.rotation.y = (rotY + modelRot.y) * Math.PI / 180;
    phonePivot.rotation.z = (rotZ + modelRot.z) * Math.PI / 180;

    // Trigger render update
    requestThreeJSRender();
}

// Set 3D scale
function setThreeJSScale(scale) {
    if (!phoneModel) return;

    phoneModel.scale.setScalar(baseModelScale * (scale / 100));

    // Trigger render update
    requestThreeJSRender();
}

// Render on demand instead of continuous animation loop
let renderRequested = false;

function requestThreeJSRender() {
    if (renderRequested) return;
    renderRequested = true;
    requestAnimationFrame(() => {
        renderRequested = false;
        if (threeRenderer && threeScene && threeCamera) {
            threeRenderer.clear();
            threeRenderer.render(threeScene, threeCamera);
        }
    });
}

// Legacy function name for compatibility - now triggers on-demand render
function animateThreeJS() {
    requestThreeJSRender();
}

// Render 3D phone only (with transparent background) to be composited
function renderThreeJSToCanvas(targetCanvas, width, height) {
    if (!threeRenderer || !threeScene || !threeCamera || !phonePivot) return;

    const dims = { width: width || 1290, height: height || 2796 };

    // Store original values
    const originalBackground = threeScene.background;
    const originalPosition = phonePivot.position.clone();
    const originalScale = phonePivot.scale.clone();
    const originalRotation = phonePivot.rotation.clone();
    const originalPlanePosition = customScreenPlane ? customScreenPlane.position.clone() : null;
    const originalPlaneScale = customScreenPlane ? customScreenPlane.scale.clone() : null;
    const oldSize = { width: 400, height: 700 };

    try {
        // Apply position, scale, and rotation from screenshot settings
        if (typeof state !== 'undefined') {
            // Use getScreenshotSettings() helper if available, otherwise fall back to defaults
            const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : state.defaults?.screenshot;
            if (ss) {
                // Scale: use screenshot.scale to adjust model size
                const screenshotScale = ss.scale / 100;
                phonePivot.scale.setScalar(screenshotScale);

                // Position: match 2D behavior where available space depends on (1 - scale)
                // This ensures same percentages look the same in 2D and 3D
                // X uses smaller factor (1.1) since canvas is taller than wide (400x700 aspect)
                const availableSpaceY = (1 - screenshotScale) * 2;
                const availableSpaceX = (1 - screenshotScale) * 0.9;
                const xOffset = ((ss.x - 50) / 50) * availableSpaceX;
                const yOffset = -((ss.y - 50) / 50) * availableSpaceY; // Inverted for 3D
                phonePivot.position.set(
                    xOffset + basePositionOffset.x,
                    yOffset + basePositionOffset.y,
                    basePositionOffset.z
                );

                // Rotation: apply 3D rotation from current screenshot settings + model base rotation
                const rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
                const config = deviceConfigs[currentDeviceModel] || deviceConfigs.iphone;
                const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
                phonePivot.rotation.set(
                    (rotation3D.x + modelRot.x) * Math.PI / 180,
                    (rotation3D.y + modelRot.y) * Math.PI / 180,
                    (rotation3D.z + modelRot.z) * Math.PI / 180
                );

                // Screen position nudge: re-apply THIS screenshot's own fine-tune offset every
                // render - customScreenPlane.position otherwise only changes via direct slider
                // calls or model reload, so switching to a different screenshot of the SAME
                // device type (no reload) would otherwise keep showing a stale nudge value.
                if (customScreenPlane) {
                    const planeHeight = (4.3 * config.screenHeightFactor) / baseModelScale;
                    const planeWidth = planeHeight * config.aspectRatio;
                    const pos = computeScreenPlaneOffset(config, planeWidth, planeHeight, ss.screenAdjust);
                    customScreenPlane.position.set(pos.x, pos.y, pos.z);
                    customScreenPlane.scale.setScalar((ss.screenScale || 100) / 100);
                }
            }
        }

        // Set transparent background for compositing
        threeScene.background = null;
        threeRenderer.setClearColor(0x000000, 0); // Fully transparent clear color

        // Temporarily resize renderer
        threeRenderer.setSize(dims.width, dims.height);
        threeCamera.aspect = dims.width / dims.height;
        threeCamera.updateProjectionMatrix();

        // Clear the renderer before drawing (ensures clean transparency)
        threeRenderer.clear();

        // Render with transparency
        threeRenderer.render(threeScene, threeCamera);

        // Draw to target canvas (compositing the 3D phone onto existing content)
        const ctx = targetCanvas.getContext('2d');
        ctx.drawImage(threeRenderer.domElement, 0, 0, dims.width, dims.height);
    } finally {
        // Restore size, background, and model transforms - always, even if the render/draw above threw
        threeRenderer.setSize(oldSize.width, oldSize.height);
        threeCamera.aspect = oldSize.width / oldSize.height;
        threeCamera.updateProjectionMatrix();
        threeScene.background = originalBackground;
        phonePivot.position.copy(originalPosition);
        phonePivot.scale.copy(originalScale);
        phonePivot.rotation.copy(originalRotation);
        if (customScreenPlane && originalPlanePosition) {
            customScreenPlane.position.copy(originalPlanePosition);
        }
        if (customScreenPlane && originalPlaneScale) {
            customScreenPlane.scale.copy(originalPlaneScale);
        }
    }
}

// Render 3D for a specific screenshot index (used for side previews)
function renderThreeJSForScreenshot(targetCanvas, width, height, screenshotIndex) {
    if (!threeRenderer || !threeScene || !threeCamera) return;
    if (typeof state === 'undefined' || !state.screenshots[screenshotIndex]) return;

    const screenshot = state.screenshots[screenshotIndex];
    const ss = screenshot.screenshot;
    const dims = { width: width || 1290, height: height || 2796 };

    // Determine which device model this screenshot uses
    const screenshotDeviceType = ss.device3D || 'iphone';
    const config = deviceConfigs[screenshotDeviceType] || deviceConfigs.iphone;

    // Check if this screenshot uses the same device as currently active
    const useCurrentModel = screenshotDeviceType === currentDeviceModel && phonePivot;

    // Get the model to use (either current or from cache)
    let pivotToUse, screenPlaneToUse, baseScaleToUse;

    if (useCurrentModel) {
        // Use the currently loaded model
        pivotToUse = phonePivot;
        screenPlaneToUse = customScreenPlane;
        baseScaleToUse = baseModelScale;
    } else {
        // Use cached model for different device
        const cached = phoneModelCache[screenshotDeviceType];
        if (!cached?.loaded) {
            // Model not cached yet - trigger loading and skip this render
            loadCachedPhoneModel(screenshotDeviceType).then(() => {
                // Trigger a re-render once model is loaded
                if (typeof updateCanvas === 'function') {
                    updateCanvas();
                }
            });
            return;
        }
        pivotToUse = cached.pivot;
        screenPlaneToUse = cached.screenPlane;
        // The cache stores each device's OWN baseScale - NOT the same as the current global
        // baseModelScale, which belongs to whichever device is currently active.
        baseScaleToUse = cached.baseScale;

        // Add cached pivot to scene temporarily
        threeScene.add(pivotToUse);
    }

    // Store original values
    const originalBackground = threeScene.background;
    const originalPosition = pivotToUse.position.clone();
    const originalScale = pivotToUse.scale.clone();
    const originalRotation = pivotToUse.rotation.clone();
    const originalCameraZ = threeCamera.position.z;
    const originalCameraFov = threeCamera.fov;
    const oldSize = { width: 400, height: 700 };
    const oldMaterial = screenPlaneToUse ? screenPlaneToUse.material : null;
    const originalPlanePosition = screenPlaneToUse ? screenPlaneToUse.position.clone() : null;
    const originalPlaneScale = screenPlaneToUse ? screenPlaneToUse.scale.clone() : null;

    try {
        // Hide the current model if we're using a different one
        if (!useCurrentModel && phonePivot) {
            phonePivot.visible = false;
        }

        // Temporarily update screen texture for this screenshot
        // Use getScreenshotImage() for localized image support
        const screenshotImage = typeof getScreenshotImage === 'function'
            ? getScreenshotImage(screenshot)
            : screenshot?.image;
        if (screenshotImage && screenPlaneToUse) {
            const cornerRadius = Math.round(screenshotImage.width * config.cornerRadiusFactor);
            const roundedImage = createRoundedScreenImage(screenshotImage, cornerRadius);
            const newTexture = new THREE.Texture(roundedImage);
            newTexture.needsUpdate = true;
            newTexture.encoding = THREE.sRGBEncoding;
            newTexture.flipY = true;

            const newMaterial = new THREE.MeshBasicMaterial({
                map: newTexture,
                side: THREE.FrontSide,
                transparent: true
            });
            screenPlaneToUse.material = newMaterial;
        }

        // Apply frame color for this screenshot
        if (ss.frameColor) {
            if (useCurrentModel) {
                setPhoneFrameColor(ss.frameColor, screenshotDeviceType);
            } else {
                setCachedModelFrameColor(ss.frameColor, screenshotDeviceType);
            }
        }

        // Apply rotation for this screenshot + model base rotation
        const rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
        const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
        pivotToUse.rotation.set(
            (rotation3D.x + modelRot.x) * Math.PI / 180,
            (rotation3D.y + modelRot.y) * Math.PI / 180,
            (rotation3D.z + modelRot.z) * Math.PI / 180
        );

        // Apply scale and position (matching 2D behavior)
        const screenshotScale = ss.scale / 100;
        pivotToUse.scale.setScalar(screenshotScale);
        const availableSpaceY = (1 - screenshotScale) * 2;
        const availableSpaceX = (1 - screenshotScale) * 0.9;
        const xOffset = ((ss.x - 50) / 50) * availableSpaceX;
        const yOffset = -((ss.y - 50) / 50) * availableSpaceY;
        pivotToUse.position.set(
            xOffset + basePositionOffset.x,
            yOffset + basePositionOffset.y,
            basePositionOffset.z
        );

        // Apply this screenshot's own fine-tune screen position nudge and scale
        if (screenPlaneToUse) {
            const planeHeight = (4.3 * config.screenHeightFactor) / baseScaleToUse;
            const planeWidth = planeHeight * config.aspectRatio;
            const pos = computeScreenPlaneOffset(config, planeWidth, planeHeight, ss.screenAdjust);
            screenPlaneToUse.position.set(pos.x, pos.y, pos.z);
            screenPlaneToUse.scale.setScalar((ss.screenScale || 100) / 100);
        }

        // Frame this screenshot's device with its own camera baseline (tablets vs phones
        // need different distance/FOV) - restored to the currently active device below
        const cam = config.camera || { distance: 6, fov: 35 };
        threeCamera.position.z = cam.distance;
        threeCamera.fov = cam.fov;

        // Set transparent background for compositing
        threeScene.background = null;
        threeRenderer.setClearColor(0x000000, 0); // Fully transparent clear color

        // Temporarily resize renderer
        threeRenderer.setSize(dims.width, dims.height);
        threeCamera.aspect = dims.width / dims.height;
        threeCamera.updateProjectionMatrix();

        // Clear the renderer before drawing (ensures clean transparency)
        threeRenderer.clear();

        // Render with transparency
        threeRenderer.render(threeScene, threeCamera);

        // Draw to target canvas (composite 3D phone onto existing background)
        const ctx = targetCanvas.getContext('2d');
        ctx.drawImage(threeRenderer.domElement, 0, 0, dims.width, dims.height);
    } finally {
        // Restore everything - always, even if the render/draw above threw, so a failed
        // side-preview render can never leave its transform/texture/camera bled onto the
        // next real paint of the main canvas
        threeRenderer.setSize(oldSize.width, oldSize.height);
        threeCamera.aspect = oldSize.width / oldSize.height;
        threeCamera.position.z = originalCameraZ;
        threeCamera.fov = originalCameraFov;
        threeCamera.updateProjectionMatrix();
        threeScene.background = originalBackground;
        pivotToUse.position.copy(originalPosition);
        pivotToUse.scale.copy(originalScale);
        pivotToUse.rotation.copy(originalRotation);
        if (screenPlaneToUse && originalPlanePosition) {
            screenPlaneToUse.position.copy(originalPlanePosition);
        }
        if (screenPlaneToUse && originalPlaneScale) {
            screenPlaneToUse.scale.copy(originalPlaneScale);
        }

        // Restore original material
        if (oldMaterial && screenPlaneToUse) {
            // Dispose the temporary material
            if (screenPlaneToUse.material !== oldMaterial) {
                screenPlaneToUse.material.map?.dispose();
                screenPlaneToUse.material.dispose();
            }
            screenPlaneToUse.material = oldMaterial;
        }

        // Restore frame color on current model if we changed it
        if (useCurrentModel && ss.frameColor && typeof state !== 'undefined') {
            const currentSS = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : null;
            if (currentSS?.frameColor) {
                setPhoneFrameColor(currentSS.frameColor, currentDeviceModel);
            }
        }

        // Clean up: remove cached model from scene and restore current model visibility
        if (!useCurrentModel) {
            threeScene.remove(pivotToUse);
            if (phonePivot) {
                phonePivot.visible = true;
            }
        }
    }
}

// Show/hide Three.js container
function showThreeJS(show) {
    const container = document.getElementById('threejs-container');
    const canvas = document.getElementById('preview-canvas');

    // In 3D mode, we show the 2D canvas (which composites everything)
    // The Three.js container is hidden but used for rendering
    if (container) {
        container.style.display = 'none'; // Always hidden - we render to 2D canvas
    }
    if (canvas) {
        canvas.style.display = 'block'; // Always visible
    }

    if (show && !isThreeJSInitialized) {
        initThreeJS();
    }

    // Apply current rotation and background
    if (show && typeof state !== 'undefined') {
        updateThreeJSBackground();
        if (phoneModel) {
            const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : state.defaults?.screenshot;
            const rotation3D = ss?.rotation3D || { x: 0, y: 0, z: 0 };
            setThreeJSRotation(rotation3D.x, rotation3D.y, rotation3D.z);
            updateScreenTexture();
        }
    }
}

// Get Three.js canvas for export
function getThreeJSCanvas() {
    return threeRenderer ? threeRenderer.domElement : null;
}

// Update Three.js scene background from state
function updateThreeJSBackground() {
    if (!threeScene || typeof state === 'undefined') return;

    // Use getBackground() helper if available, otherwise fall back to defaults
    const bg = typeof getBackground === 'function' ? getBackground() : state.defaults?.background;
    if (!bg) return;

    if (bg.type === 'solid') {
        threeScene.background = new THREE.Color(bg.solid);
    } else if (bg.type === 'gradient') {
        // Use the first gradient color as background (Three.js doesn't support gradients natively)
        const firstStop = bg.gradient.stops[0];
        if (firstStop) {
            threeScene.background = new THREE.Color(firstStop.color);
        }
    } else {
        // For image backgrounds, use a neutral color
        threeScene.background = new THREE.Color(0x1a1a2e);
    }

    // Trigger render update
    requestThreeJSRender();
}

// Cleanup
function disposeThreeJS() {
    if (screenTexture) {
        screenTexture.dispose();
    }
    if (threeRenderer) {
        threeRenderer.dispose();
    }
    isThreeJSInitialized = false;
    phoneModelLoaded = false;
}

// Interactive rotation/movement for 2D canvas in 3D mode
let isDragging3D = false;
let isAltDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let dragUpdatePending = false;

function getUse3D() {
    if (typeof getScreenshotSettings === 'function') {
        const ss = getScreenshotSettings();
        return ss?.use3D || false;
    }
    return state.defaults?.screenshot?.use3D || false;
}

function setup3DCanvasInteraction() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (typeof state !== 'undefined' && getUse3D()) {
            isDragging3D = true;
            isAltDragging = e.altKey;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            canvas.style.cursor = isAltDragging ? 'move' : 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging3D || typeof state === 'undefined' || !getUse3D()) return;
        // Don't rotate 3D device while dragging an element
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper && wrapper.classList.contains('element-dragging')) {
            isDragging3D = false;
            isAltDragging = false;
            canvas.style.cursor = '';
            return;
        }

        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Get current screenshot settings
        const ss = typeof getScreenshotSettings === 'function' ? getScreenshotSettings() : state.defaults?.screenshot;
        if (!ss) return;

        if (isAltDragging) {
            // Alt+drag: move position (x, y)
            ss.x = Math.max(0, Math.min(100, ss.x + deltaX * 0.2));
            ss.y = Math.max(0, Math.min(100, ss.y + deltaY * 0.2));

            // Update sliders
            document.getElementById('screenshot-x').value = ss.x;
            document.getElementById('screenshot-x-value').textContent = Math.round(ss.x) + '%';
            document.getElementById('screenshot-y').value = ss.y;
            document.getElementById('screenshot-y-value').textContent = Math.round(ss.y) + '%';
        } else {
            // Regular drag: rotate
            if (!ss.rotation3D) ss.rotation3D = { x: 0, y: 0, z: 0 };

            ss.rotation3D.y = Math.max(-45, Math.min(45, ss.rotation3D.y + deltaX * 0.5));
            ss.rotation3D.x = Math.max(-45, Math.min(45, ss.rotation3D.x + deltaY * 0.5));

            // Update sliders
            document.getElementById('rotation-3d-y').value = ss.rotation3D.y;
            document.getElementById('rotation-3d-y-value').textContent = Math.round(ss.rotation3D.y) + '°';
            document.getElementById('rotation-3d-x').value = ss.rotation3D.x;
            document.getElementById('rotation-3d-x-value').textContent = Math.round(ss.rotation3D.x) + '°';

            // Apply rotation directly to model (fast path - skip full updateCanvas)
            setThreeJSRotation(ss.rotation3D.x, ss.rotation3D.y, ss.rotation3D.z);
        }

        // Throttle updateCanvas calls using requestAnimationFrame
        if (!dragUpdatePending) {
            dragUpdatePending = true;
            requestAnimationFrame(() => {
                dragUpdatePending = false;
                if (typeof updateCanvas === 'function') {
                    updateCanvas();
                }
            });
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDragging3D) {
            isDragging3D = false;
            isAltDragging = false;
            canvas.style.cursor = getUse3D() ? 'grab' : '';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDragging3D) {
            isDragging3D = false;
            isAltDragging = false;
            canvas.style.cursor = '';
        }
    });

    // Change cursor when hovering in 3D mode
    canvas.addEventListener('mouseenter', () => {
        if (typeof state !== 'undefined' && getUse3D()) {
            canvas.style.cursor = 'grab';
        }
    });
}

// Initialize interaction when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup3DCanvasInteraction);
} else {
    setup3DCanvasInteraction();
}
