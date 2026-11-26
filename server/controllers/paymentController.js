import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/User.js";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Transaction from "../models/Transaction.js";

// Helper: Razorpay SDK Instance
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys are not configured in environment variables");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const PLAN_DETAILS = {
  premium: { amount: 499, months: 6 },
  ultimate: { amount: 999, months: 12 },
};

// Helper: Prorated Upgrade Calculation for Passes
const calculateProratedAmount = (user, targetTier) => {
  const targetPlan = PLAN_DETAILS[targetTier];
  if (!targetPlan) return { payableAmount: 0 };

  const currentTier = user?.membership?.tier;
  const expiresAt = user?.membership?.expiresAt;

  if (targetTier === "ultimate" && currentTier === "premium" && expiresAt && new Date(expiresAt) > new Date()) {
    const totalDays = 6 * 30;
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const unusedRatio = Math.min(1, Math.max(0, remainingDays / totalDays));
    const credit = Math.round(PLAN_DETAILS.premium.amount * unusedRatio);
    return { payableAmount: Math.max(1, targetPlan.amount - credit) };
  }

  return { payableAmount: targetPlan.amount };
};

// ─────────────────────────────────────────────────────────────
// 1. MEMBERSHIP PASS PAYMENTS (Premium ₹499 / Ultimate ₹999)
// ─────────────────────────────────────────────────────────────

export const createOrder = async (req, res) => {
  try {
    const { tier } = req.body;
    if (!tier || !PLAN_DETAILS[tier]) {
      return res.status(400).json({ message: "Invalid membership tier selected" });
    }

    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { payableAmount } = calculateProratedAmount(user, tier);
    const razorpay = getRazorpayInstance();
    const receipt = `pass_${userId.toString().slice(-4)}_${Date.now().toString().slice(-6)}`;

    const order = await razorpay.orders.create({
      amount: payableAmount * 100, // in paise
      currency: "INR",
      receipt,
      notes: { userId: userId.toString(), tier, type: "membership" },
    });

    await Transaction.create({
      user: userId,
      orderId: order.id,
      amount: payableAmount,
      type: "membership",
      tier,
      currency: order.currency,
      status: "pending",
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      tier,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tier } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !tier) {
      return res.status(400).json({ message: "Missing payment verification details" });
    }

    const plan = PLAN_DETAILS[tier];
    if (!plan) return res.status(400).json({ message: "Invalid plan" });

    const userId = req.user?.id || req.user?._id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Transaction.findOneAndUpdate({ orderId: razorpay_order_id }, { status: "failed" });
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.months);

    await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, status: "success", startDate, endDate },
      { upsert: true }
    );

     const bonusCredits = tier === "ultimate" ? 400 : 200;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { credits: bonusCredits },
        membership: { tier, startedAt: startDate, expiresAt: endDate },
      },
      { new: true }
    ).select("-password");

    res.status(200).json({ message: `Upgraded to ${tier.toUpperCase()} Pass!`, user: updatedUser });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: error.message || "Failed to verify payment" });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. BOOK RENT & BUY PAYMENTS (1-Day, 1-Week, 1-Year, Lifetime)
// ─────────────────────────────────────────────────────────────

export const createBookOrder = async (req, res) => {
  try {
    const { bookId, plan } = req.body;
    const userId = req.user?.id || req.user?._id;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Duplicate check
    const existing = (user.digitalShelf || []).find((i) => i.book && i.book.toString() === bookId.toString());
    if (existing) {
      if (existing.plan === "lifetime" || !existing.expiresAt) {
        return res.status(400).json({ message: "You already own lifetime access to this e-book." });
      }
      if (new Date(existing.expiresAt) > new Date()) {
        return res.status(400).json({ message: "You already have an active rental for this e-book." });
      }
    }

    const pricing = {
      day: book.rentalPlans?.day?.inr ?? 20,
      week: book.rentalPlans?.week?.inr ?? 70,
      year: book.rentalPlans?.year?.inr ?? 299,
      lifetime: book.price ?? 349,
    };
    const amountInInr = pricing[plan] || pricing.week;

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: amountInInr * 100,
      currency: "INR",
      receipt: `bk_${userId.toString().slice(-4)}_${Date.now().toString().slice(-6)}`,
      notes: { userId: userId.toString(), bookId: bookId.toString(), plan, type: "book_access" },
    });

    await Transaction.create({
      user: userId,
      orderId: order.id,
      amount: amountInInr,
      type: "book_access",
      currency: order.currency,
      status: "pending",
      bookTitle: book.title,
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookTitle: book.title,
    });
  } catch (error) {
    console.error("Book order error:", error);
    res.status(500).json({ message: error.message || "Failed to create book payment order" });
  }
};

