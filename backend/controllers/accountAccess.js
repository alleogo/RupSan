const mongoose = require("mongoose");
const AccountAccess = require("../models/AccountAccess");
const Centre = require("../models/Centre");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { escapeHtml } = require("../utils/notify");
const { getAccountPermissions } = require("../utils/accountAccess");

// Account Access Controller - Centre admins share their centre's account with members

// What the signed-in user can do with their centre's account (Super Admin: the list of centres)
exports.getMyAccess = async (req, res) => {
    try {
        if (req.user.role === "SuperAdmin") {
            const centres = await Centre.find().select("name").sort({ nameKey: 1 });
            return res.status(200).json({ success: true, permissions: await getAccountPermissions(req.user, "any"), centres });
        }
        const permissions = await getAccountPermissions(req.user, req.user.centreId);
        const centre = req.user.centreId ? await Centre.findById(req.user.centreId).select("name") : null;
        return res.status(200).json({ success: true, permissions, centre });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: who the account is shared with
exports.listAccess = async (req, res) => {
    try {
        const grants = await AccountAccess.find({ centre: req.user.centreId })
            .populate("user", "firstName lastName email role")
            .populate("grantedBy", "firstName lastName")
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, grants });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: share the account with a member of the centre (or change their level / end date)
exports.grantAccess = async (req, res) => {
    try {
        const { userId, level, expiresOn } = req.body;
        if (!["Viewer", "Editor"].includes(level)) return res.status(400).json({ success: false, message: "Level must be Viewer or Editor" });
        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(404).json({ success: false, message: "This person is not a member of your centre" });

        const user = await User.findById(userId).select("firstName lastName email role centreId");
        if (!user || String(user.centreId) !== req.user.centreId) return res.status(404).json({ success: false, message: "This person is not a member of your centre" });
        if (!["Participant", "Manager"].includes(user.role)) return res.status(400).json({ success: false, message: "Admins already have full access to the account" });

        let expiresAt = null;
        if (expiresOn) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || expiresOn < new Date().toISOString().slice(0, 10)) {
                return res.status(400).json({ success: false, message: "Choose an end date from today onwards" });
            }
            expiresAt = new Date(`${expiresOn}T23:59:59.999Z`);
        }

        const grant = await AccountAccess.findOneAndUpdate(
            { centre: req.user.centreId, user: user._id },
            { $set: { level, expiresAt, grantedBy: req.user.id } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const centre = await Centre.findById(req.user.centreId).select("name");
        const until = expiresAt ? ` until ${expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}` : "";
        await mailSender(user.email, `Access to the ${centre.name} account`, `<p>Dear ${escapeHtml(user.firstName)},</p>
            <p>You now have <b>${level === "Editor" ? "editor" : "view-only"}</b> access to the <b>${escapeHtml(centre.name)}</b> account${until}.</p>
            <p>${level === "Editor" ? "You can see the ledger, add entries, and edit or delete entries you add." : "You can see the ledger and its reports."}</p><p>Thank you!</p>`);

        return res.status(200).json({ success: true, message: `${user.firstName} ${user.lastName} is now ${level === "Editor" ? "an editor" : "a viewer"} of the account${until}`, grant });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: stop sharing the account with someone
exports.revokeAccess = async (req, res) => {
    try {
        const grant = await AccountAccess.findOneAndDelete({ centre: req.user.centreId, user: req.params.userId }).populate("user", "firstName lastName");
        if (!grant) return res.status(404).json({ success: false, message: "This person doesn't have access to the account" });
        return res.status(200).json({ success: true, message: `${grant.user ? grant.user.firstName : "Their"} access to the account was removed` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
