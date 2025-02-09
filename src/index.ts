import { generatePaymentProcess } from "./Controller/PaymentController/generatePaymentProcess";
import { PrismaClient } from "@prisma/client";
import express from "express";
import dotenv from "dotenv";
import log4js from "log4js";
import cors from "cors";
import { userController } from "./Controller/UserController/userController";
import { updateUserStatistics } from "./Controller/StatisticController/statisticController";
import { startTelegramBot } from "./Telegram/bot";
import { validatePayment } from "./PaymentHandler/paymentHandler";

dotenv.config();

log4js.configure({
  appenders: {
    console: { type: "console" },
    file: { type: "file", filename: "app.log" },
  },
  categories: {
    default: { appenders: ["console", "file"], level: "info" },
  },
});

const logger = log4js.getLogger();
logger.level = "info";

const prisma = new PrismaClient();

const app = express();

async function main() {
  app.use(express.json());
  app.use(
    cors({
      origin: "*",
      methods: ["POST", "GET"],
    })
  );
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/user-controller/", userController);
  app.use("/api/update-user-statictics/", updateUserStatistics);
  app.use("/api/generate-payment-process/", generatePaymentProcess);

  app.use("/api/endpoint-for-validate-payment/", validatePayment);

  await startTelegramBot();

  app.get("/", (req, res) => {
    res.send("working...");
  });

  app.listen(process.env.PORT, () => {
    logger.info(
      `🚀 Server with telegram bot running on port ${process.env.PORT}`
    );
  });
}

main().catch((e) => {
  logger.error("ERROR: Произошла ошибка в main()", e);
  prisma.$disconnect();
  process.exit(1);
});
