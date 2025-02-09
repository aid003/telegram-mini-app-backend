import { caption } from "./caption";
import { PrismaClient } from "@prisma/client";
import TelegramBot from "node-telegram-bot-api";
import log4js from "log4js";
import path from "path";

type BotConfig = {
  token: string;
  miniAppUrl: string;
  welcomeImagePath: string;
};

if (!process.env.API_KEY_BOT) {
  throw new Error("❌ API_KEY_BOT не найден в .env");
}

const config: BotConfig = {
  token: process.env.API_KEY_BOT as string,
  miniAppUrl: `${process.env.MINI_APP_URL}`,
  welcomeImagePath: path.resolve("./public/main.jpg"),
};

export const bot = new TelegramBot(config.token, {
  polling: { interval: 200 },
});

const prisma = new PrismaClient();
const logger = log4js.getLogger();
logger.level = "info";

export async function startTelegramBot() {
  bot.on("polling_error", (err) => {
    logger.error("Polling error:", err);
    setTimeout(() => startTelegramBot(), 5000); 
  });

  bot.on("message", async (msg) => {
    if (msg.text !== "/start") return;

    const chatId = msg.chat.id;
    const tgId = msg.from?.id;
    const userName = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!tgId || !userName || !firstName) {
      logger.warn(`Missing user data for chatId: ${chatId}`);
      return bot.sendMessage(chatId, "Ошибка получения данных пользователя.");
    }

    try {
      let user = await prisma.user.findUnique({ where: { tgId } });

      if (!user) {
        user = await prisma.user.create({
          data: { tgId, userName, firstName },
        });
        logger.info(
          `Новый пользователь зарегистрирован: ${userName} (tgId: ${tgId})`
        );
      } else {
        logger.info(`Пользователь авторизован: ${userName} (tgId: ${tgId})`);
      }

      await prisma.userStatistics.upsert({
        where: { userId: user.id },
        update: { botLaunch: true },
        create: { userId: user.id, botLaunch: true },
      });

      await bot.sendPhoto(chatId, config.welcomeImagePath, {
        caption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔥 Открыть Mini App",
                web_app: { url: config.miniAppUrl },
              },
            ],
          ],
        },
      });

      logger.info(
        `Приветственное сообщение отправлено пользователю: ${userName}`
      );
    } catch (error) {
      logger.error(`Ошибка при обработке команды /start у ${tgId}:`, error);
      await bot.sendMessage(chatId, "Произошла ошибка, попробуйте снова.");
    }
  });
}
