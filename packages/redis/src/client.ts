import Redis from "ioredis";
import { env } from "@degenradar/config";
import { logger } from "@degenradar/logger";
import type { WsEvent } from "@degenradar/types";

// Connection for BullMQ / general caching
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

// Separate connections for Pub/Sub
export const redisPublisher = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const redisSubscriber = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err) => logger.error({ err }, "Redis connection error"));
redisPublisher.on("error", (err) => logger.error({ err }, "Redis Publisher error"));
redisSubscriber.on("error", (err) => logger.error({ err }, "Redis Subscriber error"));

// Pub/Sub Channels
export const CHANNELS = {
  WS_BROADCAST: "degenradar:ws:broadcast",
  SCORE_UPDATED: "degenradar:score:updated",
  TOKEN_DISCOVERED: "degenradar:token:discovered",
  ALERTS: "degenradar:alerts",
} as const;

export async function publishWsEvent<T>(event: WsEvent<T>): Promise<void> {
  try {
    await redisPublisher.publish(CHANNELS.WS_BROADCAST, JSON.stringify(event));
  } catch (error) {
    logger.error({ error, eventType: event.type }, "Failed to publish WS event to Redis");
  }
}
