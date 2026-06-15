import { getAllDekaIds } from "./getAllDekaIds.js";
import { downloadDekaPDF } from "./downloadDeka.js";
import { getTotalPages } from "./getTotalpages.js";
import config from "./config.js";
import { logger, LogLevel } from "./utils/logger.js";
import { checkpointManager } from "./utils/checkpointManager.js";

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
    const folderName = `${startYear}-${endYear}`;
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
    let remainingIds = allIds.filter((id) => !downloadedIds.includes(id));
    logger.info(
      `📂 Starting download of ${remainingIds.length} PDF files (${CONCURRENCY_LIMIT} at a time)...`,
    );

    for (let i = 0; i < remainingIds.length; i += CONCURRENCY_LIMIT) {
      // Create batch
      const batch = remainingIds.slice(i, i + CONCURRENCY_LIMIT);

      logger.info(
        `\n⏳ Downloading batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} (IDs: ${batch.join(", ")})`,
      );

      // Download concurrently in this batch
      const results = await Promise.all(
        batch.map(async (docId) => {
          const success = await downloadDekaPDF(docId, folderName);
          return { docId, success };
        }),
      );

      // Update progress tracking
      results.forEach(({ docId, success }) => {
        if (success) {
          downloadedIds.push(docId);
        } else {
          failedIds.push(docId);
        }
      });

      // Save checkpoint
      await checkpointManager.saveCheckpoint(
        startYear,
        endYear,
        downloadedIds,
        failedIds,
      );

      // Delay between batches to be kind to the server
      if (i + CONCURRENCY_LIMIT < remainingIds.length) {
        logger.info(
          `Pausing for ${config.BATCH_DELAY_MS}ms before next batch...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, config.BATCH_DELAY_MS),
        );
      }
    }

    // Handle failed downloads with retries
    if (failedIds.length > 0) {
      logger.warn(`🔁 Retrying ${failedIds.length} failed downloads...`);
      const retryResults = await Promise.all(
        failedIds.map(async (docId) => {
          const success = await downloadDekaPDF(docId, folderName);
          return { docId, success };
        }),
      );

      // Update final results
      retryResults.forEach(({ docId, success }) => {
        if (success) {
          // Move from failed to downloaded
          failedIds = failedIds.filter((id) => id !== docId);
          downloadedIds.push(docId);
        }
      });

      // Save final checkpoint
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
  { startYear: 2568, endYear: 2569 },
  { startYear: 2567, endYear: 2568 },
];

async function runAllYearRanges() {
  for (const { startYear, endYear } of YEAR_RANGES) {
    await startWorkflow(startYear, endYear);
  }
}

// Run the workflow
runAllYearRanges();
