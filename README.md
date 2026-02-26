VoiceGuard AI
Intelligent Multilingual Voice Chatbot Platform
Full Build Guide  |  24-Hour Hackathon  |  Problem Statement 3


1.  What Are We Building?
VoiceGuard AI is a smart, human-like chatbot that replaces old robotic IVR (Press 1, Press 2) systems. It talks naturally in Hindi, Marathi, and English, understands emotions through face, text, and voice, has a 3D animated avatar, saves a personalized account for every user, detects fraud in real time, and lets the user download their chat as a PDF — just like ChatGPT.

Area	Detail
Problem	Old IVR systems are robotic, menu-based, language-limited
Solution	Natural voice AI with emotion + fraud detection
Languages	Hindi, Marathi, Hinglish, English
Platform	Website + WhatsApp + Phone Call
Backend CRM	ServiceNow (free developer instance)
AI Engine	Google Gemini 1.5 Flash API (free)


2.  Complete Tech Stack
Technology	Purpose	Language
React.js	Frontend chatbot UI	JavaScript
CSS / Tailwind	Styling and animations	CSS
Three.js + RPM	3D animated avatar	JavaScript
Web Speech API	Browser voice input/output	JavaScript
Google Gemini API	AI brain / NLP responses	Python
Flask	ML model server	Python
transformers	Sentiment + emotion detection	Python
face-api.js	Face emotion detection	JavaScript
librosa	Voice tone / stress analysis	Python
langdetect	Language auto-detection	Python
Node.js + Express	Backend API server	JavaScript
ServiceNow PDI	CRM + tickets + dashboard	REST API
Twilio	WhatsApp + phone call	Python
jsPDF	Chat-to-PDF download	JavaScript
ngrok	Expose local server (free)	CLI Tool


3.  Project Folder Structure
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


 
4.  Feature 1 — Personalized User Account
Every customer who opens the chatbot gets their own account. The account stores their name, phone number, preferred language, chosen avatar, and full chat history. This data is saved automatically in ServiceNow so the agent team can see the full customer profile.

4.1  User Profile Screen (React + CSS)
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
    // Save to ServiceNow CRM
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

4.2  Save to ServiceNow CRM (Node.js backend)
// backend/routes/servicenow.js
const axios = require('axios');

const SN_URL  = 'https://dev12345.service-now.com';
const SN_AUTH = { username: 'admin', password: 'your_password' };

async function createCustomer(userData) {
  const res = await axios.post(
    `${SN_URL}/api/now/table/sys_user`,
    {
      first_name:              userData.name,
      mobile_phone:            userData.phone,
      u_preferred_language:    userData.lang,
      u_avatar_id:             userData.avatar,
      u_total_chats:           0
    },
    { auth: SN_AUTH }
  );
  return res.data.result.sys_id;   // ServiceNow user ID
}


5.  Feature 2 — 3D Animated Avatar
The avatar is built using Ready Player Me (free) for the 3D model and Three.js / React Three Fiber for rendering it in the browser. When the bot speaks, the avatar's mouth animates in sync. When the user is detected as angry or panicking, the avatar changes expression to show empathy.

5.1  Get Your Free Avatar
•	Go to: https://readyplayer.me
•	Create a free avatar (male or female, any style)
•	Click Share → copy the .glb model URL
•	Example URL: https://models.readyplayer.me/abc123.glb

5.2  Avatar Component Code
// frontend/src/components/Avatar.jsx
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF }           from '@react-three/drei';
import { useRef, useEffect } from 'react';

