# Curalink — AI Medical Research Assistant

A full-stack MERN application that acts as an intelligent health research companion, combining real-time medical publications, clinical trials, and open-source LLM reasoning.

---

## Architecture Overview

```
User Query
    │
    ▼
Query Expansion (disease + intent + synonyms)
    │
    ├──► PubMed API (100 results via esearch + efetch)
    ├──► OpenAlex API (200 results)
    └──► ClinicalTrials.gov API (50 trials)
         │
         ▼
    Ranking Engine
    (relevance × 0.4 + recency × 0.3 + citations × 0.3)
         │
         ▼
    Top 6-8 Publications + Top 3-5 Trials
         │
         ▼
    Mistral-7B-Instruct (HuggingFace Inference API)
    Structured Prompt → Structured Response
         │
         ▼
    MongoDB (conversation history)
         │
         ▼
    React Frontend (structured display with source attribution)
```

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (conversation history + sessions)
- **LLM**: Mistral-7B-Instruct-v0.2 via HuggingFace Inference API (open-source)
- **Data Sources**: PubMed NCBI, OpenAlex, ClinicalTrials.gov

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)
- HuggingFace account (free API key at huggingface.co)

### 1. Get a HuggingFace API Key (Free)
1. Go to [huggingface.co](https://huggingface.co) → Sign up (free)
2. Settings → Access Tokens → New Token (read permission)
3. Copy the token

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env and add your HuggingFace API key
nano .env

npm install
npm run dev
```

Backend runs on: `http://localhost:5000`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/curalink
PORT=5000
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxx   # Required for LLM
PUBMED_API_KEY=                        # Optional (increases rate limits)
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Main research query endpoint |
| POST | `/api/research` | Alias for /api/chat |
| GET | `/api/sessions/:id/history` | Get conversation history |
| GET | `/api/sessions` | List all sessions |
| DELETE | `/api/sessions/:id` | Clear a session |
| GET | `/api/health` | Health check |

### Example Request
```json
POST /api/chat
{
  "sessionId": "uuid-here",
  "message": "What are the latest treatments for deep brain stimulation?",
  "disease": "Parkinson's disease",
  "patientName": "John Smith",
  "location": "Toronto, Canada"
}
```

---

## Key Design Decisions

### Query Expansion
Instead of searching `"deep brain stimulation"`, the system searches:
- `"deep brain stimulation Parkinson's disease treatment"`
- Disease synonyms are added automatically (15+ diseases mapped)

### Retrieval Pipeline
- **Depth first**: Fetches 100+ PubMed + 200 OpenAlex + 50 clinical trials
- **Precision second**: Ranks by composite score, returns top 6-8 papers + 3-5 trials

### Ranking Formula
```
score = relevance × 0.4 + recency × 0.3 + log(citations+1) × 0.3
```
- Recency: 1.0 = 2024, linear decay to 0 for 10+ year old papers
- Citations: log-normalized from OpenAlex cited_by_count
- Deduplication: Jaccard similarity on titles

### LLM Choice: Mistral-7B-Instruct-v0.2
- Open-source, hosted on HuggingFace (free tier)
- Medical instruction following quality
- Mistral [INST] prompt format
- 3-retry logic for cold starts
- Rule-based fallback if LLM unavailable

### Multi-turn Conversations
- Session IDs stored in localStorage
- Last 5 conversation turns passed to LLM as context
- Follow-up queries automatically inherit disease context

---

## Deployment

### Backend (Render.com - free tier)
```bash
# Add environment variables in Render dashboard
# Build command: npm install
# Start command: npm start
```

### Frontend (Vercel - free)
```bash
# Set VITE_API_URL environment variable to your Render backend URL
npx vercel --prod
```

### Update vite.config.js for production
Change proxy target to your deployed backend URL.
