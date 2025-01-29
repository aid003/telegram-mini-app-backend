import { PrismaClient } from "@prisma/client";
import TelegramBot from "node-telegram-bot-api";
import expressAsyncHandler from "express-async-handler";
import log4js from "log4js";
import { Request, Response } from "express";

const prisma = new PrismaClient();
const bot_tg = new TelegramBot(process.env.API_KEY_BOT as string, {
  polling: { interval: 200 },
});
const logger = log4js.getLogger();
logger.level = "info";

interface PaymentRequestBody {
  label: string;
  unaccepted: boolean;
  operation_id: string;
}

interface PaymentResponse {
  message: string;
}

const sendSafeMessage = async (
  chatId: bigint,
  text: string,
  options?: TelegramBot.SendMessageOptions
) => {
  try {
    await bot_tg.sendMessage(chatId.toString(), text, options);
    return true;
  } catch (error) {
    logger.error(`Failed to send message to ${chatId}: ${error}`);
    return false;
  }
};

// Вспомогательная функция для обработки ошибок БД
const handleDatabaseError = (error: Error, message: string) => {
  logger.error(`${message}: ${error.message}`);
  throw new Error(message);
};

export const validatePayment = expressAsyncHandler(
  async (req: Request, res: Response<PaymentResponse>): Promise<void> => {
    const { label, unaccepted, operation_id } = req.body as PaymentRequestBody;

    try {
      logger.info(
        `Processing payment: ${label}, status: ${unaccepted}, operation ID: ${operation_id}`
      );

      // Если платеж заморожен (не принят)
      if (unaccepted) {
        const payment = await prisma.payment
          .findUnique({
            where: { order_id: label },
            select: { userId: true },
          })
          .catch((error) =>
            handleDatabaseError(error, "Payment lookup failed")
          );

        if (!payment) {
          logger.error(`Payment ${label} not found`);
          res.status(404).json({ message: "Payment not found" });
          return;
        }

        const user = await prisma.user
          .findUnique({
            where: { id: payment.userId },
            select: { tgId: true },
          })
          .catch((error) => handleDatabaseError(error, "User lookup failed"));

        if (!user) {
          logger.error(`User ${payment.userId} not found`);
          res.status(404).json({ message: "User not found" });
          return;
        }

        await sendSafeMessage(
          user.tgId,
          `❄️ Ваш платеж был заморожен. Деньги не были зачислены на счет.\nОбычно это решается в течении часа.\nНомер операции: ${operation_id}\n\nЕсли проблема не решится, напишите сюда: @GMTUSDT`
        );

        res.status(200).json({ message: "Payment frozen message sent" });
        return;
      }

      // Если платеж успешен
      const payment = await prisma
        .$transaction(async (tx) => {
          const existingPayment = await tx.payment.findUnique({
            where: { order_id: label },
            select: { status: true },
          });

          if (existingPayment?.status) {
            throw new Error("Payment already processed");
          }

          return tx.payment.update({
            where: { order_id: label },
            data: { status: true },
            select: { userId: true },
          });
        })
        .catch((error) => {
          if (error.message === "Payment already processed") {
            res.status(200).json({ message: "Payment already processed" });
          } else {
            handleDatabaseError(error, "Payment update failed");
          }
          return null;
        });

      if (!payment) return;

      // Получение информации о пользователе
      const user = await prisma.user
        .findUnique({
          where: { id: payment.userId },
          select: { tgId: true, userName: true },
        })
        .catch((error) => handleDatabaseError(error, "User lookup failed"));

      if (!user) {
        logger.error(`User ${payment.userId} not found`);
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Обновление статистики
      await prisma
        .$transaction([
          prisma.userStatistics.upsert({
            where: { userId: payment.userId },
            update: { coursePaid: true },
            create: {
              userId: payment.userId,
              coursePaid: true,
            },
          }),
        ])
        .catch((error) =>
          handleDatabaseError(error, "Statistics update failed")
        );

      // Отправка успешного сообщения пользователю с готовой ссылкой
      const successMessage = `🎉 Ваш платеж был успешно обработан! Вы можете перейти по следующей ссылке для доступа к курсу: [Вставьте ссылку сюда]`;

      await sendSafeMessage(user.tgId, successMessage);

      logger.info(`Payment ${label} processed successfully`);
      res.status(200).json({ message: "Payment processed successfully" });
    } catch (error) {
      logger.error(`Critical error processing payment ${label}: ${error}`);

      // Попытка уведомить пользователя об ошибке
      try {
        const failedPayment = await prisma.payment.findUnique({
          where: { order_id: label },
          select: { userId: true },
        });

        if (failedPayment) {
          const user = await prisma.user.findUnique({
            where: { id: failedPayment.userId },
            select: { tgId: true },
          });

          if (user) {
            await sendSafeMessage(
              user.tgId,
              `⚠️ Вы успешно оплатили заказ, но возникла техническая ошибка.\nКод операции: ${operation_id}\nПожалуйста, свяжитесь с поддержкой: @GMTUSDT`
            );
          }
        }
      } catch (innerError) {
        logger.error(`Error notification failed: ${innerError}`);
      }

      res.status(500).json({ message: "Internal server error" });
    }
  }
);
