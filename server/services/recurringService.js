import fs from "fs";
import path from "path";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import Book from "../models/Book.js";
import { calcFine } from "../utils/fine.js";
import { sendNotification } from "../controllers/notificationController.js";
import {
  sendDueDateReminderEmail,
  sendWeeklyNewArrivalsDigestEmail,
} from "../utils/mailer.js";

const formatDateStr = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

// ── State Persistence: Prevents duplicate weekly digest across server restarts ──
const DIGEST_STATE_FILE = path.resolve(process.cwd(), ".digest_state.json");

const getWeekId = (d = new Date()) => {
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
  return `${year}-W${week}`;
};

const getSavedDigestWeek = () => {
  try {
    if (fs.existsSync(DIGEST_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(DIGEST_STATE_FILE, "utf-8"));
      return data.lastSentWeek;
    }
  } catch {}
  return null;
};

const saveDigestWeek = (weekId) => {
  try {
    fs.writeFileSync(
      DIGEST_STATE_FILE,
      JSON.stringify({ lastSentWeek: weekId, sentAt: new Date() }),
      "utf-8"
    );
  } catch {}
};
// ─────────────────────────────────────────────────────────────────────────────

// 1. Check books due in 2 days (48h reminder) & send interactive reminder email
const checkTwoDayDueReminders = async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcomingIssues = await Issue.find({
      status: "issued",
      dueDate: { $gte: windowStart, $lte: windowEnd },
    }).populate("book member");

    for (const issue of upcomingIssues) {
      if (issue.member?.email && issue.book) {
        await sendDueDateReminderEmail({
          to: issue.member.email,
          name: issue.member.name,
          bookTitle: issue.book.title,
          dueDate: issue.dueDate,
          issueId: issue._id,
        });

        await sendNotification({
          userId: issue.member._id,
          title: "Book Due in 2 Days",
          message: `Reminder: "${issue.book.title}" is due on ${formatDateStr(
            issue.dueDate
          )}. You can reissue or return it now.`,
          type: "warning",
          link: `/purchaser/my-issues`,
        });
      }
    }
    console.log(`[Recurring] Checked 2-day due reminders: sent ${upcomingIssues.length} reminder(s)`);
  } catch (err) {
    console.error("[Recurring] checkTwoDayDueReminders error:", err);
  }
};

// 2. Check books due tomorrow (24h reminder)
const checkUpcomingDueDates = async () => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingIssues = await Issue.find({
      status: "issued",
      dueDate: { $gte: now, $lte: tomorrow },
    }).populate("book member");

    for (const issue of upcomingIssues) {
      if (issue.member?._id && issue.book) {
        await sendNotification({
          userId: issue.member._id,
          title: "Book Due Tomorrow",
          message: `Reminder: "${issue.book.title}" is due tomorrow (${formatDateStr(
            issue.dueDate
          )}). Please return or request a reissue.`,
          type: "warning",
          link: "/purchaser/my-issues",
        });
      }
    }
    console.log(`[Recurring] Checked upcoming dues: notified ${upcomingIssues.length} member(s)`);
  } catch (err) {
    console.error("[Recurring] checkUpcomingDueDates error:", err);
  }
};

// 3. Check overdue books & sync daily fines
const checkOverdueBooksAndFines = async () => {
  try {
    const now = new Date();
    const overdueIssues = await Issue.find({
      status: "issued",
      dueDate: { $lt: now },
    }).populate("book member");

    for (const issue of overdueIssues) {
      const currentFine = calcFine(issue.dueDate, now);
      if (currentFine !== issue.fine) {
        issue.fine = currentFine;
        await issue.save();
      }

      if (issue.member?._id && issue.book) {
        await sendNotification({
          userId: issue.member._id,
          title: "Book Overdue Alert",
          message: `"${issue.book.title}" is overdue! Current fine: INR ${currentFine}. Please return it immediately.`,
          type: "danger",
          link: "/purchaser/my-issues",
        });
      }
    }
    console.log(`[Recurring] Processed ${overdueIssues.length} overdue issue(s)`);
  } catch (err) {
    console.error("[Recurring] checkOverdueBooksAndFines error:", err);
  }
};

