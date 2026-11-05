const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Malformed ids in the URL are "not found", not server errors
const validId = (req, res, next, value) => (mongoose.Types.ObjectId.isValid(value) ? next() : res.status(404).json({ success: false, message: "Not found" }));
router.param("id", validId);
router.param("userId", validId);
const {
    listCentres, listCentresForSuperAdmin, createCentre, updateCentre, deleteCentre, getCentreDetails,
    appointAdmin, changeAdminRole, changeUnassignedAdminRole, getMyCentre, addCoAdmin, removeCoAdmin
} = require("../controllers/centre");
const { auth, isAdmin, isSuperAdmin } = require("../middlewares/auth");

// Public: the centre dropdown (signup needs it before login)
router.get("/", listCentres);

// Admin / co-admin of a centre
router.get("/mine", auth, isAdmin, getMyCentre);
router.post("/mine/co-admins", auth, isAdmin, addCoAdmin);
router.delete("/mine/co-admins/:userId", auth, isAdmin, removeCoAdmin);

// Super Admin
router.get("/manage", auth, isSuperAdmin, listCentresForSuperAdmin);
router.post("/", auth, isSuperAdmin, createCentre);
router.put("/unassigned-admins/:userId/role", auth, isSuperAdmin, changeUnassignedAdminRole);
router.put("/:id", auth, isSuperAdmin, updateCentre);
router.delete("/:id", auth, isSuperAdmin, deleteCentre);

// Members of the centre and the Super Admin
router.get("/:id/details", auth, getCentreDetails);
router.put("/:id/admin", auth, isSuperAdmin, appointAdmin);
router.put("/:id/admin/role", auth, isSuperAdmin, changeAdminRole);

module.exports = router;
