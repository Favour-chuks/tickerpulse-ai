# SignalHub: Real-Time Market Narrative Detection Engine

## Problem Statement

Markets react to information asymmetry. Professional traders have been monitoring public filings (SEC EDGAR) and news for decades to identify trading opportunities. However, retail investors and analysts face two critical problems:

1. **Information Lag**: By the time material information appears in filings or news, institutional traders have already priced it in. Detecting _when_ information emerges is harder than reading _what_ it contains.

2. **Volume Without Catalyst**: Trading volume often spikes with no corresponding public announcement or news event—a phenomenon known as "informed trading" or information leakage. Traditional tools flag volume anomalies but don't explain them. Analysts must manually search SEC databases and news archives to find the catalyst, wasting hours on negative results.

3. **Narrative Contradictions Go Undetected**: Companies make forward-looking statements in quarterly filings (e.g., "We remain confident in our 2025 guidance"). Months later, a new filing quietly omits that statement or reverses course. Detecting these narrative shifts requires comparing documents manually across quarters—a task too tedious for consistent execution.

SignalHub solves this by automating the detection of unexplained volume spikes and contradictory narratives using real-time processing and AI-driven analysis.

---

## Solution Overview

SignalHub is a real-time system that detects market anomalies and surfaces their underlying narratives:

1. **Detects volume spikes** using statistical analysis (z-scores and deviation multiples)
2. **Searches for explanations** by checking SEC filings and news from a 24-hour window around the spike
3. **Flags unexplained spikes** as divergences—volume movements without public catalysts
4. **Generates hypotheses** about likely causes using Gemini AI analysis
5. **Analyzes narratives** in new SEC filings for tone shifts, risk factor changes, and contradictions with prior statements
6. **Delivers alerts** via WebSocket to watching users in real-time

The result: traders and analysts get alerts about _when_ information is entering the market, not just _what_ the information is.

---

## Core Functionality

### 1. Volume Spike Detection (Statistical Foundation)

**Input**: Real-time market volume data (ticker, volume per minute, historical averages)

**Process**:

- Calculate 20-day rolling average volume and standard deviation
- When new volume arrives, compute z-score: `(current_volume - avg) / std_dev`
- Flag spike if z-score > 2.5 or volume > 3× average
- Record spike timestamp, volume magnitude, and deviation metrics in database

**Output**: Spike record with statistical metrics (ID, z-score, deviation multiple, detected timestamp)

**Why not rule-based?** Simple thresholds generate false positives (market opens, scheduled earnings announcements). Z-scores account for normal volatility by ticker; a 2.5 z-score spike in a liquid stock is statistically rare.

---

### 2. Divergence Detection (Core Algorithm)

**Input**: Volume spike record from step 1

**Process**:

1. Retrieve all SEC filings for the ticker from past 24 hours → typically 0–1 filings (filings are infrequent)
2. Retrieve news/social mentions for the ticker from past 24 hours → threshold: flag divergence if < 3 mentions
3. If both checks return no results → **divergence detected**: volume moved without public explanation
4. Call Gemini Pro API to generate hypotheses about why the volume spike occurred
5. Calculate alert severity based on spike magnitude and divergence confirmation
6. Store alert in database; broadcast to watching users via WebSocket

**Output**: Divergence alert record containing:

- Spike ID and ticker
- Severity level (low, medium, high, critical)
- Gemini-generated hypothesis ("possible insider information," "sector news," "algorithm-driven rebalancing")
- Watch-for signals (what to monitor next)

**Why this is powerful**: The system doesn't require manual SEC and news searches. It automatically determines: "This spike has no public explanation" in seconds.

---

### 3. Narrative Analysis Pipeline (Deep Insight)

**Input**: New SEC filing (10-Q, 10-K, 8-K) from EDGAR

**Process**:

**Stage 1 - Quick Filter (Gemini Flash)**

- Extract first 5000 characters of filing
- Use fast, cheaper Gemini 1.5 Flash model to quickly determine if filing is material
- Material criteria: business changes, guidance updates, C-suite departures, M&A, legal/regulatory issues
- If non-material → discard; if material → proceed to Stage 2

**Stage 2 - Deep Analysis (Gemini Pro)**

