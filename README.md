# VoiceGuard AI
## Intelligent Multilingual Voice Chatbot Platform
### Full Build Guide | 24-Hour Hackathon | Problem Statement 3

---

## 1. PROJECT OVERVIEW

### What Problem Are We Solving?
Traditional bank customer support uses old robotic IVR systems (Press 1, Press 2, Press 3). These systems are:
- Frustrating — they don't understand natural human language
- Language-limited — they don't work in Hindi or Marathi, only formal English
- Emotionally blind — they can't tell if a customer is panicking, angry, or scared
- Slow to detect fraud — by the time a human agent catches a scam call, damage is done
- Not connected — no automatic escalation, no real-time alerts, no audit trail

### What Are We Building?
VoiceGuard AI is a smart, human-like chatbot that:
- Talks naturally in Hindi, Marathi, and English
- Understands emotions through face, text, and voice
- Has a 3D animated avatar
- Saves a personalized account for every user
- Detects fraud in real time
- Lets the user download their chat as a PDF — just like ChatGPT
- Auto-creates security incidents in ServiceNow when fraud is detected

---

## 2. COMPLETE TECH STACK

### Frontend
- React.js — Chatbot UI
- Three.js / React Three Fiber — 3D Avatar rendering
- Ready Player Me — Free 3D avatar models
- face-api.js — Face emotion detection
- Web Speech API — Voice input (speech to text)
- SpeechSynthesis API — Voice output (text to speech)
- jsPDF — PDF download of chat transcript

### Backend
- Node.js + Express — Main backend server
- Axios — API calls to ML model and ServiceNow

### ML Model
- Python Flask — ML server
- Google Gemini 1.5 Flash — AI brain for NLP responses
- HuggingFace Transformers — Text emotion detection
- Librosa — Voice emotion analysis
- LangDetect — Language detection

### Integrations
- ServiceNow — CRM, incident management, chat logs, dashboard
- Twilio — WhatsApp messaging
- Ngrok — Expose local ML server for WhatsApp webhook

---

## 3. PROJECT FOLDER STRUCTURE

```
voiceguard-ai/
  frontend/                   React chatbot UI
    src/
      components/
        ChatWindow.jsx         Main chat interface
        Avatar.jsx             3D animated avatar
        VoiceInput.jsx         Mic + speech-to-text
        FaceEmotion.jsx        Camera face detection
        MessageBubble.jsx      Chat message UI
        UserProfile.jsx        Personalized account
        DownloadPDF.jsx        PDF export button
        LanguageSelector.jsx   Hindi/English/Marathi
      App.jsx
      index.js
  backend/                    Node.js Express server
    server.js                  Main server file
    routes/
      chat.js                  Chat endpoint
      servicenow.js            ServiceNow API
      whatsapp.js              Twilio WhatsApp
  ml_model/                   Python Flask ML server
    app.py                     Main Flask app
    gemini_chat.py             Gemini AI responses
    sentiment.py               Text emotion detection
    fraud_detector.py          Fraud scoring
    voice_emotion.py           Voice tone analysis
    language_detector.py       Language detection
    pdf_generator.py           Server-side PDF
    requirements.txt
  website_embed/              Embeddable widget
    index.html                 Demo website
    chatbot-widget.js          Embed script
```

---

## 4. FEATURE 1 — PERSONALIZED USER ACCOUNT

Every customer gets their own account storing:
- Name and phone number
- Preferred language (Hindi, Marathi, English)
- Chosen 3D avatar
- Full chat history

This data is automatically saved in ServiceNow so the agent team can see the full customer profile.

