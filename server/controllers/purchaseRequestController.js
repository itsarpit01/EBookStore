import PurchaseRequest from "../models/PurchaseRequest.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import Notification from "../models/Notification.js";
import { assertDueWithinTier } from "../services/issueService.js";
import { getUserTierConfig } from "../config/membershipConfig.js";
import { endOfToday } from "../utils/dates.js";
import { calcFine } from "../utils/fine.js";
import { httpError } from "../services/issueService.js";
import mongoose from "mongoose";
import { sendNotification, notifyLibrarians } from "./notificationController.js";

const checkId = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid request ID format" });
    return false;
  }
  return true;
};

const quantityCapError = (res, totalCopies) =>
  res.status(400).json({
    message: `Quantity exceeds total copies owned by the library (${totalCopies}).`,
  });

const validateReason = (reason, res) => {
  const trimmed = reason ? reason.trim() : "";
  if (!trimmed) return true;
  if (trimmed.length < 5) {
    res.status(400).json({ message: "If provided, reason must be at least 5 characters" });
    return false;
  }
  return true;
};

// POST /api/purchase-requests (purchaser)
export const createRequest = async (req, res) => {
  try {
    const {
      bookId,
      quantity = 1,
      neededUntil,
      reason,
      accessMode = "physical",
      digitalPlan = "week",
      paymentMode = "credits",
      creditCost = 0,
    } = req.body;

    const [book, user] = await Promise.all([
      Book.findById(bookId),
      User.findById(req.user.id),
    ]);

    if (!book) return res.status(404).json({ message: "Book not found" });

    // Outstanding unpaid fines check
    const userIssues = await Issue.find({
      member: req.user.id,
      finePaid: false,
    });

    const totalUnpaidFine = userIssues.reduce((sum, i) => {
      if (i.finePaid) return sum;
      if (i.status === "returned") return sum + (i.fine || 0);
      if (i.status === "issued" && new Date() > i.dueDate) {
        return sum + calcFine(i.dueDate);
      }
      return sum;
    }, 0);

    if (totalUnpaidFine > 0) {
      return res.status(400).json({
        message: `Borrowing paused: You have an outstanding late fine of Rs. ${totalUnpaidFine}. Please clear your fine under My Issues before requesting new books.`,
      });
    }

    const tierConfig = getUserTierConfig(user);

    // Physical-only validations
    if (accessMode !== "digital") {
      if (tierConfig.maxBooks !== Infinity) {
        const [activeIssuesCount, pendingRequestsCount] = await Promise.all([
          Issue.countDocuments({ member: req.user.id, status: "issued" }),
          PurchaseRequest.countDocuments({
            requestedBy: req.user.id,
            status: { $in: ["pending", "counter_offered"] },
          }),
        ]);

        const totalActiveUsed = activeIssuesCount + pendingRequestsCount;
        if (totalActiveUsed >= tierConfig.maxBooks) {
          return res.status(400).json({
            message: `Limit reached: You have ${totalActiveUsed} active requests/books (Max ${tierConfig.maxBooks} on ${tierConfig.name} plan).`,
          });
        }
      }

      assertDueWithinTier(neededUntil, tierConfig);
      if (!validateReason(reason, res)) return;
      if (quantity > book.totalCopies) return quantityCapError(res, book.totalCopies);
    } else {
      if (paymentMode === "credits") {
        const cost = Number(creditCost) || 0;
        const currentCredits = user.credits ?? 100;
        if (currentCredits < cost) {
          return res.status(400).json({
            message: `Insufficient credits! You need ${cost} credits, but you have ${currentCredits}.`,
          });
        }
      }
    }

    const effectiveReason = reason?.trim()
      ? reason.trim()
      : accessMode === "digital"
      ? `Digital ${digitalPlan} access request`
      : "Borrow for study and reading";

    const request = await PurchaseRequest.create({
      requestedBy: req.user.id,
      book: book._id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: accessMode === "digital" ? 1 : quantity,
      neededUntil,
      reason: effectiveReason,
      accessMode,
      digitalPlan: accessMode === "digital" ? digitalPlan : null,
      paymentMode: accessMode === "digital" ? paymentMode : null,
      creditCost: accessMode === "digital" && paymentMode === "credits" ? Number(creditCost) : 0,
      creditsDeducted: false,
      status: "pending",
    });

    try {
      notifyLibrarians({
        title: accessMode === "digital" ? "New Digital Book Request" : "New Book Request",
        message: `${user.name} submitted a ${accessMode === "digital" ? `digital (${digitalPlan})` : "physical"} request for "${book.title}".`,
        type: "info",
        link: "/librarian/requests",
      });
    } catch (notifErr) {}

    res.status(201).json(request);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to create request" });
  }
};

// GET /api/purchase-requests/my (purchaser)
export const getMyRequests = async (req, res) => {
  try {
    const filter = { requestedBy: req.user.id };
    if (req.query.status) filter.status = req.query.status;

    const requests = await PurchaseRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("reviewedBy", "name");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Failed to load your requests" });
  }
};

