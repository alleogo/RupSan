// One-off cleanup of data the app no longer uses. Dry run by default: prints what would change.
// Usage: node scripts/cleanup-stale-data.js            (dry run, changes nothing)
//        node scripts/cleanup-stale-data.js --apply    (makes the changes)
//
// - users:              old Aadhaar numbers (replaced by the Aadhaar card photo) and the old typed-in centre name
// - yatras:             gallery and bankDetails (removed features)
// - expenses:           paidBy, splitAmong (removed features) and the old category field; an expense with no
//                       name gets its old category as its name first, so it isn't left blank
// - yatraregistrations: the old amountPaid field, only where it is 0 or already equals online + cash paid.
//                       Registrations whose amountPaid holds money recorded nowhere else are kept and listed.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
    const apply = process.argv.includes("--apply");
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;
    try {
        console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will change)"}\n`);
        const report = async (label, collection, filter) => console.log(`${label}: ${await db.collection(collection).countDocuments(filter)}`);

        await report("users with an old Aadhaar number", "users", { aadharNumber: { $exists: true } });
        await report("users with an old typed-in centre", "users", { centre: { $exists: true } });
        await report("yatras with gallery/bankDetails", "yatras", { $or: [{ gallery: { $exists: true } }, { bankDetails: { $exists: true } }] });
        await report("expenses with paidBy/splitAmong/category", "expenses", { $or: [{ paidBy: { $exists: true } }, { splitAmong: { $exists: true } }, { category: { $exists: true } }] });
        await report("expenses named from their old category", "expenses", { name: { $in: [null, ""] }, category: { $nin: [null, ""] } });

        const regs = await db.collection("yatraregistrations").find({ amountPaid: { $exists: true } }).toArray();
        const redundant = regs.filter(r => !r.amountPaid || r.amountPaid === (r.paidOnline || 0) + (r.paidCash || 0));
        const kept = regs.filter(r => !redundant.includes(r));
        console.log(`registrations with a redundant amountPaid: ${redundant.length}`);
        kept.forEach(r => console.log(`  KEPT: registration ${r._id} has amountPaid ${r.amountPaid} but online ${r.paidOnline || 0} + cash ${r.paidCash || 0}`));

        if (!apply) {
            console.log("\nRun again with --apply to make these changes.");
            return;
        }
        const r1 = await db.collection("users").updateMany({ $or: [{ aadharNumber: { $exists: true } }, { centre: { $exists: true } }] }, { $unset: { aadharNumber: "", centre: "" } });
        const r2 = await db.collection("yatras").updateMany({}, { $unset: { gallery: "", bankDetails: "" } });
        const named = await db.collection("expenses").updateMany({ name: { $in: [null, ""] }, category: { $nin: [null, ""] } }, [{ $set: { name: "$category" } }]);
        const r3 = await db.collection("expenses").updateMany({}, { $unset: { paidBy: "", splitAmong: "", category: "" } });
        const r4 = await db.collection("yatraregistrations").updateMany({ _id: { $in: redundant.map(r => r._id) } }, { $unset: { amountPaid: "" } });
        console.log(`\nusers cleaned: ${r1.modifiedCount}, yatras: ${r2.modifiedCount}, expenses named: ${named.modifiedCount}, expenses cleaned: ${r3.modifiedCount}, registrations: ${r4.modifiedCount}`);
    } finally {
        await mongoose.disconnect();
    }
})().catch(error => { console.error("Failed:", error.message); process.exit(1); });
