const mongoose = require("mongoose");
const Centre = require("../models/Centre");
const User = require("../models/User");
const RoleRequest = require("../models/RoleRequest");
const AccountAccess = require("../models/AccountAccess");
const mailSender = require("../utils/mailSender");
const { escapeHtml } = require("../utils/notify");
const { clearTemporaryAccess } = require("../utils/tempManager");
const { invalidateRoleCache } = require("../middlewares/auth");

// Centre Controller - The centre list (Super Admin), centre admins and co-admins

const MEMBER_ROLES = ["Manager", "Participant"];
const userFields = "firstName lastName email phoneNumber role";

// Other collections may not exist yet; count safely
const countIn = async (modelName, filter) => {
    if (!mongoose.models[modelName]) return 0;
    return mongoose.model(modelName).countDocuments(filter);
};

// Make someone an Admin of a centre: drop temporary access and open role requests they had
const makeAdmin = async (user, centreId) => {
    if (user.tempManagerFrom) {
        const requestId = user.tempManagerRequest;
        await clearTemporaryAccess(user);
        if (requestId) await RoleRequest.updateOne({ _id: requestId, status: "Approved" }, { $set: { status: "Revoked", reviewNote: "Became a centre admin" } });
    }
    await RoleRequest.updateMany({ user: user._id, status: "Pending" }, { $set: { status: "Cancelled", reviewNote: "Became a centre admin" } });
    await User.updateOne({ _id: user._id }, { $set: { role: "Admin", status: "Approved", centreId } });
    // Admins have full access to their centre's account; shared access records no longer apply
    await AccountAccess.deleteMany({ user: user._id });
    invalidateRoleCache(user._id);
};

const setMemberRole = async (userId, role) => {
    await User.updateOne({ _id: userId }, { $set: { role, status: "Approved" } });
    invalidateRoleCache(userId);
};

const email = (user, subject, body) => mailSender(user.email, subject, `<p>Dear ${escapeHtml(user.firstName)},</p>${body}<p>Thank you!</p>`);

// Public: names for the centre dropdown
exports.listCentres = async (req, res) => {
    try {
        const centres = await Centre.find().select("name").sort({ nameKey: 1 });
        return res.status(200).json({ success: true, centres });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Super Admin: centres with their admins and what they contain
exports.listCentresForSuperAdmin = async (req, res) => {
    try {
        const centres = await Centre.find().sort({ nameKey: 1 }).populate("admin", userFields).populate("coAdmins", userFields).lean();
        const memberCounts = await User.aggregate([
            { $match: { centreId: { $ne: null } } },
            { $group: { _id: { centre: "$centreId", role: "$role" }, count: { $sum: 1 } } }
        ]);
        const withCounts = await Promise.all(centres.map(async (c) => {
            const counts = { Admin: 0, Manager: 0, Participant: 0 };
            memberCounts.filter(m => String(m._id.centre) === String(c._id)).forEach(m => { counts[m._id.role] = m.count; });
            return {
                ...c,
                members: counts,
                yatras: await countIn("Yatra", { centre: c._id }),
                entries: await countIn("Transaction", { centre: c._id })
            };
        }));
        const unassignedAdmins = await User.find({ role: "Admin", centreId: null }).select(userFields);
        return res.status(200).json({ success: true, centres: withCounts, unassignedAdmins });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCentre = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ success: false, message: "Enter a centre name" });
        const centre = await Centre.create({ name });
        return res.status(201).json({ success: true, message: `Centre "${centre.name}" added`, centre });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "A centre with this name already exists" });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Renaming updates every member automatically, since members reference the centre
exports.renameCentre = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ success: false, message: "Enter a centre name" });
        const centre = await Centre.findById(req.params.id);
        if (!centre) return res.status(404).json({ success: false, message: "Centre not found" });
        centre.name = name;
        await centre.save();
        return res.status(200).json({ success: true, message: `Centre renamed to "${centre.name}"`, centre });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "A centre with this name already exists" });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Only empty centres can be deleted, so no member, yatra or account entry is left without a centre
