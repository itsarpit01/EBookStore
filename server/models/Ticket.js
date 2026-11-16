import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: ["book", "payment", "account", "general"],
      default: "general",
    },
    message: {
      type: String,
      required: [true, "Please describe your concern"],
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
      index: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      default: "",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", ticketSchema);