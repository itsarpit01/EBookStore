import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 6,
    },
    googleId: { type: String, default: null },
    role: {
      type: String,
      enum: ["librarian", "purchaser"],
      default: "purchaser",
    },
    avatar: { type: String, default: "" },
    membership: {
      tier: {
        type: String,
        enum: ["free", "premium", "ultimate"],
        default: "free",
      },
      startedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
    accountDeleteToken: { type: String, default: null },
    accountDeleteExpires: { type: Date, default: null },

    // ── Online Credits & Digital Shelf Fields ──
    credits: {
      type: Number,
      default: 100, // Naye users ko 100 free credits milenge
      min: 0,
    },
    // User ki rented / lifetime digital books list
    digitalShelf: [
      {
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book",
          required: true,
        },
        plan: {
          type: String,
          enum: ["day", "week", "year", "lifetime"],
          required: true,
        },
        paymentMode: {
          type: String,
          enum: ["credits", "cash"],
          default: "credits",
        },
        amountPaid: { type: Number, default: 0 },
        acquiredAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null }, // null means Lifetime Ownership!
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);