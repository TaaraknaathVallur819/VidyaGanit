import { Router, type IRouter } from "express";
import {
  GetClassCurriculumParams,
  GetClassCurriculumResponse,
} from "@workspace/api-zod";
import { getCurriculum, normalizeCurriculumClass } from "../lib/curriculum";
import { requireAuth, requireTutor } from "../middlewares/auth";

const router: IRouter = Router();

// ── Class-wise maths curriculum (tutor planning aid, tutors only) ───
router.get(
  "/curriculum/:studentClass",
  requireAuth,
  requireTutor,
  async (req, res): Promise<void> => {
    const params = GetClassCurriculumParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const cls = normalizeCurriculumClass(params.data.studentClass);
    if (!cls) {
      res.status(400).json({ error: "Unknown class. Choose 4, 5, 6 or 7." });
      return;
    }

    res.json(
      GetClassCurriculumResponse.parse({
        studentClass: cls,
        units: getCurriculum(cls),
      }),
    );
  },
);

export default router;