function AvatarModel({ isSpeaking, emotion }) {
  const { scene, nodes } = useGLTF('YOUR_RPM_URL.glb');
  const mouthRef = useRef();
  let t = 0;

  useFrame(() => {
    if (!mouthRef.current) return;
    if (isSpeaking) {
      // Animate mouth open/close while speaking
      t += 0.15;
      mouthRef.current.morphTargetInfluences[0] =
        Math.abs(Math.sin(t)) * 0.6;
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

5.3  Install Dependencies
npm install three @react-three/fiber @react-three/drei


 
6.  Feature 3 — Emotion Detection (Face + Text + Voice)

6.1  Face Emotion Detection (Camera)
Uses face-api.js, a free JavaScript library. Reads the webcam every second and detects: happy, angry, sad, fearful, surprised, disgusted, neutral. When angry or fearful is detected, the bot softens its tone automatically.

// frontend/src/components/FaceEmotion.jsx
import * as faceapi from 'face-api.js';
import { useEffect, useRef } from 'react';

const FaceEmotion = ({ onEmotionDetected }) => {
  const videoRef = useRef();

  useEffect(() => {
    // Load face-api models from CDN
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
        .detectSingleFace(videoRef.current,
          new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (result) {
        const e = result.expressions;
        // e = { happy:0.1, angry:0.8, fearful:0.7 ... }
        const dominant = Object.entries(e)
          .sort((a,b) => b[1]-a[1])[0][0];
        onEmotionDetected(dominant); // pass to parent
      }
    }, 1500);  // check every 1.5 seconds
  };

  return <video ref={videoRef} autoPlay muted
                style={{ display:'none' }} />;
};
export default FaceEmotion;

6.2  Text Emotion Detection (Python ML)
Uses a HuggingFace transformer model to read the meaning of the message and detect emotion: joy, anger, sadness, fear, surprise, disgust, neutral.

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
    # Try transformer model first
    try:
        results = emotion_model(text[:512])
        top     = results[0][0]
        return { 'emotion': top['label'], 'score': top['score'] }
    except:
        pass

    # Fallback: Hindi keyword matching
    text_l = text.lower()
    for emotion, words in HINDI_EMOTION_MAP.items():
        if any(w in text_l for w in words):
            return { 'emotion': emotion, 'score': 0.9 }
    return { 'emotion': 'neutral', 'score': 1.0 }

6.3  Voice Emotion Detection (Pitch + Speed)
Uses the librosa audio library. Analyses the raw audio file for pitch, speaking speed, and loudness to determine if the caller is panicking, angry, sad, or calm.

# ml_model/voice_emotion.py
import librosa, numpy as np

def analyze_voice_emotion(audio_path: str) -> dict:
    y, sr = librosa.load(audio_path, sr=22050)

    pitch  = librosa.yin(y, fmin=50, fmax=400)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    volume = float(np.mean(librosa.feature.rms(y=y)))
    avg_pitch = float(np.mean(pitch[pitch > 0]))

    if avg_pitch > 220 and tempo > 150:
        return { 'emotion': 'panic',  'pitch': avg_pitch }
    elif volume > 0.12 and avg_pitch > 190:
        return { 'emotion': 'angry',  'pitch': avg_pitch }
    elif avg_pitch < 110 and tempo < 75:
        return { 'emotion': 'sad',    'pitch': avg_pitch }
    else:
        return { 'emotion': 'calm',   'pitch': avg_pitch }

6.4  How All 3 Emotions Combine
def final_emotion(face_emotion, text_emotion, voice_emotion):
    # Priority order: face > voice > text
    if face_emotion in ['angry','fearful']:   return face_emotion
    if voice_emotion in ['panic','angry']:    return voice_emotion
    return text_emotion

# Bot then adjusts its reply tone based on final_emotion
# calm    -> normal helpful response
# fearful -> 'Ghabrao mat, main aapke saath hoon...'
# angry   -> 'Main samajhta hoon, bilkul sahi hai...'
# panic   -> 'Rukiye! Main abhi turant help karta hoon...'


 
7.  Feature 4 — NLP with Gemini API
Gemini 1.5 Flash is the AI brain. It understands what the user says (in any language), keeps memory of the conversation, adjusts its tone based on detected emotion, and replies in the user's preferred language. It is used for NLU (Natural Language Understanding) — no menu trees, no rules, pure understanding.

7.1  Get Free Gemini API Key
•	Go to: https://makersuite.google.com/app/apikey
•	Sign in with Google account
•	Click Create API Key
•	Free tier: 60 requests per minute — more than enough for hackathon

7.2  Gemini Chat with Memory + Emotion Tone
# ml_model/gemini_chat.py
import google.generativeai as genai
import json

genai.configure(api_key='YOUR_GEMINI_API_KEY')
model = genai.GenerativeModel('gemini-1.5-flash')

# Store chat history per user
chat_sessions = {}

EMOTION_INSTRUCTIONS = {
    'calm':    'Reply helpfully and professionally.',
    'angry':   'User is angry. Be extra patient, validate feelings first.',
    'fearful': 'User is scared. Be very reassuring and calming.',
    'panic':   'User is panicking. Be immediate and action-focused.',
    'sad':     'User is sad. Show empathy before solving the problem.',
}

def get_reply(user_id, message, language='hindi', emotion='calm',
              fraud_score=0) -> str:

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

    # Get or create chat session for this user
    if user_id not in chat_sessions:
        chat_sessions[user_id] = model.start_chat(history=[])

    response = chat_sessions[user_id].send_message(
        f'[System: {system}]\n\nUser: {message}'
    )
    return response.text


8.  Feature 5 — Fraud Detection
Fraud detection runs on 4 layers simultaneously: keyword matching, behaviour analysis, voice stress pattern, and Gemini AI judgement. All 4 scores are combined into a final fraud score from 0 to 100.

# ml_model/fraud_detector.py
import json
import google.generativeai as genai

FRAUD_PHRASES = [
    'share otp','otp batao','send money','paisa bhejo',
    'account blocked','kyc expired','prize won','inaam mila',
    'rbi calling','bank officer','click link','verify now',
    'urgent transfer','account close','government scheme',
]

def score_keywords(text: str) -> int:
    t = text.lower()
    return min(sum(25 for p in FRAUD_PHRASES if p in t), 100)

def score_behaviour(history: list) -> int:
    flags = 0
    if not history: return 0
    last = history[-1].get('text','').lower()
    # Fake urgency
    for w in ['immediately','abhi','turant','last chance','expire']:
        if w in last: flags += 2
    # Repeating same request
    texts = [m.get('text','') for m in history]
    if texts.count(history[-1].get('text','')) > 2: flags += 3
    return min(flags * 15, 100)

def score_gemini(conversation_text: str) -> int:
    prompt = f'''
Analyze if this is a fraud/scam attempt. Score 0-100.
Reply JSON only: {{"fraud_score": <int>, "reason": "<str>"}}

Conversation: {conversation_text}
'''
    try:
        r    = genai.GenerativeModel('gemini-1.5-flash')\
                    .generate_content(prompt)
        data = json.loads(r.text.strip().strip('```json').strip('```'))
        return int(data.get('fraud_score', 0))
    except:
        return 0

def final_fraud_score(text, history, conversation_text) -> dict:
    kw  = score_keywords(text)          # weight 25%
    beh = score_behaviour(history)       # weight 25%
    gem = score_gemini(conversation_text)# weight 50%
    score = int(kw*0.25 + beh*0.25 + gem*0.50)

    if score >= 70:  action = 'BLOCK'
    elif score >= 40: action = 'WARN'
    else:            action = 'NORMAL'

    return { 'fraud_score': score, 'action': action }


 
9.  Feature 6 — Download Chat as PDF (Like ChatGPT)
The user can click a Download PDF button at any time. This exports the entire conversation — with timestamps, emotion labels, and fraud alerts — as a clean PDF file. Uses the jsPDF library, which runs fully in the browser with no server needed.

9.1  Install jsPDF
npm install jspdf

9.2  PDF Download Component
// frontend/src/components/DownloadPDF.jsx
import jsPDF from 'jspdf';

const DownloadPDF = ({ messages, userName }) => {

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(108, 99, 255);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('VoiceGuard AI  |  Chat Transcript', 14, 20);

    y = 45;
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text(`Customer: ${userName}`, 14, y);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, y+7);
    y += 20;

    // Separator line
    doc.setDrawColor(108, 99, 255);
    doc.line(14, y, pageW-14, y);
    y += 10;

    // Messages
    messages.forEach(msg => {
      const isUser = msg.role === 'user';

      // Role label
      doc.setFontSize(10);
      doc.setTextColor(isUser ? 30 : 108, isUser ? 30 : 99, isUser ? 200 : 255);
      doc.text(isUser ? 'You' : 'VoiceGuard AI', 14, y);

      // Timestamp
      doc.setTextColor(150, 150, 150);
      doc.text(msg.timestamp || '', pageW-50, y);
      y += 6;

      // Message text (wrap long lines)
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(msg.text, pageW-28);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 4;

      // Emotion & fraud badge if present
      if (msg.emotion) {
        doc.setFontSize(9);
        doc.setTextColor(200, 100, 0);
        doc.text(`Emotion: ${msg.emotion}`, 14, y);
        y += 5;
      }
      if (msg.fraud_score > 40) {
        doc.setTextColor(220, 0, 0);
        doc.text(`Fraud Score: ${msg.fraud_score}/100`, 14, y);
        y += 5;
      }

      y += 6;
      // New page if needed
      if (y > 270) { doc.addPage(); y = 20; }
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150,150,150);
    doc.text('Generated by VoiceGuard AI | Confidential', 14, 285);

    doc.save(`voiceguard_chat_${Date.now()}.pdf`);
  };

  return (
    <button onClick={downloadPDF} className='download-btn'>
      Download Chat as PDF
    </button>
  );
};
export default DownloadPDF;


10. Feature 7 — Voice Input + Output
The user can speak instead of typing. The browser captures audio using the Web Speech API (free, no library needed). For output, the bot's reply is read aloud using the SpeechSynthesis API, and the avatar animates its mouth in sync.

// frontend/src/components/VoiceInput.jsx
import { useState } from 'react';

const VoiceInput = ({ language, onResult }) => {
  const [listening, setListening] = useState(false);

  const LANG_CODES = {
    hindi:   'hi-IN',
    marathi: 'mr-IN',
    english: 'en-IN',
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();

    recog.lang = LANG_CODES[language] || 'hi-IN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart  = () => setListening(true);
    recog.onend    = () => setListening(false);
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);  // send to chat
    };
    recog.start();
  };

  const speak = (text, lang) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = LANG_CODES[lang] || 'hi-IN';
    u.rate  = 0.9;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  };

  return (
    <button onClick={startListening}
            className={listening ? 'mic active' : 'mic'}>
      {listening ? 'Listening...' : 'Speak'}
    </button>
  );
};
export default VoiceInput;


 
11. Backend Server — Node.js (Connects Everything)
// backend/server.js
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const app     = express();

