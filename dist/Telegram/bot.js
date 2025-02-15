"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
exports.startTelegramBot = startTelegramBot;
const caption_1 = require("./caption");
const client_1 = require("@prisma/client");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const log4js_1 = __importDefault(require("log4js"));
const path_1 = __importDefault(require("path"));
if (!process.env.API_KEY_BOT) {
    throw new Error("❌ API_KEY_BOT не найден в .env");
}
const config = {
    token: process.env.API_KEY_BOT,
    miniAppUrl: `${process.env.MINI_APP_URL}`,
    welcomeImagePath: path_1.default.resolve("./public/main.jpg"),
};
exports.bot = new node_telegram_bot_api_1.default(config.token, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 30,
        },
    },
});
const prisma = new client_1.PrismaClient();
const logger = log4js_1.default.getLogger();
logger.level = "info";
async function startTelegramBot() {
    exports.bot.on("polling_error", (err) => {
        logger.error("Polling error:", err);
        setTimeout(() => startTelegramBot(), 5000);
    });
    exports.bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const tgId = msg.from?.id;
        const text = msg.text?.trim() || "";
        if (!tgId) {
            logger.warn("Сообщение получено без tgId");
            return exports.bot.sendMessage(chatId, "Ошибка: не удалось определить ваш Telegram ID.");
        }
        if (text === "/start") {
            const userName = msg.from?.username;
            const firstName = msg.from?.first_name;
            if (!userName || !firstName) {
                logger.warn(`Не удалось получить имя пользователя. ChatId: ${chatId}`);
                return exports.bot.sendMessage(chatId, "Ошибка получения данных пользователя.");
            }
            try {
                let user = await prisma.user.findUnique({ where: { tgId } });
                if (!user) {
                    user = await prisma.user.create({
                        data: { tgId, userName, firstName },
                    });
                    logger.info(`🆕 Новый пользователь зарегистрирован: ${userName} (tgId: ${tgId})`);
                }
                else {
                    logger.info(`✅ Пользователь авторизован: ${userName} (tgId: ${tgId})`);
                }
                await prisma.userStatistics.upsert({
                    where: { userId: user.id },
                    update: { botLaunch: true },
                    create: { userId: user.id, botLaunch: true },
                });
                await exports.bot.sendPhoto(chatId, config.welcomeImagePath, {
                    caption: caption_1.caption,
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Пройти тест",
                                    web_app: { url: config.miniAppUrl },
                                },
                            ],
                        ],
                    },
                });
                logger.info(`📩 Приветственное сообщение отправлено пользователю: ${userName}`);
            }
            catch (error) {
                logger.error(`Ошибка при обработке команды /start у ${tgId}:`, error);
                await exports.bot.sendMessage(chatId, "Произошла ошибка, попробуйте снова.");
            }
        }
        if (text === "/statistic") {
            const allowedTgIds = [2099914999, 7311013323];
            if (!allowedTgIds.includes(Number(tgId))) {
                logger.warn(`⛔ Пользователь ${tgId} пытался запросить статистику`);
                return exports.bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
            }
            try {
                const [botLaunchCount, miniAppLinkClickedCount, learnMoreButtonClickedCount, courseButtonClickedCount, coursePaidCount,] = await Promise.all([
                    prisma.userStatistics.count({ where: { botLaunch: true } }),
                    prisma.userStatistics.count({ where: { miniAppLinkClicked: true } }),
                    prisma.userStatistics.count({
                        where: { learnMoreButtonClicked: true },
                    }),
                    prisma.userStatistics.count({ where: { courseButtonClicked: true } }),
                    prisma.userStatistics.count({ where: { coursePaid: true } }),
                ]);
                const totalUsers = botLaunchCount || 1; // Защита от деления на 0
                const miniAppConversion = ((miniAppLinkClickedCount / totalUsers) *
                    100).toFixed(2);
                const learnMoreConversion = ((learnMoreButtonClickedCount / miniAppLinkClickedCount) *
                    100).toFixed(2);
                const courseButtonConversion = ((courseButtonClickedCount / learnMoreButtonClickedCount) *
                    100).toFixed(2);
                const coursePaidConversion = ((coursePaidCount / courseButtonClickedCount) *
                    100).toFixed(2);
                const learnMoreGlobalConversion = ((learnMoreButtonClickedCount / totalUsers) *
                    100).toFixed(2);
                const courseButtonGlobalConversion = ((courseButtonClickedCount / totalUsers) *
                    100).toFixed(2);
                const coursePaidGlobalConversion = ((coursePaidCount / totalUsers) *
                    100).toFixed(2);
                const statisticsMessage = `📊 *Статистика воронки продаж* 📊\n\n` +
                    `🚀 *Запустили бота:* ${botLaunchCount}\n` +
                    `🔗 *Перешли в Mini App:* ${miniAppLinkClickedCount} (${miniAppConversion}%)\n` +
                    `❓ *Нажали "Узнать больше":* ${learnMoreButtonClickedCount} (${learnMoreConversion}% | ${learnMoreGlobalConversion}%)\n` +
                    `💳 *Нажали "Купить курс":* ${courseButtonClickedCount} (${courseButtonConversion}% | ${courseButtonGlobalConversion}%)\n` +
                    `✅ *Оплатили курс:* ${coursePaidCount} (${coursePaidConversion}% | ${coursePaidGlobalConversion}%)`;
                await exports.bot.sendMessage(chatId, statisticsMessage, {
                    parse_mode: "Markdown",
                });
                logger.info(`📊 Статистика отправлена пользователю с tgId: ${tgId}`);
            }
            catch (error) {
                logger.error(`Ошибка при обработке команды /statistic у ${tgId}:`, error);
                await exports.bot.sendMessage(chatId, "Произошла ошибка при получении статистики. Попробуйте снова.");
            }
        }
    });
    exports.bot.on("callback_query", async (query) => {
        const chatId = query.message?.chat.id;
        const data = query.data;
        if (!chatId || !data)
            return;
        logger.info(`🔘 Получен callback_query: ${data}`);
        if (data === "some_action") {
            await exports.bot.sendMessage(chatId, "Вы нажали кнопку!");
        }
        await exports.bot.answerCallbackQuery(query.id);
    });
    logger.info("✅ Бот успешно запущен и слушает сообщения.");
}
//# sourceMappingURL=bot.js.map