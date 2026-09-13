import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());

// The chat endpoint accepts file attachments as base64 data URLs (up to ~8MB,
// i.e. ~11.5MB encoded), so it needs a larger JSON body limit. Every other
// route keeps the small default limit to limit abuse. The route handler still
// enforces its own attachment size cap as a second line of defense.
const largeJson = express.json({ limit: "12mb" });
const defaultJson = express.json();
const PARENT_LARGE_BODY_RE = /^\/api\/parent\/[^/]+\/consultant\/(message|transcribe)$/;
app.use((req, res, next) => {
  if (req.path === "/api/chat/message" || PARENT_LARGE_BODY_RE.test(req.path))
    return largeJson(req, res, next);
  return defaultJson(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      req.log?.error({ err }, "Unhandled error");
      if (res.headersSent) return;
      res.status(500).json({ error: "Something went wrong. Please try again." });
  });

export default app;
