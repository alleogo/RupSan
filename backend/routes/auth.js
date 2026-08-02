const express = require("express");
const router = express.Router();
const { login, register, approveManager, sendOTP, getPendingManagers } = require("../controllers/auth");
const { auth, isAdmin } = require("../middlewares/auth");

// Request logging middleware for auth routes
router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[Auth Routes] ${timestamp} - ${req.method} ${req.path}`);
    next();
});

router.post("/sendotp", sendOTP);
router.post("/register", register);
router.post("/login", login);
router.post("/approve-manager", auth, isAdmin, approveManager);
router.get("/pending-managers", auth, isAdmin, getPendingManagers);

module.exports = router;
