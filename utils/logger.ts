import fs from "fs";
import path from "path";
import config from "../config.js";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logFilePath: string;

  private constructor() {
    this.logLevel = LogLevel.INFO;
    this.logFilePath = path.join(process.cwd(), config.LOG_FILE);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  public warn(message: string, error?: any): void {
    this.log(LogLevel.WARN, message, error);
  }

  public info(message: string, error?: any): void {
    this.log(LogLevel.INFO, message, error);
  }

  public debug(message: string, error?: any): void {
    this.log(LogLevel.DEBUG, message, error);
  }

  private log(level: LogLevel, message: string, error?: any): void {
    if (level > this.logLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const logMessage = `[${timestamp}] ${levelStr}: ${message}`;

    // Log to console
    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }

    // Log error details if provided
    if (error) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      console.error(`Error Details: ${errorMessage}`);
    }

    // Write to file
    try {
      const logEntry = error
        ? `${logMessage}\nError Details: ${error instanceof Error ? error.stack : String(error)}\n`
        : `${logMessage}\n`;

      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (fileError) {
      console.error(`Failed to write to log file: ${fileError}`);
    }
  }
}

export const logger = Logger.getInstance();

export default logger;
