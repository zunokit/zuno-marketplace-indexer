/**
 * File Logger - Writes all event processing logs to file for debugging
 * 
 * Configuration via environment variables:
 * - LOG_FILE_PATH: Custom log file path (default: ./debug.log)
 * - FILE_LOGGING_ENABLED: Enable/disable file logging (default: true)
 * - FILE_LOGGING_CONSOLE: Enable/disable console output (default: false)
 */

import * as fs from "fs/promises";
import * as path from "path";

const LOG_FILE = process.env.LOG_FILE_PATH || path.join(process.cwd(), "debug.log");

export class FileLogger {
  private static instance: FileLogger;
  private enabled: boolean;
  private consoleEnabled: boolean;
  private logFile: string;
  private writeQueue: string[] = [];
  private isWriting: boolean = false;

  private constructor() {
    this.enabled = process.env.FILE_LOGGING_ENABLED !== "false";
    this.consoleEnabled = process.env.FILE_LOGGING_CONSOLE === "true";
    this.logFile = LOG_FILE;
    // Clear log file on startup
    this.clearLog();
    this.log("=== Zuno Marketplace Indexer Started ===");
  }

  public static getInstance(): FileLogger {
    if (!FileLogger.instance) {
      FileLogger.instance = new FileLogger();
    }
    return FileLogger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;
    
    this.isWriting = true;
    try {
      const messages = this.writeQueue.splice(0, this.writeQueue.length);
      await fs.appendFile(this.logFile, messages.join("\n") + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    } finally {
      this.isWriting = false;
      if (this.writeQueue.length > 0) {
        this.processWriteQueue();
      }
    }
  }

  private writeToFile(message: string): void {
    if (!this.enabled) return;
    this.writeQueue.push(message);
    this.processWriteQueue();
  }

  public clearLog(): void {
    fs.writeFile(this.logFile, "").catch((error) => {
      console.error("Failed to clear log file:", error);
    });
  }

  public log(message: string, data?: any): void {
    const timestamp = this.formatTimestamp();
    let logLine = `[${timestamp}] ${message}`;
    if (data !== undefined) {
      logLine += `\n${JSON.stringify(data, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2)}`;
    }
    this.writeToFile(logLine);
    if (this.consoleEnabled) console.log(logLine);
  }

  public logEvent(eventName: string, phase: "START" | "SUCCESS" | "ERROR", details: any): void {
    const timestamp = this.formatTimestamp();
    const icon = phase === "START" ? ">>>" : phase === "SUCCESS" ? "OK " : "ERR";
    let logLine = `[${timestamp}] [${icon}] ${eventName}`;
    if (details !== undefined) {
      logLine += `\n${JSON.stringify(details, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2)}`;
    }
    this.writeToFile(logLine);
    this.writeToFile("---");
    if (this.consoleEnabled) console.log(logLine);
  }

  public logRawEvent(eventName: string, event: any, context: any): void {
    const timestamp = this.formatTimestamp();
    const logData = {
      eventName,
      chainId: context?.network?.chainId,
      blockNumber: event?.block?.number?.toString(),
      txHash: event?.transaction?.hash,
      logIndex: event?.log?.logIndex,
      contractAddress: event?.log?.address,
      args: event?.args,
    };
    
    let logLine = `[${timestamp}] [RAW] ${eventName}`;
    logLine += `\n${JSON.stringify(logData, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2)}`;
    
    this.writeToFile(logLine);
    this.writeToFile("===");
    if (this.consoleEnabled) console.log(logLine);
  }

  public logError(eventName: string, error: Error, context?: any): void {
    const timestamp = this.formatTimestamp();
    const logData = {
      error: error.message,
      stack: error.stack,
      context,
    };
    
    let logLine = `[${timestamp}] [ERROR] ${eventName}`;
    logLine += `\n${JSON.stringify(logData, null, 2)}`;
    
    this.writeToFile(logLine);
    this.writeToFile("!!!ERROR!!!");
    if (this.consoleEnabled) console.error(logLine);
  }

  public logDbOperation(operation: string, table: string, data: any): void {
    const timestamp = this.formatTimestamp();
    let logLine = `[${timestamp}] [DB] ${operation} -> ${table}`;
    logLine += `\n${JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2)}`;
    
    this.writeToFile(logLine);
    if (this.consoleEnabled) console.log(logLine);
  }
}

export function getFileLogger(): FileLogger {
  return FileLogger.getInstance();
}
