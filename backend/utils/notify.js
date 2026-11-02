const User = require("../models/User");
const mailSender = require("./mailSender");

// Helpers for notification emails and safe text handling

// Escape user-supplied text before putting it into email HTML
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Escape regex special characters so user input is matched as plain text
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Base URL for links in emails. Configured values win over request headers, which clients control.
const getSiteUrl = (req) => {
    const configured = process.env.SITE_URL || (process.env.FRONTEND_URL || "").split(",")[0].trim();
    if (configured) return configured.replace(/\/$/, "");
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    // Local development: the frontend runs on its own localhost port
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
    return `${req.protocol}://${req.get("host")}`;
};

// Email every admin; `buildHtml` receives each admin so the greeting can use their name
const notifyAdmins = async (subject, buildHtml) => {
    const admins = await User.find({ role: "Admin" }).select("email firstName");
    await Promise.all(admins.map(admin => mailSender(admin.email, subject, buildHtml(admin))));
    return admins.length;
};

module.exports = { escapeHtml, escapeRegex, getSiteUrl, notifyAdmins };
