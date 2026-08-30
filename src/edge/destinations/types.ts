import type { AnalyticsEventEnvelope } from "../../contracts/analytics-event.js";

export interface DestinationResult {
  accepted: boolean;
  status: number;
}

export interface AnalyticsDestination {
  send(event: AnalyticsEventEnvelope): Promise<DestinationResult>;
}
