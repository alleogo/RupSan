require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const app = express();
const { connect } = require("./config/database");

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow any localhost / 127.0.0.1 origin (any port) and requests with no origin (e.g. curl, Postman)
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked for origin: ${origin}`));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
}));

const path = require("path");

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
require("./utils/cron");

// Default route
app.get("/", (req, res) => {
    res.send("<h1>Accounts Management API is running...</h1>");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
