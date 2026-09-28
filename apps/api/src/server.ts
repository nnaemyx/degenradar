import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import { env } from "@degenradar/config";
import { logger } from "@degenradar/logger";
import { redisSubscriber, CHANNELS } from "@degenradar/redis";
import { registerRoutes } from "./routes";
import type { WebSocket } from "ws";

const app = Fastify({
  logger: false, // Handled via @degenradar/logger
});

async function main() {
  // Security & Middleware
  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(fastifyWebsocket);

  // Active WebSocket clients set
  const connectedClients = new Set<WebSocket>();

  // Subscribe to Redis PubSub for real-time fanout to frontend clients
  await redisSubscriber.subscribe(CHANNELS.WS_BROADCAST, (err) => {
    if (err) logger.error({ err }, "Failed to subscribe to Redis WS channel");
    else logger.info("Subscribed to Redis WS broadcast channel");
  });

  redisSubscriber.on("message", (channel, message) => {
    if (channel === CHANNELS.WS_BROADCAST) {
      for (const client of connectedClients) {
        if (client.readyState === 1 /* OPEN */) {
          try {
            client.send(message);
          } catch (e) {
            // Socket drop handled in close event
          }
        }
      }
    }
  });

  // WebSocket Route for Frontend Dashboard
  app.get("/ws", { websocket: true }, (socket /* WebSocket */) => {
    connectedClients.add(socket);
    logger.info({ totalConnected: connectedClients.size }, "Client connected to WebSocket");

    socket.send(
      JSON.stringify({
        type: "CONNECTED",
        message: "Connected to DegenRadar Real-Time Gateway",
        timestamp: new Date().toISOString(),
      })
    );

    socket.on("close", () => {
      connectedClients.delete(socket);
      logger.info({ totalConnected: connectedClients.size }, "Client disconnected from WebSocket");
    });
  });

  // Register REST API Routes
  await registerRoutes(app);

  // Start Server
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    logger.info(`DegenRadar API & WebSocket Gateway running at http://${env.API_HOST}:${env.API_PORT}`);

    // Launch all 24/7 background scanners & workers inside the API service (runs on Render Free Web Service)
    if (process.env.RUN_WORKERS !== "false") {
      logger.info("Initializing 24/7 Background Workers & Live Blockchain Scanners in API process...");
      await import("@degenradar/worker-token-discovery");
      await import("@degenradar/worker-risk-engine");
      await import("@degenradar/worker-feature-engine");
      await import("@degenradar/worker-scoring");
      await import("@degenradar/worker-alerts");
      logger.info("All 5 background workers running 24/7 alongside Fastify API Gateway");
    }
  } catch (err) {
    logger.error({ err }, "Error starting Fastify server");
    process.exit(1);
  }
}

main();
