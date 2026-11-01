import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import erpRouter from "./erp.js";
import servicesRouter from "./services.js";
import storesRouter from "./stores.js";
import pickupsRouter from "./pickups.js";
import contactRouter from "./contact.js";
import authRouter from "./auth.js";
import aiRouter from "./ai.js";
import publicOrdersRouter from "./public-orders.js";
import publicReviewsRouter from "./public-reviews.js";
import feedbackRouter from "./feedback.js";
import portalRouter from "./portal.js";
import paymentsRouter from "./payments.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(erpRouter);
router.use(servicesRouter);
router.use(storesRouter);
router.use(pickupsRouter);
router.use(contactRouter);
router.use(authRouter);
router.use(aiRouter);
router.use(publicOrdersRouter);
router.use(publicReviewsRouter);
router.use(feedbackRouter);
router.use(portalRouter);
router.use(paymentsRouter);
router.use(settingsRouter);

export default router;
