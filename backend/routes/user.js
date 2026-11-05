const express = require("express");
const router = express.Router();
const { updateProfile, uploadAadharCard, getAadharCard, requestVerification, getUnverifiedUsers, verifyUser, getAllUsers, changeUserRole } = require("../controllers/user");
const { auth, isAdmin, isAdminOrSuperAdmin } = require("../middlewares/auth");

router.put("/profile", auth, updateProfile);
router.post("/request-verification", auth, requestVerification);
router.get("/unverified", auth, isAdmin, getUnverifiedUsers);
router.get("/all", auth, isAdminOrSuperAdmin, getAllUsers);
router.post("/aadhar-card", auth, uploadAadharCard);
router.get("/:userId/aadhar-card", auth, getAadharCard);
router.put("/verify/:userId", auth, isAdmin, verifyUser);
router.put("/:userId/role", auth, isAdmin, changeUserRole);

module.exports = router;

