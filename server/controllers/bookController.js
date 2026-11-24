import fs from "fs";
import path from "path";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import { bookQuerySchema } from "../validators/bookQueryValidator.js";
import { sendNewBookAlertEmail, sendBookDiscontinuedEmail } from "../utils/mailer.js";
import { sendNotification } from "./notificationController.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Sirf uploads folder ke andar ki file delete hogi
const removeFile = (relPath) => {
  if (!relPath) return;
  const full = path.resolve(process.cwd(), "." + relPath);
  if (!full.startsWith(UPLOADS_DIR + path.sep)) return;
  fs.unlink(full, () => {});
};

// Request fail ho to multer ki save ki hui nayi file hata do
const discardUpload = (req) => {
  if (req.file) fs.unlink(req.file.path, () => {});
};

// GET /api/books
export const getBooks = async (req, res) => {
  const parsed = bookQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const errors = Object.fromEntries(
      parsed.error.issues.map((i) => [i.path.join(".") || "query", i.message])
    );
    return res.status(400).json({ message: "Validation failed", errors });
  }

  const { search, category, author, available, sort, page, limit } = parsed.data;
  const andConditions = [];

  // 1. Search Query (Title, Author, ISBN)
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const searchOr = [{ title: regex }, { author: regex }];

    const isbnTerm = search.replace(/[-\s]/g, "");
    if (isbnTerm) {
      searchOr.push({ isbn: new RegExp(escapeRegex(isbnTerm), "i") });
    }
    andConditions.push({ $or: searchOr });
  }

  // 2. Category & Author Filters
  if (category) andConditions.push({ category: new RegExp(`^${escapeRegex(category)}$`, "i") });
  if (author) andConditions.push({ author: new RegExp(escapeRegex(author), "i") });

  // 3. Available / Not Available / All Filter
  if (available === true) {
    andConditions.push({
      availableCopies: { $gt: 0 },
      isDiscontinued: { $ne: true },
    });
  } else if (available === false) {
    andConditions.push({
      $or: [
        { availableCopies: { $lte: 0 } },
        { isDiscontinued: true },
      ],
    });
  }

  const filter = andConditions.length > 0 ? { $and: andConditions } : {};
  const sortBy = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

  const [books, total] = await Promise.all([
    Book.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
    Book.countDocuments(filter),
  ]);

  res.json({
    data: books,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
};

// GET /api/books/:id
export const getBookById = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });
  res.json(book);
};

// POST /api/books (librarian)
export const createBook = async (req, res) => {
  const { isbn, totalCopies, creditPrice, price } = req.body;

  const exists = await Book.findOne({ isbn });
  if (exists) {
    discardUpload(req);
    return res.status(409).json({ message: "Book with this ISBN already exists" });
  }

  const bookData = {
    ...req.body,
    availableCopies: totalCopies || 9999,
    creditPrice: creditPrice || Math.max(1, Math.round((Number(price) || 100) / 10)),
  };

  if (req.file) bookData.coverImage = `/uploads/books/${req.file.filename}`;

  const book = await Book.create(bookData);

  res.status(201).json(book);
};

// PUT /api/books/:id (librarian)
export const updateBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    discardUpload(req);
    return res.status(404).json({ message: "Book not found" });
  }

  const { totalCopies, isbn, ...rest } = req.body;

  if (isbn !== undefined && isbn !== book.isbn) {
    const dup = await Book.findOne({ isbn });
    if (dup) {
      discardUpload(req);
      return res.status(409).json({ message: "Book with this ISBN already exists" });
    }
    book.isbn = isbn;
  }

  if (totalCopies !== undefined) {
    const issuedCount = book.totalCopies - book.availableCopies;
    if (totalCopies < issuedCount) {
      discardUpload(req);
      return res.status(400).json({
        message: `${issuedCount} copies are currently issued, total copies cannot be less than that`,
      });
    }
    book.totalCopies = totalCopies;
    book.availableCopies = totalCopies - issuedCount;
  }

  Object.assign(book, rest);

  if (req.file) {
    removeFile(book.coverImage);
    book.coverImage = `/uploads/books/${req.file.filename}`;
  }

  const updated = await book.save();
  res.json(updated);
};