### User Profile Component (React)
```javascript
// frontend/src/components/UserProfile.jsx
import { useState } from 'react';
const UserProfile = ({ onSave }) => {
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [lang, setLang]     = useState('hindi');
  const [avatar, setAvatar] = useState('avatar_1');

  const avatarOptions = [
    { id: 'avatar_1', url: 'https://models.readyplayer.me/ID1.png' },
    { id: 'avatar_2', url: 'https://models.readyplayer.me/ID2.png' },
    { id: 'avatar_3', url: 'https://models.readyplayer.me/ID3.png' },
  ];

  const saveProfile = async () => {
    await fetch('http://localhost:4000/api/user/create', {
      method: 'POST',
      body: JSON.stringify({ name, phone, lang, avatar })
    });
    onSave({ name, phone, lang, avatar });
  };

  return (
    <div className='profile-setup'>
      <h2>Welcome! Set up your account</h2>
      <input placeholder='Your Name' onChange={e=>setName(e.target.value)} />
      <input placeholder='Phone Number' onChange={e=>setPhone(e.target.value)} />
      <select onChange={e=>setLang(e.target.value)}>
        <option value='hindi'>Hindi</option>
        <option value='marathi'>Marathi</option>
        <option value='english'>English</option>
      </select>
      <div className='avatar-grid'>
        {avatarOptions.map(a => (
          <img key={a.id} src={a.url}
               className={avatar===a.id ? 'selected' : ''}
               onClick={()=>setAvatar(a.id)} />
        ))}
      </div>
      <button onClick={saveProfile}>Start Chatting!</button>
    </div>
  );
};
```

### Save to ServiceNow (Node.js)
```javascript
// backend/routes/servicenow.js
const axios = require('axios');
const SN_URL  = 'https://dev12345.service-now.com';
const SN_AUTH = { username: 'admin', password: 'your_password' };

async function createCustomer(userData) {
  const res = await axios.post(
    `${SN_URL}/api/now/table/sys_user`,
    {
      first_name:           userData.name,
      mobile_phone:         userData.phone,
      u_preferred_language: userData.lang,
      u_avatar_id:          userData.avatar,
      u_total_chats:        0
    },
    { auth: SN_AUTH }
  );
  return res.data.result.sys_id;
}
```

---

## 5. FEATURE 2 — 3D ANIMATED AVATAR

Built using:
- Ready Player Me (free) for the 3D model
- Three.js / React Three Fiber for browser rendering
- Mouth animates in sync when bot speaks
- Avatar changes expression based on detected emotion

### Setup
```bash
npm install three @react-three/fiber @react-three/drei
```

### Get Free Avatar
1. Go to: https://readyplayer.me
2. Create a free avatar
3. Click Share → copy the .glb model URL
4. Example: https://models.readyplayer.me/abc123.glb

### Avatar Component
```javascript
// frontend/src/components/Avatar.jsx
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF }           from '@react-three/drei';
import { useRef }            from 'react';

function AvatarModel({ isSpeaking }) {
  const { scene } = useGLTF('YOUR_RPM_URL.glb');
  const mouthRef  = useRef();
  let t = 0;

  useFrame(() => {
    if (!mouthRef.current) return;
    if (isSpeaking) {
      t += 0.15;
      mouthRef.current.morphTargetInfluences[0] = Math.abs(Math.sin(t)) * 0.6;
    } else {
      mouthRef.current.morphTargetInfluences[0] = 0;
    }
  });

  return <primitive object={scene} scale={1.8} position={[0,-1.5,0]} />;
}

const Avatar = ({ isSpeaking, emotion }) => (
  <Canvas style={{ height: 320, borderRadius: 16 }}
          camera={{ position: [0, 0.5, 3] }}>
    <ambientLight intensity={0.8} />
    <directionalLight position={[2, 2, 2]} intensity={1} />
    <AvatarModel isSpeaking={isSpeaking} emotion={emotion} />
  </Canvas>
);
export default Avatar;
```

---

## 6. FEATURE 3 — EMOTION DETECTION

Three layers of emotion detection working together:

### Layer 1: Face Emotion (Camera)
Uses face-api.js. Reads webcam every 1.5 seconds.
Detects: happy, angry, sad, fearful, surprised, neutral.

