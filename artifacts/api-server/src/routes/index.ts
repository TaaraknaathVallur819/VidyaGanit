import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import chatRouter from "./chat";
import parentRouter from "./parent";
import gamesRouter from "./games";
import assessmentRouter from "./assessment";
import curriculumRouter from "./curriculum";
import gamificationRouter from "./gamification";
import notificationsRouter from "./notifications";
import tutorRouter from "./tutor";
import goalsRouter from "./goals";
import worksheetRouter from "./worksheet";
import bookmarksRouter from "./bookmarks";
import messagesRouter from "./messages";
import feesRouter from "./fees";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(chatRouter);
router.use(parentRouter);
router.use(gamesRouter);
router.use(assessmentRouter);
router.use(curriculumRouter);
router.use(gamificationRouter);
router.use(notificationsRouter);
router.use(tutorRouter);
router.use(goalsRouter);
router.use(worksheetRouter);
router.use(bookmarksRouter);
router.use(messagesRouter);
router.use(feesRouter);

export default router;
