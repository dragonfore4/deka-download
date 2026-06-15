import fs from "fs";
import path from "path";
import config from "../config.js";
import { logger } from "./logger.js";

export interface CheckpointData {
  yearRange: {
    startYear: number;
    endYear: number;
  };
  downloadedIds: string[];
  failedIds: string[];
  timestamp: string;
}

export class CheckpointManager {
  private static instance: CheckpointManager;
  private checkpointFilePath: string;

  private constructor() {
    this.checkpointFilePath = path.join(process.cwd(), config.CHECKPOINT_FILE);
  }

  public static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  public async saveCheckpoint(
    startYear: number,
    endYear: number,
    downloadedIds: string[],
    failedIds: string[],
  ): Promise<void> {
    if (!config.ENABLE_RESUME) {
      return;
    }

    try {
      const checkpointData: CheckpointData = {
        yearRange: { startYear, endYear },
        downloadedIds,
        failedIds,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(
        this.checkpointFilePath,
        JSON.stringify(checkpointData, null, 2),
      );

      logger.debug(`Checkpoint saved for years ${startYear}-${endYear}`);
    } catch (error) {
      logger.error("Failed to save checkpoint", error);
    }
  }

  public async loadCheckpoint(
    startYear: number,
    endYear: number,
  ): Promise<CheckpointData | null> {
    if (!config.ENABLE_RESUME) {
      return null;
    }

    try {
      if (!fs.existsSync(this.checkpointFilePath)) {
        logger.debug("No checkpoint file found");
        return null;
      }

      const data = fs.readFileSync(this.checkpointFilePath, "utf8");
      const checkpointData: CheckpointData = JSON.parse(data);

      // Verify this checkpoint is for the same year range
      if (
        checkpointData.yearRange.startYear === startYear &&
        checkpointData.yearRange.endYear === endYear
      ) {
        logger.info(
          `Loaded checkpoint from ${checkpointData.timestamp} with ${checkpointData.downloadedIds.length} downloaded and ${checkpointData.failedIds.length} failed IDs`,
        );
        return checkpointData;
      } else {
        logger.info(
          `Found checkpoint for different year range (${checkpointData.yearRange.startYear}-${checkpointData.yearRange.endYear}), ignoring`,
        );
        return null;
      }
    } catch (error) {
      logger.error("Failed to load checkpoint", error);
      return null;
    }
  }

  public async clearCheckpoint(): Promise<void> {
    try {
      if (fs.existsSync(this.checkpointFilePath)) {
        fs.unlinkSync(this.checkpointFilePath);
        logger.debug("Checkpoint file cleared");
      }
    } catch (error) {
      logger.error("Failed to clear checkpoint", error);
    }
  }
}

export const checkpointManager = CheckpointManager.getInstance();

export default checkpointManager;