```javascript
// frontend/src/components/FaceEmotion.jsx
import * as faceapi from 'face-api.js';
import { useEffect, useRef } from 'react';

const FaceEmotion = ({ onEmotionDetected }) => {
  const videoRef = useRef();

  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models')
    ]).then(startCamera);
  }, []);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    videoRef.current.srcObject = stream;
    setInterval(async () => {
      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      if (result) {
        const dominant = Object.entries(result.expressions)
          .sort((a,b) => b[1]-a[1])[0][0];
        onEmotionDetected(dominant);
      }
    }, 1500);
  };

  return <video ref={videoRef} autoPlay muted style={{ display:'none' }} />;
};
```

### Layer 2: Text Emotion (Python ML)
Uses HuggingFace transformer model.
Detects: joy, anger, sadness, fear, surprise, disgust, neutral.

```python
# ml_model/sentiment.py
from transformers import pipeline
emotion_model = pipeline(
    'text-classification',
    model='j-hartmann/emotion-english-distilroberta-base',
    top_k=3
)

HINDI_EMOTION_MAP = {
    'fear':    ['darr','ghabra','pareshan','bachao','help karo'],
    'anger':   ['gussa','bekar','bakwaas','complaint','galat'],
    'sadness': ['dukh','ro raha','bura laga','nahi hua'],
    'panic':   ['jaldi','abhi','turant','emergency','pls pls'],
}

def detect_text_emotion(text: str) -> dict:
    try:
        results = emotion_model(text[:512])
        top = results[0][0]
        return { 'emotion': top['label'], 'score': top['score'] }
    except:
        pass
    text_l = text.lower()
    for emotion, words in HINDI_EMOTION_MAP.items():
        if any(w in text_l for w in words):
            return { 'emotion': emotion, 'score': 0.9 }
    return { 'emotion': 'neutral', 'score': 1.0 }
```

### Layer 3: Voice Emotion (Pitch + Speed)
Uses librosa audio library.

```python
# ml_model/voice_emotion.py
import librosa, numpy as np

def analyze_voice_emotion(audio_path: str) -> dict:
    y, sr    = librosa.load(audio_path, sr=22050)
    pitch    = librosa.yin(y, fmin=50, fmax=400)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    volume   = float(np.mean(librosa.feature.rms(y=y)))
    avg_pitch = float(np.mean(pitch[pitch > 0]))

    if avg_pitch > 220 and tempo > 150:
        return { 'emotion': 'panic',  'pitch': avg_pitch }
    elif volume > 0.12 and avg_pitch > 190:
        return { 'emotion': 'angry',  'pitch': avg_pitch }
    elif avg_pitch < 110 and tempo < 75:
        return { 'emotion': 'sad',    'pitch': avg_pitch }
    else:
        return { 'emotion': 'calm',   'pitch': avg_pitch }
```

### Final Emotion Combination
```python
def final_emotion(face_emotion, text_emotion, voice_emotion):
    # Priority: face > voice > text
    if face_emotion in ['angry','fearful']:  return face_emotion
    if voice_emotion in ['panic','angry']:   return voice_emotion
    return text_emotion
```

### Bot Response Based on Emotion
- calm    → Normal helpful response
- fearful → "Ghabrao mat, main aapke saath hoon..."
- angry   → "Main samajhta hoon, bilkul sahi hai..."
- panic   → "Rukiye! Main abhi turant help karta hoon..."

---

## 7. FEATURE 4 — NLP WITH GEMINI API

### Get Free API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click Create API Key
4. Free tier: 60 requests per minute

