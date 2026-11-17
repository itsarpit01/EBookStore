import express from "express";
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  resolveTicket,
  deleteTicket,
  addComment,
} from "../controllers/ticketController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Shared authenticated comment route
router.post("/:id/comments", addComment);

// Purchaser routes
router.post("/", authorizeRoles("purchaser"), createTicket);
router.get("/my", authorizeRoles("purchaser"), getMyTickets);
router.delete("/:id", authorizeRoles("purchaser"), deleteTicket);

// Librarian routes
router.get("/", authorizeRoles("librarian"), getAllTickets);
router.patch("/:id/resolve", authorizeRoles("librarian"), resolveTicket);

export default router;