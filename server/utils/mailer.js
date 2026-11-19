import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_USER && SMTP_PASS) {
    const cleanPass = SMTP_PASS.replace(/\s+/g, "");
    const port = Number(SMTP_PORT) || 587;

    transporter = nodemailer.createTransport({
      host: SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: {
        user: SMTP_USER,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });
  } else {
    transporter = null;
  }
  return transporter;
};

export const verifyMailer = async () => {
  if (process.env.BREVO_API_KEY) {
    console.log("Brevo HTTP Mailer ready (Port 443 - Production Ready)");
    return;
  }
  if (process.env.RESEND_API_KEY) {
    console.log("Resend HTTP Mailer ready (Port 443)");
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.log("SMTP not configured: OTP will be printed in console");
    return;
  }
  try {
    await t.verify();
    console.log("SMTP ready");
  } catch (err) {
    console.error("SMTP error:", err.message);
  }
};

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const getCleanClientUrl = () => {
  const rawUrls = (process.env.CLIENT_URL || "https://library-management-iota-two.vercel.app")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const selected = rawUrls.find((u) => u.startsWith("https://")) || rawUrls[0] || "https://library-management-iota-two.vercel.app";
  return selected.replace(/\/+$/, "");
};

// Generic email dispatcher supporting Brevo -> Resend -> SMTP
const sendMailGeneric = async ({ to, toName, subject, html, text }) => {
  if (process.env.BREVO_API_KEY) {
    return await sendViaBrevo({ to, toName, subject, html, text });
  }
  if (process.env.RESEND_API_KEY) {
    return await sendViaResend({ to, subject, html, text });
  }
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("Email service is not configured.");
    console.log(`[DEV Email] To: ${to} | Subject: ${subject}`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

// Brevo HTTP API
const sendViaBrevo = async ({ to, toName, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || process.env.MAIL_FROM;
  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is missing in Railway variables.");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "LibraryHub",
        email: senderEmail,
      },
      to: [
        {
          email: to,
          name: toName || to,
        },
      ],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Brevo API error: ${res.statusText}`);
  }

  return true;
};

// Resend HTTP API fallback
const sendViaResend = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LibraryHub <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Resend error: ${res.statusText}`);
  }

  return true;
};

/* ---------------- 1. OTP EMAIL ---------------- */
export const sendOtpEmail = async (to, name, otp) => {
  const subject = "Your LibraryHub password reset code";
  const text = `Hello ${name}, your OTP is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff">
      <h2 style="color:#5c6bc0;margin-top:0">LibraryHub</h2>
      <p>Hello ${escapeHtml(name)},</p>
      <p>Use this code to reset your password:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f4f0ff;color:#4f46e5;padding:12px;text-align:center;border-radius:8px">${otp}</p>
      <p style="color:#6b6784;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>`;

  await sendMailGeneric({ to, toName: name, subject, html, text });
};

/* ---------------- 2. ACCOUNT DELETION CONFIRMATION REQUEST EMAIL ---------------- */
export const sendAccountDeletionEmail = async (to, name, userId, rawToken) => {
  const clientUrl = getCleanClientUrl();
  const confirmUrl = `${clientUrl}/delete-account-confirm?token=${rawToken}`;
  const subject = "Action Required: Confirm LibraryHub Account Deletion";

  const textContent = `Hello ${name},

You have requested to permanently delete your LibraryHub account.

Account Details:
- User ID: ${userId}
- Name: ${name}
- Email: ${to}

Important Notice:
Deleting your account is permanent. All your borrowing history, active membership benefits, and transaction records will be permanently erased.

To confirm permanent deletion, open the following link:
${confirmUrl}

This link expires in 15 minutes.`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px">
        <h2 style="margin:0;color:#5c6bc0;font-size:20px">LibraryHub</h2>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280">Account Security & Privacy</p>
      </div>

      <h3 style="color:#dc2626;margin:0 0 10px 0;font-size:17px">Confirm Permanent Account Deletion</h3>
      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        We received a request to permanently delete your LibraryHub account.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:13px">
        <div style="margin-bottom:5px"><strong>Member ID:</strong> <span style="font-family:monospace">${escapeHtml(String(userId))}</span></div>
        <div style="margin-bottom:5px"><strong>Name:</strong> ${escapeHtml(name)}</div>
        <div><strong>Registered Email:</strong> ${escapeHtml(to)}</div>
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${confirmUrl}" style="background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block">
          Confirm Account Deletion
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;margin:18px 0 0 0;text-align:center">
        This link will expire in <strong>15 minutes</strong>.
      </p>
    </div>
  `;

  await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
};

/* ---------------- 2b. ACCOUNT DELETED SUCCESS EMAIL (SAFETY EXPORT) ---------------- */
export const sendAccountDeletedSuccessEmail = async (to, name) => {
  const subject = "Your LibraryHub Account Has Been Deleted";
  const htmlContent = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:22px;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff">
      <h3 style="color:#111827;margin-top:0">Account Successfully Deleted</h3>
      <p>Hello <b>${escapeHtml(name)}</b>,</p>
      <p>Your LibraryHub account and associated profile data have been permanently removed as requested.</p>
      <p style="font-size:13px;color:#6b7280">If you ever wish to rejoin LibraryHub in the future, you are always welcome to sign up again.</p>
    </div>
  `;
  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: `Hello ${name}, Your LibraryHub account has been deleted.` });
  } catch (e) {
    console.error("[Mailer] Account deletion success notice error:", e.message);
  }
};

