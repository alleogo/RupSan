const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.auth = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            return res.status(401).json({ success: false, message: "Token is missing" });
        }

        try {
            const decode = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
            req.user = decode;
        } catch (error) {
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
            return res.status(401).json({ success: false, message: "This is a protected route for Admins only" });
        }
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "User role cannot be verified" });
    }
};

exports.isManager = async (req, res, next) => {
    try {
        if (req.user.role === 'Manager' && req.user.status === 'Approved') {
            return next();
        }
        if (req.user.role === 'Admin') {
            return next();
        }
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
