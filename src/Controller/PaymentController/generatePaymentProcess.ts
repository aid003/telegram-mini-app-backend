import expressAsyncHandler from "express-async-handler";
import { Request, Response } from "express";
import log4js from "log4js";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const logger = log4js.getLogger();
logger.level = "info";

interface GeneratePaymentProcessRequest {
  id: number;
  amount: number;
}

export const generatePaymentProcess = expressAsyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id, amount }: GeneratePaymentProcessRequest = req.body;

    if (!id || !amount) {
      logger.warn("Missing required parameters: id or amount");
      res.status(400).json({ message: "Missing required parameters" });
      return;
    }

    if (!Number.isInteger(amount)) {
      logger.warn(`Invalid amount: ${amount} is not an integer`);
      res.status(400).json({ message: "Amount must be an integer" });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        logger.warn(`User with id ${id} not found`);
        res.status(404).json({ message: "User not found" });
        return;
      }

      let orderId = uuidv4();
      let orderExists = await prisma.payment.findUnique({
        where: { order_id: orderId },
      });

      while (orderExists) {
        orderId = uuidv4();
        orderExists = await prisma.payment.findUnique({
          where: { order_id: orderId },
        });
      }

      const createPayment = await prisma.payment.create({
        data: {
          userId: id,
          order_id: orderId,
          amount: Math.floor(amount),
        },
      });

      const paymentLink = await createPaymentLink(
        createPayment.order_id,
        createPayment.amount
      );

      logger.info(
        `Payment entry created successfully with order_id: ${createPayment.order_id}`
      );

      res.status(200).json({
        message: "Payment created successfully",
        paymentLink,
      });
    } catch (error) {
      logger.error("Error during payment creation", error);
      res.status(500).json({
        message: "Error during payment creation",
        error: (error as Error).message,
      });
    }
  }
);

async function createPaymentLink(
  order_id: string,
  amount: number
): Promise<string> {
  const link: string | undefined = process.env.LINK_FOR_CREATE_FORM;
  const receiver: string | undefined = process.env.WALLET_MERCHANT;
  const paymentType: string | undefined = process.env.TYPE_PAYMENT;
  const successURL: string | undefined = process.env.SUCCESS_URL;

  if (!link || !receiver || !paymentType || !successURL) {
    throw new Error("Missing required environment variables");
  }

  const data: Record<string, string> = {
    receiver,
    "quickpay-form": "button",
    paymentType,
    sum: amount.toString(),
    label: order_id,
    successURL,
  };

  try {
    const response = await fetch(link, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data),
    });

    if (
      response.status === 200 &&
      response.statusText === "OK" &&
      response.url
    ) {
      return response.url;
    } else {
      throw new Error("Ошибка выставления счета");
    }
  } catch (error) {
    throw new Error(`Error creating payment link: ${(error as Error).message}`);
  }
}
