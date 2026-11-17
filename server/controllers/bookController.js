import fs from "fs";
import path from "path";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import { bookQuerySchema } from "../validators/bookQueryValidator.js";
import { sendNewBookAlertEmail, sendBookDiscontinuedEmail } from "../utils/mailer.js";

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
  const filter = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: regex }, { author: regex }];

    const isbnTerm = search.replace(/[-\s]/g, "");
    if (isbnTerm) {
      filter.$or.push({ isbn: new RegExp(escapeRegex(isbnTerm), "i") });
    }
  }
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (author) filter.author = new RegExp(escapeRegex(author), "i");
  if (available === true) filter.availableCopies = { $gt: 0 };
  if (available === false) filter.availableCopies = 0;

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

  // ── NEW: Broadcast email to all registered & active members ──
  (async () => {
    try {
      const activeMembers = await User.find({ role: "purchaser" }).select("name email");
      if (activeMembers && activeMembers.length > 0) {
        await sendNewBookAlertEmail(activeMembers, book);
      }
    } catch (err) {
      console.error("[Book] New book alert broadcast failed:", err.message);
    }
  })();

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
// ── NEW FEATURE: Discontinue book with mandatory date, optional reason & 7-day grace return window ──
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

    // Mark book as discontinued
    book.isDiscontinued = true;
    book.discontinueReason = reason ? reason.trim() : "Catalog retirement";
    book.discontinuedDate = new Date(effectiveDate);
    // Discontinued books cannot accept new issues
    book.availableCopies = 0;
    await book.save();

    // Find all actively issued copies
    const activeIssues = await Issue.find({
      book: book._id,
      status: "issued",
    }).populate("member", "name email");

    const now = new Date();
    const oneWeekDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // exactly 7 days from today

    const notifiedMembers = [];

    for (const issue of activeIssues) {
      // Set new due date to 1 week from today
      issue.dueDate = oneWeekDeadline;
      await issue.save();

      // Send discontinuation email strictly to this user
      if (issue.member?.email) {
        notifiedMembers.push(issue.member.email);
        sendBookDiscontinuedEmail({
          to: issue.member.email,
          name: issue.member.name,
          bookTitle: book.title,
          reason: book.discontinueReason,
          effectiveDate: book.discontinuedDate,
          newDueDate: oneWeekDeadline,
        }).catch((err) =>
          console.error(`[Book] Discontinue email failed for ${issue.member.email}:`, err.message)
        );
      }
    }

    res.json({
      message: `Book marked as discontinued. ${activeIssues.length} active borrower(s) notified with a 7-day return deadline.`,
      book,
      affectedBorrowersCount: activeIssues.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};