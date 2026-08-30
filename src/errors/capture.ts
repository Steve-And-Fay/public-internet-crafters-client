import type { AnalyticsDestination, DestinationResult } from "../edge/destinations/types.js";
import { createServerErrorEvent, type ServerErrorContext } from "./server.js";

interface ServerErrorCaptureOptions<Arguments extends unknown[]> {
  context: (arguments_: Arguments, failure: unknown) => ServerErrorContext;
  destination: AnalyticsDestination;
}

export async function captureServerError(
  failure: unknown,
  context: ServerErrorContext,
  destination: AnalyticsDestination,
): Promise<DestinationResult> {
  return destination.send(createServerErrorEvent(failure, context));
}

export function withServerErrorCapture<Arguments extends unknown[], Result>(
  handler: (...arguments_: Arguments) => Promise<Result> | Result,
  options: ServerErrorCaptureOptions<Arguments>,
): (...arguments_: Arguments) => Promise<Result> {
  return async (...arguments_: Arguments): Promise<Result> => {
    try {
      return await handler(...arguments_);
    } catch (failure) {
      try {
        await captureServerError(
          failure,
          options.context(arguments_, failure),
          options.destination,
        );
      } catch {
        // Reporting must never replace the customer application's original failure.
      }

      throw failure;
    }
  };
}
