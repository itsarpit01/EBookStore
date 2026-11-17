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

/* ---------------- 2. ACCOUNT DELETION EMAIL ---------------- */
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

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin:20px 0">
        <h3 style="margin:0 0 12px 0;font-size:15px;color:#334155;font-weight:700">Quick Guide: What You Can Do</h3>
        
        <div style="margin-bottom:12px;display:flex;align-items:flex-start">
          <div style="background:#e0e7ff;color:#4f46e5;font-weight:700;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;margin-right:12px;flex-shrink:0">1</div>
          <div style="font-size:13px;line-height:1.5">
            <strong>Browse Catalog:</strong> Search books by title, author, category, or ISBN with live availability filters.
          </div>
        </div>

        <div style="margin-bottom:12px;display:flex;align-items:flex-start">
          <div style="background:#e0e7ff;color:#4f46e5;font-weight:700;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;margin-right:12px;flex-shrink:0">2</div>
          <div style="font-size:13px;line-height:1.5">
            <strong>Instant Issue & Request:</strong> Borrow available books or submit purchase requests for titles not yet in stock.
          </div>
        </div>

        <div style="margin-bottom:12px;display:flex;align-items:flex-start">
          <div style="background:#e0e7ff;color:#4f46e5;font-weight:700;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;margin-right:12px;flex-shrink:0">3</div>
          <div style="font-size:13px;line-height:1.5">
            <strong>Renew & Reissue:</strong> Need extra days? Request a reissue directly from your dashboard before due date.
          </div>
        </div>

        <div style="display:flex;align-items:flex-start">
          <div style="background:#e0e7ff;color:#4f46e5;font-weight:700;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;margin-right:12px;flex-shrink:0">4</div>
          <div style="font-size:13px;line-height:1.5">
            <strong>Help & Support:</strong> Connect with librarians through threaded support tickets right from the portal.
          </div>
        </div>
      </div>

      <div style="text-align:center;margin:26px 0">
        <a href="${clientUrl}" style="background:#5c6bc0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block">
          Explore LibraryHub Now &rarr;
        </a>
      </div>

      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0 0">
        If you have any questions, simply reply to this email or open a support ticket in your account.
      </p>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Welcome email failed for ${to}:`, err.message);
  }
};

/* ---------------- 4. NEW BOOK ADDED ALERT EMAIL (BROADCAST) ---------------- */
export const sendNewBookAlertEmail = async (recipients, book) => {
  if (!recipients || recipients.length === 0) return;
  const clientUrl = getCleanClientUrl();
  const bookUrl = `${clientUrl}/books/${book._id}`;
  const subject = `New Arrival at LibraryHub: "${book.title}" by ${book.author}`;

  const textContent = `New Arrival Alert!

"${book.title}" by ${book.author} is now available in LibraryHub!

Category: ${book.category || "General"}
Copies Available: ${book.availableCopies || book.totalCopies}
ISBN: ${book.isbn || "N/A"}

Description:
${book.description ? book.description.substring(0, 200) + "..." : "No description provided."}

Check out this book: ${bookUrl}

Happy reading,
LibraryHub`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px">
        <h2 style="margin:0;color:#5c6bc0;font-size:20px">LibraryHub • Fresh Arrival</h2>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280">A new book has been added to our shelves</p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:18px">
        <h3 style="margin:0 0 6px 0;font-size:18px;color:#1e293b">${escapeHtml(book.title)}</h3>
        <p style="margin:0 0 12px 0;font-size:14px;color:#64748b">by <strong>${escapeHtml(book.author)}</strong></p>

        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:12px">
          <span><strong>Category:</strong> ${escapeHtml(book.category || "General")}</span>
          <span>•</span>
          <span><strong>Available Copies:</strong> ${book.availableCopies || book.totalCopies}</span>
        </div>

        ${
          book.description
            ? `<p style="font-size:13px;line-height:1.5;color:#475569;margin:0;font-style:italic">
                "${escapeHtml(book.description.substring(0, 240))}${book.description.length > 240 ? "..." : ""}"
              </p>`
            : ""
        }
      </div>

      <div style="text-align:center;margin:22px 0">
        <a href="${bookUrl}" style="background:#5c6bc0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block">
          View & Issue This Book &rarr;
        </a>
      </div>

      <p style="font-size:11px;color:#94a3b8;text-align:center;margin:16px 0 0 0">
        You are receiving this notification because you are a registered member of LibraryHub.
      </p>
    </div>
  `;

  // Send to all members (in small parallel batches to prevent rate limits)
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
      console.error(`[Mailer] New book alert failed for ${member.email}:`, err.message);
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

