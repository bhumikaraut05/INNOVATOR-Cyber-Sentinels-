// ============================================================
// 3D Avatar — Professional Full-Body with Built-in Lip-Sync
// No external model dependency — works 100% offline
// Head nods while speaking, blinks, anti-gravity float
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, clock;
let avatarGroup = null;
let animationId = null;
let isLoaded = false;
let containerRef = null;
let currentAvatarGender = "female";

// Lip-sync & animation states
let lipSyncActive = false;
let lipSyncTimer = null;
let isListeningPose = false;
let blinkTimer = 0;
let blinkPhase = 0; // 0=open, 1=closing, 2=opening

// Avatar body part refs for animation
let headGroup = null;
let jawMesh = null;
let lEyeLid = null;
let rEyeLid = null;
let lEye = null;
let rEye = null;

/**
 * Initialize 3D scene with full-body avatar.
 */
async function initAvatar(container, onLoaded = null) {
    containerRef = container;
    scene = new THREE.Scene();

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Camera: frames head to knees
    camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    camera.position.set(0, 1.0, 2.4);
    camera.lookAt(0, 0.85, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // ── Soft, even lighting ──────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(0.5, 2, 3);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8ba3c1, 0.4);
    fill.position.set(-2, 1.5, 1.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x06b6d4, 0.3);
    rim.position.set(0, 1.5, -2.5);
    scene.add(rim);

    const ground = new THREE.DirectionalLight(0x1e3a5f, 0.2);
    ground.position.set(0, -1, 1);
    scene.add(ground);

    clock = new THREE.Clock();

    // Build avatar
    buildAvatar(currentAvatarGender);
    isLoaded = true;
    if (onLoaded) onLoaded();

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

/**
 * Build a professional full-body avatar.
 * gender: "male" | "female" — determines the avatar shown
 */
function buildAvatar(gender) {
    if (avatarGroup) {
        scene.remove(avatarGroup);
        avatarGroup = null;
    }

    avatarGroup = new THREE.Group();
    headGroup = new THREE.Group();

    // ── Materials ─────────────────────────────────────────
    const skinColor = gender === "male" ? 0xd4a574 : 0xe8c4a0;
    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55, metalness: 0.05 });
    const blazer = new THREE.MeshStandardMaterial({ color: 0x1a2e4a, roughness: 0.45, metalness: 0.05 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.45 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.1 });
    const hair = new THREE.MeshStandardMaterial({ color: gender === "male" ? 0x1a1a1a : 0x2a1a0a, roughness: 0.7 });
    const lipMat = new THREE.MeshStandardMaterial({ color: gender === "male" ? 0xb3756a : 0xc47070, roughness: 0.5 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.2 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x3a2210, roughness: 0.3 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 });
    const eyebrow = new THREE.MeshStandardMaterial({ color: gender === "male" ? 0x1a1a1a : 0x2a1a0a, roughness: 0.6 });
    const eyelidMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55 });

    // ── HEAD (in headGroup for nod/tilt) ──────────────────
    // Skull
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 32, 32), skin);
    skull.scale.set(1, 1.08, 1);
    skull.position.y = 1.62;
    headGroup.add(skull);

    // Face front plane (slightly flatter)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 32), skin);
    face.scale.set(1.05, 0.85, 0.5);
    face.position.set(0, 1.58, 0.06);
    headGroup.add(face);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 8), skin);
    nose.position.set(0, 1.58, 0.145);
    nose.rotation.x = Math.PI;
    headGroup.add(nose);

    // ── EYES ──────────────────────────────────────────────
    function makeEye(x) {
        const eyeGroup = new THREE.Group();
        // White
        const white = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), eyeWhite);
        eyeGroup.add(white);
        // Iris
        const irisM = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), iris);
        irisM.position.z = 0.024;
        eyeGroup.add(irisM);
        // Pupil
        const pupilM = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), pupil);
        pupilM.position.z = 0.025;
        eyeGroup.add(pupilM);
        eyeGroup.position.set(x, 1.635, 0.12);
        return eyeGroup;
    }

    lEye = makeEye(-0.048);
    rEye = makeEye(0.048);
    headGroup.add(lEye);
    headGroup.add(rEye);

    // ── EYELIDS (for blinking) ────────────────────────────
    function makeEyelid(x) {
        const lid = new THREE.Mesh(
            new THREE.PlaneGeometry(0.058, 0.03),
            eyelidMat
        );
        lid.position.set(x, 1.655, 0.125);
        lid.visible = false; // hidden by default, shown during blink
        return lid;
    }
    lEyeLid = makeEyelid(-0.048);
    rEyeLid = makeEyelid(0.048);
    headGroup.add(lEyeLid);
    headGroup.add(rEyeLid);

    // ── EYEBROWS ──────────────────────────────────────────
    function makeEyebrow(x) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.008), eyebrow);
        brow.position.set(x, 1.665, 0.13);
        brow.rotation.z = x < 0 ? 0.08 : -0.08;
        return brow;
    }
    headGroup.add(makeEyebrow(-0.048));
    headGroup.add(makeEyebrow(0.048));

    // ── MOUTH / JAW (for lip-sync) ────────────────────────
    // Upper lip (static)
    const upperLip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.008, 0.015),
        lipMat
    );
    upperLip.position.set(0, 1.555, 0.135);
    upperLip.geometry.translate(0, 0, 0);
    // Round it
    for (let i = 0; i < upperLip.geometry.attributes.position.count; i++) {
        const x = upperLip.geometry.attributes.position.getX(i);
        const z = upperLip.geometry.attributes.position.getZ(i);
        upperLip.geometry.attributes.position.setZ(i, z + Math.cos(x * 40) * 0.003);
    }
    headGroup.add(upperLip);

    // Lower lip / jaw (animated for lip-sync)
    jawMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.008, 0.013),
        lipMat
    );
    jawMesh.position.set(0, 1.545, 0.133);
    headGroup.add(jawMesh);

    // Mouth interior (dark behind lips)
    const mouthInner = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 0.015),
        new THREE.MeshStandardMaterial({ color: 0x2a0a0a, roughness: 0.8 })
    );
    mouthInner.position.set(0, 1.55, 0.125);
    mouthInner.name = "mouthInner";
    headGroup.add(mouthInner);

    // ── HAIR ──────────────────────────────────────────────
    if (gender === "male") {
        const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
        hairTop.position.y = 1.66;
        hairTop.scale.set(1.02, 1.02, 1.02);
        headGroup.add(hairTop);
    } else {
        // Female: longer hair
        const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.155, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
        hairTop.position.y = 1.665;
        hairTop.scale.set(1.04, 1.05, 1.04);
        headGroup.add(hairTop);
        // Side hair
        const hairSide = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.25, 12), hair);
        hairSide.position.set(-0.12, 1.52, -0.04);
        headGroup.add(hairSide);
        const hairSide2 = hairSide.clone();
        hairSide2.position.x = 0.12;
        headGroup.add(hairSide2);
    }

    // ── EARS ──────────────────────────────────────────────
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), skin);
    ear.scale.set(0.5, 1, 0.5);
    const lEar = ear.clone(); lEar.position.set(-0.14, 1.62, 0);
    const rEar = ear.clone(); rEar.position.set(0.14, 1.62, 0);
    headGroup.add(lEar);
    headGroup.add(rEar);

    avatarGroup.add(headGroup);

    // ── NECK ──────────────────────────────────────────────
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 16), skin);
    neck.position.y = 1.46;
    avatarGroup.add(neck);

    // ── SHIRT COLLAR ──────────────────────────────────────
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.06, 16), shirt);
    collar.position.y = 1.39;
    avatarGroup.add(collar);

    // ── TORSO (blazer) ────────────────────────────────────
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.42, 16), blazer);
    torso.position.y = 1.15;
    avatarGroup.add(torso);

    // Shirt V-neck peek
    const shirtV = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.15), shirt);
    shirtV.position.set(0, 1.28, 0.145);
    avatarGroup.add(shirtV);

    // Blazer lapels
    const lapelGeo = new THREE.PlaneGeometry(0.05, 0.12);
    const lLapel = new THREE.Mesh(lapelGeo, blazer);
    lLapel.position.set(-0.05, 1.26, 0.148);
    lLapel.rotation.y = 0.2;
    avatarGroup.add(lLapel);
    const rLapel = new THREE.Mesh(lapelGeo, blazer);
    rLapel.position.set(0.05, 1.26, 0.148);
    rLapel.rotation.y = -0.2;
    avatarGroup.add(rLapel);

    // ── ARMS ──────────────────────────────────────────────
    const upperArm = new THREE.CylinderGeometry(0.042, 0.035, 0.25, 12);
    const lUpperArm = new THREE.Mesh(upperArm, blazer);
    lUpperArm.position.set(-0.22, 1.13, 0);
    lUpperArm.rotation.z = 0.1;
    avatarGroup.add(lUpperArm);
    const rUpperArm = new THREE.Mesh(upperArm, blazer);
    rUpperArm.position.set(0.22, 1.13, 0);
    rUpperArm.rotation.z = -0.1;
    avatarGroup.add(rUpperArm);

    // Forearms
    const forearm = new THREE.CylinderGeometry(0.033, 0.028, 0.22, 12);
    const lForearm = new THREE.Mesh(forearm, blazer);
    lForearm.position.set(-0.24, 0.9, 0.03);
    lForearm.rotation.z = 0.06;
    avatarGroup.add(lForearm);
    const rForearm = new THREE.Mesh(forearm, blazer);
    rForearm.position.set(0.24, 0.9, 0.03);
    rForearm.rotation.z = -0.06;
    avatarGroup.add(rForearm);

    // ── HANDS ─────────────────────────────────────────────
    const handGeo = new THREE.SphereGeometry(0.032, 12, 12);
    const lHand = new THREE.Mesh(handGeo, skin);
    lHand.position.set(-0.26, 0.76, 0.04);
    lHand.scale.set(1, 0.8, 0.6);
    avatarGroup.add(lHand);
    const rHand = new THREE.Mesh(handGeo, skin);
    rHand.position.set(0.26, 0.76, 0.04);
    rHand.scale.set(1, 0.8, 0.6);
    avatarGroup.add(rHand);

    // ── BELT ──────────────────────────────────────────────
    const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.152, 0.148, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.2 })
    );
    belt.position.y = 0.92;
    avatarGroup.add(belt);

    // Belt buckle
    const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.02, 0.01),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.7, roughness: 0.2 })
    );
    buckle.position.set(0, 0.92, 0.145);
    avatarGroup.add(buckle);

    // ── LEGS ──────────────────────────────────────────────
    const thigh = new THREE.CylinderGeometry(0.06, 0.05, 0.35, 12);
    const lThigh = new THREE.Mesh(thigh, pants);
    lThigh.position.set(-0.07, 0.72, 0);
    avatarGroup.add(lThigh);
    const rThigh = new THREE.Mesh(thigh, pants);
    rThigh.position.set(0.07, 0.72, 0);
    avatarGroup.add(rThigh);

    // Calves
    const calf = new THREE.CylinderGeometry(0.045, 0.038, 0.32, 12);
    const lCalf = new THREE.Mesh(calf, pants);
    lCalf.position.set(-0.07, 0.39, 0);
    avatarGroup.add(lCalf);
    const rCalf = new THREE.Mesh(calf, pants);
    rCalf.position.set(0.07, 0.39, 0);
    avatarGroup.add(rCalf);

    // ── SHOES ─────────────────────────────────────────────
    const shoeGeo = new THREE.BoxGeometry(0.065, 0.035, 0.12);
    const lShoe = new THREE.Mesh(shoeGeo, shoes);
    lShoe.position.set(-0.07, 0.215, 0.015);
    avatarGroup.add(lShoe);
    const rShoe = new THREE.Mesh(shoeGeo, shoes);
    rShoe.position.set(0.07, 0.215, 0.015);
    avatarGroup.add(rShoe);

    scene.add(avatarGroup);
    console.log("✅ Built-in avatar ready —", gender);
}

