<div align="center">

# ⚡ CompareX Server

**The AI-powered product comparison engine. Crawl, rank, and stream results across Amazon, Walmart, and eBay — in real time.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Modules](#-modules)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Docker Deployment](#-docker-deployment)
- [Project Structure](#-project-structure)
- [Scripts](#-scripts)

---

## 🔍 Overview

**CompareX Server** is the backend API powering the CompareX platform — a real-time, AI-enhanced product comparison tool. When a user searches for a product, the server simultaneously crawls **Amazon**, **Walmart**, and **eBay** using Puppeteer-powered headless browsers, streams the results back to the client via **Server-Sent Events (SSE)** and **Socket.IO**, then uses **OpenAI GPT-4o-mini** to intelligently rank and score each product by relevance.

Search sessions and rankings are persisted in **MongoDB**, allowing users to revisit their search history at any time.

---

## 🏛 Architecture

```
Client
  │
  ├─── REST  ──────────────────────────────────────────────────► Users Module
  │                                                               (Auth, JWT)
  │
  └─── SSE / Socket.IO ──────────────────────────────────────► Search Module
                                                                     │
                                          ┌──────────────────────────┤
                                          │                          │
                                    Crawler Module             AI Module
                                          │                          │
                          ┌───────────────┼───────────────┐    GPT-4o-mini
                          │               │               │   (Rank + Score)
                       Amazon          Walmart           eBay
                      Crawler          Crawler          Crawler
                          │               │               │
                          └───────────────┴───────────────┘
                                          │
                                    RxJS merge()
                                          │
                                    MongoDB (Sessions
                                    & Product Scores)
```

### Data Flow

1. **Client** sends a search query via SSE (`GET /search/stream?q=...&token=...`)
2. **AI Module** normalises the raw query (spelling correction, noise removal) using GPT-4o-mini
3. **Crawler Module** launches three parallel Puppeteer streams (Amazon, Walmart, eBay) merged with RxJS
4. **Search Orchestrator** orchestrates events, groups batches, and persists results to MongoDB
5. **AI Module** scores and ranks each product batch (relevance, price, ratings, sponsor status)
6. Ranked products stream back to the client in real time via SSE/Socket.IO
7. Sessions are saved so users can later retrieve them via `GET /search/history`

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔄 **Real-time Streaming** | Products stream live via SSE + Socket.IO as crawlers find them |
| 🤖 **AI Ranking** | GPT-4o-mini scores every product on a 0–100 relevance scale |
| 🕷 **Multi-Platform Crawling** | Simultaneous Puppeteer crawls on Amazon, Walmart & eBay |
| 🛡 **Fault Isolation** | RxJS `catchError` ensures one failing crawler never breaks the others |
| 🗄 **Session Persistence** | All searches and rankings stored in MongoDB for history retrieval |
| 🔐 **JWT Authentication** | Secure user accounts with bcrypt-hashed passwords and JWT tokens |
| 🚦 **Rate Limiting** | Global throttler guard (10 requests / 60 seconds) prevents abuse |
| 🐳 **Docker Ready** | Multi-stage Dockerfile with system Chromium for lean production images |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | NestJS 11 (TypeScript) |
| **Database** | MongoDB via Mongoose 7 |
| **Crawling** | Puppeteer 24 (headless Chromium) |
| **Streaming** | RxJS 7, Socket.IO 4, Server-Sent Events (SSE) |
| **AI** | OpenAI SDK — GPT-4o-mini |
| **Auth** | Passport.js + JWT (`@nestjs/passport`, `@nestjs/jwt`) |
| **Validation** | `class-validator` + `class-transformer` |
| **Rate Limiting** | `@nestjs/throttler` |
| **Linting** | Biome |
| **Testing** | Jest + Supertest |

---

## 📦 Modules

### `UsersModule`
Handles user registration, login, and authentication.

- `POST /users/register` — Create a new account
- `POST /users/login` — Authenticate and receive a JWT
- `POST /users/logout` — Logout (JWT invalidation)
- Passwords are hashed with **bcrypt** (10 salt rounds)
- JWT payloads contain `userId`, `email`, and `username`

### `CrawlerModule`
Manages Puppeteer-powered scrapers for each e-commerce platform.

- `AmazonCrawler` — Scrapes Amazon search results pages
- `WalmartCrawler` — Scrapes Walmart search results pages
- `EbayCrawler` — Scrapes eBay search results pages
- All crawlers implement a `streamSearch(query, maxPages): Observable<CrawlerEvent>` interface
- Streams are merged with RxJS `merge()` and errors are isolated with `catchError()`

### `AiModule`
Integrates with OpenAI to enhance search quality.

- **Query Normalisation** — Corrects spelling, removes filler words before crawling begins
- **Product Ranking** — Scores each product 0–100 across four weighted dimensions:
  - Title relevance — **40%**
  - Price competitiveness — **20%**
  - Ratings & review count — **30%**
  - Source reputation — **10%**
  - *(Sponsored products are slightly de-prioritised)*
- Gracefully falls back to original order if the OpenAI call fails

### `SearchModule`
Orchestrates the full search lifecycle end-to-end.

- **SSE Stream** — `GET /search/stream` — live product stream
- **Result Retrieval** — `GET /search/results/:searchId` — fetch a completed session
- **History** — `GET /search/history` — list all of a user's past searches
- **Trending** — `GET /search/trending` — discover popular products
- Session metadata (status, platform stats, timestamps) persisted in MongoDB

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/users/register` | Public | Register a new user |
| `POST` | `/users/login` | Public | Login and get a JWT token |
| `POST` | `/users/logout` | JWT | Logout current user |

### Search

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/search/stream?q=&token=` | Token (query param) | Live SSE stream of search results |
| `GET` | `/search/results/:searchId` | JWT | Retrieve results from a past session |
| `GET` | `/search/history` | JWT | Get authenticated user's search history |
| `GET` | `/search/trending` | Public | Get trending product data |

#### SSE Stream Events

The `/search/stream` endpoint emits the following Server-Sent Event types:

| Event Type | Description |
|---|---|
| `search:started` | Search session created, returns `searchId` |
| `products:batch` | A batch of newly found & ranked products |
| `search:stats` | Live per-platform crawl statistics |
| `search:complete` | All crawlers finished; final summary |
| `search:error` | Error from one or more crawlers |
| `search:cancelled` | Search was cancelled by the client |

#### Example SSE Connection

```js
const token = localStorage.getItem('token');
const query = 'iPhone 15 case';
const url = `https://your-api.com/search/stream?q=${encodeURIComponent(query)}&token=${token}`;

const eventSource = new EventSource(url);

eventSource.addEventListener('products:batch', (e) => {
  const data = JSON.parse(e.data);
  console.log('New products:', data.products);
});

eventSource.addEventListener('search:complete', (e) => {
  const summary = JSON.parse(e.data);
  console.log('Done! Total:', summary.totalProducts);
  eventSource.close();
});
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **MongoDB** (local or Atlas)
- **OpenAI API Key**
- **Chromium** (required for Puppeteer; installed automatically in Docker)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/comparex-server.git
cd comparex-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

> Fill in the values — see [Environment Variables](#-environment-variables) below.

### 4. Start development server

```bash
npm run start:dev
```

The API will be live at `http://localhost:3000` (or the `PORT` you configured).

---

## 🔑 Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# MongoDB connection string (Atlas or local)
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/compare_db

# JWT configuration
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# Server port
PORT=3000

# OpenAI API key (required for AI ranking and query normalisation)
OPENAI_API_KEY=sk-...

# Allowed CORS origin for the frontend
CORS_ORIGIN=http://localhost:3001

# (Optional) Brightdata / Scraping Browser WebSocket endpoint
SBR_WS_ENDPOINT=wss://brd-...
```

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection URI |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs (keep this long and random) |
| `JWT_EXPIRES_IN` | ✅ | Token expiry duration (e.g. `7d`, `24h`) |
| `PORT` | ✅ | Port the API listens on |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT-4o-mini |
| `CORS_ORIGIN` | ✅ | Frontend origin for CORS whitelisting |
| `SBR_WS_ENDPOINT` | ❌ | Brightdata scraping browser endpoint (optional) |

---

## 🐳 Docker Deployment

The included multi-stage `Dockerfile` installs system Chromium (avoiding Puppeteer's bundled binary) and produces a lean production image.

### Build and run locally

```bash
# Build the image
docker build -t comparex-server .

# Run with environment variables
docker run -p 8080:8080 \
  -e MONGO_URI=your_uri \
  -e JWT_SECRET=your_secret \
  -e OPENAI_API_KEY=your_key \
  -e CORS_ORIGIN=http://localhost:3001 \
  comparex-server
```

### Deploy to Fly.io

A `fly.toml` configuration is included:

```bash
fly deploy
```

### Deploy to Railway / Render

`railway.toml` and `render.yaml` configuration files are also included for one-click deployments.

---

## 📁 Project Structure

```
comparex-server/
├── src/
│   ├── ai/                          # AI module (OpenAI integration)
│   │   ├── ai.controller.ts
│   │   ├── ai.module.ts
│   │   ├── ai.services.ts           # rankProductsWithScores, normalizeQuery
│   │   ├── constants/               # Mock data & prompt constants
│   │   └── utils/
│   ├── crawler/                     # Puppeteer crawlers
│   │   ├── crawler.amazon.ts        # Amazon scraper
│   │   ├── crawler.ebay.ts          # eBay scraper
│   │   ├── crawler.walmart.ts       # Walmart scraper
│   │   ├── crawler.service.ts       # RxJS merge orchestration
│   │   ├── crawler.module.ts
│   │   └── types/                   # Shared types & event definitions
│   ├── search/                      # Search orchestration & SSE
│   │   ├── search-stream.controller.ts
│   │   ├── search.module.ts
│   │   ├── gateways/                # Socket.IO gateways
│   │   ├── schemas/                 # Mongoose schemas (sessions, products)
│   │   └── services/
│   │       ├── crawl-session.service.ts     # Session persistence
│   │       └── search-orchestrator.service.ts  # Full lifecycle orchestrator
│   ├── users/                       # Auth & user management
│   │   ├── users.controller.ts
│   │   ├── users.service.ts         # Register, login, JWT generation
│   │   ├── users.module.ts
│   │   ├── dto/                     # Request DTOs (auth, login)
│   │   ├── schemas/                 # User Mongoose schema
│   │   └── strategy/                # Passport JWT strategy
│   ├── app.module.ts                # Root module (with ThrottlerGuard)
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts                      # Bootstrap (CORS, global pipes)
├── test/                            # e2e tests
├── Dockerfile                       # Multi-stage Docker build
├── fly.toml                         # Fly.io deployment config
├── railway.toml                     # Railway deployment config
├── render.yaml                      # Render deployment config
├── .env.example                     # Environment variable template
└── package.json
```

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start development server with hot-reload |
| `npm run start:prod` | Run compiled production build |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run lint` | Lint and auto-fix with Biome |
| `npm run format` | Format code with Biome |

---

<div align="center">

Built with ❤️ using NestJS, Puppeteer & OpenAI

</div>