import express from "express";
import {
  register,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
  googleCallback,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/authValidator.js";
import {
  loginLimiter,
  registerLimiter,
  forgotLimiter,
  resetLimiter,
} from "../middleware/rateLimiter.js";
import User from "../models/User.js";

const router = express.Router();

router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protect, me);
router.post("/forgot-password", forgotLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", resetLimiter, validate(resetPasswordSchema), resetPassword);

// ── In-Memory Used Codes Lock (Prevents Browser Double-Hit Replay) ────────────
const usedCodes = new Set();

// ── 1. Google OAuth Initiate Route ──────────────────────────────────────────
router.get("/google", (req, res) => {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const redirectUri = "http://localhost:5000/api/auth/google/callback";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");

  res.redirect(authUrl.toString());
});

// ── 2. Google OAuth Direct Token Exchange Callback ──────────────────────────
router.get("/google/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error("Google Auth error:", error, error_description);
    return res.redirect("http://localhost:5173/login?error=google_cancelled");
  }

  if (!code) {
    return res.redirect("http://localhost:5173/login?error=no_code");
  }

  const codeStr = String(code).trim();

  // 🛡️ DEDUP LOCK: Agar browser extension ne same code double-hit kiya, toh ignore duplicate
  if (usedCodes.has(codeStr)) {
    console.log("⚠️ Duplicate code hit detected from browser extension. Redirecting smoothly...");
    return res.redirect("http://localhost:5173/purchaser");
  }
  usedCodes.add(codeStr);
  setTimeout(() => usedCodes.delete(codeStr), 60 * 1000); // 1 min memory cleanup

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const redirectUri = "http://localhost:5000/api/auth/google/callback";

  const bodyData = new URLSearchParams({
    code: codeStr,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: bodyData.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("❌ TOKEN FAILED:", tokenData);
      return res.redirect("http://localhost:5173/login?error=auth_failed");
    }

    console.log("🎉 SUCCESS! TOKEN RECEIVED for:", clientId.slice(-10));

    // Fetch user profile from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userRes.json();
    console.log("Logged in profile:", profile.name, profile.email);

    const email = profile.email?.toLowerCase();
    const googleId = profile.sub;
    const name = profile.name || profile.given_name || "Library Member";
    const avatar = profile.picture || "";

    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        if (!user.avatar && avatar) user.avatar = avatar;
        await user.save();
      } else {
        user = await User.create({
          name,
          email,
          googleId,
          avatar,
          role: "purchaser",
        });
      }
    }

    req.user = user;
    return googleCallback(req, res);
  } catch (err) {
    console.error("Server exception:", err);
    return res.redirect("http://localhost:5173/login?error=server_error");
  }
});

export default router;