- Use Gemini 1.5 Pro to perform full narrative analysis:
  - Extract executive summary: "What are the 3 most important changes?"
  - Analyze tone: bullish, bearish, neutral, or cautious
  - Identify language shifts: new hedging language, removed positive statements, cautionary tone
  - Detect contradictions: compare with prior filing for statement reversals
  - Identify red flags: unexplained omissions, concerning changes
  - Suggest watch-for signals: what to monitor in next earnings call or filing
- Return structured JSON with confidence scores, categories, and evidence

**Stage 3 - Contradiction Detection (Gemini Pro)**

- Compare current filing's language against all prior filings in past 2 years
- Flag contradictions: "Prior filing stated 'strong demand,' current filing does not mention demand"
- Severity: LOW (minor wording change) → CRITICAL (reversed guidance)

**Output**: Narrative record containing:

- Structured analysis (tone, key changes, language shifts)
- Contradiction list with severity levels
- Recommendations for what to watch next

**Why Gemini, not rules?** SEC filings are unstructured prose. Detecting tone shifts, narrative contradictions, and implicit changes requires understanding context and semantics—not pattern matching. A sentence like "We remain cautiously optimistic" contains both positive (optimistic) and hedging (cautious) signals that rule-based systems miss. Gemini's language understanding captures these nuances.

---

### 4. Real-Time Alert System

**Input**: Volume spikes, divergence detections, narrative contradictions

**Process**:

1. User creates watchlist (tickers they care about)
2. User sets alert preferences (alert on divergence? narrative changes? contradictions?)
3. When alert condition is met → broadcast to user via WebSocket
4. User can acknowledge, dismiss, or annotate alerts; system tracks user feedback

**Output**: Real-time notifications; alert history for user review

---

## What Makes This Different

### 1. **Divergence Detection is Novel**

- Competing tools (Bloomberg, FactSet, Yahoo Finance) alert on volume spikes with threshold-based rules
- SignalHub adds a crucial layer: _explanation_. If volume spiked with no public catalyst, it signals potential information leakage or insider trading—a high-value signal
- No public product explicitly detects "high volume + zero public news" as a distinct alert type

### 2. **Narrative Contradiction Tracking**

- Competitors track volume and earnings changes, not narrative shifts
- SignalHub surfaces when companies quietly reverse prior statements—a red flag for deteriorating fundamentals
- Example: "We expect continued growth in Asia" → next quarter: "Asia revenue declined"

### 3. **Integration of Structured + Unstructured Data**

- Volume detection (quantitative, statistical)
- Filing analysis (qualitative, narrative)
- Real-time correlation (if divergence appears, narrative analysis explains why)

### 4. **AI as a First-Class Tool, Not an Add-On**

- Gemini is not a "nice to have"—it's essential
- Without it, narrative analysis would require manual human reading of every filing; impossible at scale
- Gemini Flash (fast, cheap) screens for materiality; Gemini Pro (powerful) performs deep analysis
- Model choice reflects actual requirements: Flash for fast filtering, Pro for accuracy where it matters

---

## Gemini 3 Integration

### How Gemini Powers This System

**1. Divergence Hypothesis Generation**

- When a volume spike is detected _without_ public news or filings, Gemini is called to generate hypotheses
- Input: ticker, spike size (volume multiple), timing, social sentiment, prior public statements
- Output: Structured list of potential explanations:
  - "Possible insider trading" (highest risk)
  - "Algorithmic rebalancing across sector"
  - "Rumored acquisition activity"
  - "Options expiration hedging"
  - "Sector rotation signals"
- Each hypothesis includes confidence score and watch-for signals
- Why essential: Rules cannot generate novel hypotheses. Gemini understands financial context and can reason about what drives market moves.

**2. Filing Materiality Screening (Gemini Flash)**

- SEC EDGAR publishes ~400+ filings per day across all stocks
- Screening all of them is expensive; most are routine, non-material updates
- Gemini Flash quickly filters: "Is this filing material to stock price?" (< 1 second per filing)
- Input: Filing type (10-Q, 8-K, etc.), first 5000 chars, company ticker
- Output: Binary decision + one-sentence reason
- Why essential: Definining "material" is semantic. A filing mentioning "compliance with new EU regulation" may or may not matter depending on company exposure. Gemini understands context; rules do not.

