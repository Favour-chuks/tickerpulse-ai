
# TickerPulse API Specification

This document outlines the communication contract between the Frontend (`src/shared/services/api.ts`) and the Backend.

**Base URL:** `http://localhost:5000/api/v1`

---

## 1. Authentication & User Management

### Login
*   **Frontend Method:** `api.auth.login(email, password)`
*   **Backend Route:** `POST /auth/login`
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "securePassword123"
    }
    ```
*   **Response JSON:**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "usr_123456789",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      }
    }
    ```

### Register
*   **Frontend Method:** `api.auth.register(email, password, firstName, lastName)`
*   **Backend Route:** `POST /auth/register`
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "securePassword123",
      "firstName": "John",
      "lastName": "Doe"
    }
    ```
*   **Response JSON:** (Same as Login)

### Update Profile
*   **Frontend Method:** `api.auth.updateProfile(data)`
*   **Backend Route:** `PUT /users/me`
*   **Request Body:**
    ```json
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "avatarUrl": "...",
      "password": "newPassword", 
      "currentPassword": "oldPassword" // Required if changing sensitive data
    }
    ```
*   **Response JSON:**
    ```json
    {
      "success": true,
      "user": { ...updatedUserObject }
    }
    ```

### Delete Account
*   **Frontend Method:** `api.auth.deleteAccount(password)`
*   **Backend Route:** `DELETE /users/me`
*   **Request Body:**
    ```json
    {
      "password": "currentPasswordForConfirmation"
    }
    ```
*   **Response JSON:**
    ```json
    { "success": true }
    ```

---

## 2. Watchlists

### Get All Watchlists
*   **Frontend Method:** `api.watchlist.getAll()`
*   **Backend Route:** `GET /watchlist`
*   **Response JSON:**
    ```json
    {
      "count": 2,
      "watchlists": [
        {
          "id": "wl_1",
          "name": "Semiconductors",
          "created_at": "2024-01-15T10:00:00Z"
        },
        {
          "id": "wl_2",
          "name": "High Beta",
          "created_at": "2024-01-20T14:30:00Z"
        }
      ]
    }
    ```

### Create Watchlist
*   **Frontend Method:** `api.watchlist.create(name)`
*   **Backend Route:** `POST /watchlist`
*   **Response JSON:**
    ```json
    {
      "id": "wl_3",
      "name": "New List",
      "created_at": "2024-02-01T09:00:00Z",
      "items": []
    }
    ```

### Update Watchlist
*   **Frontend Method:** `api.watchlist.update(id, name)`
*   **Backend Route:** `PUT /watchlist/:id`
*   **Response JSON:** (Returns the updated watchlist object)

### Delete Watchlist
*   **Frontend Method:** `api.watchlist.delete(id)`
*   **Backend Route:** `DELETE /watchlist/:id`
*   **Response JSON:** `{ "success": true }`

### Get Watchlist Items
*   **Frontend Method:** `api.watchlist.getItems(id)`
*   **Backend Route:** `GET /watchlist/:id/items`
*   **Response JSON:**
    ```json
    {
      "tickers": [
        {
          "id": 101,
          "symbol": "NVDA",
          "companyName": "NVIDIA Corporation",
          "sector": "Technology"
        },
        {
          "id": 102,
          "symbol": "AMD",
          "companyName": "Advanced Micro Devices",
          "sector": "Technology"
        }
      ]
    }
    ```

### Add Item to Watchlist
*   **Frontend Method:** `api.watchlist.addItem(id, symbol)`
*   **Backend Route:** `POST /watchlist/:id/items`
*   **Request Body:** `{ "symbol": "TSLA" }`
*   **Response JSON:** `{ "success": true }`

### Remove Item
*   **Frontend Method:** `api.watchlist.removeItem(id, symbol)`
*   **Backend Route:** `DELETE /watchlist/:id/items/:symbol`
*   **Response JSON:** `{ "success": true }`

---

## 3. Alerts & Signals

### Get Recent Alerts
*   **Frontend Method:** `api.alerts.getRecent()`
*   **Backend Route:** `GET /alerts?limit=20`
*   **Response JSON:**
    ```json
    {
      "alerts": [
        {
          "id": "alt_55",
          "symbol": "GME",
          "message": "Sudden localized volatility detected in dark pool routing.",
          "priority": "high",  // Options: 'low' | 'medium' | 'high' | 'critical'
          "alert_type": "spike", // Options: 'spike' | 'contradiction' | 'narrative'
          "created_at": "2024-02-10T11:22:33Z"
        }
      ]
    }
    ```

### Dismiss Alert
*   **Frontend Method:** `api.alerts.dismiss(id)`
*   **Backend Route:** `DELETE /alerts/:id`
*   **Response JSON:** `{ "success": true }`

### Get Volume Spikes (Dashboard Feed)
*   **Frontend Method:** `api.market.getSpikes()`
*   **Backend Route:** `GET /volume-spikes`
*   **Response JSON:**
    ```json
    {
      "spikes": [
        {
          "id": 1,
          "tickerSymbol": "NVDA",
          "detectedAt": "10:45 AM",
          "volume": 15400000,
          "deviationMultiple": 4.2, // 4.2x average volume
          "zScore": 3.8,
          "priceAtSpike": 142.30,
          "priceChangePercent": 2.1,
          "severity": "critical",
          "hasCatalyst": false // True if news/earnings exist
        }
      ]
    }
    ```

---

## 4. Market Data & Intelligence

### Search Tickers
*   **Frontend Method:** `api.market.search(query)`
*   **Backend Route:** `GET /market/search?q=QUERY`
*   **Response JSON:**
    ```json
    [
      { "id": 1, "symbol": "AAPL", "companyName": "Apple Inc.", "sector": "Technology" },
      { "id": 5, "symbol": "ABNB", "companyName": "Airbnb Inc.", "sector": "Consumer Cyclical" }
    ]
    ```

### Get Chart Data
*   **Frontend Method:** `api.market.getData(symbol)`
*   **Backend Route:** `GET /market/data/:symbol`
*   **Response JSON:**
    ```json
    [
      { "time": "09:30:00", "close": 150.00, "volume": 5000 },
      { "time": "09:45:00", "close": 152.50, "volume": 12000 },
      // ... array of data points
    ]
    ```

### Get Narratives (Timeline)
*   **Frontend Method:** `api.narratives.getAll()`
*   **Backend Route:** `GET /narratives`
*   **Response JSON:**
    ```json
    [
      {
        "id": 1,
        "tickerSymbol": "AAPL",
        "filingType": "10-Q",
        "filedAt": "2025-05-15",
        "summary": "Focus shifted from hardware margins to ecosystem services.",
        "toneShift": "Cautiously Bullish",
        "managementConfidence": 8, // Scale 1-10
        "keyChanges": ["CapEx +12%", "R&D tripled"]
      }
    ]
    ```

### Get Contradictions
*   **Frontend Method:** `api.narratives.getContradictions(symbol)`
*   **Backend Route:** `GET /narratives/:symbol/contradictions`
*   **Response JSON:**
    ```json
    [
      {
        "id": 202,
        "tickerSymbol": "TSLA",
        "contradiction_type": "guidance_miss",
        "explanation": "Management committed to 2025 rollout but delayed in press release.",
        "severity": "critical",
        "quote_1": "Production on track for early 2025.", // Original
        "quote_2": "Re-evaluating timeline for entry-level platforms.", // New
        "detected_at": "2024-02-12T08:00:00Z",
        "market_trend_before": "bullish",
        "market_trend_after": "bearish",
        "price_impact": -4.2,
        "volume_impact": 2.5,
        "gemini_confidence": 0.92,
        "is_validated": false
      }
    ]
    ```

### Get Promises (Guidance Ledger)
*   **Frontend Method:** `api.narratives.getPromises(symbol)`
*   **Backend Route:** `GET /narratives/:symbol/promises`
*   **Response JSON:**
    ```json
    [
      {
        "id": 5,
        "promise_text": "Release v2 by Q3",
        "promise_date": "2024-01-01",
        "status": "broken", // 'kept' | 'broken' | 'pending'
        "verification_notes": "Delayed to 2025 per Q3 earnings call."
      }
    ]
    ```

---

## 5. AI & Chat

### Chat with Narrative Engine
*   **Frontend Method:** `api.analyse.sendMessage(message, history)`
*   **Backend Route:** `POST /analyse`
*   **Request Body:**
    ```json
    {
      "message": "Why is NVDA dropping today?",
      "conversation_history": [
        { "role": "user", "text": "Hi" },
        { "role": "model", "text": "Hello, I am SignalHub AI." }
      ]
    }
    ```
*   **Response JSON:**
    ```json
    {
      "response": "NVDA is experiencing a pullback due to sector rotation out of semis..."
    }
    ```

---

## 6. System

### Health Check
*   **Frontend Method:** `api.system.health()`
*   **Backend Route:** `GET /health`
*   **Response JSON:**
    ```json
    {
      "status": "ok",
      "timestamp": "2024-02-20T12:00:00Z",
      "version": "1.0.0"
    }
    ```
