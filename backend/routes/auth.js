const express = require("express");
const router = express.Router();
const { login, register, approveManager, sendOTP, getPendingManagers } = require("../controllers/auth");
const { auth, isAdmin } = require("../middlewares/auth");

router.post("/sendotp", sendOTP);
router.post("/register", register);
router.post("/login", login);
router.post("/approve-manager", auth, isAdmin, approveManager);
router.get("/pending-managers", auth, isAdmin, getPendingManagers);

module.exports = router;
