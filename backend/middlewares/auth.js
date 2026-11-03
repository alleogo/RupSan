const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { syncTemporaryRole } = require("../utils/tempManager");

// Manager tokens can outlive a demotion or expiry, so their role is looked up in the database.
// Results are cached per server instance for a short time to keep manager requests fast;
// changes made on this instance clear the cache immediately (see invalidateRoleCache).
const ROLE_CACHE_MS = 30 * 1000;
const roleCache = new Map();

const loadCurrentRole = async (userId) => {
    const key = String(userId);
    const hit = roleCache.get(key);
    let user = hit && Date.now() - hit.at < ROLE_CACHE_MS ? hit.user : null;
    if (!user) {
        user = await User.findById(userId).select("role status tempManagerFrom tempManagerUntil tempManagerRequest");
        if (!user) return null;
        if (roleCache.size > 1000) roleCache.clear();
        roleCache.set(key, { user, at: Date.now() });
    }
    // Start or end a temporary manager window on time, even when the lookup came from the cache
    await syncTemporaryRole(user);
    return user;
};

exports.invalidateRoleCache = (userId) => roleCache.delete(String(userId));
require("dotenv").config();

exports.auth = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            console.log(`[Auth Middleware] Token missing for request to ${req.method} ${req.path}`);
            return res.status(401).json({ success: false, message: "Token is missing" });
        }

        try {
            const decode = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
            req.tokenClaims = decode;
            req.user = decode;
            // Managers and temporary managers: use the current role, so demotion, expiry and revocation take effect
            if (decode.role === "Manager" || decode.tempManager) {
                const user = await loadCurrentRole(decode.id);
                if (!user) return res.status(401).json({ success: false, message: "Invalid token" });
                req.user = { ...decode, role: user.role, status: user.status };
            }
            console.log(`[Auth Middleware] User authenticated: ${decode._id} (Role: ${decode.role})`);
        } catch (error) {
            console.log(`[Auth Middleware] Invalid token - verification failed`);
            return res.status(401).json({ success: false, message: "Invalid token" });
        }
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "Token validation issue occurred" });
    }
};

exports.isAdmin = async (req, res, next) => {
    try {
        if (req.user.role !== "Admin") {
            console.log(`[Auth Middleware] Admin access denied for user ${req.user._id} with role ${req.user.role}`);
            return res.status(401).json({ success: false, message: "This is a protected route for Admins only" });
        }
        console.log(`[Auth Middleware] Admin access granted for user ${req.user._id}`);
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "User role cannot be verified" });
    }
};

exports.isManager = async (req, res, next) => {
    try {
        if (req.user.role === 'Manager' && req.user.status === 'Approved') {
            console.log(`[Auth Middleware] Manager access granted for user ${req.user._id}`);
            return next();
        }
        if (req.user.role === 'Admin') {
            console.log(`[Auth Middleware] Admin access granted (Manager route) for user ${req.user._id}`);
            return next();
        }
        console.log(`[Auth Middleware] Manager access denied for user ${req.user._id} (Status: ${req.user.status})`);
        return res.status(401).json({ success: false, message: "This is a protected route for approved Managers only" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "User role cannot be verified" });
    }
};

