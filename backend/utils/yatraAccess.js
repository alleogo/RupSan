const mongoose = require("mongoose");
const Yatra = require("../models/Yatra");

// Who can see and manage a yatra.
// See: its creator, members of the yatra's centre, centres it's shared with (or all centres), and the Super Admin.
// Yatras from before centres existed (no centre) stay visible to everyone.
// Manage: the manager who created it and the admins (and co-admins) of its centre.

const idOf = (value) => (value && value._id ? String(value._id) : value ? String(value) : null);

const canSeeYatra = (user, yatra) => {
    if (user.role === "SuperAdmin") return true;
    // Creators keep seeing their yatras, even after moving to another centre
    if (idOf(yatra.createdBy) === String(user.id)) return true;
    if (!yatra.centre) return true;
    if (yatra.visibility && yatra.visibility.allCentres) return true;
    if (!user.centreId) return false;
    if (idOf(yatra.centre) === user.centreId) return true;
    return ((yatra.visibility && yatra.visibility.centres) || []).some(c => idOf(c) === user.centreId);
};

const canManageYatra = (user, yatra) => {
    if (idOf(yatra.createdBy) === String(user.id)) return true;
    if (user.role !== "Admin" || !user.centreId) return false;
    return !yatra.centre || idOf(yatra.centre) === user.centreId;
};

// Query filter for the yatras a user can see
const visibleYatraFilter = (user) => {
    if (user.role === "SuperAdmin") return {};
    const or = [{ centre: null }, { "visibility.allCentres": true }, { createdBy: new mongoose.Types.ObjectId(user.id) }];
    if (user.centreId) {
        const centre = new mongoose.Types.ObjectId(user.centreId);
        or.push({ centre }, { "visibility.centres": centre });
    }
    return { $or: or };
};

// Load a yatra the user may manage, or send the error response and return null
const loadManageableYatra = async (req, res, yatraId) => {
    if (!mongoose.Types.ObjectId.isValid(yatraId)) { res.status(404).json({ success: false, message: "Yatra not found" }); return null; }
    const yatra = await Yatra.findById(yatraId);
    if (!yatra || !canSeeYatra(req.user, yatra)) { res.status(404).json({ success: false, message: "Yatra not found" }); return null; }
    if (!canManageYatra(req.user, yatra)) { res.status(403).json({ success: false, message: "Only this yatra's manager or its centre's admins can do that" }); return null; }
    return yatra;
};

// Load a yatra the user may see, or send 404 and return null
const loadVisibleYatra = async (req, res, yatraId) => {
    if (!mongoose.Types.ObjectId.isValid(yatraId)) { res.status(404).json({ success: false, message: "Yatra not found" }); return null; }
    const yatra = await Yatra.findById(yatraId);
    if (!yatra || !canSeeYatra(req.user, yatra)) { res.status(404).json({ success: false, message: "Yatra not found" }); return null; }
    return yatra;
};

module.exports = { canSeeYatra, canManageYatra, visibleYatraFilter, loadManageableYatra, loadVisibleYatra };
