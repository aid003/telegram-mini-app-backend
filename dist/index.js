"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generatePaymentProcess_1 = require("./Controller/PaymentController/generatePaymentProcess");
const client_1 = require("@prisma/client");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const log4js_1 = __importDefault(require("log4js"));
const cors_1 = __importDefault(require("cors"));
const userController_1 = require("./Controller/UserController/userController");
const statisticController_1 = require("./Controller/StatisticController/statisticController");
const bot_1 = require("./Telegram/bot");
const paymentHandler_1 = require("./PaymentHandler/paymentHandler");
dotenv_1.default.config();
log4js_1.default.configure({
    appenders: {
        console: { type: "console" },
        file: { type: "file", filename: "app.log" },
    },
    categories: {
        default: { appenders: ["console", "file"], level: "info" },
    },
});
const logger = log4js_1.default.getLogger();
logger.level = "info";
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
async function main() {
    app.use(express_1.default.json());
    app.use((0, cors_1.default)({
        origin: "*",
        methods: ["POST", "GET"],
    }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use("/api/user-controller/", userController_1.userController);
    app.use("/api/update-user-statictics/", statisticController_1.updateUserStatistics);
    app.use("/api/generate-payment-process/", generatePaymentProcess_1.generatePaymentProcess);
    app.use("/api/endpoint-for-validate-payment/", paymentHandler_1.validatePayment);
    await (0, bot_1.startTelegramBot)();
    app.get("/", (req, res) => {
        res.send("working...");
    });
    app.listen(process.env.PORT, () => {
        logger.info(`🚀 Server with telegram bot running on port ${process.env.PORT}`);
    });
}
main().catch((e) => {
    logger.error("ERROR: Произошла ошибка в main()", e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=index.js.map