// PATCH /api/purchase-requests/:id (purchaser)
export const updateRequest = async (req, res) => {
  try {
    if (!checkId(req.params.id, res)) return;
    const { bookId, quantity, neededUntil, reason } = req.body;

    const [existing, user] = await Promise.all([
      PurchaseRequest.findOne({ _id: req.params.id, requestedBy: req.user.id }),
      User.findById(req.user.id),
    ]);

    if (!existing) return res.status(404).json({ message: "Request not found" });
    if (existing.status !== "pending" && existing.status !== "counter_offered") {
      return res.status(409).json({ message: "Only pending or counter offered requests can be edited" });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    if (existing.accessMode !== "digital") {
      assertDueWithinTier(neededUntil, getUserTierConfig(user));
      if (!validateReason(reason, res)) return;
      if (quantity > book.totalCopies) return quantityCapError(res, book.totalCopies);
    }

    const updated = await PurchaseRequest.findOneAndUpdate(
      { _id: existing._id, requestedBy: req.user.id, status: { $in: ["pending", "counter_offered"] } },
      {
        book: book._id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        quantity,
        neededUntil,
        reason,
        status: "pending",
        proposedDate: null,
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to update request" });
  }
};

// PATCH /api/purchase-requests/:id/accept-counter (purchaser)
export const acceptCounterOffer = async (req, res) => {
  try {
    if (!checkId(req.params.id, res)) return;

    const existing = await PurchaseRequest.findOne({
      _id: req.params.id,
      requestedBy: req.user.id,
      status: "counter_offered",
    });
    if (!existing) return res.status(404).json({ message: "Counter offered request not found" });

    existing.neededUntil = existing.proposedDate;
    existing.proposedDate = null;
    existing.status = "pending";
    existing.reviewNote = existing.reviewNote
      ? `${existing.reviewNote} (Accepted proposed date by user)`
      : "Accepted proposed date by user";
    await existing.save();

    res.json(existing);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to accept counter offer" });
  }
};

// DELETE /api/purchase-requests/:id (purchaser)
export const cancelRequest = async (req, res) => {
  try {
    if (!checkId(req.params.id, res)) return;

    const deleted = await PurchaseRequest.findOneAndDelete({
      _id: req.params.id,
      requestedBy: req.user.id,
      status: { $in: ["pending", "counter_offered"] },
    });
    if (!deleted) return res.status(404).json({ message: "Pending request not found" });

    try {
      await Notification.updateMany(
        { title: "New Book Request", link: "/librarian/requests", read: false },
        { read: true }
      );
    } catch (notifErr) {}

    res.json({ message: "Request cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel request" });
  }
};

// GET /api/purchase-requests (librarian)
export const getAllRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const requests = await PurchaseRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("requestedBy", "name email membership")
      .populate("reviewedBy", "name");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Failed to load requests" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/purchase-requests/:id/review (librarian approves/rejects request)
// ════════════════════════════════════════════════════════════════════════════
export const reviewRequest = async (req, res) => {
  try {
    if (!checkId(req.params.id, res)) return;
    const { status, reviewNote } = req.body;

    const existing = await PurchaseRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Request not found" });
    if (!["pending", "counter_offered"].includes(existing.status)) {
      return res.status(409).json({ message: "Request already reviewed" });
    }

    if (status === "approved" && existing.status === "counter_offered") {
      throw httpError(409, "Waiting for the member to respond to your counter offer");
    }

    const update = {
      status,
      reviewNote,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    };

    if (status === "counter_offered") {
      const proposed = new Date(req.body.proposedDate);
      proposed.setHours(23, 59, 59, 0);

      if (proposed <= endOfToday()) {
        throw httpError(400, "Proposed date must be from tomorrow onwards");
      }
      if (existing.neededUntil && proposed >= existing.neededUntil) {
        throw httpError(
          400,
          "Proposed date is not earlier than the requested date. Approve the request instead."
        );
      }
      const user = await User.findById(existing.requestedBy);
      if (user) {
        assertDueWithinTier(proposed, getUserTierConfig(user));
      }
      update.proposedDate = proposed;
    } else {
      update.proposedDate = null;
    }

    const updated = await PurchaseRequest.findOneAndUpdate(
      { _id: existing._id, status: existing.status },
      update,
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: "Request already reviewed" });

    const statusLabels = {
      approved: "Approved",
      rejected: "Rejected",
      counter_offered: "Counter-Offered",
    };

    try {
      sendNotification({
        userId: existing.requestedBy,
        title: `Request ${statusLabels[status] || status}`,
        message: `Your request for "${existing.title}" has been ${statusLabels[status]?.toLowerCase() || status}.`,
        type: status === "approved" ? "success" : status === "rejected" ? "danger" : "warning",
        link: "/purchaser/requests",
      });

      await Notification.updateMany(
        { title: "New Book Request", link: "/librarian/requests", read: false },
        { read: true }
      );
    } catch (notifErr) {}

    res.json(updated);
  } catch (err) {
    console.error("Review request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Failed to review request" });
  }
};