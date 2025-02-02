"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePaymentProcess = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const log4js_1 = __importDefault(require("log4js"));
const uuid_1 = require("uuid");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const logger = log4js_1.default.getLogger();
logger.level = "info";
exports.generatePaymentProcess = (0, express_async_handler_1.default)(async (req, res) => {
    const { id, amount } = req.body;
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
        let orderId = (0, uuid_1.v4)();
        let orderExists = await prisma.payment.findUnique({
            where: { order_id: orderId },
        });
        while (orderExists) {
            orderId = (0, uuid_1.v4)();
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
        const paymentLink = await createPaymentLink(createPayment.order_id, createPayment.amount);
        logger.info(`Payment entry created successfully with order_id: ${createPayment.order_id}`);
        res.status(200).json({
            message: "Payment created successfully",
            paymentLink,
        });
    }
    catch (error) {
        logger.error("Error during payment creation", error);
        res.status(500).json({
            message: "Error during payment creation",
            error: error.message,
        });
    }
});
async function createPaymentLink(order_id, amount) {
    const link = process.env.LINK_FOR_CREATE_FORM;
    const receiver = process.env.WALLET_MERCHANT;
    const paymentType = process.env.TYPE_PAYMENT;
    const successURL = process.env.SUCCESS_URL;
    if (!link || !receiver || !paymentType || !successURL) {
        throw new Error("Missing required environment variables");
    }
    const data = {
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
        if (response.status === 200 &&
            response.statusText === "OK" &&
            response.url) {
            return response.url;
        }
        else {
            throw new Error("Ошибка выставления счета");
        }
    }
    catch (error) {
        throw new Error(`Error creating payment link: ${error.message}`);
    }
}
//# sourceMappingURL=generatePaymentProcess.js.map