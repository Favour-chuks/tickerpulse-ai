# TickerPulse AI

> **Real-time Market Intelligence Engine** - Detect hidden signals in stock market data using AI-powered narrative analysis and divergence detection.

## 🎯 Project Overview

TickerPulse AI is a sophisticated financial intelligence platform that detects divergences between volume spikes and public information, analyzes SEC filings for contradictions, and generates AI-powered insights about hidden market signals.

### What It Does

- **🔍 Detects Hidden Signals**: Identifies volume spikes without corresponding news catalysts
- **📄 Analyzes Narratives**: AI-powered extraction of company strategy and commitments from SEC filings
- **⚠️ Flags Contradictions**: Detects when companies contradict previous statements
- **🚨 Real-time Alerts**: Delivers instant notifications via WebSocket when anomalies are detected
- **📊 Personalized Tracking**: Users can create watchlists with customizable alert preferences
- **💡 AI Explanations**: Gemini AI provides context and analysis for each detected signal

### Key Features

| Feature                      | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Volume Anomaly Detection** | Real-time monitoring of unusual trading volume using Z-score analysis    |
| **Divergence Analysis**      | Flags volume movements without clear public catalyst or narrative change |
| **SEC Filing Intelligence**  | AI-powered extraction of company promises, strategy, and potential risks |
| **Contradiction Detection**  | Identifies inconsistencies between current and past company statements   |
| **Promise Tracking**         | Monitors company commitments and flags when they fail to deliver         |
| **Multi-source News**        | Aggregates news from multiple sources for context analysis               |
| **WebSocket Alerts**         | Real-time push notifications for subscribed tickers                      |
| **User Watchlists**          | Personalized ticker tracking with granular alert settings                |

## 📁 Project Structure

```
tickerpulse-ai/
├── backend/                    # Node.js/Fastify API server
│   ├── src/
│   │   ├── modules/           # Feature modules (alerts, market, news, etc.)
│   │   ├── shared/            # Shared services, types, and utilities
│   │   ├── config/            # Configuration and initialization
│   │   ├── app.ts             # Express app setup
│   │   └── server.ts          # Server entry point
│   ├── database/              # PostgreSQL schema with TimescaleDB
│   └── package.json
│
├── frontend/                   # React + Vite web application
│   ├── src/
│   │   ├── features/          # Feature modules (auth, watchlist, alerts, etc.)
│   │   ├── shared/            # Shared components, services, types
│   │   ├── App.tsx            # Main app component
│   │   └── index.tsx          # Entry point
│   └── package.json
│
└── README.md (this file)       # Project overview

```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+ (with TimescaleDB extension)
- **Redis** 6+
- **Google Gemini API Key**

### Setup (5 minutes)

```bash
# 1. Install dependencies for both frontend and backend
cd backend && pnpm install
cd ../frontend && pnpm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database and API keys

# 3. Initialize database (see Backend README for details)

# 4. Start the servers
# Terminal 1: Backend API
cd backend && pnpm run dev

# Terminal 2: Frontend app
cd frontend && pnpm run dev
```

Visit `http://localhost:5173` (frontend) and `http://localhost:5000` (API)

## 📚 Documentation

### For Detailed Information

- **[Backend README](./backend/README.md)** - API documentation, architecture, services, and deployment
- **[Frontend README](./frontend/README.md)** - UI components, features, state management, and development guide

### Quick Links

| Document                                                  | Purpose                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| [Backend README](./backend/README.md)                     | Complete API docs, service descriptions, setup guide            |
| [Frontend README](./frontend/README.md)                   | Feature descriptions, component structure, development workflow |


## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React)                          │
│  Dashboard | Alerts | Watchlist | Intelligence | Settings   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Backend (Fastify + Node.js)                       │
├─────────────────────────────────────────────────────────────┤
│                    API Layer                                │
│  Auth | Alerts | Market | Watchlist | Analysis | News       │
├─────────────────────────────────────────────────────────────┤
│              Services & Processing                          │
│  Volume Detection | Divergence Detection | AI Analysis      │
├─────────────────────────────────────────────────────────────┤
│        Workers (Async Jobs & Real-time Updates)             │
│  Notification Queue | WebSocket Broadcast | Job Processing  │
└──────┬──────────────────────────────────────────┬───────────┘
       │                                          │
       ▼                                          ▼
   PostgreSQL + TimescaleDB              Redis (Cache & Queues)
   (Data Storage)                        (Real-time Operations)
```

## 🔑 Key Technologies

### Backend

- **Fastify** - Fast, modern Node.js web framework
- **PostgreSQL + TimescaleDB** - Time-series database for market data
- **Redis** - Caching and job queue
- **Bull** - Task queue for background jobs
- **Supabase** - Authentication and database management
- **Google Gemini AI** - Natural language analysis
- **ioredis** - Redis client with pub/sub support

### Frontend

- **React 19** - Modern UI framework with hooks
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing
- **Zustand** - Lightweight state management
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization
- **Axios** - HTTP client for API calls
- **Lucide React** - Beautiful icon library

## 📖 System Features Explained

### 1. Volume Anomaly Detection

The system monitors trading volume in real-time and calculates Z-scores to detect statistically significant spikes. When volume deviates by >2 standard deviations from the 20-day average, an alert is triggered.

### 2. Divergence Detection

When a volume spike occurs WITHOUT corresponding news, SEC filings, or social media surge, this creates a "divergence". The system flags this as potentially indicative of insider information or undisclosed events.

### 3. Narrative Analysis

AI extracts the company's narrative from SEC filings:

- Strategic direction and promises
- Risk factors
- Management commentary
- Key metrics and targets

### 4. Contradiction Detection

Compares current narrative against historical patterns to identify:

- Broken promises (company didn't deliver on stated goals)
- Strategic shifts (sudden change in messaging)
- Risk discrepancies (different risk assessment than before)

### 5. Real-time Alerts

When anomalies are detected:

- Alerts are created in the database
- WebSocket events are broadcast to subscribed users
- Notifications are queued for offline users
- Explanations are generated by Gemini AI

## 🔄 Data Flow

```
Market Data Sources
├─ Stock Price & Volume → Volume Detection Service
├─ SEC Filings → SEC Filing Service → Gemini AI Analysis
├─ News & Social → News Service → Sentiment Analysis
└─ User Watchlists → Alert Preferences

         ↓

