// One-off migration for centres. Dry run by default: prints what would change.
// Usage: node scripts/migrate-centres.js            (dry run, changes nothing)
//        node scripts/migrate-centres.js --apply    (makes the changes)
//
// What it does:
// - Every participant without a centre becomes Unverified, so they pick their centre from the list
//   and get verified again by that centre's admin (pending verifications are cleared too).
// - Lists the old typed-in centre names with how many people used each, to help create the centre list.
// - Lists admins who aren't assigned to a centre yet (the Super Admin assigns them on the Centres page).
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

(async () => {
    const apply = process.argv.includes("--apply");
    await mongoose.connect(process.env.MONGODB_URL);
    try {
        const participantFilter = { role: "Participant", centreId: null, verificationStatus: { $ne: "Unverified" } };
        const toUnverify = await User.countDocuments(participantFilter);
        const legacyCentres = await User.aggregate([
            { $match: { centre: { $nin: [null, ""] } } },
            // Group spellings that differ only in capitals or spaces
            { $group: { _id: { $toLower: { $trim: { input: "$centre" } } }, people: { $sum: 1 }, spellings: { $addToSet: { $trim: { input: "$centre" } } } } },
            { $sort: { people: -1 } }
        ]);
        const unassignedAdmins = await User.find({ role: "Admin", centreId: null }).select("firstName lastName email");

        console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will change)"}\n`);
        console.log(`Participants to mark Unverified: ${toUnverify}`);
        console.log(`\nOld typed-in centre names (${legacyCentres.length}):`);
        legacyCentres.forEach(c => console.log(`  ${String(c.people).padStart(4)}  ${c.spellings.join(" / ")}`));
        console.log(`\nAdmins without a centre (${unassignedAdmins.length}):`);
        unassignedAdmins.forEach(a => console.log(`  ${a.firstName} ${a.lastName} <${a.email}>`));

        if (apply) {
            const result = await User.updateMany(participantFilter, { $set: { verificationStatus: "Unverified" } });
            console.log(`\nMarked ${result.modifiedCount} participant(s) Unverified.`);
        } else {
            console.log("\nRun again with --apply to make these changes.");
        }
    } finally {
        await mongoose.disconnect();
    }
})().catch(error => { console.error("Failed:", error.message); process.exit(1); });
