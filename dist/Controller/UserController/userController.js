"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const log4js_1 = __importDefault(require("log4js"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const logger = log4js_1.default.getLogger();
logger.level = "info";
exports.userController = (0, express_async_handler_1.default)(async (req, res) => {
    const { id, username, first_name } = req.body;
    if (!id || !first_name || !username) {
        logger.warn("Missing required parameters: id or first_name or username");
        res.status(400).json({ message: "Missing required parameters" });
        return;
    }
    try {
        const existingUser = await prisma.user.findUnique({
            where: { tgId: id },
        });
        if (existingUser) {
            logger.warn(`User with id ${id} already exists`);
            res.status(200).json({ id: existingUser.id });
            return;
        }
        const newUser = await prisma.user.create({
            data: {
                tgId: id,
                userName: username,
                firstName: first_name,
            },
        });
        logger.info(`User created successfully with id: ${newUser.id}`);
        res.status(201).json({ id: newUser.id });
    }
    catch (error) {
        logger.error("Error while creating user", error);
        res.status(500).json({ message: "Error creating user" });
    }
});
//# sourceMappingURL=userController.js.map