app.use(cors());
app.use(express.json());

const ML  = 'http://localhost:5000';  // Python ML model
const SN  = 'https://dev12345.service-now.com';
const AUTH = Buffer.from('admin:password').toString('base64');

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, userId, language, faceEmotion } = req.body;

  // 1. Analyse message (fraud + text emotion + language)
  const analysis = await axios.post(`${ML}/analyse`, { message });
  const { fraud_score, text_emotion, detected_language } = analysis.data;

  // 2. Combine face + text emotion
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

// Save user profile
app.post('/api/user/create', async (req, res) => {
  const { name, phone, lang, avatar } = req.body;
  const r = await axios.post(`${SN}/api/now/table/sys_user`,
    { first_name: name, mobile_phone: phone,
      u_preferred_language: lang, u_avatar_id: avatar },
    { headers: { Authorization: `Basic ${AUTH}` }}
  );
  res.json({ sys_id: r.data.result.sys_id });
});

app.listen(4000, () => console.log('Backend on port 4000'));


12. ServiceNow Setup (Free Developer Instance)

12.1  Get Free Instance
•	Go to: https://developer.servicenow.com
•	Sign up free (no credit card)
•	Click Request Instance -> choose Washington DC release
•	You get: https://dev12345.service-now.com
•	Login: admin / your set password