### Gemini Chat with Memory + Emotion Tone
```python
# ml_model/gemini_chat.py
import google.generativeai as genai
genai.configure(api_key='YOUR_GEMINI_API_KEY')
model = genai.GenerativeModel('gemini-1.5-flash')

chat_sessions = {}

EMOTION_INSTRUCTIONS = {
    'calm':    'Reply helpfully and professionally.',
    'angry':   'User is angry. Be extra patient, validate feelings first.',
    'fearful': 'User is scared. Be very reassuring and calming.',
    'panic':   'User is panicking. Be immediate and action-focused.',
    'sad':     'User is sad. Show empathy before solving the problem.',
}

def get_reply(user_id, message, language='hindi', emotion='calm', fraud_score=0) -> str:
    emotion_note = EMOTION_INSTRUCTIONS.get(emotion, '')
    fraud_note   = ('FRAUD DETECTED. Warn the user and alert security.'
                    if fraud_score > 60 else '')
    system = f'''
You are VoiceGuard AI, a warm helpful bank customer support agent.
Reply ONLY in {language}.
Keep replies short (2-3 lines) — suitable for voice reading.
Use natural conversational tone, not corporate language.
{emotion_note}
{fraud_note}
'''
    if user_id not in chat_sessions:
        chat_sessions[user_id] = model.start_chat(history=[])
    response = chat_sessions[user_id].send_message(
        f'[System: {system}]\n\nUser: {message}'
    )
    return response.text
```

---

## 8. FEATURE 5 — FRAUD DETECTION

Four layers of fraud detection:
1. Keyword matching
2. Behaviour analysis
3. Voice stress pattern
4. Gemini AI judgement

Final fraud score: 0 to 100

```python
# ml_model/fraud_detector.py
FRAUD_PHRASES = [
    'share otp','otp batao','send money','paisa bhejo',
    'account blocked','kyc expired','prize won','inaam mila',
    'rbi calling','bank officer','click link','verify now',
    'urgent transfer','account close','government scheme',
]

def final_fraud_score(text, history, conversation_text) -> dict:
    kw  = score_keywords(text)           # weight 25%
    beh = score_behaviour(history)        # weight 25%
    gem = score_gemini(conversation_text) # weight 50%
    score = int(kw*0.25 + beh*0.25 + gem*0.50)

    if score >= 70:   action = 'BLOCK'
    elif score >= 40: action = 'WARN'
    else:             action = 'NORMAL'

    return { 'fraud_score': score, 'action': action }
```

---

## 9. FEATURE 6 — DOWNLOAD CHAT AS PDF

User can click "Download PDF" at any time.
Exports entire conversation with timestamps, emotion labels, and fraud alerts.
Uses jsPDF library — runs fully in the browser, no server needed.

### Install
```bash
npm install jspdf
```

---

## 10. FEATURE 7 — VOICE INPUT + OUTPUT

```javascript
// frontend/src/components/VoiceInput.jsx
const LANG_CODES = {
  hindi:   'hi-IN',
  marathi: 'mr-IN',
  english: 'en-IN',
};

const startListening = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recog = new SpeechRecognition();
  recog.lang           = LANG_CODES[language] || 'hi-IN';
  recog.interimResults = false;
  recog.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    onResult(transcript);
  };
  recog.start();
};

const speak = (text, lang) => {
  const u  = new SpeechSynthesisUtterance(text);
  u.lang   = LANG_CODES[lang] || 'hi-IN';
  u.rate   = 0.9;
  u.pitch  = 1.1;
  window.speechSynthesis.speak(u);
};
```

---

## 11. BACKEND SERVER — NODE.JS

