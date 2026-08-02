const jwt = require("jsonwebtoken");
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
            req.user = decode;
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

exports.isManagerOnly = async (req, res, next) => {
  try {
    // Allow Manager with Approved status or any Admin
    if (req.user.role === 'Manager' && req.user.status === 'Approved') {
      return next();
    }
    if (req.user.role === 'Admin') {
      return next();
    }
    return res.status(401).json({ success: false, message: "Only Managers with approved accounts can perform this action" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "User role cannot be verified" });
  }
};
