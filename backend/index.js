require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const app = express();
const { connect } = require("./config/database");

// Middleware
app.use(cors((req, callback) => {
    const origin = req.headers.origin;
    // Allow any localhost / 127.0.0.1 origin (any port), the app's own domain (frontend and API share it on Vercel),
    // origins listed in FRONTEND_URL (comma-separated), and requests with no origin (e.g. curl, Postman)
    const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean);
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    let sameOrigin = false;
    try { sameOrigin = !!origin && new URL(origin).host === host; } catch (e) {}
    const allowed = !origin || sameOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || allowedOrigins.includes(origin);
    if (!allowed) {
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
    callback(null, {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    });
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
}));

// Connect DB
connect();

// Routes
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/user", require("./routes/user"));
app.use("/api/v1/yatra", require("./routes/yatra"));
app.use("/api/v1/registration", require("./routes/registration"));
app.use("/api/v1/ticket", require("./routes/ticket"));
app.use("/api/v1/expense", require("./routes/expense"));
app.use("/api/v1/transaction", require("./routes/transaction"));
app.use("/api/v1/review", require("./routes/review"));
app.use("/api/v1/settings", require("./routes/settings"));

// Start Cron Jobs
const { runYatraReviewJob } = require("./utils/cron");

// Endpoint hit by Vercel Cron; Vercel sends "Authorization: Bearer <CRON_SECRET>"
app.get("/api/v1/cron/yatra-review", async (req, res) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    await runYatraReviewJob();
    res.json({ success: true });
});

// Default route
app.get("/", (req, res) => {
    res.send("<h1>Accounts Management API is running...</h1>");
});

// On Vercel the app is exported as a serverless function instead of listening on a port
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