/**
 * Switch avatar gender.
 * If user is female → show male, etc.
 */
function switchAvatar(userGender) {
    const target = userGender === "female" ? "male" : userGender === "male" ? "female" : "female";
    if (target === currentAvatarGender) return;
    currentAvatarGender = target;
    buildAvatar(target);
}

// ── Lip-Sync ─────────────────────────────────────────────

function startLipSync(durationMs = 5000) {
    lipSyncActive = true;
    if (lipSyncTimer) clearTimeout(lipSyncTimer);
    lipSyncTimer = setTimeout(() => {
        lipSyncActive = false;
    }, durationMs);
}

function stopLipSync() {
    lipSyncActive = false;
    if (lipSyncTimer) { clearTimeout(lipSyncTimer); lipSyncTimer = null; }
}

function setListening(v) { isListeningPose = !!v; }

// ── Animation Loop ───────────────────────────────────────

function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (!avatarGroup) { renderer.render(scene, camera); return; }

    // ── Anti-gravity float ──
    avatarGroup.position.y = Math.sin(t * 0.7) * 0.008;

    // ── Gentle body sway ──
    avatarGroup.rotation.y = Math.sin(t * 0.3) * 0.025;

    // ── LIP-SYNC: move jaw down and show mouth interior ──
    if (jawMesh) {
        if (lipSyncActive) {
            // Two layered sine waves for natural speech movement
            const jawOpen = (Math.sin(t * 14) + 1) * 0.006
                + (Math.sin(t * 7.3) + 1) * 0.004
                + (Math.sin(t * 21) + 1) * 0.002;
            jawMesh.position.y = 1.545 - jawOpen;

            // Show mouth interior when jaw opens
            headGroup.traverse(c => {
                if (c.name === "mouthInner") {
                    c.scale.y = 1 + jawOpen * 60;
                    c.visible = true;
                }
            });
        } else {
            jawMesh.position.y = 1.545;
            headGroup.traverse(c => {
                if (c.name === "mouthInner") {
                    c.scale.y = 1;
                }
            });
        }
    }

    // ── HEAD NODS while speaking ──
    if (headGroup) {
        if (lipSyncActive) {
            headGroup.rotation.x = Math.sin(t * 3) * 0.04; // nod
            headGroup.rotation.y = Math.sin(t * 1.8) * 0.025; // slight turn
            headGroup.rotation.z = 0;
        } else if (isListeningPose) {
            headGroup.rotation.x = 0.04; // slight forward tilt
            headGroup.rotation.y = 0;
            headGroup.rotation.z = Math.sin(t * 0.5) * 0.02 + 0.05; // attentive tilt
        } else {
            // Idle: very subtle movement
            headGroup.rotation.x = Math.sin(t * 0.4) * 0.01;
            headGroup.rotation.y = Math.sin(t * 0.25) * 0.01;
            headGroup.rotation.z = 0;
        }
    }

    // ── BLINKING (every ~3-5 seconds) ──
    blinkTimer += clock.getDelta();
    if (blinkPhase === 0 && blinkTimer > 3 + Math.random() * 2) {
        blinkPhase = 1;
        blinkTimer = 0;
    }
    if (lEyeLid && rEyeLid) {
        if (blinkPhase === 1) {
            // Close eyes
            lEyeLid.visible = true;
            rEyeLid.visible = true;
            if (lEye) lEye.visible = false;
            if (rEye) rEye.visible = false;
            if (blinkTimer > 0.12) blinkPhase = 2;
        } else if (blinkPhase === 2) {
            // Open eyes
            lEyeLid.visible = false;
            rEyeLid.visible = false;
            if (lEye) lEye.visible = true;
            if (rEye) rEye.visible = true;
            blinkPhase = 0;
            blinkTimer = 0;
        }
    }

    renderer.render(scene, camera);
}

function destroyAvatar() {
    if (animationId) cancelAnimationFrame(animationId);
    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
    }
}

export { initAvatar, destroyAvatar, switchAvatar, startLipSync, stopLipSync, setListening };