Important Notice:
The book "${bookTitle}" currently issued to you has been discontinued from the library catalog effective ${dateStr}.

Reason: ${reason || "Catalog revision & archive"}

Return Deadline (Grace Period):
Because this title is being retired, your return deadline has been adjusted to: ${dueStr} (1 week from today).

Please return the book to the library desk or submit a return request by this date to avoid overdue penalties.

View your active issues: ${issuesUrl}

LibraryHub Administration`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px">
        <h2 style="margin:0;color:#dc2626;font-size:20px">LibraryHub • Discontinuation Notice</h2>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280">Action required on active issued book</p>
      </div>

      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>

      <p style="font-size:14px;line-height:1.5;margin:0 0 16px 0">
        The following book currently issued to your account is being <strong>discontinued</strong> from the library catalog:
      </p>

      <div style="background:#fff7ed;border-left:4px solid #f97316;padding:14px;margin-bottom:18px;border-radius:6px">
        <h4 style="margin:0 0 6px 0;font-size:16px;color:#9a3412">${escapeHtml(bookTitle)}</h4>
        <div style="font-size:13px;color:#7c2d12;margin-bottom:4px">
          <strong>Effective Date:</strong> ${dateStr}
        </div>
        ${
          reason
            ? `<div style="font-size:13px;color:#7c2d12">
                <strong>Reason:</strong> ${escapeHtml(reason)}
              </div>`
            : ""
        }
      </div>

      <div style="background:#fef2f2;border:1px solid #fecaca;padding:14px;border-radius:8px;margin-bottom:20px">
        <strong style="color:#991b1b;display:block;margin-bottom:4px;font-size:14px">⏱️ 7-Day Return Window Assigned</strong>
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.5">
          As per library policy, you have been granted a 1-week grace period. Please return this copy on or before <strong>${dueStr}</strong>.
        </p>
      </div>

      <div style="text-align:center;margin:22px 0">
        <a href="${issuesUrl}" style="background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block">
          View Active Issues / Return
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;text-align:center;margin:16px 0 0 0">
        Thank you for your cooperation in maintaining the library inventory.
      </p>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Discontinuation notice failed for ${to}:`, err.message);
  }
};

/* ---------------- 6. DUE DATE 2-DAY REMINDER WITH REISSUE & RETURN BUTTONS ---------------- */
export const sendDueDateReminderEmail = async ({ to, name, bookTitle, dueDate, issueId }) => {
  const clientUrl = getCleanClientUrl();
  const dueStr = dueDate ? new Date(dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "in 2 days";
  const subject = `Reminder: "${bookTitle}" is Due in 2 Days (${dueStr})`;

  const returnUrl = `${clientUrl}/purchaser/my-issues?action=return&issueId=${issueId}`;
  const reissueUrl = `${clientUrl}/purchaser/my-issues?action=reissue&issueId=${issueId}`;

  const textContent = `Hello ${name},

This is a friendly reminder that "${bookTitle}" is due in 2 days on ${dueStr}.

To avoid late fee penalties, please choose an action:
1. Reissue / Extend: ${reissueUrl}
2. Return Book: ${returnUrl}

Happy reading,
LibraryHub`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px">
        <h2 style="margin:0;color:#5c6bc0;font-size:20px">LibraryHub • Due Date Reminder</h2>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280">2 Days remaining before due date</p>
      </div>

      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>

      <p style="font-size:14px;line-height:1.5;margin:0 0 16px 0">
        Your issued book <strong>"${escapeHtml(bookTitle)}"</strong> is scheduled to be returned on:
      </p>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px">
        <div style="font-size:12px;color:#1e40af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Due Date</div>
        <div style="font-size:20px;color:#1e3a8a;font-weight:700;margin-top:4px">${dueStr}</div>
      </div>

      <p style="font-size:13px;line-height:1.5;color:#4b5563;margin-bottom:18px">
        Still reading? You can easily extend your loan period by requesting a reissue. If you're finished, please return it on time to help other readers!
      </p>

      <!-- Action Buttons Side by Side -->
      <div style="display:flex;gap:12px;justify-content:center;margin:24px 0;flex-wrap:wrap">
        <a href="${reissueUrl}" style="background:#5c6bc0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px;display:inline-block">
          🔄 Reissue / Extend
        </a>
        <a href="${returnUrl}" style="background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px;display:inline-block">
          📦 Return Book
        </a>
      </div>

      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:18px 0 0 0">
        Late returns incur a daily fee after the due date passes.
      </p>
    </div>
  `;

  try {
    await sendMailGeneric({ to, toName: name, subject, html: htmlContent, text: textContent });
  } catch (err) {
    console.error(`[Mailer] Due reminder failed for ${to}:`, err.message);
  }
};