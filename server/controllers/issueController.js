import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Notification from "../models/Notification.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";
import { createIssue, reissueIssue, populateIssue } from "../services/issueService.js";
import { MAX_REISSUES } from "../utils/dates.js";
import { sendNotification, notifyLibrarians } from "./notificationController.js";

const formatDateStr = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

// ══════════════════════════════════════════════════════════════════════════
// POST /api/issues (Librarian clicks "Confirm & Issue book")
// ══════════════════════════════════════════════════════════════════════════
export const issueBook = async (req, res) => {
  const { bookId, memberId, dueDate, requestId } = req.body;

  // 1. Check associated purchase request
  let requestDoc = null;
  if (requestId) {
    requestDoc = await PurchaseRequest.findById(requestId);
  } else {
    requestDoc = await PurchaseRequest.findOne({
      requestedBy: memberId,
      book: bookId,
      status: "approved",
      issue: { $exists: false },
    });
  }

  const isDigital = requestDoc?.accessMode === "digital" || Boolean(requestDoc?.digitalPlan);
  const digitalPlan = isDigital ? requestDoc.digitalPlan : null;
  const paymentMode = isDigital ? requestDoc.paymentMode : null;

  // 2. Create the official Issue record
  const issue = await createIssue({ bookId, memberId, dueDate, issuedBy: req.user.id });

  // 3. Agar digital access hai:
  if (isDigital) {
    await Issue.findByIdAndUpdate(issue._id, {
      accessMode: "digital",
      digitalPlan,
      paymentMode,
    });

    // Digital copies physical library copies ko decrement nahi karti
    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });

    // ⭐ DEDUCT CREDITS & ACTIVATE DIGITAL SHELF UPON ISSUE CONFIRMATION ⭐
    if (paymentMode === "credits" && !requestDoc?.creditsDeducted) {
      const userDoc = await User.findById(memberId);
      if (userDoc) {
        // Naye rates: 1 Day = 10, 1 Week = 50, 1 Year = 70, Lifetime = 150
        let cost = requestDoc?.creditCost || 0;
        if (!cost || cost <= 0) {
          const plan = digitalPlan || "week";
          if (plan === "day") cost = 10;
          else if (plan === "week") cost = 50;
          else if (plan === "year") cost = 70;
          else cost = 150;
        }

        // Deduct credits from wallet
        userDoc.credits = Math.max(0, (userDoc.credits ?? 100) - cost);

        // Add book to digital shelf
        userDoc.digitalShelf = userDoc.digitalShelf || [];
        let expiresAt = new Date(dueDate);
        if (digitalPlan === "lifetime") expiresAt = null;

        const shelfIdx = userDoc.digitalShelf.findIndex((item) => String(item.book) === String(bookId));
        const shelfItem = {
          book: bookId,
          plan: digitalPlan || "week",
          paymentMode: "credits",
          amountPaid: cost,
          acquiredAt: new Date(),
          expiresAt,
        };

        if (shelfIdx > -1) {
          userDoc.digitalShelf[shelfIdx] = shelfItem;
        } else {
          userDoc.digitalShelf.push(shelfItem);
        }

        await userDoc.save();

        if (requestDoc) {
          requestDoc.creditsDeducted = true;
          requestDoc.creditCost = cost;
        }
      }
    }
  }

  // 4. Link issue to purchase request
  if (requestDoc) {
    requestDoc.issue = issue._id;
    requestDoc.status = "approved";
    await requestDoc.save();
  }

  const populated = await populateIssue(Issue.findById(issue._id));

  // Notification: Clean plain text only (no emojis/icons)
  sendNotification({
    userId: memberId,
    title: isDigital ? "Digital Book Issued" : "Book Issued",
    message: isDigital
      ? `"${populated.book?.title || 'Book'}" digital access is confirmed. Book is now active under My Issues.`
      : `"${populated.book?.title || 'Book'}" has been issued to you. Due date: ${formatDateStr(dueDate)}.`,
    type: "success",
    link: "/purchaser/my-issues",
  });

  res.status(201).json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/request-reissue (purchaser) body: { dueDate }