**3. Narrative Analysis & Contradiction Detection (Gemini Pro)**

- Input: Current SEC filing text (up to 15,000 characters)
- Process: Gemini extracts and analyzes:
  - **Executive Summary**: "What changed from last quarter?"
  - **Tone Analysis**: Confidence level, hedging language, cautionary statements
  - **Language Shifts**: Phrases removed or added that signal changing sentiment
  - **Red Flags**: Unexplained omissions, concerning reversals
  - **Contradiction Detection**: "Last filing said X, this filing says Y—contradiction or clarification?"
- Output: Structured JSON with:
  - `tone`: "cautious" (down from "bullish")
  - `key_changes`: [{category: "revenue guidance", description: "lowered to $X–Y", impact: "negative"}]
  - `contradictions`: [{severity: "HIGH", type: "guidance reversal", explanation: "Q2 10-Q promised 15% growth; Q3 10-Q now predicts flat growth"}]
  - `confidence_score`: 8/10
- Why essential: Comparing two 20,000-word filings manually takes 30 minutes and requires financial expertise. Gemini does it in 3 seconds and highlights only material contradictions.

**Why This Cannot Be Done With Simpler Models or Rule-Based Logic:**

- **Tone analysis**: Phrases like "remain confident" vs. "cautiously optimistic" carry contradictory signals. LLMs with shallow context windows or token budgets fail here. Gemini 1.5 Pro handles 1M tokens, capturing full filing context.
- **Contradiction detection**: Statements like "We continue to believe in Q2 guidance" in a later filing might indicate confidence or might be boilerplate. Detecting real contradictions vs. routine language requires semantic understanding across documents.
- **Materiality assessment**: A sentence mentioning "supply chain challenges in Vietnam" is material if company has major Vietnam operations, immaterial if Vietnam is < 1% of revenue. Gemini understands company context; regex/rules cannot.

---

## System Architecture

```
Data Layer
├── SEC EDGAR (filings via API)
├── Market Data (volume, price)
└── News/Social (sentiment data)
         ↓
Processing Layer
├── Volume Detection Service (z-score analysis)
├── SEC Filing Service (ingest, parse, store)
├── Gemini Service (API wrapper for Flash/Pro models)
└── Divergence Detection Service (algorithm orchestration)
         ↓
Storage Layer
├── PostgreSQL (filings, spikes, alerts, user watchlists)
├── TimescaleDB (time-series volume data)
└── Redis (caching, real-time subscriptions)
         ↓
Output Layer
├── WebSocket Server (real-time alerts)
├── REST API (historical data, user preferences)
└── User Dashboard (React frontend)
```

---

## Key Features Implemented

✅ **Volume Spike Detection** - Real-time z-score and deviation analysis
✅ **Divergence Detection** - Automated catalyst search + Gemini hypothesis generation
✅ **SEC Filing Ingestion** - Material filter + deep narrative analysis
✅ **Narrative Contradiction Tracking** - Cross-filing comparison with contradiction detection
✅ **Real-Time Alerts** - WebSocket broadcast to watching users
✅ **User Watchlists** - Customizable ticker tracking
✅ **Alert Preferences** - User control over alert types and severity thresholds
✅ **Authentication** - JWT-based user system
✅ **Promise Verification** - Track company commitments over time
✅ **Database Schema** - 13 tables with proper relationships, indexing, audit logging

---

## Technical Stack

- **Backend**: Node.js + Express/Fastify, TypeScript
- **Database**: PostgreSQL + TimescaleDB (time-series) + pgvector (embeddings)
- **Real-Time**: WebSocket, Redis (pub/sub), Bull (job queue)
- **AI**: Google Gemini 3.0 APIs
- **Frontend**: React + TypeScript (Vite)
- **Testing**: Jest + Vitest

## Summary

SignalHub automates the detection of market anomalies that signal information leakage or shifting corporate narratives. It uses:

1. **Statistics** (z-scores) to find unusual volume
2. **Gemini AI** (essential) to understand narratives and generate hypotheses
3. **Real-time delivery** to alert users at signal speed, not news cycle speed

The combination solves a real problem that existing tools don't: explaining unexplained volume spikes and detecting corporate narrative reversals before they hit mainstream news.
