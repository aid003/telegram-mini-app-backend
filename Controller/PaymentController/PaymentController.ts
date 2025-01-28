import { Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";

export const paymentController = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id, first_name } = req.body;

    if (!id || !first_name) {
      res.status(400);
      res.json("No body params");
        }
        
        
  }
);