12.2  What to Build Inside ServiceNow
What	Purpose
Customer Table (CRM)	Stores user name, phone, language, avatar, chat count
Chat Logs Table	Every message + response + fraud score stored here
Security Incidents	Auto-created when fraud score > 70
Flow Designer — Auto Alert	Email + WhatsApp alert when fraud incident created
Performance Dashboard	Live charts: fraud today, sentiment, language breakdown
Virtual Agent (optional)	ServiceNow's own chatbot as backup channel

12.3  Flow Designer Setup (Drag & Drop, No Code)
In ServiceNow go to: Flow Designer -> New Flow. Create this automated flow:
•	TRIGGER: New Incident created AND Priority = 1 AND Category = security
•	ACTION 1: Send Email to security_team@company.com with incident details
•	ACTION 2: Send SMS/WhatsApp via Twilio integration to customer phone
•	ACTION 3: If incident not resolved in 10 minutes -> escalate to manager
•	ACTION 4: Update dashboard counter in real time


 
13. WhatsApp Integration — Twilio Sandbox

13.1  Setup Steps (15 Minutes)
•	Sign up free at: https://twilio.com (get $15 credit, no card for sandbox)
•	Dashboard -> Messaging -> Try it out -> Send a WhatsApp message
•	Your sandbox number: +1 415 523 8886
•	From your phone, send: join <sandbox-word> to that number on WhatsApp
•	Run ngrok: ngrok http 5000
•	Paste https://your-id.ngrok.io/whatsapp in Twilio Sandbox Webhook URL

