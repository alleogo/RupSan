const express = require("express");
const router = express.Router();
const { registerForYatra, updateRegistrationDetails, getYatraRegistrations, approveRegistration, getMyRegistrationStatus, getMyRegistrations } = require("../controllers/registration");
const { auth, isManager } = require("../middlewares/auth");
router.post("/register", auth, registerForYatra);
router.put("/:registrationId/details", auth, isManager, updateRegistrationDetails);
router.get("/my-registrations", auth, getMyRegistrations);
router.get("/my-status/:yatraId", auth, getMyRegistrationStatus);
router.get("/:yatraId", auth, isManager, getYatraRegistrations);
router.put("/approve/:registrationId", auth, isManager, approveRegistration);

module.exports = router;
