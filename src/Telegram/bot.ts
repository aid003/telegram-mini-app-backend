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

const config: BotConfig = {
  token: process.env.API_KEY_BOT as string,
  miniAppUrl: "https://127.0.0.1:3000",
  welcomeImagePath: path.resolve("./public/main.jpg"),
};

export const bot = new TelegramBot(config.token, {
  polling: { interval: 200 },
});
const prisma = new PrismaClient();
const logger = log4js.getLogger();
logger.level = "info";

export async function startTelegramBot() {
  bot.on("polling_error", (err) => logger.error("Polling error:", err));

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

  bot.on("message", async (msg) => {
    if (msg.text !== "/statistic") return;

    const chatId = msg.chat.id;
    const tgId = msg.from?.id;

    const allowedTgIds = [2099914999, 7311013323];
    if (!allowedTgIds.includes(Number(tgId))) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    try {
      const botLaunchCount = await prisma.userStatistics.count({
        where: {
          botLaunch: true,
        },
      });

      const miniAppLinkClickedCount = await prisma.userStatistics.count({
        where: {
          miniAppLinkClicked: true,
        },
      });

      const learnMoreButtonClickedCount = await prisma.userStatistics.count({
        where: {
          learnMoreButtonClicked: true,
        },
      });

      const courseButtonClickedCount = await prisma.userStatistics.count({
        where: {
          courseButtonClicked: true,
        },
      });

      const coursePaidCount = await prisma.userStatistics.count({
        where: {
          coursePaid: true,
        },
      });

      const statisticsMessage =
        `*Статистика использования бота*\n\n` +
        `Запустили бота: ${botLaunchCount}\n` +
        `Переход по ссылке из бота в MA: ${miniAppLinkClickedCount}\n` +
        `Нажали кнопку "Узнать больше": ${learnMoreButtonClickedCount}\n` +
        `Нажали кнопку "Купить курс": ${courseButtonClickedCount}\n` +
        `Оплатили курс: ${coursePaidCount}`;

      await bot.sendMessage(chatId, statisticsMessage, {
        parse_mode: "Markdown",
      });

      logger.info(`Статистика отправлена пользователю с tgId: ${tgId}`);
    } catch (error) {
      logger.error(`Ошибка при обработке команды /statistic у ${tgId}:`, error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при получении статистики. Попробуйте снова."
      );
    }
  });
}
