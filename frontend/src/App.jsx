import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:8000';

/* ════════════════════════════════════════════════════════════
   Main App – routes between screens via state machine
   ════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState('auth');
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState({ amount: 10, category: null, difficulty: null, question_type: 'multiple', player_name: '' });
  const [session, setSession] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [results, setResults] = useState(null);

  // Auth state
  const [token, setToken] = useState(localStorage.getItem('quiz_token') || '');
  const [user, setUser] = useState(null);

  // Check auth on mount
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
    fetch(`${API_URL}/categories`).then(r => r.json()).then(d => setCategories(d.categories)).catch(() => {});
  }, []);

  // Timer
  useEffect(() => {
    if (screen !== 'quiz' || feedback) return;
    const id = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [screen, feedback, currentQ]);

  // ── Auth helpers ──────────────────────────────────────────
  const authHeaders = () => token ? { 'Authorization': `Bearer ${token}` } : {};

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/me`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setConfig(c => ({ ...c, player_name: data.username }));
        setScreen('home');
      } else {
        logout();
      }
    } catch { logout(); }
  };

  const [authSuccess, setAuthSuccess] = useState('');

  const handleAuth = async (endpoint, body) => {
    setLoading(true);
    setError('');
    setAuthSuccess('');
    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auth failed');

      // If email confirmation is required, show message and switch to login
      if (data.confirm_email) {
        setAuthSuccess(data.message || 'Signup successful! Check your email to confirm, then log in.');
        return;
      }

      setToken(data.access_token);
      localStorage.setItem('quiz_token', data.access_token);
      setUser({ username: data.username, email: data.email });
      setConfig(c => ({ ...c, player_name: data.username }));
      setScreen('home');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('quiz_token');
    setScreen('auth');
  };

  // ── Start Quiz ────────────────────────────────────────────
  const startQuiz = async () => {
    if (!config.player_name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(config),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      const data = await res.json();
      setSession(data);
      setCurrentQ(0);
      setScore(0);
      setAnswers([]);
      setFeedback(null);
      setTimer(0);
      setScreen('quiz');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Submit Answer ─────────────────────────────────────────
  const submitAnswer = async (option) => {
    if (feedback) return;
    try {
      const res = await fetch(`${API_URL}/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id, question_index: currentQ, selected_answer: option }),
      });
      const data = await res.json();
      setFeedback({ correct: data.correct, correct_answer: data.correct_answer });
      setScore(data.current_score);
      setAnswers(prev => [...prev, { selected: option, correct: data.correct, correct_answer: data.correct_answer }]);
    } catch (e) { setError('Failed to submit answer'); }
  };

  // ── Next / Finish ─────────────────────────────────────────
  const nextQuestion = () => {
    const total = session.total || session.questions.length;
    if (currentQ + 1 >= total) { finishQuiz(); }
    else { setCurrentQ(q => q + 1); setFeedback(null); setTimer(0); }
  };

  const finishQuiz = async () => {
    try {
      const res = await fetch(`${API_URL}/quiz/results/${session.session_id}`);
      const data = await res.json();
      setResults(data);
      await fetch(`${API_URL}/leaderboard/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id, player_name: config.player_name }),
      });
      setScreen('results');
    } catch { setScreen('results'); }
  };

  // ── Leaderboard ───────────────────────────────────────────
  const showLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch { setLeaderboard([]); }
    setScreen('leaderboard');
  };

  const goHome = () => { setScreen('home'); setSession(null); setResults(null); setFeedback(null); setError(''); };

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="app">
      <div className="bg-orbs"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>

      {screen === 'auth' && <AuthScreen handleAuth={handleAuth} loading={loading} error={error} setError={setError} authSuccess={authSuccess} setAuthSuccess={setAuthSuccess} />}

      {screen === 'home' && <HomeScreen config={config} setConfig={setConfig} categories={categories}
        startQuiz={startQuiz} showLeaderboard={showLeaderboard} loading={loading} error={error} user={user} logout={logout} />}

      {screen === 'quiz' && session && <QuizScreen session={session} currentQ={currentQ} score={score}
        feedback={feedback} timer={timer} submitAnswer={submitAnswer} nextQuestion={nextQuestion} />}

      {screen === 'results' && <ResultsScreen results={results} score={score} total={session?.total || session?.questions?.length}
        goHome={goHome} showLeaderboard={showLeaderboard} />}

      {screen === 'leaderboard' && <LeaderboardScreen leaderboard={leaderboard} goHome={goHome} />}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   AUTH SCREEN (Login / Signup)
   ════════════════════════════════════════════════════════════ */
