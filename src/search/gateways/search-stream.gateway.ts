// src/search/gateways/search-stream.gateway.ts

import { UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { Subject } from "rxjs";
import { Server, Socket } from "socket.io";
import { AiService } from "src/ai/ai.services";
import { CrawlerService } from "src/crawler/crawler.service";
import { CrawlSessionService } from "../services/crawl-session.service";
import { SearchOrchestratorService } from "../services/search-orchestrator.service";

interface StreamSession {
	searchId: string;
	query: string;
	cancellationSubject: Subject<void>;
}

/**
 * WebSocket Gateway for real-time product search streaming
 *
 * Architecture:
 * - RxJS manages internal stream control (merging, buffering, cancellation)
 * - Socket.IO handles client communication only
 * - Clean separation: business logic in services, delivery in gateway
 */
@WebSocketGateway({
	cors: {
		origin: process.env.CORS_ORIGIN || "http://localhost:3000",
		credentials: true,
	},
	namespace: "/search",
})
export class SearchStreamGateway
	implements OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer()
	server: Server;

	// Track active streams per client
	private activeStreams = new Map<string, StreamSession>();

	constructor(
		private readonly jwtService: JwtService,
		private readonly crawlerService: CrawlerService,
		private readonly orchestrator: SearchOrchestratorService,
		private readonly crawlSessionService: CrawlSessionService,
		private readonly aiService: AiService,
	) {}

	/**
	 * Handle new client connections
	 * Authenticate via token in handshake
	 */
	async handleConnection(client: Socket) {
		try {
			const token =
				client.handshake.auth.token ||
				client.handshake.headers.authorization?.split(" ")[1];

			if (!token) {
				console.log(`❌ Client ${client.id} rejected: No token provided`);
				client.emit("error", { message: "Authentication required" });
				client.disconnect();
				return;
			}

			// Verify JWT
			const payload = await this.jwtService.verifyAsync(token, {
				secret: process.env.JWT_SECRET || "your-secret-key",
			});

			// Attach user info to socket
			(client as any).userId = payload.userId || payload.sub;
			(client as any).email = payload.email;

			console.log(
				`✅ Client connected: ${client.id} (userId: ${(client as any).userId})`,
			);

			client.emit("connected", {
				message: "Successfully connected to search stream",
				clientId: client.id,
			});
		} catch (error) {
			console.error(
				`❌ Authentication failed for client ${client.id}:`,
				error.message,
			);
			client.emit("error", { message: "Invalid or expired token" });
			client.disconnect();
		}
	}

	/**
	 * Handle client disconnections
	 * Clean up active streams
	 */
	handleDisconnect(client: Socket) {
		const session = this.activeStreams.get(client.id);

		if (session) {
			console.log(`🛑 Cancelling search for disconnected client ${client.id}`);
			session.cancellationSubject.next();
			session.cancellationSubject.complete();
			this.activeStreams.delete(client.id);
		}

		console.log(`👋 Client disconnected: ${client.id}`);
	}

	/**
	 * Start a new search stream
	 *
	 * Flow:
	 * 1. Normalize query via AI
	 * 2. Create session in DB
	 * 3. Start RxJS stream (crawler → orchestrator)
	 * 4. Emit events to client via Socket.IO
	 * 5. Track cancellation token
	 */
	@SubscribeMessage("startSearch")
	async handleStartSearch(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { query: string; maxPages?: number },
	) {
		const { query, maxPages = 1 } = data;

		if (!query?.trim()) {
			client.emit("error", { message: "Query parameter is required" });
			return;
		}

		// Cancel any existing search for this client
		const existingSession = this.activeStreams.get(client.id);
		if (existingSession) {
			console.log(`🔄 Cancelling existing search for client ${client.id}`);
			existingSession.cancellationSubject.next();
			existingSession.cancellationSubject.complete();
		}

		try {
			const userId = (client as any).userId || null;

			// Normalize query using AI
			const normalizedQuery = await this.aiService.normalizeQuery(query);
			console.log(`🔍 Normalized query: "${query}" → "${normalizedQuery}"`);

			// Create session in database
			const searchId = await this.crawlSessionService.createSession(
				normalizedQuery,
				userId,
			);

			// Create cancellation subject for RxJS stream control
			const cancellationSubject = new Subject<void>();

			// Store session
			this.activeStreams.set(client.id, {
				searchId,
				query: normalizedQuery,
				cancellationSubject,
			});

			// Emit search started event
			client.emit("searchStarted", {
				searchId,
				query: normalizedQuery,
				originalQuery: query,
				timestamp: Date.now(),
			});

			console.log(
				`🚀 Starting search stream: ${searchId} for client ${client.id}`,
			);

			// Start crawler streams (RxJS manages this internally)
			const crawlerEvents$ = this.crawlerService.streamAllSites(
				normalizedQuery,
				maxPages,
			);

			// Orchestrate search with RxJS operators
			const searchMessages$ = this.orchestrator.orchestrateSearch(
				searchId,
				normalizedQuery,
				crawlerEvents$,
				cancellationSubject.asObservable(), // Pass cancellation signal
			);

			// Subscribe and emit to Socket.IO
			// RxJS controls the stream, Socket.IO just delivers events
			const subscription = searchMessages$.subscribe({
				next: (message) => {
					// Emit event to client based on message type
					client.emit(message.event, {
						searchId,
						...(typeof message.data === "object" && message.data !== null
							? message.data
							: {}),
						timestamp: Date.now(),
					});
				},

				error: (error) => {
					console.error(`❌ Stream error for ${searchId}:`, error);
					client.emit("error", {
						searchId,
						message: error.message || "Search stream failed",
						timestamp: Date.now(),
					});

					this.activeStreams.delete(client.id);
				},

				complete: () => {
					console.log(`✅ Search stream completed: ${searchId}`);
					client.emit("searchComplete", {
						searchId,
						timestamp: Date.now(),
					});

					this.activeStreams.delete(client.id);
				},
			});

			// Handle cancellation from client or disconnect
			cancellationSubject.subscribe(() => {
				console.log(`🛑 Unsubscribing from search stream: ${searchId}`);
				subscription.unsubscribe();
			});
		} catch (error) {
			console.error("Failed to start search:", error);
			client.emit("error", {
				message: error.message || "Failed to start search",
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * Cancel active search for this client
	 * Triggers RxJS takeUntil operator
	 */
	@SubscribeMessage("cancelSearch")
	handleCancelSearch(@ConnectedSocket() client: Socket) {
		const session = this.activeStreams.get(client.id);

		if (!session) {
			client.emit("error", { message: "No active search to cancel" });
			return;
		}

		console.log(
			`🛑 Cancelling search: ${session.searchId} for client ${client.id}`,
		);

		// Signal cancellation to RxJS stream
		session.cancellationSubject.next();
		session.cancellationSubject.complete();

		client.emit("searchCancelled", {
			searchId: session.searchId,
			timestamp: Date.now(),
		});

		this.activeStreams.delete(client.id);
	}

	/**
	 * Get search status
	 */
	@SubscribeMessage("getStatus")
	async handleGetStatus(@ConnectedSocket() client: Socket) {
		const session = this.activeStreams.get(client.id);

		if (!session) {
			client.emit("status", {
				active: false,
				message: "No active search",
			});
			return;
		}

		const dbSession = await this.crawlSessionService.getSession(
			session.searchId,
		);

		client.emit("status", {
			active: true,
			searchId: session.searchId,
			query: session.query,
			status: dbSession?.status || "in_progress",
			productCount: await this.crawlSessionService.getProductCount(
				session.searchId,
			),
		});
	}
}
