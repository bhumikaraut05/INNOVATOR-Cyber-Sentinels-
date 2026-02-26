// ============================================================
// 3D Avatar — ReadyPlayerMe with blend shape lip-sync
// Model: 69a0aef69853ea076748551d
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, clock, model;
let animationId = null;
let morphMeshes = [];
let headBone = null;

// States
let lipSyncActive = false;
let lipSyncTimer = null;
let isListening = false;
let currentEmotion = "neutral";

const AVATAR_URL = "https://models.readyplayer.me/69a0aef69853ea076748551d.glb?morphTargets=ARKit&textureAtlas=1024";

// Emotion → blend shape mapping
const EMOTION_MORPHS = {
    happy: { mouthSmileLeft: 0.6, mouthSmileRight: 0.6, cheekSquintLeft: 0.3, cheekSquintRight: 0.3 },
    sad: { mouthFrownLeft: 0.5, mouthFrownRight: 0.5, browInnerUp: 0.4 },
    angry: { browDownLeft: 0.6, browDownRight: 0.6, jawForward: 0.2, mouthPressLeft: 0.3, mouthPressRight: 0.3 },
    surprised: { eyeWideLeft: 0.7, eyeWideRight: 0.7, browInnerUp: 0.5, jawOpen: 0.3 },
    neutral: {},
};

async function initAvatar(container, onLoaded = null) {
    scene = new THREE.Scene();

    const w = container.clientWidth;
    const h = container.clientHeight;

    camera = new THREE.PerspectiveCamera(24, w / h, 0.1, 100);
    camera.position.set(0, 1.35, 3.0);
    camera.lookAt(0, 1.05, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // Soft lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(0.5, 2, 3); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ba3c1, 0.4);
    fill.position.set(-2, 1.5, 1.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0x06b6d4, 0.3);
    rim.position.set(0, 1.5, -2.5); scene.add(rim);

    clock = new THREE.Clock();

    try {
        await loadModel();
        if (onLoaded) onLoaded();
    } catch (err) {
        console.error("Avatar load failed:", err);
        buildFallback();
        if (onLoaded) onLoaded();
    }

    animate();

    window.addEventListener("resize", () => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });

    return true;
}

async function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(AVATAR_URL, (gltf) => {
            model = gltf.scene;

            // Auto-scale and center
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const s = 1.7 / size.y;
            model.scale.setScalar(s);
            const center = box.getCenter(new THREE.Vector3());
            model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
            model.userData.baseY = model.position.y; // store for float animation

            // Collect morph meshes + head bone
            morphMeshes = [];
            headBone = null;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    if (child.morphTargetInfluences && child.morphTargetDictionary) {
                        morphMeshes.push(child);
                    }
                }
                if (child.isBone && /head/i.test(child.name)) {
                    headBone = child;
                }
            });

            scene.add(model);
            console.log("✅ RPM Avatar loaded — morphs:", morphMeshes.length, "bone:", !!headBone);
            if (morphMeshes[0]) {
                console.log("Blend shapes:", Object.keys(morphMeshes[0].morphTargetDictionary).join(", "));
            }
            resolve();
        }, undefined, reject);
    });
}

function buildFallback() {
    // Minimal fallback sphere-body avatar
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.5 });
    const blazer = new THREE.MeshStandardMaterial({ color: 0x1a2e4a, roughness: 0.45 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 32), skin);
    head.position.y = 1.6; group.add(head);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.5, 16), blazer);
    body.position.y = 1.1; group.add(body);

    const leg = new THREE.CylinderGeometry(0.05, 0.04, 0.5, 12);
    const lL = new THREE.Mesh(leg, new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
    lL.position.set(-0.07, 0.6, 0); group.add(lL);
    const rL = lL.clone(); rL.position.x = 0.07; group.add(rL);

    model = group;
    scene.add(group);
}

// ── Lip-Sync ─────────────────────────────────────────

function startLipSync(durationMs = 5000) {
    lipSyncActive = true;
    if (lipSyncTimer) clearTimeout(lipSyncTimer);
    lipSyncTimer = setTimeout(() => { lipSyncActive = false; resetMorphs("lip"); }, durationMs);
}

function stopLipSync() {
    lipSyncActive = false;
    if (lipSyncTimer) { clearTimeout(lipSyncTimer); lipSyncTimer = null; }
    resetMorphs("lip");
}

function setListeningPose(v) { isListening = !!v; }

