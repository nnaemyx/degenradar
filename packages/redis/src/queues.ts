import { Queue, QueueOptions } from "bullmq";
import { redis } from "./index";
import type {
  TokenDiscoveryJob,
  TradeProcessingJob,
  HolderAnalysisJob,
  RiskAnalysisJob,
  FeatureCalculationJob,
  ScoreCalculationJob,
  AlertProcessingJob,
  OutcomeCalculationJob,
} from "@degenradar/types";

const defaultQueueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 3600, // 1 hour
    },
    removeOnFail: {
      count: 5000,
      age: 24 * 3600, // 24 hours
    },
  },
};

// Queue Definitions
export const tokenDiscoveryQueue = new Queue<TokenDiscoveryJob>("token-discovery", defaultQueueOptions);
export const tradeProcessingQueue = new Queue<TradeProcessingJob>("trade-processing", defaultQueueOptions);
export const holderAnalysisQueue = new Queue<HolderAnalysisJob>("holder-analysis", defaultQueueOptions);
export const riskAnalysisQueue = new Queue<RiskAnalysisJob>("risk-analysis", defaultQueueOptions);
export const featureCalculationQueue = new Queue<FeatureCalculationJob>("feature-calculation", defaultQueueOptions);
export const scoreCalculationQueue = new Queue<ScoreCalculationJob>("score-calculation", defaultQueueOptions);
export const alertProcessingQueue = new Queue<AlertProcessingJob>("alert-processing", defaultQueueOptions);
export const outcomeCalculationQueue = new Queue<OutcomeCalculationJob>("outcome-calculation", defaultQueueOptions);

// Helper methods to enqueue jobs with idempotency keys
export async function enqueueTokenDiscovery(job: TokenDiscoveryJob) {
  return tokenDiscoveryQueue.add("discover", job, {
    jobId: `discover:${job.mintAddress}`,
  });
}

export async function enqueueTradeProcessing(job: TradeProcessingJob) {
  return tradeProcessingQueue.add("trade", job, {
    jobId: `trade:${job.signature}`,
  });
}

export async function enqueueHolderAnalysis(job: HolderAnalysisJob) {
  return holderAnalysisQueue.add("holder-analysis", job, {
    jobId: `holder:${job.tokenId}:${Date.now()}`,
    priority: job.priority === "high" ? 1 : job.priority === "normal" ? 2 : 3,
  });
}

export async function enqueueRiskAnalysis(job: RiskAnalysisJob) {
  return riskAnalysisQueue.add("risk-check", job, {
    jobId: `risk:${job.tokenId}`,
  });
}

export async function enqueueFeatureCalculation(job: FeatureCalculationJob) {
  return featureCalculationQueue.add("calculate-features", job, {
    jobId: `features:${job.tokenId}:${job.timestamp}`,
  });
}

export async function enqueueScoreCalculation(job: ScoreCalculationJob) {
  return scoreCalculationQueue.add("calculate-score", job, {
    jobId: `score:${job.tokenId}:${job.timestamp}`,
  });
}

export async function enqueueAlertProcessing(job: AlertProcessingJob) {
  return alertProcessingQueue.add("process-alert", job, {
    jobId: `alert:${job.tokenId}:${job.scoreId}`,
  });
}

export async function enqueueOutcomeCalculation(job: OutcomeCalculationJob, delayMs?: number) {
  return outcomeCalculationQueue.add("calculate-outcome", job, {
    delay: delayMs ?? 3600000, // Default 1 hour delay
    jobId: `outcome:${job.tokenId}:${job.signalId}`,
  });
}
