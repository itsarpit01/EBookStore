import fs from "fs";
import path from "path";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
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

  // 3. ── AVAILABLE / NOT AVAILABLE / ALL FILTER ──
  if (available === true) {
    // ✅ Available: Available copies > 0 honi chahiye AND Discontinued NAHI honi chahiye
    andConditions.push({
      availableCopies: { $gt: 0 },
      isDiscontinued: { $ne: true },
    });
  } else if (available === false) {
    // ✅ Not Available: 0 copies ho chuki hon YA fir Discontinue ho chuki ho
    andConditions.push({
      $or: [
        { availableCopies: { $lte: 0 } },
        { isDiscontinued: true },
      ],
    });
  }
  // Agar available query nahi hai (All books), toh koi condition add nahi hogi -> Saari books aayengi!

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
  const { isbn, totalCopies } = req.body;

  const exists = await Book.findOne({ isbn });
  if (exists) {
    discardUpload(req);
    return res.status(409).json({ message: "Book with this ISBN already exists" });
  }

  const bookData = { ...req.body, availableCopies: totalCopies };
  if (req.file) bookData.coverImage = `/uploads/books/${req.file.filename}`;

  const book = await Book.create(bookData);

  // ── Note: Instant broadcast email is disabled. ──
  // Books are now automatically collected into the weekly Friday digest cron job.

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
    removeFile(book.coverImage); // purani cover hatao
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
// ── Discontinue book with mandatory date, optional reason & 7-day grace return window ──
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

    // 1. Mark book as discontinued and zero available copies to stop new issues
    book.isDiscontinued = true;
    book.discontinueReason = reason ? reason.trim() : "Catalog retirement";
    book.discontinuedDate = new Date(effectiveDate);
    book.availableCopies = 0;
    await book.save();

    console.log(`\n[Discontinue] Book "${book.title}" (ID: ${book._id}) marked as discontinued.`);

    // 2. Find all actively issued copies
    const activeIssues = await Issue.find({
      book: book._id,
      status: "issued",
    }).populate("member", "name email");

    console.log(`[Discontinue] Found ${activeIssues.length} active issue(s) for this book.`);

    // 3. Strictly set 7 days (1 week) return window from today
    const now = new Date();
    const oneWeekDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    oneWeekDeadline.setHours(23, 59, 59, 999); // Till end of the 7th day

    let emailSentCount = 0;

    for (const issue of activeIssues) {
      // Har borrower ki due date update karke 7 din ka grace period dete hain
      issue.dueDate = oneWeekDeadline;
      await issue.save();

      const member = issue.member;

      if (member && member.email) {
        emailSentCount++;
        console.log(`[Discontinue] Sending notice email to: ${member.email} (${member.name})`);

        // A. Send Targeted Discontinuation Notice Email
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

        // B. Send In-App Bell Notification
        sendNotification({
          userId: member._id,
          title: "Urgent: Issued Book Discontinued",
          message: `"${book.title}" has been retired from the catalog. Please return your copy within 7 days by ${oneWeekDeadline.toLocaleDateString("en-IN")}.`,
          type: "danger",
          link: "/purchaser/my-issues",
        }).catch(() => {});
      } else {
        console.warn(`[Discontinue] Could not find member email for issue: ${issue._id}`);
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