```javascript
// backend/server.js
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const app     = express();
app.use(cors());
app.use(express.json());

const ML   = 'http://localhost:5000';
const SN   = 'https://dev12345.service-now.com';
const AUTH = Buffer.from('admin:password').toString('base64');

app.post('/api/chat', async (req, res) => {
  const { message, userId, language, faceEmotion } = req.body;

  // 1. Analyse message
  const analysis = await axios.post(`${ML}/analyse`, { message });
  const { fraud_score, text_emotion, detected_language } = analysis.data;

  // 2. Combine emotions
  const final_emotion = faceEmotion || text_emotion || 'calm';

  // 3. Get Gemini reply
  const aiRes = await axios.post(`${ML}/chat`, {
    message, language: language || detected_language,
    emotion: final_emotion, fraud_score, user_id: userId
  });
  let reply = aiRes.data.reply;

  // 4. If fraud → create ServiceNow incident
  if (fraud_score > 60) {
    await axios.post(`${SN}/api/now/table/incident`, {
      short_description: `Fraud Detected Score:${fraud_score}`,
      priority: '1', category: 'security',
      description: `User:${userId} | Msg:${message}`
    }, { headers: { Authorization: `Basic ${AUTH}` }});
  }

  // 5. Log chat in ServiceNow
  await axios.post(`${SN}/api/now/table/u_chat_logs`, {
    u_user_id: userId, u_message: message,
    u_response: reply, u_fraud_score: fraud_score,
    u_emotion: final_emotion
  }, { headers: { Authorization: `Basic ${AUTH}` }});

  res.json({ reply, fraud_score, emotion: final_emotion });
});

app.listen(4000, () => console.log('Backend on port 4000'));
```

---

## 12. SERVICENOW SETUP

### Get Free Developer Instance
1. Go to: https://developer.servicenow.com
2. Sign up free (no credit card needed)
3. Click Request Instance → choose Washington DC release
4. You get: https://devXXXXX.service-now.com

### What Was Built in ServiceNow

#### Custom Fields on sys_user Table
| Field | Type | Purpose |
|---|---|---|
| u_preferred_language | String (Choice) | Hindi / Marathi / English |
| u_avatar_id | String | Stores avatar ID |
| u_total_chats | Integer | Chat counter |

#### Custom Table: u_chat_logs
| Column | Type | Purpose |
|---|---|---|
| u_user_id | Reference (sys_user) | Links to customer |
| u_message | Long Text | Customer message |
| u_response | Long Text | AI bot reply |
| u_fraud_score | Integer (0-100) | Fraud risk score |
| u_emotion | Choice | calm/angry/fearful/panic/sad |
| u_channel | String | webchat/whatsapp/voice |
| u_chat_timestamp | DateTime | Time of message |

#### Business Rule (Auto-Created)
- Trigger: New incident inserted with Priority=1, Category=security
- Auto assigns to "Security Team"
- Sets state to "In Progress"
- Adds work note: "Auto-created by VoiceGuard AI fraud detection system"

### Flow Designer — VoiceGuard Fraud Alert Flow
Trigger: New Incident created AND Priority = 1 AND Category = security

Actions:
1. Send Email to security_team@company.com with incident details
2. Send WhatsApp alert to customer mobile number
3. If not resolved in 10 minutes → escalate to manager
4. Update dashboard fraud counter

### Dashboard — VoiceGuard Fraud Monitor
Widgets:
- Fraud Incidents Today (Single Score)
- Open vs Resolved (Pie Chart)
- Conversations by Channel — WebChat vs WhatsApp vs Voice (Bar Chart)
- Average Fraud Score (Single Score)
- Recent Chat Logs (List with emotion, fraud score, timestamp)

---

## 13. WHATSAPP INTEGRATION — TWILIO

### Setup Steps
1. Sign up free at: https://twilio.com (get $15 credit, no card for sandbox)
2. Dashboard → Messaging → Try it out → Send a WhatsApp message
3. Sandbox number: +1 415 523 8886
4. From your phone send: join <sandbox-word> to that number on WhatsApp
5. Run ngrok: `ngrok http 5000`
6. Paste https://your-id.ngrok.io/whatsapp in Twilio Sandbox Webhook URL