export const verifyBookPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookId, plan } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookId || !plan) {
      return res.status(400).json({ message: "Missing required verification details" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Transaction.findOneAndUpdate({ orderId: razorpay_order_id }, { status: "failed" });
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const daysMap = { day: 1, week: 7, year: 365, lifetime: 3650 };
    const pricing = {
      day: book.rentalPlans?.day?.inr ?? 20,
      week: book.rentalPlans?.week?.inr ?? 70,
      year: book.rentalPlans?.year?.inr ?? 299,
      lifetime: book.price ?? 349,
    };
    const days = daysMap[plan] || 7;
    const amountInInr = pricing[plan] || 70;

    const now = new Date();
    const expiresAt = plan === "lifetime" ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // 1. Digital Shelf update
    if (!user.digitalShelf) user.digitalShelf = [];
    const idx = user.digitalShelf.findIndex((i) => i.book && i.book.toString() === bookId.toString());
    const shelfEntry = { book: bookId, plan, paymentMode: "razorpay", amountPaid: amountInInr, acquiredAt: now, expiresAt };
    if (idx >= 0) user.digitalShelf[idx] = shelfEntry;
    else user.digitalShelf.push(shelfEntry);
    await user.save();

    // 2. Issue Record create/update
    const issueDueDate = expiresAt || new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
    let issueDoc = await Issue.findOne({ book: bookId, member: userId, status: "issued" });
    if (issueDoc) {
      issueDoc.dueDate = issueDueDate;
      issueDoc.digitalPlan = plan;
      issueDoc.paymentMode = "razorpay";
      await issueDoc.save();
    } else {
      issueDoc = await Issue.create({
        book: bookId,
        member: userId,
        issuedBy: userId,
        issueDate: now,
        dueDate: issueDueDate,
        status: "issued",
        accessMode: "digital",
        digitalPlan: plan,
        paymentMode: "razorpay",
      });
    }

    // 3. PurchaseRequest Receipt log
    await PurchaseRequest.create({
      requestedBy: userId,
      book: bookId,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: 1,
      neededUntil: issueDueDate,
      reason: `Digital ${plan.toUpperCase()} Access (₹${amountInInr} via Razorpay)`,
      status: "approved",
      accessMode: "digital",
      digitalPlan: plan,
      paymentMode: "razorpay",
      creditCost: amountInInr,
      creditsDeducted: false,
      issue: issueDoc._id,
    });

    // 4. Update Transaction
    await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, status: "success", startDate: now, endDate: expiresAt }
    );

    res.json({ success: true, message: `Payment verified! "${book.title}" added to your My Library.`, plan, expiresAt });
  } catch (error) {
    console.error("Book verify error:", error);
    res.status(500).json({ message: error.message || "Failed to verify book payment" });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. TRANSACTION UTILITIES & WEBHOOK
// ─────────────────────────────────────────────────────────────

export const markPaymentFailed = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    await Transaction.findOneAndUpdate(
      { orderId, status: "pending" },
      { status: "failed", failureReason: reason || "User cancelled payment or closed popup" }
    );
    res.status(200).json({ message: "Payment marked as failed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction status" });
  }
};

export const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ message: "Webhook secret missing" });

    const signature = req.headers["x-razorpay-signature"];
    const shasum = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
    if (shasum !== signature) return res.status(400).json({ message: "Invalid signature" });

    const { event, payload } = req.body;
    if (event === "payment.captured" || event === "order.paid") {
      const p = payload.payment.entity;
      await Transaction.findOneAndUpdate({ orderId: p.order_id }, { paymentId: p.id, status: "success" }, { upsert: true });
    } else if (event === "payment.failed") {
      const p = payload.payment.entity;
      await Transaction.findOneAndUpdate({ orderId: p.order_id }, { status: "failed", failureReason: p.error_description });
    }
    res.status(200).json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ message: "Webhook error" });
  }
};