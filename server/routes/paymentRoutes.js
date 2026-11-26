import express from "express";
import {
  createOrder,
  verifyPayment,
  createBookOrder,
  verifyBookPayment,
  markPaymentFailed,
  handleWebhook,
  getMyTransactions,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Webhook (Razorpay Server)
router.post("/webhook", handleWebhook);

// Protected Membership Pass Endpoints
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);

// Protected Book Rent / Purchase Endpoints
router.post("/create-book-order", protect, createBookOrder);
router.post("/verify-book-order", protect, verifyBookPayment);

// Transaction History & Tracking
router.post("/mark-failed", protect, markPaymentFailed);
router.get("/my-transactions", protect, getMyTransactions);

export default router;