Processing Layer
├─ Divergence Detection (Volume + News + Sentiment)
├─ Contradiction Detection (Current vs Historical Narrative)
└─ Promise Tracking (Company Commitments)

         ↓

Alert Generation & Distribution
├─ Create Alert Records
├─ WebSocket Broadcast (Online Users)
└─ Notification Queue (Offline Users)

         ↓

User Notifications
├─ Real-time Push via WebSocket
├─ In-app Alert List
├─ Progressive Web App Notifications (Future)
└─ Email Notifications (Future)
```

## 🔐 Authentication & Security

- **JWT-based authentication** with access and refresh tokens
- **Supabase Auth** for user management
- **Protected API endpoints** with middleware authentication
- **Row-level security** for user data isolation
- **Secure WebSocket connections** with token validation

## 🚢 Deployment

Both frontend and backend can be deployed to:

- **Vercel** (Frontend)
- **Railway/Heroku/Render** (Backend)
- **Docker** (Self-hosted)
- **AWS/GCP/Azure** (Enterprise)

See detailed deployment guides in respective README files.

## 📊 Status

### ✅ Completed

- User authentication and authorization
- Watchlist management
- Real-time WebSocket alerts
- Basic market data tracking
- SEC filing processing
- UI components and pages
- Database schema and migrations

### 🚧 In Progress / Future

- Advanced AI analysis features
- Social sentiment integration
- Email notifications
- Portfolio tracking
- Mobile app support
- Advanced visualizations
- Backtest analysis

## 🛠️ Development

### Running in Development

```bash
# Backend - API server and worker processes
cd backend
pnpm run dev       # Main API server on port 5000
pnpm run workers   # Background job processors

# Frontend - React development server
cd frontend
pnpm run dev       # Dev server on port 5173
```

### Running Tests

```bash
# Backend tests
cd backend
pnpm run test              # Run all tests
pnpm run test:watch       # Watch mode
pnpm run test:coverage    # Coverage report

# Frontend tests
cd frontend
pnpm run test             # Run tests (if configured)
```

### Building for Production

```bash
# Backend
cd backend
pnpm run build            # Compile TypeScript
NODE_ENV=production node dist/server.js

# Frontend
cd frontend
pnpm run build            # Build static assets
pnpm run preview          # Preview build locally
```

## 🤝 Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes following the code style
3. Write tests for new functionality
4. Commit with descriptive messages
5. Push and create a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **Formatting**: ESLint + Prettier
- **Testing**: Jest (Backend)
- **Documentation**: Inline comments for complex logic

## 📝 Documentation Structure

Each part of the project has detailed documentation:

```
├── README.md                           # You are here
├── backend/
│   ├── README.md                       # Backend setup & API docs
│   ├── DATABASE_SCHEMA.md              # Database schema details
│   ├── IMPLEMENTATION_GUIDE.md         # How to implement features
│   └── AUTH_ARCHITECTURE.md            # Authentication design
├── frontend/
│   ├── README.md                       # Frontend setup & features
│   ├── BACKEND_INTEGRATION.md          # How to integrate with backend
│   └── API_SPECIFICATION.md            # API contract
└── Implementation Guides               # Phase-based implementation
    ├── MISSING_BUSINESS_LOGIC.md       # What needs to be built
    ├── IMPLEMENTATION_ROADMAP.md       # Priority matrix
    └── IMPLEMENTATION_CHECKLIST.md     # Daily tasks
```

## 🆘 Troubleshooting

### Backend Won't Start

- **Issue**: Database connection error
- **Solution**: Check PostgreSQL is running, credentials in `.env` are correct
- See [Backend README](./backend/README.md#troubleshooting)

### Frontend Can't Connect to API

- **Issue**: CORS or connection error
- **Solution**: Ensure backend is running on correct port, check `.env` API URL
- See [Frontend README](./frontend/README.md#troubleshooting)

### WebSocket Not Connecting

- **Issue**: Real-time alerts not working
- **Solution**: Check WebSocket URL in frontend config, verify backend WebSocket handler
- See [Backend README](./backend/README.md#websocket-setup)

## 📞 Support & Issues

- **Questions**: Check the [Backend](./backend/README.md) or [Frontend](./frontend/README.md) README first
- **Bugs**: Open an issue with reproduction steps
- **Features**: Submit a feature request with use case

## 📄 License

MIT License - See LICENSE file for details

## 🎓 Learning Resources

- [Fastify Documentation](https://www.fastify.io/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Supabase Guides](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/)

---

**Next Steps:**

1. **Setting up?** → Read [Backend README](./backend/README.md) and [Frontend README](./frontend/README.md)
2. **Understanding the system?** → Check the Architecture Overview above
4. **Need API docs?** → See [Backend README API Documentation](./backend/README.md#api-endpoints)
