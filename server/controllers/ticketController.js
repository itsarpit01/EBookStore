import Ticket from "../models/Ticket.js";
import { notifyLibrarians, sendNotification } from "./notificationController.js";

// POST /api/tickets (Purchaser: Raise concern)
export const createTicket = async (req, res) => {
  try {
    const { subject, category, message } = req.body;
    
    const validCategories = ["general", "book", "payment", "account"];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ message: "Invalid ticket category" });
    }

    const trimmedSubject = subject?.trim();
    const trimmedMessage = message?.trim();

    if (!trimmedSubject || trimmedSubject.length < 5) {
      return res.status(400).json({ message: "Subject must be at least 5 characters" });
    }
    if (trimmedSubject.length > 100) {
      return res.status(400).json({ message: "Subject cannot exceed 100 characters" });
    }

    if (!trimmedMessage || trimmedMessage.length < 20) {
      return res.status(400).json({ message: "Description must be at least 20 characters" });
    }
    if (trimmedMessage.length > 1000) {
      return res.status(400).json({ message: "Description cannot exceed 1000 characters" });
    }

    const ticket = await Ticket.create({
      user: req.user.id,
      subject: trimmedSubject,
      category: category || "general",
      message: trimmedMessage,
    });

    await notifyLibrarians({
      title: "New Support Ticket",
      message: `${req.user.name} submitted a concern: "${trimmedSubject}"`,
      type: "warning",
      link: "/librarian/support",
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tickets/my (Purchaser: View own tickets with comments)
export const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id })
      .populate("comments.sender", "name role avatar")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tickets (Librarian: View all tickets with comments)
export const getAllTickets = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["open", "resolved"].includes(status)) {
      filter.status = status;
    }

    const tickets = await Ticket.find(filter)
      .populate("user", "name email role avatar")
      .populate("comments.sender", "name role avatar")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/tickets/:id/comments (Both: Add reply to ticket thread)
export const addComment = async (req, res) => {
  try {
    const { message } = req.body;
    const trimmed = message?.trim();
    if (!trimmed) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Permission check: Purchaser can only comment on own ticket
    if (req.user.role === "purchaser" && ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to comment on this ticket" });
    }

    const newComment = {
      sender: req.user.id,
      senderRole: req.user.role,
      message: trimmed,
      createdAt: new Date(),
    };

    ticket.comments.push(newComment);
    await ticket.save();

    // Populate newly added sender info
    const populated = await Ticket.findById(ticket._id)
      .populate("user", "name email role avatar")
      .populate("comments.sender", "name role avatar")
      .populate("resolvedBy", "name");

    // Notification routing:
    if (req.user.role === "purchaser") {
      // Notify staff
      await notifyLibrarians({
        title: "New Reply on Ticket",
        message: `${req.user.name} replied on "${ticket.subject}"`,
        type: "info",
        link: "/librarian/support",
      });
    } else {
      // Notify purchaser
      await sendNotification({
        userId: ticket.user,
        title: "Staff Replied to Your Concern",
        message: `Librarian: "${trimmed.slice(0, 70)}${trimmed.length > 70 ? "..." : ""}"`,
        type: "info",
        link: "/purchaser/support",
      });
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/tickets/:id/resolve (Librarian: Resolve or Reopen)
export const resolveTicket = async (req, res) => {
  try {
    const { resolutionNote, status = "resolved" } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.status = status;
    if (status === "resolved") {
      ticket.resolutionNote = resolutionNote?.trim() || "Concern resolved by library staff.";
      ticket.resolvedBy = req.user.id;
      ticket.resolvedAt = new Date();

      await sendNotification({
        userId: ticket.user,
        title: "Concern Resolved",
        message: `Your ticket "${ticket.subject}" has been marked as resolved: ${ticket.resolutionNote}`,
        type: "success",
        link: "/purchaser/support",
      });
    } else {
      // Reopen
      ticket.status = "open";
    }

    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate("user", "name email role avatar")
      .populate("comments.sender", "name role avatar")
      .populate("resolvedBy", "name");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/tickets/:id (Purchaser: Delete open ticket)
export const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, user: req.user.id });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (ticket.status !== "open") {
      return res.status(400).json({
        message: "Cannot delete a ticket that has already been resolved by staff",
      });
    }

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};