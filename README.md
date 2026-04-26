# Interactive Quiz Application

A full-stack quiz application with 1000+ dynamic questions from the Open Trivia Database. Built with React, FastAPI, and Supabase.

## Features

✨ **Key Features:**
- **Dynamic Questions**: 1000+ questions fetched in real-time from Open Trivia Database API
- **Category Selection**: 15+ categories including Science, History, Sports, Computers, and more
- **Difficulty Levels**: Easy, Medium, Hard, or Mixed
- **Real-Time Feedback**: Instant answer validation with <200ms response time
- **Score Tracking**: Live score counter with per-question timing
- **Persistent Leaderboard**: Rankings stored in Supabase (PostgreSQL)
- **Quiz History**: Session data persisted for analytics
- **Beautiful UI**: Modern glassmorphism design with smooth animations
- **Responsive**: Works on desktop and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, CSS3 (Glassmorphism) |
| **Backend** | Python, FastAPI, Pydantic |
| **Database** | Supabase (PostgreSQL) |
| **External API** | Open Trivia Database |
| **Deployment** | Docker, Docker Compose |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   React UI  │────▶│  FastAPI      │────▶│  Open Trivia DB  │
│   (Vite)    │◀────│  REST API     │     │  (1000+ Qs)      │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Supabase   │
                    │  (PostgreSQL)│
                    │  Leaderboard │
                    │  Quiz History│
                    └──────────────┘
```

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Server runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Supabase Setup (Optional)

The app works without Supabase (uses in-memory storage). To enable persistent data:

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `backend/schema.sql`
3. Copy your project URL and anon key from **Settings → API**
4. Set environment variables:

```bash
export SUPABASE_URL=https://your-project-id.supabase.co
export SUPABASE_KEY=your-anon-public-key
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + DB status |
| GET | `/categories` | Available quiz categories |
| POST | `/quiz/start` | Start new quiz session |
| POST | `/quiz/answer` | Submit answer, get feedback |
| GET | `/quiz/results/{id}` | Get detailed results |
| POST | `/leaderboard/submit` | Submit score to leaderboard |
| GET | `/leaderboard` | Get top scores |

## Project Structure

```
InteractiveQuizApplication/
├── backend/
│   ├── main.py              # FastAPI server + Supabase integration
│   ├── schema.sql           # Supabase table definitions
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React application (4 screens)
│   │   ├── App.css          # Glassmorphism + animations
│   │   ├── main.jsx         # Entry point
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

## License

MIT License
