import express from "express";
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  resolveTicket,
} from "../controllers/ticketController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Purchaser routes
router.post("/", authorizeRoles("purchaser"), createTicket);
router.get("/my", authorizeRoles("purchaser"), getMyTickets);

// Librarian routes
router.get("/", authorizeRoles("librarian"), getAllTickets);
router.patch("/:id/resolve", authorizeRoles("librarian"), resolveTicket);

export default router;