### WhatsApp Bot Code
```python
# ml_model/app.py
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse

@app.route('/whatsapp', methods=['POST'])
def whatsapp_reply():
    incoming    = request.values.get('Body', '').strip()
    sender      = request.values.get('From', '')
    analysis    = analyse_message(incoming)
    fraud_score = analysis['fraud_score']
    emotion     = analysis['text_emotion']
    language    = analysis['detected_language']

    bot_reply = get_reply(
        user_id=sender, message=incoming,
        language=language, emotion=emotion,
        fraud_score=fraud_score
    )

    if fraud_score > 60:
        bot_reply += ('\n\n🚨 Security team has been alerted.'
                      ' Ref: INC' + create_incident(sender, incoming))

    resp = MessagingResponse()
    resp.message(bot_reply)
    return str(resp)
```

---

## 14. HOW TO RUN — STEP BY STEP

### Step 1 — Python ML Server
```bash
cd ml_model
pip install flask google-generativeai transformers torch librosa langdetect twilio requests
python app.py
# Running on http://localhost:5000
```

### Step 2 — Node.js Backend
```bash
cd backend
npm install express cors axios
node server.js
# Running on http://localhost:4000
```

### Step 3 — React Frontend
```bash
cd frontend
npm install
npm start
# Running on http://localhost:3000
```

### Step 4 — Expose for WhatsApp
```bash
ngrok http 5000
# Copy https://xxxx.ngrok.io URL
# Paste in Twilio WhatsApp Sandbox Webhook
```

---

## 15. FREE API KEYS & RESOURCES

| Service | Link | Cost |
|---|---|---|
| Gemini AI | https://makersuite.google.com/app/apikey | Free (60 req/min) |
| Ready Player Me | https://readyplayer.me | Free |
| ServiceNow Developer | https://developer.servicenow.com | Free |
| Twilio WhatsApp | https://twilio.com | Free ($15 credit) |
| Ngrok | https://ngrok.com | Free |
| HuggingFace | https://huggingface.co | Free |

---

## 16. DEMO SCRIPT FOR JUDGES (2 Minutes)

1. Open the website. Show chatbot widget on bottom right corner.
2. Say: "Every customer gets a personalized account with their own avatar."
3. Switch language to Hindi. Click the mic and say:
   "Mera account hack ho gaya, koi OTP maang raha hai, jaldi karo"
4. Point out to judges:
   - Bot detected Hindi language automatically
   - Face camera detected fear expression
   - Voice analysis detected panic tone
   - Fraud score jumped to 87/100
   - Bot replied with empathy in Hindi, not a robotic message
   - Avatar mouth animated while speaking
5. Switch to ServiceNow dashboard and show:
   - P1 Security Incident auto-created in real time
   - Email alert sent to security team automatically
   - Customer chat logged with emotion and fraud score
6. Open WhatsApp and send the same message — show it works there too
7. Click Download PDF — show full conversation exported as PDF
8. Close with:
   "From voice in Hindi, to fraud detection, to auto-incident, to PDF export —
    all in under 6 seconds, 24 hours a day, no human needed. That is VoiceGuard AI."

---

## 17. WHY THIS WILL WIN

| Feature | Impact |
|---|---|
| Multilingual (Hindi/Marathi/English) | Reaches rural and semi-urban customers |
| 3-layer emotion detection | No other chatbot does face + voice + text together |
| Real-time fraud detection | Prevents financial loss before it happens |
| ServiceNow auto-incident | Zero manual work for security team |
| Works on WhatsApp | Customers don't need to install any app |
| PDF transcript | Full audit trail like ChatGPT |
| 3D animated avatar | Most visually impressive demo in the room |

---

## 18. CONCLUSION

Banks and financial services are losing customers to fraud and poor support experiences
because their systems are built for machines, not humans.

VoiceGuard AI flips that — it is built for the human first, in their language,
aware of their emotional state, and smart enough to protect them automatically.

From a voice message in Hindi, to fraud detection, to a resolved incident in ServiceNow,
to a PDF export — all in under 6 seconds, 24 hours a day, no human needed.

That is VoiceGuard AI.

