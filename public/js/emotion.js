// ============================================================
// Emotion Detection — face-api.js
// Detects: happy, sad, angry, surprised, neutral
// ============================================================

let videoStream = null;
let detectionInterval = null;
let currentEmotion = "neutral";
let onDetectCallback = null;

const EMOTION_EMOJIS = {
    neutral: "😐", happy: "😊", sad: "😢", angry: "😠",
    surprised: "😲", disgusted: "🤢", fearful: "😨",
};

async function loadModels() {
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
    ]);
    console.log("✅ Face-api models loaded");
}

async function startEmotionDetection(videoEl, canvasEl, onDetect) {
    onDetectCallback = onDetect;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
        videoEl.srcObject = videoStream;
        await videoEl.play();
    } catch (err) {
        console.error("Camera error:", err);
        onDetect?.("error", "❌", null, null);
        return false;
    }

    await loadModels();

    detectionInterval = setInterval(async () => {
        try {
            const detections = await faceapi
                .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
                .withFaceExpressions()
                .withAgeAndGender();

            if (!detections) return;

            // Draw
            if (canvasEl) {
                const dims = faceapi.matchDimensions(canvasEl, videoEl, true);
                const resized = faceapi.resizeResults(detections, dims);
                canvasEl.getContext("2d").clearRect(0, 0, canvasEl.width, canvasEl.height);
                faceapi.draw.drawDetections(canvasEl, resized);
            }

            // Get dominant emotion
            const expressions = detections.expressions;
            const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
            currentEmotion = sorted[0][0];
            const emoji = EMOTION_EMOJIS[currentEmotion] || "😐";
            const gender = detections.gender;
            const age = Math.round(detections.age);

            onDetectCallback?.(currentEmotion, emoji, gender, age);
        } catch { }
    }, 800);

    return true;
}

function stopEmotionDetection() {
    if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
    currentEmotion = "neutral";
}

function getCurrentEmotion() { return currentEmotion; }
function getEmotionEmoji(e) { return EMOTION_EMOJIS[e] || "😐"; }

export { startEmotionDetection, stopEmotionDetection, getCurrentEmotion, getEmotionEmoji };