// 4. Check membership plans expiry
const checkMembershipExpiries = async () => {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      "membership.tier": { $in: ["premium", "ultimate"] },
      "membership.expiresAt": { $lt: now },
    });

    for (const u of expiredUsers) {
      const oldTier = u.membership.tier;
      u.membership.tier = "free";
      u.membership.expiresAt = null;
      await u.save();

      await sendNotification({
        userId: u._id,
        title: "Membership Expired",
        message: `Your ${oldTier.toUpperCase()} membership has expired and your plan has reverted to the Free tier.`,
        type: "info",
        link: "/purchaser",
      });
    }
    console.log(`[Recurring] Expired ${expiredUsers.length} membership plan(s)`);
  } catch (err) {
    console.error("[Recurring] checkMembershipExpiries error:", err);
  }
};

// 5. ── WEEKLY NEW ARRIVALS DIGEST (Runs Once a Week on Friday) ──
const checkWeeklyNewArrivalsDigest = async () => {
  try {
    const now = new Date();
    const currentWeek = getWeekId(now);
    const savedWeek = getSavedDigestWeek();

    // Target day: 5 = Friday (0 = Sun, 1 = Mon, ..., 5 = Fri)
    // Testing ke liye `.env` me WEEKLY_DIGEST_FORCE=true kar sakte hain
    const targetDay = Number(process.env.WEEKLY_DIGEST_DAY ?? 5);
    const isTargetDay = now.getDay() === targetDay;
    const forceRun = process.env.WEEKLY_DIGEST_FORCE === "true";

    if (!forceRun) {
      // Sirf target day par chalega
      if (!isTargetDay) return;

      // Agar is hafte pehle hi ja chuki hai, toh dubara nahi bhejega
      if (savedWeek === currentWeek) return;
    }

    // Pichle 7 dino me add hui kitabein fetch karo
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newBooks = await Book.find({
      createdAt: { $gte: sevenDaysAgo },
      isDiscontinued: { $ne: true },
    }).sort({ createdAt: -1 });

    // ⭐ KEY RULE: Agar is hafte koi book add nahi hui, toh bilkul mail nahi jayegi!
    if (!newBooks || newBooks.length === 0) {
      console.log(`[Recurring] Weekly Digest: No new books added in the past 7 days. Skipping email.`);
      saveDigestWeek(currentWeek);
      return;
    }

    const members = await User.find({ role: "purchaser" }).select("name email");
    if (!members || members.length === 0) return;

    console.log(
      `[Recurring] Weekly Digest: Found ${newBooks.length} new book(s). Sending digest to ${members.length} member(s)...`
    );

    await sendWeeklyNewArrivalsDigestEmail(members, newBooks);
    saveDigestWeek(currentWeek);
    console.log(`[Recurring] Weekly Digest dispatched successfully for ${currentWeek}!`);
  } catch (err) {
    console.error("[Recurring] checkWeeklyNewArrivalsDigest error:", err);
  }
};

// Main Runner
export const startRecurringJobs = () => {
  console.log("[Recurring] Background Automation Service Initialized");

  const runAllJobs = async () => {
    console.log("[Recurring] Running scheduled recurring checks...");
    await checkTwoDayDueReminders();
    await checkUpcomingDueDates();
    await checkOverdueBooksAndFines();
    await checkMembershipExpiries();
    await checkWeeklyNewArrivalsDigest(); // <-- Weekly Digest Check Included
    console.log("[Recurring] Scheduled checks complete.");
  };

  // 1. Server start hone ke 5 sec baad run karega
  setTimeout(runAllJobs, 5000);

  // 2. Har 1 ghante (3600000 ms) me background me automatically check karega
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(runAllJobs, ONE_HOUR);
};