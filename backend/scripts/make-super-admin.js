// Make an existing account the platform's Super Admin.
// Usage: node scripts/make-super-admin.js someone@example.com [--replace]
//   --replace  turns the current Super Admin into a participant first (there can only be one)
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Centre = require("../models/Centre");

(async () => {
    const email = process.argv[2];
    const replace = process.argv.includes("--replace");
    if (!email || email.startsWith("--")) {
        console.log("Usage: node scripts/make-super-admin.js someone@example.com [--replace]");
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URL);
    try {
        const user = await User.findOne({ email });
        if (!user) throw new Error(`No account with email ${email}. Sign up first, then run this again.`);
        if (user.role === "SuperAdmin") { console.log(`${email} is already the Super Admin.`); return; }

        const current = await User.findOne({ role: "SuperAdmin" });
        if (current && !replace) throw new Error(`${current.email} is already the Super Admin. Use --replace to hand over.`);
        if (current) {
            await User.updateOne({ _id: current._id }, { $set: { role: "Participant", status: "Approved" } });
            console.log(`${current.email} is now a participant.`);
        }

        // The Super Admin doesn't belong to a centre or administer one
        await Centre.updateMany({ admin: user._id }, { $set: { admin: null } });
        await Centre.updateMany({ coAdmins: user._id }, { $pull: { coAdmins: user._id } });
        await User.updateOne({ _id: user._id }, {
            $set: { role: "SuperAdmin", status: "Approved", centreId: null, tempManagerFrom: null, tempManagerUntil: null, tempManagerRequest: null }
        });
        console.log(`${email} is now the Super Admin.`);
    } finally {
        await mongoose.disconnect();
    }
})().catch(error => { console.error("Failed:", error.message); process.exit(1); });
