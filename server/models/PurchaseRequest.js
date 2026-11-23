import mongoose from "mongoose";

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    neededUntil: { type: Date },
    proposedDate: { type: Date },
    reason: { type: String, required: true, trim: true },

    // ── NEW: Digital request tracking ──
    accessMode: {
      type: String,
      enum: ["physical", "digital"],
      default: "physical",
    },
    digitalPlan: {
      type: String,
      enum: ["day", "week", "year", "lifetime"],
      default: null,
    },
    paymentMode: {
      type: String,
      enum: ["credits", "cash"],
      default: null,
    },
    creditCost: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "counter_offered", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "Issue" },
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);