export const requestReissue = async (req, res) => {
  const { dueDate } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, member: req.user.id });

  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status !== "issued") {
    return res.status(400).json({ message: "Only currently issued books can be reissued" });
  }
  if ((issue.reissueCount || 0) >= MAX_REISSUES) {
    return res.status(400).json({ message: `Maximum reissue limit (${MAX_REISSUES}) reached` });
  }

  issue.reissueRequested = true;
  issue.reissueRequestedDate = new Date(dueDate);
  await issue.save();

  const populated = await populateIssue(Issue.findById(issue._id));
  const memberName = populated.member?.name || "A member";

  notifyLibrarians({
    title: "New Reissue Request",
    message: `${memberName} requested reissue for "${populated.book?.title || 'Book'}" until ${formatDateStr(dueDate)}.`,
    type: "warning",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/cancel-reissue (purchaser)
export const cancelReissue = async (req, res) => {
  const issue = await Issue.findOne({ _id: req.params.id, member: req.user.id });

  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (!issue.reissueRequested) {
    return res.status(400).json({ message: "No pending reissue request found for this book" });
  }

  issue.reissueRequested = false;
  issue.reissueRequestedDate = null;
  await issue.save();

  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  const populated = await populateIssue(Issue.findById(issue._id));
  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/reissue (librarian) body: { dueDate }
export const reissue = async (req, res) => {
  const issue = await reissueIssue({ issueId: req.params.id, dueDate: req.body.dueDate });
  
  await Issue.findByIdAndUpdate(req.params.id, {
    reissueRequested: false,
    reissueRequestedDate: null,
  });

  const populated = await populateIssue(Issue.findById(issue._id));

  sendNotification({
    userId: populated.member?._id || populated.member,
    title: "Reissue Approved",
    message: `Your reissue request for "${populated.book?.title || 'Book'}" was approved. Extended until: ${formatDateStr(req.body.dueDate)}.`,
    type: "success",
    link: "/purchaser/my-issues",
  });

  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/reject-reissue (librarian)
export const rejectReissue = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (!issue.reissueRequested) {
    return res.status(400).json({ message: "No pending reissue request to reject" });
  }

  issue.reissueRequested = false;
  issue.reissueRequestedDate = null;
  await issue.save();

  const populated = await populateIssue(Issue.findById(issue._id));

  sendNotification({
    userId: populated.member?._id || populated.member,
    title: "Reissue Rejected",
    message: `Your reissue request for "${populated.book?.title || 'Book'}" was rejected. Please return the book on time.`,
    type: "danger",
    link: "/purchaser/my-issues",
  });

  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/return (librarian or purchaser)
export const returnBook = async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user?.role === "purchaser") {
    query.member = req.user.id;
  }
  const issue = await Issue.findOne(query);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status === "returned") {
    return res.status(400).json({ message: "Book already returned" });
  }

  const now = new Date();
  const fineAmount = issue.accessMode === "digital" ? 0 : calcFine(issue.dueDate, now);

  const updated = await Issue.findOneAndUpdate(
    { _id: issue._id, status: "issued" },
    {
      status: "returned",
      returnDate: now,
      fine: fineAmount,
      reissueRequested: false,
      reissueRequestedDate: null,
    },
    { new: true }
  );
  if (!updated) return res.status(400).json({ message: "Book already returned" });

  if (issue.accessMode !== "digital") {
    await Book.findByIdAndUpdate(issue.book, { $inc: { availableCopies: 1 } });
  }

  try {
    await Notification.deleteMany({
      $or: [
        { link: `/issues?id=${issue._id}` },
        { link: `/requests?issueId=${issue._id}` },
      ],
    });
  } catch (notifErr) {}

  // On-time return reward (+10 bonus credits) for physical returns
  let rewardGranted = false;
  const isOnTime = issue.accessMode !== "digital" && fineAmount === 0 && now.getTime() <= new Date(issue.dueDate).getTime();

  if (isOnTime) {
    try {
      const userDoc = await User.findById(issue.member);
      if (userDoc) {
        if (userDoc.credits === undefined || userDoc.credits === null) {
          userDoc.credits = 100;
        }
        userDoc.credits += 10;
        await userDoc.save();
        rewardGranted = true;

        const bookDoc = await Book.findById(issue.book);
        const bookTitle = bookDoc?.title || "your book";

        sendNotification({
          userId: issue.member,
          title: "Bonus Credits Rewarded",
          message: `Great job returning "${bookTitle}" on time. +10 Bonus Credits added to your balance.`,
          type: "success",
          link: "/purchaser/books",
        });
      }
    } catch (rewardErr) {
      console.error("[Reward Error]:", rewardErr.message);
    }
  }

  const populated = await populateIssue(Issue.findById(updated._id));
  res.json({
    ...withOverdueInfo(populated),
    rewardGranted,
    creditsEarned: rewardGranted ? 10 : 0,
  });
};

// GET /api/issues
export const getIssues = async (req, res) => {
  const { status, reissueRequested } = req.query;
  const filter = {};

  if (status === "reissue_requested" || reissueRequested === "true") {
    filter.status = "issued";
    filter.reissueRequested = true;
  } else {
    if (status === "issued" || status === "returned") filter.status = status;
    if (status === "overdue") {
      filter.status = "issued";
      filter.dueDate = { $lt: new Date() };
    }
  }

  const issues = await populateIssue(Issue.find(filter).sort({ createdAt: -1 }));
  res.json(issues.map(withOverdueInfo));
};

// GET /api/issues/my
export const getMyIssues = async (req, res) => {
  const issues = await populateIssue(
    Issue.find({ member: req.user.id }).sort({ createdAt: -1 })
  );
  res.json(issues.map(withOverdueInfo));
};