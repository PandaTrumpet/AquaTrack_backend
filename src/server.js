import express from "express";
import pino from "pino-http";
import cors from "cors";
import { env } from "./utils/env.js";
import { config } from "dotenv";
import router from "./routers/index.js";
import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/errorHandler.js";
import { UPLOAD_DIR } from "./constans/index.js";
import { swaggerDocs } from "./middlewares/swaggerDocs.js";

config();

const PORT = Number(env("PORT", 3000));
const app = express({
  type: ["application/json", "application/vnd.api+json"],
});

export const startServer = () => {
  app.use(pino({ transport: { target: "pino-pretty" } }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.use("/api-docs", swaggerDocs());

  app.get("/", (req, res) => {
    res.json({ message: "Hello  world" });
  });
  app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  app.listen(PORT, () => {
    console.log(`Server is running in port ${PORT}`);
  });
};
