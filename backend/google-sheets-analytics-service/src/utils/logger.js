// filepath: /Users/I528966/Desktop/BITS/APIBP-20242YA-Team-1/backend/email-storage-service/src/utils/logger.js
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const levelName = (process.env.LOG_LEVEL || "info").toLowerCase();
const activeLevel = LEVELS[levelName] ?? LEVELS.info;
const isProd = process.env.NODE_ENV === "production";

function fmtBase(level) {
  return isProd ? { ts: new Date().toISOString(), level } : { level };
}

function serialize(arg) {
  if (arg instanceof Error) {
    return { message: arg.message, stack: arg.stack, name: arg.name };
  }
  return arg;
}

function write(level, msg, meta) {
  if (LEVELS[level] > activeLevel) return;
  const base = fmtBase(level);
  const payload = { ...base, msg, ...(meta ? { meta: serialize(meta) } : {}) };
  const line = isProd ? JSON.stringify(payload) : `[${level.toUpperCase()}] ${msg}${meta ? ` :: ${typeof meta === "string" ? meta : JSON.stringify(serialize(meta))}` : ""}`;
  // Route to console method by level
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(line);
}

function makeLogger(ctx = {}) {
  return {
    info: (msg, meta) => write("info", msg, { ...ctx, ...(meta || {}) }),
    warn: (msg, meta) => write("warn", msg, { ...ctx, ...(meta || {}) }),
    error: (err, meta) => {
      const body = err instanceof Error ? serialize(err) : { message: String(err) };
      write("error", body.message || "error", { ...ctx, ...body, ...(meta || {}) });
    },
    debug: (msg, meta) => write("debug", msg, { ...ctx, ...(meta || {}) }),
    child: (extra = {}) => makeLogger({ ...ctx, ...extra }),
  };
}

const logger = makeLogger();
export default logger;

// Express request logger middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    logger.info(`${method} ${originalUrl} -> ${status} (${duration}ms)`, {
      status,
      method,
      url: originalUrl,
      durationMs: duration,
      user: req.user?.email || null,
    });
  });
  next();
}
