import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true, trim: true },
    category: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    totalCopies: { type: Number, required: true, min: 1, default: 1 },
    availableCopies: { type: Number, min: 0 },
    coverImage: { type: String, default: "" },

    // ── Discontinuation Feature Fields ──
    isDiscontinued: { type: Boolean, default: false },
    discontinueReason: { type: String, default: "", trim: true },
    discontinuedDate: { type: Date, default: null },

    // ── Online Digital & Credits Feature Fields ──
    creditPrice: {
      type: Number,
      min: 0,
      default: function () {
        return Math.max(1, Math.round((this.price || 100) / 10));
      },
    },
    // Dynamic Rental & Lifetime Rates (Defaults calculated from book price)
    rentalPlans: {
      day: {
        inr: { type: Number, default: 20 },
        credits: { type: Number, default: 2 },
      },
      week: {
        inr: { type: Number, default: 70 },
        credits: { type: Number, default: 7 },
      },
      year: {
        inr: { type: Number, default: 299 },
        credits: { type: Number, default: 30 },
      },
      lifetime: {
        inr: {
          type: Number,
          default: function () {
            return this.price || 499;
          },
        },
        credits: {
          type: Number,
          default: function () {
            return this.creditPrice || Math.max(1, Math.round((this.price || 499) / 10));
          },
        },
      },
    },
    isDigitalAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bookSchema.index({ category: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ isDiscontinued: 1 });

export default mongoose.model("Book", bookSchema);