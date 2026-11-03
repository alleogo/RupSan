const mongoose = require('mongoose');
require('dotenv').config();

// Serverless (Vercel): connect on demand and retry after a failure. Without this, a failed first
// connection leaves every later query waiting 10s and failing until the instance is replaced.
let connecting = null;
exports.ensureConnected = async () => {
    if (mongoose.connection.readyState === 1) return;
    if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is not set");
    if (!connecting) {
        connecting = mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 8000 })
            .finally(() => { connecting = null; });
    }
    await connecting;
};

exports.connect = async () => {
    if (process.env.VERCEL) {
        // Warm up the connection; requests retry through ensureConnected if this fails
        return exports.ensureConnected()
            .then(() => console.log("DB connected successfully to primary database!"))
            .catch(error => console.error("[DB] Connection failed:", error.message));
    }

    const primaryUrl = process.env.MONGODB_URL;
    const fallbackUrl = "mongodb://127.0.0.1:27017/accountsManagementDB";

    if (primaryUrl) {
        try {
            await mongoose.connect(primaryUrl);
            console.log("DB connected successfully to primary database!");
            return;
        } catch (error) {
            console.warn("Primary DB connection failed. Attempting fallback to local DB...", error.message);
        }
    }

    // No local DB fallback on Vercel; don't kill the serverless function
    if (process.env.VERCEL) {
        console.error("DB connection failed: MONGODB_URL is missing or unreachable");
        return;
    }

    try {
        await mongoose.connect(fallbackUrl);
        console.log("DB connected successfully to local database!");
    } catch (error) {
        console.error("DB connection failed:", error.message);
        process.exit(1);
    }
};

