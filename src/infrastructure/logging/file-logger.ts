/**
 * File Logger - Writes all event processing logs to file for debugging
 */

import * as fs from "fs";
import * as path from "path";

const LOG_FILE = path.join(process.cwd(), "debug.log");

export class FileLogger {
  private static instance: FileLogger;
  private enabled: boolean;
  private logFile: string;

  private constructor() {
    this.enabled = true;
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

  private writeToFile(message: string): void {
    if (!this.enabled) return;
    try {
      fs.appendFileSync(this.logFile, message + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  public clearLog(): void {
    try {
      fs.writeFileSync(this.logFile, "");
    } catch (error) {
      console.error("Failed to clear log file:", error);
    }
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
    console.log(logLine);
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
    console.log(logLine);
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
    console.log(logLine);
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
    console.error(logLine);
  }

  public logDbOperation(operation: string, table: string, data: any): void {
    const timestamp = this.formatTimestamp();
    let logLine = `[${timestamp}] [DB] ${operation} -> ${table}`;
    logLine += `\n${JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2)}`;
    
    this.writeToFile(logLine);
    console.log(logLine);
  }
}

export function getFileLogger(): FileLogger {
  return FileLogger.getInstance();
}
