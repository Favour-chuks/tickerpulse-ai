
# Connecting Frontend to Backend

This document outlines how to connect the React frontend to your Fastify/Supabase backend.

## 1. Environment Configuration

Create a `.env` file in the root of your frontend project (if not exists) and configure the API URL.

```env
VITE_API_URL=http://localhost:5000/api/v1
```

**Note:** If your backend runs on a different port or domain, update this value accordingly.

## 2. Authentication Flow

The frontend has been updated to match the backend controller logic:

### Login (`POST /auth/login`)
- **Backend Response:**
  ```json
  {
    "message": "Login successful",
    "user": { "id": "..." },
    "session": { "access_token": "...", "refresh_token": "...", "expires_at": ... }
  }
  ```
- **Frontend Logic:**
  - Extracts `session.access_token` for `localStorage` (`auth_token`).
  - Uses `user.id` to fetch the full profile from `/users/:id` if necessary.

### Google OAuth
1. Frontend calls `GET /auth/google`.
2. Backend returns `{ "url": "https://accounts.google.com/..." }`.
3. Frontend redirects window to this URL.
4. Google redirects to Backend `/auth/callback?code=...`.
5. Backend processes code and redirects to Frontend `/auth-success#access_token=...&user_id=...`.
6. Frontend `AuthCallback` component parses the hash, stores the token, fetches user details, and redirects to Dashboard.

## 3. Gemini Investigation

The "Investigate" button in the Contradictions view now uses `gemini-2.5-flash` via the `validateContradiction` service. 

- **Requirement:** Ensure your `VITE_GEMINI_API_KEY` (or process.env.API_KEY logic) is set correctly in your build environment. The current code uses `process.env.API_KEY`, which usually requires replacement during build or proper Vite env var usage (`import.meta.env.VITE_GEMINI_API_KEY`).

## 4. API Endpoints Contract

Ensure your backend implements the following routes for full functionality:

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/google`
- `GET /users/:id` (To fetch profile details like firstName, lastName after login)
- `PUT /users/me` (Update profile)
- `GET /watchlist`
- `POST /watchlist`
- `PUT /watchlist/:id`
- `DELETE /watchlist/:id`
- `POST /watchlist/:id/items`
- `DELETE /watchlist/:id/items/:symbol`
- `GET /alerts`
- `GET /volume-spikes`
- `POST /analyse` (Chatbot)

## 5. WebSockets

The app attempts to connect to:
- `ws://localhost:5000/ws/alerts`
- `ws://localhost:5000/ws/market`

Ensure your backend handles the Upgrade request for these paths and validates the `token` query parameter.

## 6. Narrative Intelligence Endpoints

These routes feed the Timeline, Contradiction Engine, and Ticker Detail views.

### Get Narratives by Ticker
- **Route:** `GET /narratives/:ticker`
- **Response:** `{ "ticker": "AAPL", "count": 10, "narratives": [...] }`

### Get Timeline
- **Route:** `GET /narratives/:ticker/timeline`
- **Params:** `startDate`, `endDate`, `limit`
- **Response:**
  ```json
  {
    "ticker": "AAPL",
    "period": { "start": "...", "end": "..." },
    "timeline": [
      {
        "position": 1,
        "date": "2024-01-01T...",
        "filing_type": "10-Q",
        "summary": "...",
        "tone": "Cautious",
        "confidence": 8,
        "filing_url": "..."
      }
    ]
  }
  ```

### Get Contradictions
- **Route:** `GET /narratives/:ticker/contradictions`
- **Params:** `severity` (low, medium, high), `limit`
- **Response:**
  ```json
  {
    "ticker": "AAPL",
    "stats": { ... },
    "contradictions": [
      {
        "id": 1,
        "type": "guidance_miss",
        "severity": "high",
        "explanation": "...",
        "detected_at": "...",
        "earlier_statement": { "summary": "..." },
        "later_statement": { "summary": "..." }
      }
    ]
  }
  ```

### Get Latest Narrative
- **Route:** `GET /narratives/:ticker/latest`
- **Response:** Returns the single most recent narrative object including nested `sec_filings` data.

### Compare Narratives
- **Route:** `GET /narratives/:ticker/compare`
- **Params:** `id1`, `id2` (Narrative IDs)
- **Response:**
  ```json
  {
    "ticker": "AAPL",
    "narrative1": { ... },
    "narrative2": { ... },
    "changes": {
      "confidence_delta": -2,
      "tone_changed": true
    }
  }
  ```
