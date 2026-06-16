import { getAllDekaIds } from "./getAllDekaIds.js";
import { downloadDekaPDF } from "./downloadDeka.js";
import { getTotalPages } from "./getTotalpages.js";
import config from "./config.js";
import { logger, LogLevel } from "./utils/logger.js";
import { checkpointManager } from "./utils/checkpointManager.js";
import { runPool } from "./utils/pool.js";

// Set log level
logger.setLogLevel(LogLevel.INFO);

async function startWorkflow(startYear: number, endYear: number) {
  logger.info(
    `🚀 Starting DEKA download workflow for years ${startYear} - ${endYear}`,
  );

  try {
    // Clear any existing checkpoint for this year range
    await checkpointManager.clearCheckpoint();

    // STEP 1: Get total pages
    const totalPages = await getTotalPages(startYear, endYear);

    if (!totalPages) {
      logger.error("❌ No page count found");
      return;
    }

    // STEP 2: Get all IDs from all pages
    const allIds = await getAllDekaIds(startYear, endYear, totalPages);

    if (!allIds || allIds.length === 0) {
      logger.error("❌ No DEKA IDs found");
      return;
    }

    // STEP 3: Download PDFs with concurrent batching and resume capability
    const folderName = `${startYear}-${endYear}-${allIds.length}`;
    const CONCURRENCY_LIMIT = config.DOWNLOAD_CONCURRENCY_LIMIT;

    // Track progress
    let downloadedIds: string[] = [];
    let failedIds: string[] = [];

    // Try to load checkpoint if resume is enabled
    if (config.ENABLE_RESUME) {
      const checkpoint = await checkpointManager.loadCheckpoint(
        startYear,
        endYear,
      );
      if (checkpoint) {
        downloadedIds = [...checkpoint.downloadedIds];
        failedIds = [...checkpoint.failedIds];
        logger.info(
          `Resuming from checkpoint: ${downloadedIds.length} downloaded, ${failedIds.length} failed`,
        );
      }
    }

    // Filter out already downloaded IDs
    const remainingIds = allIds.filter((id) => !downloadedIds.includes(id));
    logger.info(
      `📂 Starting download of ${remainingIds.length} PDF files (${CONCURRENCY_LIMIT} workers, streaming)...`,
    );

    // Run downloads through a streaming worker pool: each worker grabs the next
    // ID the moment it finishes, so one slow/retrying download never blocks the
    // rest. Checkpoint is persisted every `CHECKPOINT_EVERY` completions.
    const downloadAll = async (ids: string[]) =>
      runPool(
        ids,
        CONCURRENCY_LIMIT,
        async (docId) => ({
          docId,
          success: await downloadDekaPDF(docId, folderName),
        }),
        async ({ docId, success }, _item, _index, { completed, total }) => {
          if (success) {
            downloadedIds.push(docId);
          } else {
            failedIds.push(docId);
          }

          if (
            completed % config.CHECKPOINT_EVERY === 0 ||
            completed === total
          ) {
            logger.info(
              `📦 Progress: ${completed}/${total} (✅ ${downloadedIds.length} / ❌ ${failedIds.length})`,
            );
            await checkpointManager.saveCheckpoint(
              startYear,
              endYear,
              downloadedIds,
              failedIds,
            );
          }
        },
      );

    await downloadAll(remainingIds);

    // One more pass over anything that still failed (server may have been busy).
    if (failedIds.length > 0) {
      const toRetry = [...failedIds];
      failedIds = [];
      logger.warn(`🔁 Retrying ${toRetry.length} failed downloads...`);
      await downloadAll(toRetry);

      await checkpointManager.saveCheckpoint(
        startYear,
        endYear,
        downloadedIds,
        failedIds,
      );
    }

    logger.info(
      `✨ Workflow completed! Successfully downloaded ${downloadedIds.length} files to ${config.DOWNLOAD_DIR}/${folderName}`,
    );

    if (failedIds.length > 0) {
      logger.error(
        `❌ Failed to download ${failedIds.length} files: ${failedIds.join(", ")}`,
      );
    }

    // Clear checkpoint on successful completion
    if (failedIds.length === 0) {
      await checkpointManager.clearCheckpoint();
    }
  } catch (error) {
    logger.error("❌ Error in workflow", error);
  }
}

const YEAR_RANGES = [
  // { startYear: 2568, endYear: 2569 },
  // { startYear: 2567, endYear: 2568 }
  // { startYear: 2566, endYear: 2567 },
  // { startYear: 2565, endYear: 2566 },
  // { startYear: 2564, endYear: 2565 },
  // { startYear: 2563, endYear: 2564 },
  // { startYear: 2562, endYear: 2563 },
  // { startYear: 2561, endYear: 2562 },
  // { startYear: 2560, endYear: 2561 },
  // { startYear: 2559, endYear: 2560 },
  // { startYear: 2558, endYear: 2559 },
  // { startYear: 2557, endYear: 2558 },
  // { startYear: 2556, endYear: 2557 },
  // { startYear: 2555, endYear: 2556 },
  // { startYear: 2554, endYear: 2555 },
  { startYear: 2553, endYear: 2554 },
  { startYear: 2552, endYear: 2553 },
  { startYear: 2551, endYear: 2552 },
  { startYear: 2550, endYear: 2551 },
];

async function runAllYearRanges() {
  for (const { startYear, endYear } of YEAR_RANGES) {
    await startWorkflow(startYear, endYear);
  }
}

// Run the workflow
runAllYearRanges();