function AuthScreen({ handleAuth, loading, error, setError, authSuccess, setAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (isLogin) {
      if (!form.email || !form.password) { setError('Email and password required'); return; }
      handleAuth('login', { email: form.email, password: form.password });
    } else {
      if (!form.username || !form.email || !form.password) { setError('All fields required'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      handleAuth('signup', form);
    }
  };

  const toggleMode = () => { setIsLogin(!isLogin); setError(''); setAuthSuccess(''); };

  return (
    <div className="screen auth-screen fade-in">
      <div className="hero">
        <div className="logo-icon">🧠</div>
        <h1>QuizMaster<span className="dot">.</span></h1>
        <p className="tagline">Challenge yourself with 1000+ questions across categories</p>
      </div>

      <div className="auth-card glass">
        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>Login</button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <label>Username</label>
              <input type="text" placeholder="Choose a username..." value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} maxLength={20} />
            </div>
          )}

          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="your@email.com" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>

          {authSuccess && <div className="success-msg">{authSuccess}</div>}
          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary btn-glow" disabled={loading}>
            {loading ? <span className="spinner" /> : (isLogin ? '🔐' : '🚀')}
            {loading ? 'Please wait...' : (isLogin ? ' Login' : ' Create Account')}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button className="link-btn" onClick={toggleMode}>{isLogin ? 'Sign Up' : 'Login'}</button>
        </p>
      </div>

      <p className="footer-note">Powered by Open Trivia Database • Built with React, FastAPI & Supabase</p>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   HOME SCREEN
   ════════════════════════════════════════════════════════════ */
function HomeScreen({ config, setConfig, categories, startQuiz, showLeaderboard, loading, error, user, logout }) {
  return (
    <div className="screen home-screen fade-in">
      <div className="hero">
        <div className="logo-icon">🧠</div>
        <h1>QuizMaster<span className="dot">.</span></h1>
        {user && (
          <div className="user-bar">
            <span className="user-greeting">Welcome, <strong>{user.username}</strong></span>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        )}
      </div>

      <div className="config-card glass">
        <div className="input-row">
          <div className="input-group">
            <label>Category</label>
            <select value={config.category || ''} onChange={e => setConfig({ ...config, category: e.target.value ? parseInt(e.target.value) : null })}>
              <option value="">Any Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Difficulty</label>
            <select value={config.difficulty || ''} onChange={e => setConfig({ ...config, difficulty: e.target.value || null })}>
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Questions</label>
            <select value={config.amount} onChange={e => setConfig({ ...config, amount: parseInt(e.target.value) })}>
              {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} Questions</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Type</label>
            <select value={config.question_type || ''} onChange={e => setConfig({ ...config, question_type: e.target.value || null })}>
              <option value="multiple">Multiple Choice</option>
              <option value="boolean">True / False</option>
            </select>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button className="btn-primary btn-glow" onClick={startQuiz} disabled={loading}>
          {loading ? <span className="spinner" /> : '🚀'} {loading ? 'Loading...' : 'Start Quiz'}
        </button>

        <button className="btn-secondary" onClick={showLeaderboard}>🏆 Leaderboard</button>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   QUIZ SCREEN
   ════════════════════════════════════════════════════════════ */
function QuizScreen({ session, currentQ, score, feedback, timer, submitAnswer, nextQuestion }) {
  const q = session.questions[currentQ];
  const total = session.total || session.questions.length;
  const progress = ((currentQ + (feedback ? 1 : 0)) / total) * 100;
  const diffColor = { easy: '#4ade80', medium: '#fbbf24', hard: '#f87171' };

  return (
    <div className="screen quiz-screen fade-in">
      <div className="quiz-top glass">
        <div className="quiz-stats">
          <div className="stat"><span className="stat-label">Score</span><span className="stat-value">{score}</span></div>
          <div className="stat"><span className="stat-label">Question</span><span className="stat-value">{currentQ + 1}/{total}</span></div>
          <div className="stat"><span className="stat-label">Time</span><span className="stat-value">{timer}s</span></div>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="question-card glass" key={currentQ}>
        <div className="q-meta">
          <span className="q-category">{q.category}</span>
          <span className="q-difficulty" style={{ background: diffColor[q.difficulty] || '#a78bfa' }}>{q.difficulty}</span>
        </div>
        <h2 className="q-text">{q.question}</h2>

        <div className="options-grid">
          {q.options.map((opt, i) => {
            let cls = 'option-btn';
            if (feedback) {
              if (opt === feedback.correct_answer) cls += ' correct';
              else if (opt !== feedback.correct_answer && i === q.options.indexOf(opt)) cls += '';
            }
            return (
              <button key={i} className={cls} onClick={() => submitAnswer(opt)} disabled={!!feedback}>
                <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                <span className="opt-text">{opt}</span>
                {feedback && opt === feedback.correct_answer && <span className="opt-icon">✓</span>}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className={`feedback-banner ${feedback.correct ? 'fb-correct' : 'fb-wrong'}`}>
            <span>{feedback.correct ? '🎉 Correct!' : `❌ Wrong! Answer: ${feedback.correct_answer}`}</span>
            <button className="btn-next" onClick={nextQuestion}>
              {currentQ + 1 >= total ? '📊 See Results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   RESULTS SCREEN
   ════════════════════════════════════════════════════════════ */
function ResultsScreen({ results, score, total, goHome, showLeaderboard }) {
  const pct = results ? results.percentage : (total ? Math.round((score / total) * 100) : 0);
  const grade = pct >= 90 ? 'S' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  const gradeColor = { S: '#a78bfa', A: '#4ade80', B: '#34d399', C: '#fbbf24', D: '#fb923c', F: '#f87171' };
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👏' : pct >= 40 ? '📚' : '💪';

  return (
    <div className="screen results-screen fade-in">
      <div className="results-card glass">
        <div className="results-hero">
          <div className="big-emoji">{emoji}</div>
          <h1>Quiz Complete!</h1>
          <div className="grade-badge" style={{ background: gradeColor[grade] }}>{grade}</div>
        </div>

        <div className="results-stats">
          <div className="r-stat"><span className="r-num">{results?.score ?? score}</span><span className="r-label">Correct</span></div>
          <div className="r-stat"><span className="r-num">{results?.total ?? total}</span><span className="r-label">Total</span></div>
          <div className="r-stat"><span className="r-num">{pct}%</span><span className="r-label">Score</span></div>
        </div>

        {results?.results && (
          <div className="results-detail">
            <h3>Question Breakdown</h3>
            <div className="results-list">
              {results.results.map((r, i) => (
                <div key={i} className={`result-item ${r.is_correct ? 'ri-correct' : 'ri-wrong'}`}>
                  <span className="ri-num">Q{i + 1}</span>
                  <span className="ri-text">{r.question}</span>
                  <span className="ri-icon">{r.is_correct ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="results-actions">
          <button className="btn-primary" onClick={goHome}>🔄 Play Again</button>
          <button className="btn-secondary" onClick={showLeaderboard}>🏆 Leaderboard</button>
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   LEADERBOARD SCREEN
   ════════════════════════════════════════════════════════════ */
function LeaderboardScreen({ leaderboard, goHome }) {
  return (
    <div className="screen leaderboard-screen fade-in">
      <div className="lb-card glass">
        <h1>🏆 Leaderboard</h1>
        {leaderboard.length === 0 ? (
          <p className="empty-state">No scores yet. Be the first!</p>
        ) : (
          <div className="lb-table">
            <div className="lb-header">
              <span>Rank</span><span>Player</span><span>Score</span><span>%</span><span>Difficulty</span>
            </div>
            {leaderboard.map((entry, i) => (
              <div key={i} className={`lb-row ${i < 3 ? `lb-top-${i + 1}` : ''}`}>
                <span className="lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <span className="lb-name">{entry.player_name}</span>
                <span>{entry.score}/{entry.total}</span>
                <span className="lb-pct">{entry.percentage}%</span>
                <span className="lb-diff">{entry.difficulty || 'mixed'}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn-primary" onClick={goHome}>← Back to Home</button>
      </div>
    </div>
  );
}
