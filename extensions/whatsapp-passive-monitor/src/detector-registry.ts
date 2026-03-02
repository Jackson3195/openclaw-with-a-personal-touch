import type { DetectorExecCtx } from "./interfaces/detector.ts";
import type { Logger } from "./types.ts";

type DetectorExecutor = (ctx: DetectorExecCtx) => Promise<unknown>;

export type DetectorRegistry = {
  /** Register an initialized detector executor */
  add: (executor: DetectorExecutor) => void;
  /** Run all registered detectors sequentially */
  runAll: (ctx: DetectorExecCtx) => Promise<void>;
};

export const createDetectorRegistry = (logger: Logger): DetectorRegistry => {
  const detectors: DetectorExecutor[] = [];

  return {
    add: (executor) => {
      detectors.push(executor);
    },
    runAll: async (ctx) => {
      for (const detector of detectors) {
        try {
          await detector(ctx);
        } catch (err) {
          logger.error(`detector-registry: detector failed: ${String(err)}`);
        }
      }
    },
  };
};
