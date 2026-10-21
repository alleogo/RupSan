const mongoose = require('mongoose');
require('dotenv').config();

exports.connect = async () => {
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

