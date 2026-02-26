# Multilingual AI Avatar Chatbot

24/7 intelligent banking chatbot with 3D avatar, real lip-sync, voice I/O, emotion detection, and multilingual support.

## Features

- **Authentication**: Email/Password, Google OAuth, Mobile OTP
- **Multilingual**: English, Hindi, Marathi — auto-detect & dynamic UI translation
- **3D Avatar**: ReadyPlayerMe model with ARKit blend shape lip-sync
- **Voice**: Speech-to-Text input + Text-to-Speech output with lip-sync
- **Emotion Detection**: Camera-based face expression analysis (face-api.js)
- **AI Chat**: OpenAI GPT integration with context memory
- **WhatsApp**: Cloud API webhook for two-way messaging
- **Real-time**: WebSocket streaming with REST fallback

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start server
npm start
# → http://localhost:3000
```

## Docker

```bash
docker-compose up --build
# → http://localhost:3000
```

## Project Structure

```
├── server/
│   ├── server.js           # Express + WebSocket server
│   ├── routes/
│   │   ├── auth.js         # Email, Google, OTP auth
│   │   ├── chat.js         # OpenAI GPT chat
│   │   └── whatsapp.js     # WhatsApp webhook
│   ├── ws/
│   │   └── chatStream.js   # WebSocket real-time chat
│   ├── models/
│   │   ├── User.js         # MongoDB user model
│   │   └── Session.js      # Chat session model
│   └── middleware/
│       └── auth.js         # JWT middleware
├── public/
│   ├── index.html          # SPA entry point
│   ├── css/styles.css      # Mobile-first navy theme
│   └── js/
│       ├── app.js          # Main controller
│       ├── auth.js         # Frontend auth API client
│       ├── chat.js         # WebSocket chat module
│       ├── avatar.js       # RPM 3D avatar + lip-sync
│       ├── voice.js        # STT + TTS module
│       ├── emotion.js      # Face emotion detection
│       └── i18n.js         # EN/HI/MR translations
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `OPENAI_API_KEY` | OpenAI API key for GPT |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `WHATSAPP_TOKEN` | WhatsApp Business API token |
| `WHATSAPP_PHONE_ID` | WhatsApp phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/signin` | Email/phone login |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/otp/send` | Send OTP |
| POST | `/api/auth/otp/verify` | Verify OTP |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/chat/message` | Send chat message |
| GET | `/api/whatsapp/webhook` | WhatsApp verify |
| POST | `/api/whatsapp/webhook` | WhatsApp messages |
| WS | `/ws` | Real-time chat stream |

## WhatsApp Setup

1. Create Meta Business account → WhatsApp Business API
2. Get permanent token and phone number ID
3. Set webhook URL: `https://your-domain.com/api/whatsapp/webhook`
4. Set verify token to match `WHATSAPP_VERIFY_TOKEN`

## Tech Stack

- **Frontend**: Vanilla JS (ES Modules), Three.js, face-api.js
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: MongoDB (Mongoose)
- **AI**: OpenAI GPT-4o-mini
- **Avatar**: ReadyPlayerMe GLB with ARKit morph targets
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Deployment**: Docker, Docker Compose
