const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { syncTemporaryRole } = require("../utils/tempManager");
require("dotenv").config();

// Tokens identify the user; their current role and centre come from the database, so promotions,
// demotions, centre changes and temporary access apply without signing in again.
// Lookups are cached per server instance for a short time to keep requests fast;
// changes made on this instance clear the cache immediately (see invalidateRoleCache).
const ROLE_CACHE_MS = 30 * 1000;
const roleCache = new Map();

const loadCurrentUser = async (userId) => {
    const key = String(userId);
    const hit = roleCache.get(key);
    let user = hit && Date.now() - hit.at < ROLE_CACHE_MS ? hit.user : null;
    if (!user) {
        user = await User.findById(userId).select("role status centreId verificationStatus tempManagerFrom tempManagerUntil tempManagerRequest");
        if (!user) return null;
        if (roleCache.size > 1000) roleCache.clear();
        roleCache.set(key, { user, at: Date.now() });
    }
    // Start or end a temporary manager window on time, even when the lookup came from the cache
    await syncTemporaryRole(user);
    return user;
};

exports.invalidateRoleCache = (userId) => roleCache.delete(String(userId));

exports.auth = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ success: false, message: "Token is missing" });
    }

    let decode;
    try {
        decode = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }

    try {
        const user = await loadCurrentUser(decode.id);
        if (!user) return res.status(401).json({ success: false, message: "Invalid token" });
        req.tokenClaims = decode;
        req.user = {
            ...decode,
            role: user.role,
            status: user.status,
            centreId: user.centreId ? String(user.centreId) : null,
            verificationStatus: user.verificationStatus
        };
        next();
    } catch (error) {
        // A database problem is not the user's fault: don't answer 401, which would sign them out
        console.error("[Auth Middleware] Could not load user:", error.message);
        return res.status(503).json({ success: false, message: "Service temporarily unavailable. Please try again." });
    }
};

exports.isSuperAdmin = (req, res, next) => {
    if (req.user.role !== "SuperAdmin") {
        return res.status(403).json({ success: false, message: "This is a protected route for the Super Admin only" });
    }
    next();
};

// Admin or co-admin of a centre
exports.isAdmin = (req, res, next) => {
    if (req.user.role !== "Admin") {
        return res.status(403).json({ success: false, message: "This is a protected route for Admins only" });
    }
    if (!req.user.centreId) {
        return res.status(403).json({ success: false, message: "You are not assigned to a centre yet. Ask the Super Admin to assign you one." });
    }
    next();
};

// Centre admins (their centre) or the Super Admin (everything)
exports.isAdminOrSuperAdmin = (req, res, next) => {
    if (req.user.role === "SuperAdmin") return next();
    return exports.isAdmin(req, res, next);
};

// Approved managers and centre admins
exports.isManager = (req, res, next) => {
    if (req.user.role === "Manager" && req.user.status === "Approved") return next();
    if (req.user.role === "Admin" && req.user.centreId) return next();
    return res.status(403).json({ success: false, message: "This is a protected route for approved Managers only" });
};
