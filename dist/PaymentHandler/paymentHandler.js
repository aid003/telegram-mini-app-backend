"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayment = void 0;
const bot_1 = require("./../Telegram/bot");
const client_1 = require("@prisma/client");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const log4js_1 = __importDefault(require("log4js"));
const prisma = new client_1.PrismaClient();
const bot_tg = bot_1.bot;
const logger = log4js_1.default.getLogger();
logger.level = "info";
const sendSafeMessage = async (chatId, text, options) => {
    try {
        await bot_tg.sendMessage(chatId.toString(), text, options);
        return true;
    }
    catch (error) {
        const err = error;
        const errorMsg = err.response?.body?.description || "Unknown error";
        if (errorMsg.includes("bot was blocked")) {
            logger.warn(`User ${chatId} blocked the bot. Deleting user from DB.`);
            await prisma.user.delete({ where: { tgId: chatId } });
        }
        else if (errorMsg.includes("Too Many Requests")) {
            logger.warn(`Too many requests to Telegram API. Retrying in 3s...`);
            setTimeout(() => sendSafeMessage(chatId, text, options), 3000);
        }
        logger.error(`Failed to send message to ${chatId}: ${errorMsg}`);
        return false;
    }
};
exports.validatePayment = (0, express_async_handler_1.default)(async (req, res) => {
    const { label, unaccepted, operation_id } = req.body;
    try {
        logger.info(`Processing payment: ${label}, status: ${unaccepted}, operation ID: ${operation_id}`);
        const existingPayment = await prisma.payment.findUnique({
            where: { order_id: label },
            select: { status: true, processedAt: true, userId: true },
        });
        if (!existingPayment) {
            logger.error(`Payment ${label} not found`);
            res.status(404).json({ message: "Payment not found" });
            return;
        }
        if (existingPayment.status === "SUCCESS" || existingPayment.processedAt) {
            logger.warn(`Payment ${label} already processed.`);
            res.status(200).json({ message: "Payment already processed" });
            return;
        }
        if (unaccepted) {
            const user = await prisma.user.findUnique({
                where: { id: existingPayment.userId },
                select: { tgId: true },
            });
            if (user) {
                await sendSafeMessage(user.tgId, `❄️ Ваш платёж заморожен. Деньги не зачислены.\nНомер операции: ${operation_id}\nЕсли проблема не решится, напишите в поддержку: @GMTUSDT`);
            }
            res.status(200).json({ message: "Payment frozen message sent" });
            return;
        }
        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { order_id: label },
                data: { status: "SUCCESS", processedAt: new Date() },
            });
            await tx.userStatistics.upsert({
                where: { userId: existingPayment.userId },
                update: { coursePaid: true },
                create: { userId: existingPayment.userId, coursePaid: true },
            });
        });
        const user = await prisma.user.findUnique({
            where: { id: existingPayment.userId },
            select: { tgId: true, userName: true },
        });
        if (user) {
            let inviteLink;
            try {
                inviteLink = await bot_tg.createChatInviteLink(process.env.CHANNEL_ID, { member_limit: 1 });
            }
            catch (error) {
                logger.error("❌ Ошибка получения ссылки на канал:", error);
                inviteLink = {
                    invite_link: "",
                    creator: {},
                    is_primary: false,
                    is_revoked: false,
                };
            }
            // Отправляем пользователю приглашение
            await sendSafeMessage(user.tgId, `🎉 Ваш платёж обработан! Доступ к курсу предоставлен.\n\nПрисоединяйтесь к каналу: [Нажмите сюда](${inviteLink.invite_link})`, { parse_mode: "Markdown" });
        }
        logger.info(`Payment ${label} successfully processed.`);
        res.status(200).json({ message: "Payment processed successfully" });
    }
    catch (error) {
        logger.error(`Critical error processing payment ${label}: ${error}`);
        res.status(500).json({ message: "Internal server error" });
    }
});
//# sourceMappingURL=paymentHandler.js.map