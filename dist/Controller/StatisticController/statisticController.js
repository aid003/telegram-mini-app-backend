"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserStatistics = void 0;
const client_1 = require("@prisma/client"); // Импортируем типы из Prisma
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const log4js_1 = __importDefault(require("log4js"));
const prisma = new client_1.PrismaClient();
const logger = log4js_1.default.getLogger();
logger.level = "info";
exports.updateUserStatistics = (0, express_async_handler_1.default)(async (req, res) => {
    const { userId, stage, value } = req.body;
    if (!userId || !stage || value === undefined) {
        logger.warn("Missing required parameters: userId, stage, or value");
        res.status(400).json({ message: "Missing required parameters" });
        return;
    }
    const validStages = [
        "botLaunch",
        "miniAppLinkClicked",
        "learnMoreButtonClicked",
        "courseButtonClicked",
        "coursePaid",
    ];
    if (!validStages.includes(stage)) {
        logger.warn(`Invalid stage: ${stage}`);
        res.status(400).json({ message: "Invalid stage" });
        return;
    }
    try {
        const userStats = await prisma.userStatistics.findUnique({
            where: { userId },
        });
        if (!userStats) {
            logger.warn(`User statistics for userId ${userId} not found, creating new statistics`);
            const newUserStats = await prisma.userStatistics.create({
                data: {
                    userId,
                    [stage]: Boolean(value),
                },
            });
            logger.info(`User statistics created successfully for userId: ${userId}`);
            res.status(201).json({
                message: "User statistics created successfully",
                updatedStats: newUserStats,
            });
            return;
        }
        const updatedStats = await prisma.userStatistics.update({
            where: { userId },
            data: {
                [stage]: Boolean(value),
            },
        });
        logger.info(`User statistics updated successfully for userId: ${userId}`);
        res.status(200).json({
            message: "User statistics updated successfully",
            updatedStats,
        });
    }
    catch (error) {
        logger.error("Error during user statistics update", error);
        res.status(500).json({
            message: "Error during user statistics update",
            error: error.message,
        });
    }
});
//# sourceMappingURL=statisticController.js.map