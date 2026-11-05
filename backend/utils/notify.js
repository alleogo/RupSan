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

const sendToAll = async (recipients, subject, buildHtml) => {
    await Promise.all(recipients.map(person => mailSender(person.email, subject, buildHtml(person))));
    return recipients.length;
};

// Email the admin and co-admins of a centre; `buildHtml` receives each recipient so the greeting can use
// their name. If the centre has no admins yet, the Super Admin is told instead so nothing is missed.
const notifyCentreAdmins = async (centreId, subject, buildHtml) => {
    let recipients = centreId ? await User.find({ role: "Admin", centreId }).select("email firstName") : [];
    if (!recipients.length) recipients = await User.find({ role: "SuperAdmin" }).select("email firstName");
    return sendToAll(recipients, subject, buildHtml);
};

module.exports = { escapeHtml, escapeRegex, getSiteUrl, notifyCentreAdmins };