/* ---------------- 3. WELCOME EMAIL FOR NEW USER REGISTRATION ---------------- */
export const sendWelcomeEmail = async (to, name) => {
  const clientUrl = getCleanClientUrl();
  const subject = "Welcome to LibraryHub! Your Journey Starts Here";

  const textContent = `Hello ${name},

Welcome to LibraryHub! Your reader account is ready.

Here is what you can do inside LibraryHub:
1. Explore Books: Browse through hundreds of books by genre, author, and availability.
2. Request & Borrow: Request physical books or reserve copies in one click.
3. Track Deadlines & Reissues: Manage active issues, request reissues before the due date, and view return history.
4. Upgrade Membership: Unlock higher issue capacities and extended reading windows.
5. Help & Support: Need assistance? Raise a concern ticket and chat directly with our librarians.

Start exploring now: ${clientUrl}

Happy reading,
The LibraryHub Team`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:auto;padding:26px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="text-align:center;border-bottom:1px solid #f3f4f6;padding-bottom:18px;margin-bottom:20px">
        <h1 style="margin:0;color:#5c6bc0;font-size:24px;font-weight:800">LibraryHub</h1>
        <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280">Your Smart Campus Library Companion</p>
      </div>

      <h2 style="font-size:18px;color:#111827;margin-top:0">Welcome aboard, ${escapeHtml(name)}! 👋</h2>
      <p style="font-size:14px;line-height:1.6;color:#4b5563">
        We're thrilled to have you with us. Your account is fully active and ready to explore thousands of titles, manage loans, and track your reading journey.
      </p>

      <div style="text-align:center;margin:26px 0">
        <a href="${clientUrl}" style="background:#5c6bc0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block">
          Explore LibraryHub Now &rarr;
        </a>
      </div>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Welcome email failed for ${to}:`, err.message);
  }
};

/* ---------------- 4. DEPRECATED INSTANT BOOK ALERT (Kept for safe backward-compat) ---------------- */
export const sendNewBookAlertEmail = async () => {
  // Discontinued in favor of Weekly Digest - no-op to prevent server crash
  return true;
};

/* ---------------- 4b. WEEKLY NEW ARRIVALS DIGEST EMAIL (CRON) ---------------- */
export const sendWeeklyNewArrivalsDigestEmail = async (recipients, books) => {
  if (!recipients || recipients.length === 0 || !books || books.length === 0) return;
  const clientUrl = getCleanClientUrl();
  const catalogUrl = `${clientUrl}/purchaser/books`;
  const count = books.length;
  const subject = `📚 Weekly New Arrivals: ${count} fresh ${count === 1 ? "book" : "books"} added this week!`;

  const booksTextList = books
    .slice(0, 10)
    .map(
      (b, idx) =>
        `${idx + 1}. "${b.title}" by ${b.author} (${b.category || "General"}) - ${
          b.availableCopies ?? b.totalCopies
        } copies available`
    )
    .join("\n");

  const textContent = `Hello Reader,

Here is your Weekly New Arrivals Digest from LibraryHub!

This week, we added ${count} new title${count === 1 ? "" : "s"} to our collection:

${booksTextList}

Explore and borrow from the catalog:
${catalogUrl}

Happy reading,
The LibraryHub Team`;

  const booksHtmlList = books
    .slice(0, 8)
    .map(
      (b) => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:3px">${escapeHtml(b.title)}</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:6px">by <strong>${escapeHtml(b.author)}</strong></div>
          <div style="display:flex;gap:10px;font-size:12px;color:#475569">
            <span style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:6px;font-weight:600">${escapeHtml(b.category || "General")}</span>
            <span>Available: <strong>${b.availableCopies ?? b.totalCopies}</strong> copies</span>
          </div>
        </div>
      </div>`
    )
    .join("");

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:auto;padding:26px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:16px;margin-bottom:20px;text-align:center">
        <h2 style="margin:0;color:#5c6bc0;font-size:22px;font-weight:800">LibraryHub • Weekly Digest</h2>
        <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280">Fresh New Arrivals for Your Reading List</p>
      </div>

      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 16px 0">
        Hello Book Lover! Here are the <strong>${count} new ${count === 1 ? "book" : "books"}</strong> added to LibraryHub this week. Be the first to grab a copy!
      </p>

      <div style="margin-bottom:20px">
        ${booksHtmlList}
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${catalogUrl}" style="background:#5c6bc0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block">
          Explore All New Books &rarr;
        </a>
      </div>
    </div>
  `;

  for (const member of recipients) {
    if (!member.email) continue;
    try {
      await sendMailGeneric({
        to: member.email,
        toName: member.name,
        subject,
        html: htmlContent,
        text: textContent,
      });
    } catch (err) {
      console.error(`[Weekly Digest] Failed sending to ${member.email}:`, err.message);
    }
  }
};

/* ---------------- 5. BOOK DISCONTINUED NOTICE EMAIL ---------------- */
export const sendBookDiscontinuedEmail = async ({ to, name, bookTitle, reason, effectiveDate, newDueDate }) => {
  const clientUrl = getCleanClientUrl();
  const issuesUrl = `${clientUrl}/purchaser/my-issues`;
  const subject = `Urgent Notice: "${bookTitle}" Discontinued - Please Return`;

  const dateStr = effectiveDate ? new Date(effectiveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Immediate";
  const dueStr = newDueDate ? new Date(newDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Within 7 days";

  const textContent = `Hello ${name},
