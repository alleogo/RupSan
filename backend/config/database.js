const mongoose = require('mongoose');
require('dotenv').config();

exports.connect = () => {
    const primaryUrl = process.env.MONGODB_URL;
    const fallbackUrl = "mongodb://127.0.0.1:27017/accountsManagementDB";

    if (primaryUrl) {
        mongoose.connect(primaryUrl)
        .then(() => console.log("DB connected successfully to primary database!"))
        .catch((error) => {
            console.warn("Primary DB connection failed. Attempting fallback to local DB...", error.message);
            mongoose.connect(fallbackUrl)
            .then(() => console.log("DB connected successfully to fallback local database!"))
            .catch((fallbackError) => {
                console.error("Fallback DB connection also failed.");
                console.error(fallbackError);
                process.exit(1);
            });
        });
    } else {
        mongoose.connect(fallbackUrl)
        .then(() => console.log("DB connected successfully to local database!"))
        .catch((error) => {
            console.error("DB connection failed.");
            console.error(error);
            process.exit(1);
        });
    }
};
