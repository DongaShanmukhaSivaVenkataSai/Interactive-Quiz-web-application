from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from dotenv import load_dotenv
from gotrue.errors import AuthApiError
import httpx
import html
import uuid
import random
import os
import logging
from datetime import datetime

# Load env
load_dotenv("variables.env")

# ─── Supabase Setup ─────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Connected to Supabase")

# ─── App Setup ───────────────────────────────────────────────────────
app = FastAPI(title="Quiz API with Supabase Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

sessions: Dict[str, dict] = {}

TRIVIA_API_URL = "https://opentdb.com/api.php"
CATEGORIES_API_URL = "https://opentdb.com/api_category.php"

# ─── Models ─────────────────────────────────────────────────────────
class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    username: str = ""


class QuizConfig(BaseModel):
    amount: int = 10
    category: Optional[int] = None
    difficulty: Optional[str] = None
    question_type: Optional[str] = None
    player_name: str = "Anonymous"


class AnswerSubmission(BaseModel):
    session_id: str
    question_index: int
    selected_answer: str


class LeaderboardEntry(BaseModel):
    session_id: str
    player_name: str


# ─── Auth Helpers ───────────────────────────────────────────────────
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None

    token = credentials.credentials

    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── Auth Routes ────────────────────────────────────────────────────
@app.post("/signup")
async def signup(request: SignupRequest):
    try:
        # Sign up the user
        res = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "username": request.username or request.email.split("@")[0]
                }
            }
        })

        if res.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")

        # Check if email confirmation is required
        # If session is None, email confirmation is pending
        if res.session is None:
            return {
                "confirm_email": True,
                "message": "Signup successful! Please check your email to confirm your account, then log in.",
                "email": request.email
            }

        # If email confirmation is disabled, session is returned directly
        username = request.username or request.email.split("@")[0]
        return {
            "access_token": res.session.access_token,
            "username": username,
            "email": request.email,
            "message": "Signup successful"
        }

    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login")
async def login(request: AuthRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        # Extract username from user metadata or use email prefix
        username = request.email.split("@")[0]
        if res.user and res.user.user_metadata:
            username = res.user.user_metadata.get("username", username)

        return {
            "access_token": res.session.access_token,
            "username": username,
            "email": res.user.email
        }

    except AuthApiError:
        raise HTTPException(status_code=401, detail="Invalid email or password")


# ─── Profile Route ──────────────────────────────────────────────────
@app.get("/me")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        user_resp = supabase.auth.get_user(credentials.credentials)
        user = user_resp.user
        username = user.email.split("@")[0]
        if user.user_metadata:
            username = user.user_metadata.get("username", username)

        return {
            "username": username,
            "email": user.email
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── Categories Route ───────────────────────────────────────────────
@app.get("/categories")
async def get_categories():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(CATEGORIES_API_URL)
            data = resp.json()
        # Transform to simpler format
        categories = [
            {"id": c["id"], "name": c["name"]}
            for c in data.get("trivia_categories", [])
        ]
        return {"categories": categories}
    except Exception:
        return {"categories": []}


# ─── Helpers ────────────────────────────────────────────────────────
def decode_questions(raw_questions: list) -> list:
    decoded = []
    for q in raw_questions:
        correct = html.unescape(q["correct_answer"])
        incorrect = [html.unescape(a) for a in q["incorrect_answers"]]
        options = incorrect + [correct]
        random.shuffle(options)
        decoded.append({
            "question": html.unescape(q["question"]),
            "category": html.unescape(q["category"]),
            "difficulty": q["difficulty"],
            "type": q["type"],
            "options": options,
            "correct_answer": correct,
        })
    return decoded


# ─── Quiz Routes ────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "active_sessions": len(sessions),
    }


@app.post("/quiz/start")
async def start_quiz(config: QuizConfig, user=Depends(get_current_user)):
    params = {"amount": min(config.amount, 50)}
    if config.category:
        params["category"] = config.category
    if config.difficulty:
        params["difficulty"] = config.difficulty
    if config.question_type:
        params["type"] = config.question_type

    async with httpx.AsyncClient() as client:
        resp = await client.get(TRIVIA_API_URL, params=params)
        data = resp.json()

    if data.get("response_code") != 0 or not data.get("results"):
        raise HTTPException(status_code=400, detail="Could not fetch questions. Try different settings.")

    questions = decode_questions(data["results"])
    session_id = str(uuid.uuid4())

    # Use email from authenticated user or fallback to player_name
    player_name = config.player_name
    if user:
        email = user.email
        username = email.split("@")[0]
        if user.user_metadata:
            username = user.user_metadata.get("username", username)
        player_name = username

    sessions[session_id] = {
        "player_name": player_name,
        "questions": questions,
        "answers": [None] * len(questions),
        "score": 0,
        "started_at": datetime.now().isoformat(),
        "total": len(questions),
    }

    # Include category and difficulty in safe_questions for frontend display
    safe_questions = [
        {
            "question": q["question"],
            "options": q["options"],
            "category": q["category"],
            "difficulty": q["difficulty"],
        }
        for q in questions
    ]

    return {
        "session_id": session_id,
        "questions": safe_questions,
        "total": len(questions),
    }


@app.post("/quiz/answer")
async def submit_answer(submission: AnswerSubmission):
    session = sessions.get(submission.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if submission.question_index < 0 or submission.question_index >= len(session["questions"]):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = session["questions"][submission.question_index]
    is_correct = submission.selected_answer == question["correct_answer"]

    if session["answers"][submission.question_index] is None:
        session["answers"][submission.question_index] = is_correct
        if is_correct:
            session["score"] += 1

    return {
        "correct": is_correct,
        "correct_answer": question["correct_answer"],
        "current_score": session["score"],
    }


@app.get("/quiz/results/{session_id}")
async def get_results(session_id: str):
    session = sessions.get(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    score = session["score"]
    total = session["total"]
    percentage = round((score / total) * 100, 1) if total > 0 else 0

    return {
        "player_name": session["player_name"],
        "score": score,
        "total": total,
        "percentage": percentage,
    }


# ─── Leaderboard Routes ────────────────────────────────────────────
@app.get("/leaderboard")
async def get_leaderboard():
    try:
        result = (
            supabase.table("leaderboard")
            .select("*")
            .order("percentage", desc=True)
            .order("score", desc=True)
            .limit(50)
            .execute()
        )
        return {"leaderboard": result.data or []}
    except Exception:
        return {"leaderboard": []}


@app.post("/leaderboard/submit")
async def submit_to_leaderboard(entry: LeaderboardEntry):
    session = sessions.get(entry.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    score = session["score"]
    total = session["total"]

    data = {
        "player_name": entry.player_name or session["player_name"],
        "score": score,
        "total": total,
        "percentage": round((score / total) * 100, 1) if total > 0 else 0,
        "played_at": datetime.now().isoformat()
    }

    supabase.table("leaderboard").insert(data).execute()

    return {"message": "Saved to leaderboard"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
