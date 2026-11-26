import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import PurchaseRequest from "../models/PurchaseRequest.js";

/**
 * GET /api/issues
 * Librarian: Fetch all reading passes / rental issues
 */
export const getIssues = async (req, res) => {
  try {
    const { status, member, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (member) {
      filter.member = member;
    }

    const issues = await Issue.find(filter)
      .populate("book", "title author coverImage")
      .populate("member", "name email membership")
      .sort({ createdAt: -1 });

    let result = issues;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.book?.title?.toLowerCase().includes(q) ||
          i.book?.author?.toLowerCase().includes(q) ||
          i.member?.name?.toLowerCase().includes(q) ||
          i.member?.email?.toLowerCase().includes(q)
      );
    }

    res.json(result);
  } catch (err) {
    console.error("getIssues error:", err);
    res.status(500).json({ message: "Failed to fetch active reader sessions" });
  }
};

/**
 * GET /api/issues/my
 * Reader: Fetch their own rental passes & purchased books
 */
export const getMyIssues = async (req, res) => {
  try {
    const issues = await Issue.find({ member: req.user._id })
      .populate("book", "title author coverImage rentalPlans")
      .sort({ createdAt: -1 });

    res.json(issues);
  } catch (err) {
    console.error("getMyIssues error:", err);
    res.status(500).json({ message: "Failed to fetch your library books" });
  }
};

/**
 * POST /api/issues/:id/return
 * Reader / Librarian: Return a rented e-book early
 * Reward: Gives +5 Bonus Reading Credits for returning before due date!
 */
export const returnBook = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: "Reading record not found" });
    }

    // Authorization: Member themselves or a librarian
    if (
      req.user.role !== "librarian" &&
      issue.member.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized to return this book" });
    }

    if (issue.status === "returned") {
      return res.status(400).json({ message: "Book has already been returned" });
    }

    const now = new Date();
    const isEarlyReturn = now.getTime() < new Date(issue.dueDate).getTime();

    issue.status = "returned";
    issue.returnedAt = now;
    await issue.save();

    // Expire access immediately from user's active digitalShelf
    await User.updateOne(
      { _id: issue.member, "digitalShelf.book": issue.book },
      { $set: { "digitalShelf.$.expiresAt": now } }
    );

    // Give +5 Reading Credits Cashback if returned early!
    if (isEarlyReturn) {
      await User.findByIdAndUpdate(issue.member, { $inc: { credits: 5 } });
    }

    // Sync status with PurchaseRequest record
    await PurchaseRequest.updateMany(
      { book: issue.book, user: issue.member, status: "approved" },
      { $set: { status: "returned" } }
    );

    res.json({
      message: isEarlyReturn
        ? "Book returned early! +5 Reading Credits bonus added to your account."
        : "Book returned successfully.",
      creditsAwarded: isEarlyReturn ? 5 : 0,
      issue,
    });
  } catch (err) {
    console.error("returnBook error:", err);
    res.status(500).json({ message: "Failed to return book" });
  }
};