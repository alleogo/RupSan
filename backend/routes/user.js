const express = require("express");
const router = express.Router();
const { updateProfile, requestVerification, getUnverifiedUsers, verifyUser, getAllUsers, changeUserRole } = require("../controllers/user");
const { auth, isAdmin } = require("../middlewares/auth");

router.put("/profile", auth, updateProfile);
router.post("/request-verification", auth, requestVerification);
router.get("/unverified", auth, isAdmin, getUnverifiedUsers);
router.get("/all", auth, isAdmin, getAllUsers);
router.put("/verify/:userId", auth, isAdmin, verifyUser);
router.put("/:userId/role", auth, isAdmin, changeUserRole);

module.exports = router;

