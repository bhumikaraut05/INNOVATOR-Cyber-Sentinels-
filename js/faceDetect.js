// ============================================================
// Face Emotion Detection — face-api.js
// ============================================================

let videoStream = null;
let detectionInterval = null;
let currentEmotion = "neutral";
let currentGender = null;
let currentAge = null;
let onEmotionChangeCallback = null;

const EMOTION_EMOJIS = {
    neutral: "😐",
    happy: "😊",
    sad: "😢",
    angry: "😠",
    disgusted: "🤢",
    surprised: "😲",
    fearful: "😨",
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";

let modelsLoaded = false;

/**
 * Load face-api.js models.
 */
async function loadModels() {
    if (modelsLoaded) return true;

    try {
        // Wait for face-api to be available (loaded via script tag)
        if (typeof faceapi === "undefined") {
            console.error("face-api.js not loaded");
            return false;
        }

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        return true;
    } catch (err) {
        console.error("Failed to load face-api models:", err);
        return false;
    }
}

/**
 * Start webcam and begin face detection.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLCanvasElement} canvasEl
 * @param {function} onEmotionChange - Called with (emotion, emoji)
 */
async function startFaceDetection(videoEl, canvasEl, onEmotionChange) {
    onEmotionChangeCallback = onEmotionChange;

    // Load models
    const loaded = await loadModels();
    if (!loaded) {
        if (onEmotionChange) onEmotionChange("error", "❌");
        return false;
    }

    // Get webcam stream
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 400, height: 300, facingMode: "user" },
            audio: false,
        });
        videoEl.srcObject = videoStream;

        // Wait for video to start playing
        await new Promise((resolve) => {
            videoEl.onloadedmetadata = () => {
                videoEl.play();
                resolve();
            };
        });
    } catch (err) {
        console.error("Webcam access denied:", err);
        if (onEmotionChange) onEmotionChange("error", "❌");
        return false;
    }

    // Set canvas dimensions
    const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
    faceapi.matchDimensions(canvasEl, displaySize);

    // Start detection loop
    detectionInterval = setInterval(async () => {
        try {
            const detections = await faceapi
                .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
                .withFaceExpressions()
                .withAgeAndGender();

            // Clear canvas
            const ctx = canvasEl.getContext("2d");
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

            if (detections) {
                // Draw detection box
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                faceapi.draw.drawDetections(canvasEl, resizedDetections);

                // Get dominant emotion
                const expressions = detections.expressions;
                let maxEmotion = "neutral";
                let maxScore = 0;

                for (const [emotion, score] of Object.entries(expressions)) {
                    if (score > maxScore) {
                        maxScore = score;
                        maxEmotion = emotion;
                    }
                }

                // Capture gender & age
                if (detections.gender) {
                    currentGender = detections.gender; // "male" or "female"
                    currentAge = Math.round(detections.age);
                }

                if (maxEmotion !== currentEmotion) {
                    currentEmotion = maxEmotion;
                    const emoji = EMOTION_EMOJIS[maxEmotion] || "😐";
                    if (onEmotionChangeCallback) {
                        onEmotionChangeCallback(maxEmotion, emoji, currentGender, currentAge);
                    }
                }
            }
        } catch (e) {
            // Detection frame failed, skip
        }
    }, 500); // Detect every 500ms

    return true;
}

/**
 * Stop webcam and detection.
 */
function stopFaceDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
        videoStream = null;
    }
    currentEmotion = "neutral";
    currentGender = null;
    currentAge = null;
}

/**
 * Get current detected emotion.
 */
function getCurrentEmotion() {
    return currentEmotion;
}

/**
 * Get emoji for an emotion.
 */
function getEmotionEmoji(emotion) {
    return EMOTION_EMOJIS[emotion] || "😐";
}

function getCurrentGender() {
    return currentGender;
}

function getCurrentAge() {
    return currentAge;
}

export {
    loadModels,
    startFaceDetection,
    stopFaceDetection,
    getCurrentEmotion,
    getEmotionEmoji,
    getCurrentGender,
    getCurrentAge,
    EMOTION_EMOJIS,
};
