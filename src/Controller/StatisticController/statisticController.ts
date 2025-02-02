import { Request, Response } from "express";
import { PrismaClient, UserStatistics } from "@prisma/client"; // Импортируем типы из Prisma
import expressAsyncHandler from "express-async-handler";
import log4js from "log4js";

const prisma = new PrismaClient();

const logger = log4js.getLogger();
logger.level = "info";

interface UpdateUserStatisticsRequest {
  userId: number;
  stage: keyof UserStatistics;
  value: boolean;
}

export const updateUserStatistics = expressAsyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId, stage, value }: UpdateUserStatisticsRequest = req.body;

    if (!userId || !stage || value === undefined) {
      logger.warn("Missing required parameters: userId, stage, or value");
      res.status(400).json({ message: "Missing required parameters" });
      return;
    }

    const validStages: Array<keyof UserStatistics> = [
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
        logger.warn(
          `User statistics for userId ${userId} not found, creating new statistics`
        );

        const newUserStats = await prisma.userStatistics.create({
          data: {
            userId,
            [stage]: Boolean(value),
          },
        });

        logger.info(
          `User statistics created successfully for userId: ${userId}`
        );
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
    } catch (error) {
      logger.error("Error during user statistics update", error);
      res.status(500).json({
        message: "Error during user statistics update",
        error: (error as Error).message,
      });
    }
  }
);
