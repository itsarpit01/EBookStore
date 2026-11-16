import Ticket from "../models/Ticket.js";
import { notifyLibrarians, sendNotification } from "./notificationController.js";

// POST /api/tickets (Purchaser: Raise a new concern)
export const createTicket = async (req, res) => {
  try {
    const { subject, category, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    const ticket = await Ticket.create({
      user: req.user.id,
      subject,
      category: category || "general",
      message,
    });

    // Alert all librarians with sound flag
    await notifyLibrarians({
      title: "New Support Ticket",
      message: `${req.user.name} submitted a concern: "${subject}"`,
      type: "warning",
      link: "/librarian/support",
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tickets/my (Purchaser: View own submitted concerns)
export const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tickets (Librarian: View all member concerns)
export const getAllTickets = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["open", "resolved"].includes(status)) {
      filter.status = status;
    }

    const tickets = await Ticket.find(filter)
      .populate("user", "name email role avatar")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/tickets/:id/resolve (Librarian: Resolve concern with reply)
export const resolveTicket = async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.status = "resolved";
    ticket.resolutionNote = resolutionNote?.trim() || "Your concern has been verified and resolved by library staff.";
    ticket.resolvedBy = req.user.id;
    ticket.resolvedAt = new Date();
    await ticket.save();

    // Notify the user who raised the ticket
    await sendNotification({
      userId: ticket.user,
      title: "Concern Resolved",
      message: `Your ticket "${ticket.subject}" was resolved: ${ticket.resolutionNote}`,
      type: "success",
      link: "/purchaser/support",
    });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};