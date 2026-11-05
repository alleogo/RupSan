const mongoose = require("mongoose");
const AccountAccess = require("../models/AccountAccess");
const Transaction = require("../models/Transaction");

// What a user may do with a centre's account (ledger).
//   Admin / co-admin of the centre: everything (view, add, edit or delete any entry, restore, share)
//   Editor (shared): view, add entries, edit or delete their own
//   Viewer (shared): view only
//   Super Admin: view every centre's account and restore deleted entries, but not edit

const NONE = { level: null, canView: false, canAdd: false, canEditAll: false, canEditOwn: false, canRestore: false, canShare: false };

const getAccountPermissions = async (user, centreId) => {
    if (!centreId) return NONE;
    if (user.role === "SuperAdmin") return { ...NONE, level: "SuperAdmin", canView: true, canRestore: true };
    // The user's centre may be an id or a populated centre
    const userCentre = user.centreId && (user.centreId._id || user.centreId);
    if (!userCentre || String(userCentre) !== String(centreId)) return NONE;
    if (user.role === "Admin") return { level: "Admin", canView: true, canAdd: true, canEditAll: true, canEditOwn: true, canRestore: true, canShare: true };

    const grant = await AccountAccess.findOne({ centre: centreId, user: user.id || user._id });
    if (!grant || (grant.expiresAt && grant.expiresAt <= new Date())) return NONE;
    if (grant.level === "Editor") return { ...NONE, level: "Editor", canView: true, canAdd: true, canEditOwn: true, expiresAt: grant.expiresAt };
    return { ...NONE, level: "Viewer", canView: true, expiresAt: grant.expiresAt };
};

const deny = (res, status, message) => res.status(status).json({ success: false, message });

// For account-wide routes: the user's own centre, or (Super Admin) the centre chosen with ?centreId=
const resolveAccount = async (req, res, next) => {
    try {
        let centreId = req.user.centreId;
        if (req.user.role === "SuperAdmin") {
            centreId = req.query.centreId || (req.body && req.body.centreId);
            if (!centreId || !mongoose.Types.ObjectId.isValid(centreId)) return deny(res, 400, "Choose a centre's account");
        }
        if (!centreId) return deny(res, 403, "You don't belong to a centre yet");
        const permissions = await getAccountPermissions(req.user, centreId);
        if (!permissions.canView) return deny(res, 403, "You don't have access to this centre's account");
        req.account = { centreId: String(centreId), ...permissions };
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// For routes about one entry: the account is the entry's centre (deleted entries included)
const resolveEntryAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return deny(res, 404, "Entry not found");
        const entry = await Transaction.findById(id);
        if (!entry || !entry.centre) return deny(res, 404, "Entry not found");
        const permissions = await getAccountPermissions(req.user, entry.centre);
        if (!permissions.canView) return deny(res, 404, "Entry not found");
        req.entry = entry;
        req.account = { centreId: String(entry.centre), ...permissions };
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const requirePermission = (key, message) => (req, res, next) => {
    if (!req.account || !req.account[key]) return deny(res, 403, message || "You don't have permission to do that in this account");
    next();
};

// Can this user change (edit or delete) this particular entry?
const canChangeEntry = (account, entry, userId) =>
    account.canEditAll || (account.canEditOwn && String(entry.recordedBy) === String(userId));

module.exports = { getAccountPermissions, resolveAccount, resolveEntryAccount, requirePermission, canChangeEntry };