Important Notice: The book "${bookTitle}" has been discontinued. Please return before ${dueStr}.`;

  const htmlContent = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h3 style="color:#dc2626">Urgent Notice: Book Discontinued</h3>
      <p>Hello <b>${escapeHtml(name)}</b>,</p>
      <p>The book <strong>"${escapeHtml(bookTitle)}"</strong> currently issued to you has been discontinued from catalog.</p>
      <p>Reason: ${escapeHtml(reason || "Catalog revision")}</p>
      <p>Grace period return deadline: <b>${dueStr}</b></p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${issuesUrl}" style="background:#dc2626;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;">View My Issues</a>
      </div>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Discontinuation notice failed for ${to}:`, err.message);
  }
};

/* ---------------- 6. DUE DATE 2-DAY REMINDER ---------------- */
export const sendDueDateReminderEmail = async ({ to, name, bookTitle, dueDate, issueId }) => {
  const clientUrl = getCleanClientUrl();
  const dueStr = dueDate ? new Date(dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "in 2 days";
  const subject = `Reminder: "${bookTitle}" is Due in 2 Days (${dueStr})`;

  const returnUrl = `${clientUrl}/purchaser/my-issues?action=return&issueId=${issueId}`;
  const reissueUrl = `${clientUrl}/purchaser/my-issues?action=reissue&issueId=${issueId}`;

  const textContent = `Hello ${name}, "${bookTitle}" is due on ${dueStr}. Reissue: ${reissueUrl} or Return: ${returnUrl}`;

  const htmlContent = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#5c6bc0;margin-top:0">Due Date Reminder</h2>
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>Your issued book <strong>"${escapeHtml(bookTitle)}"</strong> is due on: <b>${dueStr}</b></p>
      <div style="display:flex;gap:12px;margin:20px 0;">
        <a href="${reissueUrl}" style="background:#5c6bc0;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;">🔄 Reissue / Extend</a>
        <a href="${returnUrl}" style="background:#10b981;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;">📦 Return Book</a>
      </div>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Due reminder failed for ${to}:`, err.message);
  }
};