exports.deleteCentre = async (req, res) => {
    try {
        const centre = await Centre.findById(req.params.id);
        if (!centre) return res.status(404).json({ success: false, message: "Centre not found" });
        const [members, yatras, entries] = await Promise.all([
            User.countDocuments({ centreId: centre._id }),
            countIn("Yatra", { centre: centre._id }),
            countIn("Transaction", { centre: centre._id })
        ]);
        if (members || yatras || entries) {
            const parts = [members && `${members} member(s)`, yatras && `${yatras} yatra(s)`, entries && `${entries} account entr${entries === 1 ? "y" : "ies"}`].filter(Boolean);
            return res.status(400).json({ success: false, message: `"${centre.name}" still has ${parts.join(", ")}. Only empty centres can be deleted.` });
        }
        await centre.deleteOne();
        return res.status(200).json({ success: true, message: `Centre "${centre.name}" deleted` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Super Admin: appoint an existing participant or manager (or an admin without a centre) as a centre's admin.
// The previous admin, if any, keeps their membership with the role chosen in previousAdminRole.
exports.appointAdmin = async (req, res) => {
    try {
        const { userId, previousAdminRole = "Manager" } = req.body;
        if (!MEMBER_ROLES.includes(previousAdminRole)) return res.status(400).json({ success: false, message: "Previous admin's new role must be Manager or Participant" });

        const centre = await Centre.findById(req.params.id);
        if (!centre) return res.status(404).json({ success: false, message: "Centre not found" });
        const user = await User.findById(userId).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const alreadyThisAdmin = centre.admin && String(centre.admin) === String(user._id);
        if (alreadyThisAdmin) return res.status(400).json({ success: false, message: `${user.firstName} is already this centre's admin` });
        if (user.role === "SuperAdmin") return res.status(400).json({ success: false, message: "The Super Admin can't be a centre admin" });
        const isCoAdminHere = centre.coAdmins.some(id => String(id) === String(user._id));
        if (user.role === "Admin" && user.centreId && !isCoAdminHere) {
            return res.status(400).json({ success: false, message: `${user.firstName} is already an admin of another centre` });
        }

        const previous = centre.admin ? await User.findById(centre.admin).select("firstName email") : null;
        if (previous) await setMemberRole(previous._id, previousAdminRole);

        await makeAdmin(user, centre._id);
        centre.admin = user._id;
        centre.coAdmins = centre.coAdmins.filter(id => String(id) !== String(user._id));
        await centre.save();

        await email(user, `You are now the admin of ${centre.name}`, `<p>The Super Admin has made you the admin of <b>${escapeHtml(centre.name)}</b>. You now look after its members, yatras and account.</p>`);
        if (previous) await email(previous, `Admin change at ${centre.name}`, `<p>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} is now the admin of <b>${escapeHtml(centre.name)}</b>. Your account is now a ${previousAdminRole.toLowerCase()} account.</p>`);

        return res.status(200).json({ success: true, message: `${user.firstName} ${user.lastName} is now the admin of ${centre.name}` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Super Admin: change a centre admin's role (Manager or Participant), leaving the centre without an admin
exports.changeAdminRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!MEMBER_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Role must be Manager or Participant" });
        const centre = await Centre.findById(req.params.id);
        if (!centre) return res.status(404).json({ success: false, message: "Centre not found" });
        if (!centre.admin) return res.status(400).json({ success: false, message: "This centre has no admin" });

        const admin = await User.findById(centre.admin).select("firstName lastName email");
        await setMemberRole(centre.admin, role);
        centre.admin = null;
        await centre.save();
        if (admin) await email(admin, `Your role at ${centre.name} has changed`, `<p>The Super Admin has changed your account at <b>${escapeHtml(centre.name)}</b> to a ${role.toLowerCase()} account.</p>`);

        return res.status(200).json({ success: true, message: `${admin ? admin.firstName : "The admin"} is now a ${role.toLowerCase()}. ${centre.name} has no admin until you appoint one.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Super Admin: change the role of an admin who has no centre (e.g. admins from before centres existed)
exports.changeUnassignedAdminRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!MEMBER_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Role must be Manager or Participant" });
        const user = await User.findById(req.params.userId).select("firstName role centreId");
        if (!user || user.role !== "Admin" || user.centreId) return res.status(400).json({ success: false, message: "This user is not an admin without a centre" });
        await setMemberRole(user._id, role);
        return res.status(200).json({ success: true, message: `${user.firstName} is now a ${role.toLowerCase()}. They can choose their centre from their profile.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin or co-admin: their centre, with its admin and co-admins
exports.getMyCentre = async (req, res) => {
    try {
        const centre = await Centre.findById(req.user.centreId).populate("admin", userFields).populate("coAdmins", userFields);
        if (!centre) return res.status(404).json({ success: false, message: "Centre not found" });
        return res.status(200).json({ success: true, centre, isPrimaryAdmin: centre.admin && String(centre.admin._id) === String(req.user.id) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const loadOwnCentreAsPrimary = async (req, res) => {
    const centre = await Centre.findById(req.user.centreId);
    if (!centre) { res.status(404).json({ success: false, message: "Centre not found" }); return null; }
    if (!centre.admin || String(centre.admin) !== String(req.user.id)) {
        res.status(403).json({ success: false, message: "Only the centre's admin can appoint or remove co-admins" });
        return null;
    }
    return centre;
};

// Primary admin: make a member of their centre a co-admin
exports.addCoAdmin = async (req, res) => {
    try {
        const centre = await loadOwnCentreAsPrimary(req, res);
        if (!centre) return;
        const user = await User.findById(req.body.userId).select("-password");
        if (!user || String(user.centreId) !== String(centre._id)) return res.status(404).json({ success: false, message: "This person is not a member of your centre" });
        if (!MEMBER_ROLES.includes(user.role)) return res.status(400).json({ success: false, message: `${user.firstName} is already an admin` });

        await makeAdmin(user, centre._id);
        centre.coAdmins.push(user._id);
        await centre.save();
        await email(user, `You are now a co-admin of ${centre.name}`, `<p>You have been made a co-admin of <b>${escapeHtml(centre.name)}</b>. You can now manage its members, yatras and account.</p>`);

        return res.status(200).json({ success: true, message: `${user.firstName} ${user.lastName} is now a co-admin` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Primary admin: remove a co-admin, giving them the chosen role
exports.removeCoAdmin = async (req, res) => {
    try {
        const role = req.body.role || "Manager";
        if (!MEMBER_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Role must be Manager or Participant" });
        const centre = await loadOwnCentreAsPrimary(req, res);
        if (!centre) return;
        const { userId } = req.params;
        if (!centre.coAdmins.some(id => String(id) === String(userId))) return res.status(404).json({ success: false, message: "This person is not a co-admin of your centre" });

        centre.coAdmins = centre.coAdmins.filter(id => String(id) !== String(userId));
        await centre.save();
        await setMemberRole(userId, role);
        const user = await User.findById(userId).select("firstName lastName email");
        if (user) await email(user, `Your role at ${centre.name} has changed`, `<p>You are no longer a co-admin of <b>${escapeHtml(centre.name)}</b>. Your account is now a ${role.toLowerCase()} account.</p>`);

        return res.status(200).json({ success: true, message: `${user ? user.firstName : "They"} ${user ? "is" : "are"} now a ${role.toLowerCase()}` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
