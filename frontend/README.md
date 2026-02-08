<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TickerPulse AI - Frontend

> Modern React 19 web application for real-time stock market intelligence and AI-powered alert management.

**Part of**: [TickerPulse AI](../README.md) - Real-time Market Intelligence Engine

## Overview

The frontend is a React 19 single-page application built with **Vite**, providing:

- **Real-time Dashboard** with live market data and alert streams
- **Alert Management** with detailed analysis and explanations
- **Watchlist Management** with customizable alert preferences
- **Narrative Intelligence** showing company analysis and contradictions
- **Market Intelligence** featuring divergence analysis and insights
- **User Authentication** with JWT tokens and secure session management
- **WebSocket Integration** for instant real-time updates

### Key Features

- **Live Alerts Dashboard** - Real-time notification stream with filtering
- **Watchlist Management** - Custom ticker lists with personalized alert settings
- **Intelligence Center** - AI-powered analysis of market divergences and narrative contradictions
- **Market Overview** - Real-time price tracking and volume analysis
- **User Settings** - Profile management and alert preferences
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark/Light Mode** - Built-in theme support with Tailwind CSS

## Tech Stack

| Tech | Purpose | Version |
|------|---------|---------|
| React | UI framework | 19 |
| TypeScript | Type-safe development | ^5.x |
| Vite | Build tool & dev server | ^5.x |
| React Router | Client-side routing | ^6.x |
| Zustand | State management | ^4.x |
| Tailwind CSS | Styling | ^3.x |
| Recharts | Data visualization | Latest |
| Axios | HTTP client | ^1.x |
| Lucide React | Icons | ^0.x |

## Quick Start

### Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm
- Backend API running on `http://localhost:5000`

### Installation

```bash
cd frontend
pnpm install
cp .env.example .env.local
```

Configure `.env.local`:

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

### Running

```bash
# Development
pnpm run dev
# Opens http://localhost:5173

# Production build
pnpm run build
pnpm run preview
```

## Project Structure

```
frontend/src/
├── features/                    # Feature modules
│   ├── alerts/                  # Alert management
│   ├── auth/                    # Authentication
│   ├── dashboard/               # Main dashboard
│   ├── intelligence/            # AI insights
│   ├── market/                  # Market data
│   ├── watchlist/               # User watchlists
│   └── settings/                # User settings
├── shared/                      # Shared components
│   ├── components/              # Reusable UI
│   ├── services/                # API integration
│   ├── store/                   # Zustand state
│   ├── hooks/                   # Custom hooks
│   ├── types/                   # TypeScript types
│   └── utils/                   # Helpers
└── App.tsx                      # Root component
```

## Key Features

### Real-time Alerts

WebSocket-powered alert system with filtering and sorting.

```typescript
const { alerts, loading } = useAlerts();
```

### Watchlist Management

Create and manage custom stock watchlists.

```typescript
const { watchlists } = useWatchlist();
```

### Market Intelligence

AI-powered divergence and narrative analysis.

```typescript
const divergences = await intelligenceService.getDivergences('AAPL', 30);
```

### Real-time Charts

Interactive market data visualization with Recharts.

## State Management

Zustand stores for all state management:

- `useAuthStore` - Authentication state
- `useAlertStore` - Alerts and filters
- `useWatchlistStore` - Watchlists
- `useMarketStore` - Market data
- `useUIStore` - UI state and theme
- `useNotificationStore` - Toast notifications

## API Integration

Centralized Axios instance with automatic authentication.

```typescript
// API calls with automatic token management
const response = await api.get('/api/alerts');
```

## Styling

Tailwind CSS with dark mode support.

```tsx
<div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
```

## Environment Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | Backend API URL | http://localhost:5000 |
| `VITE_WS_URL` | WebSocket URL | ws://localhost:5000 |
| `VITE_API_TIMEOUT` | Request timeout | 10000 |
| `VITE_ENABLE_DARK_MODE` | Theme toggle | true |

## Troubleshooting

### API Connection Fails
```bash
# Check backend is running
curl http://localhost:5000/health

# Verify VITE_API_URL in .env.local
```

### WebSocket Not Connecting
```bash
# Verify WebSocket URL and /api/ws path
# Check backend WebSocket handler is registered
```

### Build Size
```bash
# Analyze bundle
pnpm run build
# Check dist/ folder size
```

## Related Documentation

- [Root README](../README.md) - Project overview
- [Backend README](../backend/README.md) - API and architecture
- [API Specification](./API_SPECIFICATION.md) - Endpoint details
- [Backend Integration](./BACKEND_INTEGRATION.md) - Integration guide

---

**Last Updated**: January 2026  
**Version**: Gemini-3 Hackaton
