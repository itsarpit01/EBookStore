import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: { type: String, enum: ["issued", "returned"], default: "issued" },
    fine: { type: Number, default: 0, min: 0 },
    finePaid: { type: Boolean, default: false },
    finePaymentId: { type: String, default: null },
    finePaidAt: { type: Date, default: null },
    reissueCount: { type: Number, default: 0, min: 0 },
    reissueRequested: { type: Boolean, default: false },
    reissueRequestedDate: { type: Date },

    // ── NEW: Physical vs Digital Tracking ──
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
      enum: ["credits", "cash", "razorpay"],
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
issueSchema.index({ book: 1, status: 1 });
issueSchema.index(
  { book: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: "issued" } }
);

export default mongoose.model("Issue", issueSchema);