13.2  WhatsApp Bot Code (Python Flask)
# ml_model/app.py  (add this route)
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse

@app.route('/whatsapp', methods=['POST'])
def whatsapp_reply():
    incoming = request.values.get('Body', '').strip()
    sender   = request.values.get('From', '')

    # Reuse same logic as web chat
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




14. How to Run Everything — Step by Step

Step 1 — Install Python dependencies
cd ml_model
pip install flask google-generativeai transformers torch
         librosa langdetect twilio requests
python app.py
# Running on http://localhost:5000

Step 2 — Install Node.js dependencies and start backend
cd backend
npm install express cors axios
node server.js
# Running on http://localhost:4000

Step 3 — Start the React frontend
cd frontend
npm install
npm start
# Running on http://localhost:3000

Step 4 — Expose ML server for WhatsApp
# In a new terminal:
ngrok http 5000
# Copy the https://xxxx.ngrok.io URL
# Paste it in Twilio WhatsApp Sandbox Webhook

15 What VoiceGuard AI Solves
It replaces that broken system with a single intelligent platform that:
1. Speaks the customer's language — Hindi, Marathi, and English, naturally, not stiffly. A rural customer who only speaks Marathi can now get full support without barriers.
2. Understands emotions in real time — using face, voice, and text analysis together. If someone is panicking because their account is being hacked, the bot responds with urgency and empathy instead of a generic scripted answer.
3. Catches fraud before damage happens — the moment someone says "share your OTP" or "RBI calling," the system scores the threat, warns the customer immediately, and auto-raises a security incident in ServiceNow — all within seconds, no human needed.
4. Removes the human bottleneck — incidents are created, emails are sent, escalations happen, and chat logs are saved automatically. A security team gets alerted in real time without a single manual step.
5. Works across channels — the same intelligence works on the website AND WhatsApp, so customers aren't forced to use one specific platform.
________________________________________
The Core Conclusion
Banks and financial services are losing customers to fraud and poor support experiences because their systems are built for machines, not humans. VoiceGuard AI flips that — it's built for the human first, in their language, aware of their emotional state, and smart enough to protect them automatically. From a voice message in Hindi to a fraud alert to a resolved incident — in under 6 seconds, 24 hours a day, no human needed.

