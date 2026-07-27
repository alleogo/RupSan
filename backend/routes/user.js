const express = require("express");
const router = express.Router();
const { updateProfile, requestVerification, getUnverifiedUsers, verifyUser } = require("../controllers/user");
const { auth, isAdmin } = require("../middlewares/auth");

router.put("/profile", auth, updateProfile);
router.post("/request-verification", auth, requestVerification);
router.get("/unverified", auth, isAdmin, getUnverifiedUsers);
router.put("/verify/:userId", auth, isAdmin, verifyUser);

module.exports = router;
