import { bot } from "./../Telegram/bot";
import { PrismaClient, Prisma } from "@prisma/client";
import expressAsyncHandler from "express-async-handler";
import log4js from "log4js";
import { Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";

// Расширяем тип входящих данных уведомления
type PaymentRequestBody = {
  notification_type: string;
  operation_id: string;
  amount: string;
  currency: string;
  datetime: string;
  sender: string;
  codepro: string; // Обычно "false"
  label: string;
  sha1_hash: string;
  unaccepted: string; // "true" или "false"
};

type PaymentResponse = {
  message: string;
};

type TelegramErrorResponse = Error & {
  response?: {
    body?: {
      description: string;
      error_code?: number;
      ok: boolean;
    };
  };
};

const prisma = new PrismaClient();
const bot_tg = bot;
const logger = log4js.getLogger();
logger.level = "info";

// Секрет для проверки хеша, полученный из настроек HTTP-уведомлений
const notificationSecret = "Fv5pZ52g3OD0N3tGQjKNZld8";

const sendSafeMessage = async (
  chatId: bigint,
  text: string,
  options?: TelegramBot.SendMessageOptions
): Promise<boolean> => {
  try {
    await bot_tg.sendMessage(chatId.toString(), text, options);
    return true;
  } catch (error) {
    const err = error as TelegramErrorResponse;
    const errorMsg = err.response?.body?.description || "Unknown error";

    if (errorMsg.includes("bot was blocked")) {
      logger.warn(`User ${chatId} blocked the bot. Deleting user from DB.`);
      await prisma.user.delete({ where: { tgId: chatId } });
    } else if (errorMsg.includes("Too Many Requests")) {
      logger.warn(`Too many requests to Telegram API. Retrying in 3s...`);
      setTimeout(() => sendSafeMessage(chatId, text, options), 3000);
    }
    logger.error(`Failed to send message to ${chatId}: ${errorMsg}`);
    return false;
  }
};

export const validatePayment = expressAsyncHandler(
  async (req: Request, res: Response<PaymentResponse>): Promise<void> => {
    // Убедитесь, что в приложении подключён middleware для urlencoded:
    // app.use(express.urlencoded({ extended: true }));

    const {
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      label,
      sha1_hash,
      unaccepted,
    } = req.body as PaymentRequestBody;

    // Шаг 1. Формируем строку для расчёта хеша согласно спецификации:
    const dataString = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${notificationSecret}&${label}`;
    // Шаг 2 и 3. Вычисляем SHA‑1 хэш и получаем его HEX‑кодированное представление:
    const calculatedHash = crypto
      .createHash("sha1")
      .update(dataString)
      .digest("hex");

    if (calculatedHash !== sha1_hash) {
      logger.error(
        `Hash validation failed for operation ${operation_id}. Calculated hash: ${calculatedHash}, received hash: ${sha1_hash}`
      );
      res.status(400).json({ message: "Hash validation failed" });
      return;
    }

    // Корректное приведение поля unaccepted к булевому значению
    const isUnaccepted = unaccepted === "true";

    try {
      logger.info(
        `Processing payment: ${label}, unaccepted: ${isUnaccepted}, operation ID: ${operation_id}`
      );

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

      if (isUnaccepted) {
        const user = await prisma.user.findUnique({
          where: { id: existingPayment.userId },
          select: { tgId: true },
        });

        if (user) {
          await sendSafeMessage(
            user.tgId,
            `❄️ Ваш платёж заморожен. Деньги не зачислены.\nНомер операции: ${operation_id}\nЕсли проблема не решится, напишите в поддержку: @GMTUSDT`
          );
        }
        res.status(200).json({ message: "Payment frozen message sent" });
        return;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
        let inviteLink: TelegramBot.ChatInviteLink;
        try {
          inviteLink = await bot_tg.createChatInviteLink(
            process.env.CHANNEL_ID as string,
            { member_limit: 1 }
          );
        } catch (error) {
          logger.error("❌ Ошибка получения ссылки на канал:", error);
          inviteLink = {
            invite_link: "",
            creator: {} as TelegramBot.User,
            is_primary: false,
            is_revoked: false,
          };
        }

        // Отправляем пользователю приглашение
        await sendSafeMessage(
          user.tgId,
          `🎉 Ваш платёж обработан! Доступ к курсу предоставлен.\n\nПрисоединяйтесь к каналу: [Нажмите сюда](${inviteLink.invite_link})`,
          { parse_mode: "Markdown" }
        );
      }

      logger.info(`Payment ${label} successfully processed.`);
      res.status(200).json({ message: "Payment processed successfully" });
    } catch (error) {
      logger.error(`Critical error processing payment ${label}: ${error}`);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);