// DELETE /api/books/:id (librarian)
export const deleteBook = async (req, res) => {
  const activeIssues = await Issue.countDocuments({ book: req.params.id, status: "issued" });
  if (activeIssues > 0) {
    return res.status(400).json({
      message: `Cannot delete: ${activeIssues} copy(ies) currently issued`,
    });
  }

  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });

  removeFile(book.coverImage);
  res.json({ message: "Book deleted successfully" });
};

// PATCH /api/books/:id/discontinue (librarian)
export const discontinueBook = async (req, res) => {
  try {
    const { effectiveDate, reason } = req.body;

    if (!effectiveDate) {
      return res.status(400).json({ message: "Discontinuation effective date is mandatory" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    book.isDiscontinued = true;
    book.discontinueReason = reason ? reason.trim() : "Catalog retirement";
    book.discontinuedDate = new Date(effectiveDate);
    book.availableCopies = 0;
    await book.save();

    console.log(`\n[Discontinue] Book "${book.title}" (ID: ${book._id}) marked as discontinued.`);

    const activeIssues = await Issue.find({
      book: book._id,
      status: "issued",
    }).populate("member", "name email");

    const now = new Date();
    const oneWeekDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    oneWeekDeadline.setHours(23, 59, 59, 999);

    let emailSentCount = 0;

    for (const issue of activeIssues) {
      issue.dueDate = oneWeekDeadline;
      await issue.save();

      const member = issue.member;
      if (member && member.email) {
        emailSentCount++;
        sendBookDiscontinuedEmail({
          to: member.email,
          name: member.name || "Reader",
          bookTitle: book.title,
          reason: book.discontinueReason,
          effectiveDate: book.discontinuedDate,
          newDueDate: oneWeekDeadline,
        }).catch((err) =>
          console.error(`[Discontinue] Email error for ${member.email}:`, err.message)
        );

        sendNotification({
          userId: member._id,
          title: "Urgent: Issued Book Discontinued",
          message: `"${book.title}" has been retired from the catalog. Please return your copy within 7 days by ${oneWeekDeadline.toLocaleDateString("en-IN")}.`,
          type: "danger",
          link: "/purchaser/my-issues",
        }).catch(() => {});
      }
    }

    res.json({
      message: `Book discontinued successfully. ${activeIssues.length} active borrower(s) given a 7-day return grace period and notified via email.`,
      book,
      affectedBorrowersCount: activeIssues.length,
      emailsDispatched: emailSentCount,
      newReturnDeadline: oneWeekDeadline,
    });
  } catch (error) {
    console.error("[Discontinue Error]:", error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/books/:id/digital-access (purchaser: direct instant unlock + strict duplicate check)
export const purchaseOrRentDigitalBook = async (req, res) => {
  try {
    const { plan, paymentMode = "credits" } = req.body;
    const bookId = req.params.id;
    const userId = req.user.id || req.user._id;

    if (!["day", "week", "year", "lifetime"].includes(plan)) {
      return res.status(400).json({ message: "Invalid access plan selected" });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    if (book.isDiscontinued) {
      return res.status(400).json({ message: "Discontinued books cannot be rented or purchased" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Defensive guards for older records
    if (!user.digitalShelf) {
      user.digitalShelf = [];
    }
    if (user.credits === undefined || user.credits === null) {
      user.credits = 100;
    }

    // ─────────────────────────────────────────────────────────────
    // ⭐ STRICT DUPLICATE CHECK: 1 User cannot rent or buy twice ⭐
    // ─────────────────────────────────────────────────────────────
    const existingEntry = user.digitalShelf.find(
      (item) => item.book && item.book.toString() === bookId.toString()
    );

    if (existingEntry) {
      // 1. Agar user ke paas already Lifetime Ownership hai:
      if (existingEntry.plan === "lifetime" || !existingEntry.expiresAt) {
        return res.status(400).json({
          message: "You already own lifetime access to this e-book. You cannot purchase or rent it again.",
        });
      }

      // 2. Agar user ka Rental pass abhi active hai (expire nahi hua):
      if (new Date(existingEntry.expiresAt) > new Date()) {
        const validTill = new Date(existingEntry.expiresAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return res.status(400).json({
          message: `You already have an active rental for this e-book valid until ${validTill}. You cannot rent or buy it again while active.`,
        });
      }
    }

    // Double check active Issue lease record
    const activeIssue = await Issue.findOne({
      book: bookId,
      member: userId,
      status: "issued",
      dueDate: { $gt: new Date() },
    });
    if (activeIssue) {
      return res.status(400).json({
        message: "You already have an active rental pass for this e-book.",
      });
    }

    // 1. Updated Pricing Map: 1 Day = 10, 1 Week = 50, 1 Year = 70, Lifetime = 150
    const pricingMap = {
      day: { inr: book.rentalPlans?.day?.inr ?? 20, credits: 10, days: 1 },
      week: { inr: book.rentalPlans?.week?.inr ?? 70, credits: 50, days: 7 },
      year: { inr: book.rentalPlans?.year?.inr ?? 299, credits: 70, days: 365 },
      lifetime: { inr: book.price ?? 499, credits: 150, days: 3650 },
    };

    const cost = pricingMap[plan];

    // 2. Process Credit / Cash Payment
    if (paymentMode === "credits") {
      if (user.credits < cost.credits) {
        return res.status(400).json({
          message: `Insufficient credits. You need ${cost.credits} credits, but have ${user.credits}.`,
        });
      }
      user.credits = Math.max(0, user.credits - cost.credits);
    }

    // 3. Expiration calculation
    const now = new Date();
    let expiresAt = null;
    if (plan !== "lifetime") {
      expiresAt = new Date(now.getTime() + cost.days * 24 * 60 * 60 * 1000);
    }

    // 4. Update Digital Shelf
    const existingIndex = user.digitalShelf.findIndex(
      (item) => item.book && item.book.toString() === bookId.toString()
    );

    const shelfEntry = {
      book: bookId,
      plan,
      paymentMode,
      amountPaid: paymentMode === "credits" ? cost.credits : cost.inr,
      acquiredAt: now,
      expiresAt,
    };

    if (existingIndex >= 0) {
      user.digitalShelf[existingIndex] = shelfEntry;
    } else {
      user.digitalShelf.push(shelfEntry);
    }

    await user.save();

    // 5. Create or Update Issue record for live reading lease tracking
    const issueDueDate = expiresAt || new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
    let issueDoc = await Issue.findOne({
      book: bookId,
      member: userId,
      status: "issued",
    });

    if (issueDoc) {
      issueDoc.dueDate = issueDueDate;
      issueDoc.accessMode = "digital";
      issueDoc.digitalPlan = plan;
      issueDoc.paymentMode = paymentMode;
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
        paymentMode: paymentMode,
      });
    }

    // ⭐ 6. CREATE ORDER LOG IN PurchaseRequest FOR ADMIN AUDIT & REVENUE TRACKING ⭐
    await PurchaseRequest.create({
      requestedBy: userId,
      book: bookId,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: 1,
      neededUntil: issueDueDate,
      reason: `Digital ${plan.toUpperCase()} Access (${paymentMode === "credits" ? `${cost.credits} Credits` : `₹${cost.inr}`})`,
      status: "approved",
      accessMode: "digital",
      digitalPlan: plan,
      paymentMode: paymentMode,
      creditCost: paymentMode === "credits" ? cost.credits : cost.inr,
      creditsDeducted: paymentMode === "credits",
      issue: issueDoc._id,
    });

    // 7. Send notification to reader
    sendNotification({
      userId,
      title: "Digital Access Unlocked",
      message: `You now have access to "${book.title}" (${plan.toUpperCase()} pass). Added to your My Library.`,
      type: "success",
      link: "/purchaser/my-issues",
    });

    res.json({
      success: true,
      message: `Successfully unlocked "${book.title}" for ${plan.toUpperCase()} access!`,
      plan,
      expiresAt,
      remainingCredits: user.credits,
      bookTitle: book.title,
    });
  } catch (error) {
    console.error("[Digital Access Error]:", error);
    res.status(500).json({ message: error.message || "Failed to process digital access" });
  }
};

// GET /api/books/my-digital-shelf (purchaser)
export const getMyDigitalShelf = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).populate("digitalShelf.book");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      credits: user.credits ?? 100,
      digitalShelf: user.digitalShelf || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};