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
  },
  { timestamps: true }
);

bookSchema.index({ category: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ isDiscontinued: 1 });

export default mongoose.model("Book", bookSchema);