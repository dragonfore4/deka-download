import { logger } from "./logger.js";

export interface PoolProgress {
  /** How many items have finished (success or failure) so far. */
  completed: number;
  /** Total number of items in this run. */
  total: number;
}

/**
 * Run `worker` over every item using a fixed-size pool of concurrent workers.
 *
 * Unlike a batch+`Promise.all` loop, there is no barrier between items: as soon
 * as one worker finishes it immediately pulls the next item, so a single slow or
 * retrying item never holds up the rest of the pool (no head-of-line blocking).
 *
 * Results are returned in the original order of `items`. `onResult` is awaited
 * after each completion, which makes it a safe place to do periodic checkpointing.
 */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onResult?: (
    result: R,
    item: T,
    index: number,
    progress: PoolProgress,
  ) => void | Promise<void>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const total = items.length;
  const workerCount = Math.max(1, Math.min(concurrency, total));

  let nextIndex = 0;
  let completed = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= total) return;

      const item = items[index]!;
      const result = await worker(item, index);
      results[index] = result;
      completed++;

      if (onResult) {
        try {
          await onResult(result, item, index, { completed, total });
        } catch (error) {
          logger.error("Error in pool onResult callback", error);
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return results;
}

/** Sleep for a random duration in [0, maxMs] to avoid firing requests in lockstep. */
export async function jitter(maxMs: number): Promise<void> {
  if (maxMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, Math.random() * maxMs));
}