function setEmotion(emotion) {
    currentEmotion = emotion;
    applyEmotionMorphs(emotion);
}

function applyEmotionMorphs(emotion) {
    const targets = EMOTION_MORPHS[emotion] || {};
    for (const mesh of morphMeshes) {
        const d = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        // Reset emotion morphs first
        Object.keys(EMOTION_MORPHS).forEach(e => {
            Object.keys(EMOTION_MORPHS[e]).forEach(k => {
                if (d[k] !== undefined) inf[d[k]] = 0;
            });
        });
        // Apply new
        Object.entries(targets).forEach(([k, v]) => {
            if (d[k] !== undefined) inf[d[k]] = v;
        });
    }
}

function resetMorphs(type) {
    const lipKeys = ["jawOpen", "mouthOpen", "viseme_aa", "viseme_O", "viseme_E", "viseme_U", "viseme_I", "viseme_FF", "viseme_TH"];
    for (const mesh of morphMeshes) {
        const d = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (type === "lip") {
            lipKeys.forEach(k => { if (d[k] !== undefined) inf[d[k]] = 0; });
        }
    }
}

// ── Animation Loop ───────────────────────────────────

function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (!model) { renderer.render(scene, camera); return; }

    // Anti-gravity float
    const baseY = model.userData?.baseY ?? 0;
    model.position.y = baseY + Math.sin(t * 0.7) * 0.008;

    // Gentle body sway
    model.rotation.y = Math.sin(t * 0.3) * 0.02;

    // ── Lip-sync blend shapes ──
    if (lipSyncActive && morphMeshes.length > 0) {
        for (const mesh of morphMeshes) {
            const d = mesh.morphTargetDictionary;
            const inf = mesh.morphTargetInfluences;

            if (d["jawOpen"] !== undefined) {
                inf[d["jawOpen"]] = (Math.sin(t * 14) + 1) * 0.18 + (Math.sin(t * 7.5) + 1) * 0.07;
            }
            if (d["mouthOpen"] !== undefined) {
                inf[d["mouthOpen"]] = (Math.sin(t * 11) + 1) * 0.12;
            }
            // Cycle through visemes for natural speech
            if (d["viseme_aa"] !== undefined) inf[d["viseme_aa"]] = Math.max(0, Math.sin(t * 9)) * 0.3;
            if (d["viseme_O"] !== undefined) inf[d["viseme_O"]] = Math.max(0, Math.sin(t * 6.3 + 1)) * 0.22;
            if (d["viseme_E"] !== undefined) inf[d["viseme_E"]] = Math.max(0, Math.sin(t * 8.1 + 2)) * 0.18;
            if (d["viseme_U"] !== undefined) inf[d["viseme_U"]] = Math.max(0, Math.sin(t * 5.4 + 3)) * 0.14;
            if (d["viseme_I"] !== undefined) inf[d["viseme_I"]] = Math.max(0, Math.sin(t * 7.0 + 4)) * 0.16;
        }

        // Head nods while speaking
        if (headBone) {
            headBone.rotation.x = Math.sin(t * 3) * 0.04;
            headBone.rotation.y = Math.sin(t * 1.8) * 0.025;
        }
    } else {
        // Idle head
        if (headBone) {
            if (isListening) {
                headBone.rotation.x = 0.04;
                headBone.rotation.z = Math.sin(t * 0.5) * 0.02 + 0.04;
            } else {
                headBone.rotation.x = Math.sin(t * 0.4) * 0.01;
                headBone.rotation.y = Math.sin(t * 0.25) * 0.01;
                headBone.rotation.z = 0;
            }
        }
    }

    // ── Blinking ──
    for (const mesh of morphMeshes) {
        const d = mesh.morphTargetDictionary;
        const inf = mesh.morphTargetInfluences;
        if (d["eyeBlinkLeft"] !== undefined && d["eyeBlinkRight"] !== undefined) {
            const cycle = t % 3.8;
            let blink = 0;
            if (cycle > 3.4 && cycle < 3.52) blink = 1;
            else if (cycle > 3.52 && cycle < 3.62) blink = 0.3;
            inf[d["eyeBlinkLeft"]] = blink;
            inf[d["eyeBlinkRight"]] = blink;
        }
    }

    renderer.render(scene, camera);
}

function destroyAvatar() {
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
}

export { initAvatar, destroyAvatar, startLipSync, stopLipSync, setListeningPose, setEmotion };
