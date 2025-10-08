/* Serverless-compatible Express app for Vercel deployment */
const fs = require("fs");
const path = require("path");
const express = require("express");
const compression = require("compression");
const multer = require("multer");

// Import LLM module
const { generateReply } = require("./lib/llm");

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";
const LLM_USE_OPENAI =
  String(process.env.LLM_USE_OPENAI || "").toLowerCase() === "true";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

// Default System Prompt
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Answer questions based on the provided document context.

Rules:
- Give clear, accurate answers
- If the answer isn't in the document, say "I don't see that information in the document"
- Be concise but complete
- Show your reasoning when helpful

Document context:

{DOCUMENT_CONTEXT}`;

// Dynamic document context loading
let DOCUMENT_CONTEXT = "";
let DOCUMENT_LAST_MODIFIED = null;

// Function to load document context from file
async function loadDocumentContext() {
  try {
    const mammoth = require("mammoth");

    // For serverless, we'll use environment variables or external storage
    const documentContent = process.env.DOCUMENT_CONTENT || "";
    if (documentContent) {
      DOCUMENT_CONTEXT = documentContent;
      console.log(
        `📄 Document context loaded from environment (${DOCUMENT_CONTEXT.length} characters)`
      );
    } else {
      console.warn("⚠️ No document content found in environment variables");
      DOCUMENT_CONTEXT =
        "No document found. Please upload or create a document to analyze.";
    }
  } catch (error) {
    console.error("❌ Error loading document context:", error.message);
    DOCUMENT_CONTEXT =
      "Document loading error. Please check the document file.";
  }
}

// Load document context on startup
(async () => {
  await loadDocumentContext();
  console.log("✅ Document context ready for LLM");
})();

// Function to get current system prompt
async function getSystemPrompt() {
  await loadDocumentContext();

  const basePrompt = process.env.LLM_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  return basePrompt.replace(/{DOCUMENT_CONTEXT}/g, DOCUMENT_CONTEXT);
}

// Configuration
const SUPERDOC_BASE_URL =
  process.env.SUPERDOC_BASE_URL || "http://localhost:4002";

// Paths (adjusted for serverless)
const rootDir = path.resolve(__dirname, "..", "..");
const publicDir = path.join(rootDir, "server", "public");
const sharedUiDir = path.join(rootDir, "shared-ui");
const webDir = path.join(rootDir, "web");

// In-memory state (for serverless, we'll use external storage in production)
const DOCUMENT_ID = process.env.DOCUMENT_ID || "default";
const serverState = {
  checkedOutBy: null,
  lastUpdated: new Date().toISOString(),
  revision: 1,
  documentVersion: 1,
  title: "Untitled Document",
  status: "draft",
  updatedBy: null,
  updatedPlatform: null,
  approvalsRevision: 1,
};

// Helper functions (simplified for serverless)
function logActivity(type, userId, details = {}) {
  console.log(`Activity: ${type} by ${userId}`, details);
  // In production, you'd send this to an external logging service
}

function broadcast(event) {
  console.log("Broadcast event:", event);
  // In production, you'd use WebSockets or Server-Sent Events
}

function resolveUserLabel(id) {
  return id || "user1";
}

function getUserRole(userId) {
  return "editor";
}

function loadUsers() {
  return [
    { id: "user1", label: "user1", role: "editor" },
    { id: "user2", label: "user2", role: "editor" },
  ];
}

function loadRoleMap() {
  return {
    editor: { checkout: true, checkin: true, override: true, sendVendor: true },
  };
}

function loadApprovals() {
  return { approvers: [], revision: serverState.approvalsRevision };
}

function computeApprovalsSummary(list) {
  const total = Array.isArray(list) ? list.length : 0;
  const approved = Array.isArray(list)
    ? list.filter((a) => !!a.approved).length
    : 0;
  return { approved, total };
}

function buildBanner({ isCheckedOut, isOwner, checkedOutBy }) {
  if (isCheckedOut) {
    return null;
  }
  return null;
}

// Express app
const app = express();
app.use(compression());
app.use(express.json({ limit: "50mb" }));

// CORS for all origins in serverless
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Static assets
app.use(
  "/vendor",
  express.static(path.join(publicDir, "vendor"), { fallthrough: true })
);
app.use("/ui", express.static(sharedUiDir, { fallthrough: true }));
app.use("/web", express.static(webDir, { fallthrough: true }));

// Prevent caches on JSON APIs
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Debug and view pages
app.get("/debug", (req, res) => {
  res.sendFile(path.join(webDir, "debug.html"));
});

app.get(["/view", "/"], (req, res) => {
  res.sendFile(path.join(webDir, "view.html"));
});

// API endpoints (simplified for serverless)
app.get("/api/v1/health", (req, res) => {
  const llmEnabled =
    LLM_PROVIDER === "ollama" ||
    (LLM_PROVIDER === "openai" &&
      !!process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "mock");

  const llmInfo = llmEnabled
    ? {
        enabled: true,
        provider: LLM_PROVIDER,
        model: LLM_PROVIDER === "ollama" ? OLLAMA_MODEL : OPENAI_MODEL,
      }
    : {
        enabled: false,
        provider: null,
        usingMock: LLM_USE_OPENAI && process.env.OPENAI_API_KEY === "mock",
      };

  res.json({
    ok: true,
    superdoc: SUPERDOC_BASE_URL,
    llmEnabled: llmInfo.enabled,
    llmProvider: llmInfo.provider,
    llmModel: llmInfo.enabled ? llmInfo.model : null,
  });
});

app.get("/api/v1/users", (req, res) => {
  try {
    const users = loadUsers();
    const roles = loadRoleMap();
    const norm = users.map((u) => ({
      id: u.id || u.label || "user",
      label: u.label || u.id,
      role: u.role || "editor",
      title: u.title || "",
    }));
    return res.json({ items: norm, roles });
  } catch (e) {
    return res.json({
      items: [{ id: "user1", label: "user1", role: "editor" }],
      roles: { editor: {} },
    });
  }
});

app.get("/api/v1/state-matrix", (req, res) => {
  const { platform = "web", userId = "user1" } = req.query;
  const derivedRole = getUserRole(userId);
  const roleMap = loadRoleMap();
  const defaultPerms = {
    checkout: true,
    checkin: true,
    override: true,
    sendVendor: true,
  };
  const isCheckedOut = !!serverState.checkedOutBy;
  const isOwner = serverState.checkedOutBy === userId;
  const checkedOutLabel = resolveUserLabel(serverState.checkedOutBy);
  const canWrite = !isCheckedOut || isOwner;
  const rolePerm = roleMap[derivedRole] || defaultPerms;
  const banner = buildBanner({
    isCheckedOut,
    isOwner,
    checkedOutBy: checkedOutLabel,
  });
  const approvals = loadApprovals();
  const approvalsSummary = computeApprovalsSummary(approvals.approvers);

  const config = {
    documentId: DOCUMENT_ID,
    documentVersion: serverState.documentVersion,
    title: serverState.title,
    status: serverState.status,
    lastUpdated: serverState.lastUpdated,
    updatedBy: serverState.updatedBy,
    lastSaved: {
      user: serverState.updatedBy || "Unknown User",
      timestamp: serverState.lastUpdated || "Unknown Time",
    },
    buttons: {
      replaceDefaultBtn: true,
      checkoutBtn: !!rolePerm.checkout && !isCheckedOut,
      checkinBtn: !!rolePerm.checkin && isOwner,
      cancelBtn: !!rolePerm.checkin && isOwner,
      saveProgressBtn: !!rolePerm.checkin && isOwner,
      overrideBtn: !!rolePerm.override && isCheckedOut && !isOwner,
      sendVendorBtn: !!rolePerm.sendVendor,
      openGovBtn: true,
      primaryLayout: {
        mode: !isCheckedOut ? "not_checked_out" : isOwner ? "self" : "other",
      },
    },
    banner,
    banners: [],
    checkoutStatus: {
      isCheckedOut,
      checkedOutUserId: serverState.checkedOutBy,
    },
    viewerMessage: isCheckedOut
      ? {
          type: isOwner ? "info" : "warning",
          text: isOwner
            ? `Checked out by you`
            : `Checked out by ${checkedOutLabel}`,
        }
      : { type: "success", text: "Available for editing" },
    approvals: { enabled: true, summary: approvalsSummary },
  };
  res.json({ config, revision: serverState.revision });
});

// Checkout/Checkin endpoints (simplified for serverless)
app.post("/api/v1/checkout", (req, res) => {
  const userId = req.body?.userId || "user1";

  if (serverState.checkedOutBy && serverState.checkedOutBy !== userId) {
    return res
      .status(409)
      .json({ error: `Already checked out by ${serverState.checkedOutBy}` });
  }

  serverState.checkedOutBy = userId;
  serverState.lastUpdated = new Date().toISOString();

  logActivity("document:checkout", userId, {});
  broadcast({ type: "checkout", userId });
  res.json({ ok: true, checkedOutBy: userId });
});

app.post("/api/v1/checkin", (req, res) => {
  const userId = req.body?.userId || "user1";
  if (!serverState.checkedOutBy) {
    return res.status(409).json({ error: "Not checked out" });
  }
  if (serverState.checkedOutBy !== userId) {
    const by = resolveUserLabel(serverState.checkedOutBy);
    return res.status(409).json({ error: `Checked out by ${by}` });
  }
  serverState.checkedOutBy = null;
  serverState.lastUpdated = new Date().toISOString();

  logActivity("document:checkin", userId, {
    version: serverState.documentVersion,
  });

  broadcast({ type: "checkin", userId });
  res.json({ ok: true });
});

// Save progress (simplified for serverless)
app.post("/api/v1/save-progress", (req, res) => {
  try {
    const userId = req.body?.userId || "user1";
    const platform = (
      req.body?.platform ||
      req.query?.platform ||
      ""
    ).toLowerCase();
    const base64 = req.body?.base64 || "";

    // Validate payload
    let bytes;
    try {
      bytes = Buffer.from(String(base64), "base64");
    } catch {
      return res.status(400).json({ error: "invalid_base64" });
    }
    if (!bytes || bytes.length < 4)
      return res.status(400).json({ error: "invalid_payload" });
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b))
      return res.status(400).json({ error: "invalid_docx_magic" });

    // Check checkout status
    if (!serverState.checkedOutBy)
      return res.status(409).json({ error: "Not checked out" });
    if (serverState.checkedOutBy !== userId) {
      const by = resolveUserLabel(serverState.checkedOutBy);
      return res.status(409).json({ error: `Checked out by ${by}` });
    }

    // In serverless, you'd save to external storage (S3, etc.)
    console.log(`Document saved by ${userId} (${bytes.length} bytes)`);

    serverState.documentVersion =
      (Number(serverState.documentVersion) || 0) + 1;
    serverState.updatedBy = { userId, label: resolveUserLabel(userId) };
    serverState.updatedPlatform =
      platform === "word" || platform === "web" ? platform : null;
    serverState.lastUpdated = new Date().toISOString();

    logActivity("document:save", userId, {
      autoSave: false,
      size: bytes.length,
      version: serverState.documentVersion,
    });

    broadcast({ type: "saveProgress", userId, size: bytes.length });
    res.json({ ok: true, revision: serverState.revision });
  } catch (e) {
    res.status(500).json({ error: "save_progress_failed" });
  }
});

// Chat API (simplified for serverless)
app.post("/api/v1/events/client", async (req, res) => {
  try {
    const {
      type = "clientEvent",
      payload: rawPayload = {},
      userId = "user1",
      platform = "web",
    } = req.body || {};
    const role = getUserRole(userId);
    const originPlatform = String(platform || "web");
    const payload = Object.assign({}, rawPayload);

    broadcast({ type, payload, userId, role, platform: originPlatform });

    const text = String(payload?.text || "").trim();

    if (type === "chat" && text) {
      try {
        const systemPrompt = await getSystemPrompt();
        const result = await generateReply({
          messages: [{ role: "user", content: text }],
          systemPrompt,
        });
        if (result && result.ok && result.content) {
          const replyText = String(result.content).trim();
          broadcast({
            type: "chat",
            payload: { text: replyText, threadPlatform: originPlatform },
            userId: "bot",
            role: "assistant",
            platform: "server",
          });
        }
      } catch (e) {
        console.error("LLM error:", e);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "events_client_failed" });
  }
});

// SSE events (simplified for serverless)
app.get("/api/v1/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const initial = {
    documentId: DOCUMENT_ID,
    revision: serverState.revision,
    type: "hello",
    state: { checkedOutBy: serverState.checkedOutBy },
    ts: Date.now(),
  };
  res.write(`data: ${JSON.stringify(initial)}\n\n`);
  res.flush?.();

  // Keep connection alive
  const keepalive = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
      res.flush?.();
    } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(keepalive);
  });
});

// Export for Vercel
module.exports = app;
