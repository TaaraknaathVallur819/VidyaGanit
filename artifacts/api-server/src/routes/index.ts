import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import chatRouter from "./chat";
import parentRouter from "./parent";
import gamesRouter from "./games";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(chatRouter);
router.use(parentRouter);
router.use(gamesRouter);

export default router;
