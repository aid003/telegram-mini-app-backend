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
    const chatId = msg.chat.id;
    const tgId = msg.from?.id;
    const text = msg.text?.trim() || "";

    if (!tgId) {
      logger.warn("Сообщение получено без tgId");
      return bot.sendMessage(
        chatId,
        "Ошибка: не удалось определить ваш Telegram ID."
      );
    }

    if (text === "/start") {
      const userName = msg.from?.username;
      const firstName = msg.from?.first_name;

      if (!userName || !firstName) {
        logger.warn(`Не удалось получить имя пользователя. ChatId: ${chatId}`);
        return bot.sendMessage(chatId, "Ошибка получения данных пользователя.");
      }

      try {
        let user = await prisma.user.findUnique({ where: { tgId } });

        if (!user) {
          user = await prisma.user.create({
            data: { tgId, userName, firstName },
          });
          logger.info(
            `🆕 Новый пользователь зарегистрирован: ${userName} (tgId: ${tgId})`
          );
        } else {
          logger.info(
            `✅ Пользователь авторизован: ${userName} (tgId: ${tgId})`
          );
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
          `📩 Приветственное сообщение отправлено пользователю: ${userName}`
        );
      } catch (error) {
        logger.error(`Ошибка при обработке команды /start у ${tgId}:`, error);
        await bot.sendMessage(chatId, "Произошла ошибка, попробуйте снова.");
      }
    }

    if (text === "/statistic") {
      const allowedTgIds = [2099914999, 7311013323];

      if (!allowedTgIds.includes(Number(tgId))) {
        logger.warn(`⛔ Пользователь ${tgId} пытался запросить статистику`);
        return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
      }

      try {
        const [
          botLaunchCount,
          miniAppLinkClickedCount,
          learnMoreButtonClickedCount,
          courseButtonClickedCount,
          coursePaidCount,
        ] = await Promise.all([
          prisma.userStatistics.count({ where: { botLaunch: true } }),
          prisma.userStatistics.count({ where: { miniAppLinkClicked: true } }),
          prisma.userStatistics.count({
            where: { learnMoreButtonClicked: true },
          }),
          prisma.userStatistics.count({ where: { courseButtonClicked: true } }),
          prisma.userStatistics.count({ where: { coursePaid: true } }),
        ]);

        const totalUsers = botLaunchCount || 1; // Защита от деления на 0
        const miniAppConversion = (
          (miniAppLinkClickedCount / totalUsers) *
          100
        ).toFixed(2);
        const learnMoreConversion = (
          (learnMoreButtonClickedCount / miniAppLinkClickedCount) *
          100
        ).toFixed(2);
        const courseButtonConversion = (
          (courseButtonClickedCount / learnMoreButtonClickedCount) *
          100
        ).toFixed(2);
        const coursePaidConversion = (
          (coursePaidCount / courseButtonClickedCount) *
          100
        ).toFixed(2);

        const learnMoreGlobalConversion = (
          (learnMoreButtonClickedCount / totalUsers) *
          100
        ).toFixed(2);
        const courseButtonGlobalConversion = (
          (courseButtonClickedCount / totalUsers) *
          100
        ).toFixed(2);
        const coursePaidGlobalConversion = (
          (coursePaidCount / totalUsers) *
          100
        ).toFixed(2);

        const statisticsMessage =
          `📊 *Статистика воронки продаж* 📊\n\n` +
          `🚀 *Запустили бота:* ${botLaunchCount}\n` +
          `🔗 *Перешли в Mini App:* ${miniAppLinkClickedCount} (${miniAppConversion}%)\n` +
          `❓ *Нажали "Узнать больше":* ${learnMoreButtonClickedCount} (${learnMoreConversion}% | от начального: ${learnMoreGlobalConversion}%)\n` +
          `💳 *Нажали "Купить курс":* ${courseButtonClickedCount} (${courseButtonConversion}% | от начального: ${courseButtonGlobalConversion}%)\n` +
          `✅ *Оплатили курс:* ${coursePaidCount} (${coursePaidConversion}% | от начального: ${coursePaidGlobalConversion}%)`;

        await bot.sendMessage(chatId, statisticsMessage, {
          parse_mode: "Markdown",
        });

        logger.info(`📊 Статистика отправлена пользователю с tgId: ${tgId}`);
      } catch (error) {
        logger.error(
          `Ошибка при обработке команды /statistic у ${tgId}:`,
          error
        );
        await bot.sendMessage(
          chatId,
          "Произошла ошибка при получении статистики. Попробуйте снова."
        );
      }
    }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const data = query.data;

    if (!chatId || !data) return;

    logger.info(`🔘 Получен callback_query: ${data}`);

    if (data === "some_action") {
      await bot.sendMessage(chatId, "Вы нажали кнопку!");
    }

    await bot.answerCallbackQuery(query.id);
  });

  logger.info("✅ Бот успешно запущен и слушает сообщения.");
}
