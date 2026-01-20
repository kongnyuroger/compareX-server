compareX Backend

The compareX Backend powers the real-time product comparison experience by orchestrating crawling, stream processing, and live data delivery.
It is built with NestJS, designed for scalability, maintainability, and real-time performance.

 Overview

The backend is responsible for:

Managing product searches and crawling workflows

Aggregating data from multiple e-commerce sources

Streaming results to clients in real time

Handling cancellation, errors, and lifecycle events

Providing a clean, modular, and extensible architecture

The system is built around RxJS for stream control and Socket.IO for real-time communication, enabling progressive delivery of results instead of delayed, batch responses.

Core Capabilities

Real-time product streaming

Parallel multi-source crawling

Cancelable long-running searches

Backpressure & rate control

Clean separation of concerns

Scalable, modular NestJS architecture

🛠 Tech Stack

Framework: NestJS

Language: TypeScript

Real-time Transport: Socket.IO

Stream Management: RxJS

HTTP Server: Express (via NestJS)

Validation: class-validator / class-transformer

Configuration: @nestjs/config

📁 Project Structure
src/
├── app.module.ts
├── main.ts
│
├── modules/
│   ├── search/               # Search orchestration
│   ├── crawler/              # Crawling logic (per source)
│   ├── stream/               # RxJS stream services
│   └── socket/               # Socket.IO gateway
│
├── common/
│   ├── filters/              # Global exception filters
│   ├── pipes/                # Validation & transformation
│   └── decorators/
│
├── config/
│   └── configuration.ts
│
└── types/
    └── product.types.ts

🔄 Real-Time Architecture

compareX uses a two-layer streaming model:

Crawler → RxJS Observable → Stream Processing → Socket.IO → Client

Responsibilities

RxJS

Controls data flow

Merges multiple crawlers

Handles cancellation and cleanup

Buffers or throttles emissions

Socket.IO

Pushes updates to connected clients

Handles reconnects

Emits lifecycle events (started, completed, cancelled, error)

This approach ensures efficient resource usage and instant feedback to users.

⚙️ Getting Started
1️⃣ Prerequisites

Node.js (v18 or higher)

npm or yarn

2️⃣ Installation
git clone https://github.com/your-org/comparex-backend.git
cd comparex-backend
npm install

3️⃣ Environment Variables

Create a .env file:

PORT=3000
CLIENT_ORIGIN=http://localhost:3001
NODE_ENV=development

4️⃣ Run the Application
npm run start:dev


Server will start on:

http://localhost:3000

🔌 Socket.IO Events
Client → Server

start-search — start a new product search

cancel-search — cancel an ongoing search

Server → Client

product — streamed product result

search-started — search initialized

search-complete — search finished

search-cancelled — search stopped

search-error — error occurred

🧪 Scripts
npm run start        # Start production server
npm run start:dev    # Start development server
npm run build        # Build application
npm run lint         # Run linting

🧩 Design Principles

Real-time first: Data is streamed, not batched

Observable-driven: Long-running tasks are cancellable

Transport-agnostic logic: Business logic is not tied to Socket.IO

Modular NestJS structure: Easy to extend and test

Fail-safe cleanup: Streams terminate on disconnects or errors

🔐 Security & Stability

No client-side crawling logic

Input validation on all incoming events

Automatic cleanup on client disconnect

Stream isolation to prevent cascading failures

 Future Improvements

Redis adapter for Socket.IO scaling

Queue-based crawling (BullMQ)

Authentication & rate limiting

Persistent search history

Monitoring & metrics

Contributing

Contributions are welcome.
Please ensure:

Code follows NestJS best practices

RxJS streams are properly cleaned up

Socket events are documented

📄 License

This project is proprietary and part of the compareX platform.
All rights reserved.

📬 Contact

For questions, feedback, or collaboration, please contact the compareX engineering team.

compareX Backend
Building real-time product comparison at scale.