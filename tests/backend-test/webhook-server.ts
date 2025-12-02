/**
 * Simple Webhook Test Server
 * 
 * Receives and logs webhook events from the indexer.
 * 
 * Usage:
 *   npx ts-node tests/backend-test/webhook-server.ts
 * 
 * Then set in .env.local:
 *   WEBHOOK_ENABLED=true
 *   WEBHOOK_URL=http://localhost:4000/webhook
 *   WEBHOOK_SECRET=test-webhook-secret-min-32-chars!!
 *   WEBHOOK_EVENTS=*
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { createHmac } from "crypto";

const PORT = 4000;
const SECRET = "test-webhook-secret-min-32-chars!!";

interface WebhookPayload {
  event: string;
  chainId: number;
  timestamp: number;
  data: Record<string, unknown>;
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  console.log(`[DEBUG] Received sig: ${signature?.substring(0, 20)}...`);
  console.log(`[DEBUG] Expected sig: ${expected.substring(0, 20)}...`);
  return signature === expected;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse) {
  const signature = req.headers["x-webhook-signature"] as string;
  const eventName = req.headers["x-webhook-event"] as string;

  try {
    const body = await parseBody(req);
    
    // Verify signature
    if (!verifySignature(body, signature)) {
      console.log(`[${formatTimestamp()}] ❌ Invalid signature`);
      res.writeHead(401);
      res.end("Invalid signature");
      return;
    }

    const payload: WebhookPayload = JSON.parse(body);

    // Log the webhook
    console.log("\n" + "=".repeat(60));
    console.log(`[${formatTimestamp()}] ✅ Webhook Received`);
    console.log("=".repeat(60));
    console.log(`Event: ${payload.event}`);
    console.log(`Chain: ${payload.chainId}`);
    console.log(`Timestamp: ${new Date(payload.timestamp * 1000).toISOString()}`);
    console.log("Data:", JSON.stringify(payload.data, null, 2));
    console.log("=".repeat(60) + "\n");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, received: eventName }));
  } catch (error) {
    console.log(`[${formatTimestamp()}] ❌ Error:`, error);
    res.writeHead(500);
    res.end("Internal error");
  }
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Signature, X-Webhook-Event");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/webhook") {
    handleWebhook(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      status: "running", 
      endpoint: "/webhook",
      method: "POST" 
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 Webhook Test Server Started");
  console.log("=".repeat(60));
  console.log(`URL: http://localhost:${PORT}/webhook`);
  console.log(`Secret: ${SECRET}`);
  console.log("\nAdd to indexer .env.local:");
  console.log("  WEBHOOK_ENABLED=true");
  console.log(`  WEBHOOK_URL=http://localhost:${PORT}/webhook`);
  console.log(`  WEBHOOK_SECRET=${SECRET}`);
  console.log("  WEBHOOK_EVENTS=*");
  console.log("\nWaiting for webhooks...\n");
});
