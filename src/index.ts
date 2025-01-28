import { PrismaClient } from "@prisma/client";
import express from "express";
import dotenv from "dotenv";
import log4js from "log4js";
import TelegramBot from "node-telegram-bot-api";
import morgan from "morgan";
import https from "https";
import cors from "cors";

dotenv.config();

const prisma = new PrismaClient();

const logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL;

// logger.info("log4js log info");
// logger.debug("log4js log debug");
// logger.error("log4js log error");

const app = express();

async function main() {
  app.use(morgan("tiny"));
  app.use(express.json());
  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/generate-payment-link");

  app.listen(process.env.PORT, () => {
    logger.info(`🚀 Server running on port ${process.env.PORT}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
