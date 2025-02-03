import { Request, Response } from "express";
import log4js from "log4js";
import expressAsyncHandler from "express-async-handler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const logger = log4js.getLogger();
logger.level = "info";

interface GenerateUserRequest {
  id: number;
  username: string;
  first_name: string;
}

export const userController = expressAsyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id, username, first_name }: GenerateUserRequest = req.body;

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
    } catch (error) {
      logger.error("Error while creating user", error);
      res.status(500).json({ message: "Error creating user" });
    }
  }
);
