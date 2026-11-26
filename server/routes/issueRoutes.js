import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getIssues,
  getMyIssues,
  returnBook,
} from "../controllers/issueController.js";

const router = express.Router();

// Har request ke liye login required
router.use(protect);

// Reader: My active rented books & purchased library
router.get("/my", getMyIssues);

// Librarian: View all active readers & leases
router.get("/", authorizeRoles("librarian"), getIssues);

// Reader / Librarian: Early return of rented book (+5 Credits reward)
router.post("/:id/return", returnBook);

export default router;