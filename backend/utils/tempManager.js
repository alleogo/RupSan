const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RoleRequest = require("../models/RoleRequest");

// Temporary manager access: keeps a user's role in line with their approved access window

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const dayStart = (d) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999Z`);

/**
 * Switch the user to Manager inside their window and back to Participant outside it.
 * Once the end date has passed the access is cleared and its request marked Expired.
 * Updates both the database and the given document; returns true if anything changed.
 */
const syncTemporaryRole = async (user, now = new Date()) => {
    if (!user || !user.tempManagerFrom) return false;

    if (user.tempManagerUntil && now > user.tempManagerUntil) {
        const requestId = user.tempManagerRequest;
        const update = { role: "Participant", tempManagerFrom: null, tempManagerUntil: null, tempManagerRequest: null };
        await User.updateOne({ _id: user._id }, { $set: update });
        Object.assign(user, update);
        if (requestId) await RoleRequest.updateOne({ _id: requestId, status: "Approved" }, { $set: { status: "Expired" } });
        return true;
    }

    const active = now >= user.tempManagerFrom;
    const update = active ? { role: "Manager", status: "Approved" } : { role: "Participant" };
    if (user.role === update.role && (!active || user.status === "Approved")) return false;
    await User.updateOne({ _id: user._id }, { $set: update });
    Object.assign(user, update);
    return true;
};

// Remove a user's temporary access (when an admin revokes it or the user gives it up)
const clearTemporaryAccess = async (user) => {
    const update = { tempManagerFrom: null, tempManagerUntil: null, tempManagerRequest: null };
    if (user.role === "Manager") update.role = "Participant";
    await User.updateOne({ _id: user._id }, { $set: update });
    Object.assign(user, update);
};

const signToken = (user) => {
    const payload = {
        email: user.email,
        id: user._id,
        role: user.role,
        status: user.status
    };
    // Tokens for users with temporary access are re-checked against the database on every request,
    // so expiry and revocation apply immediately rather than when the token runs out
    if (user.tempManagerFrom) payload.tempManager = true;
    return jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret", { expiresIn: "24h" });
};

// Daily sweep so stored roles stay correct even for users who aren't signed in
const sweepTemporaryManagers = async () => {
    const users = await User.find({ tempManagerFrom: { $ne: null } }).select("role status tempManagerFrom tempManagerUntil tempManagerRequest");
    let changed = 0;
    for (const user of users) {
        if (await syncTemporaryRole(user)) changed++;
    }
    console.log(`[Temp Managers] Checked ${users.length} user(s), updated ${changed}`);
    return changed;
};

module.exports = { isDay, dayStart, dayEnd, syncTemporaryRole, clearTemporaryAccess, signToken, sweepTemporaryManagers };
