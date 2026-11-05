const mongoose = require("mongoose");
const User = require("../models/User");
const Centre = require("../models/Centre");
const RoleRequest = require("../models/RoleRequest");
const mailSender = require("../utils/mailSender");
const { isDay, dayStart, dayEnd, syncTemporaryRole, clearTemporaryAccess } = require("../utils/tempManager");
const { invalidateRoleCache } = require("../middlewares/auth");
const { escapeHtml, escapeRegex, getSiteUrl, notifyCentreAdmins } = require("../utils/notify");
const { uploadPrivateImage, signedImageUrl, deletePrivateImage } = require("../utils/privateFiles");

const PUBLIC_USER_FIELDS = "-password -aadharNumber -aadharCard.publicId -aadharCard.format";
const AADHAR_MAX_BYTES = 4 * 1024 * 1024;

const loadPublicUser = (id) => User.findById(id).select(PUBLIC_USER_FIELDS).populate("centreId", "name");

// Update Profile (participants may also change their centre, which means verifying again)
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, centreId } = req.body;

        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Email is already in use by another account" });
            }
        }

        const current = await User.findById(req.user.id).select("role centreId verificationStatus");
        const updates = {};
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (email !== undefined) updates.email = email;
        if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;

        if (centreId !== undefined && String(centreId || "") !== String(current.centreId || "")) {
            if (current.role !== "Participant") {
                return res.status(403).json({ success: false, message: "Only participants can change their centre. Ask your centre admin." });
            }
            if (!mongoose.Types.ObjectId.isValid(centreId) || !(await Centre.exists({ _id: centreId }))) {
                return res.status(400).json({ success: false, message: "Choose a centre from the list" });
            }
            updates.centreId = centreId;
            // The new centre's admin has to verify them
            if (current.verificationStatus !== "Unverified") updates.verificationStatus = "Unverified";
        }

        await User.updateOne({ _id: req.user.id }, { $set: updates });
        invalidateRoleCache(req.user.id);
        const user = await loadPublicUser(req.user.id);
        const message = updates.centreId ? "Profile updated. Request verification so your new centre's admin can verify you." : "Profile updated successfully";
        return res.status(200).json({ success: true, message, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Upload a photo of the Aadhaar card (stored privately)
exports.uploadAadharCard = async (req, res) => {
    try {
        const file = req.files && req.files.aadharCard;
        if (!file) return res.status(400).json({ success: false, message: "Choose a photo of your Aadhaar card" });
        if (!file.mimetype.startsWith("image/")) return res.status(400).json({ success: false, message: "Upload a photo (JPG or PNG) of your Aadhaar card" });
        if (file.size > AADHAR_MAX_BYTES) return res.status(400).json({ success: false, message: "The photo must be smaller than 4MB" });

        const user = await User.findById(req.user.id).select("role verificationStatus aadharCard");
        const uploaded = await uploadPrivateImage(file, `${process.env.FOLDER_NAME}/aadhar`);
        await deletePrivateImage(user.aadharCard && user.aadharCard.publicId);

        const updates = { aadharCard: { ...uploaded, uploadedAt: new Date() } };
        // A new card has to be checked again
        if (user.role === "Participant" && user.verificationStatus !== "Unverified") updates.verificationStatus = "Unverified";
        await User.updateOne({ _id: user._id }, { $set: updates });
        invalidateRoleCache(user._id);

        return res.status(200).json({ success: true, message: "Aadhaar card uploaded", user: await loadPublicUser(user._id) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// A short-lived view of someone's Aadhaar card: themselves, their centre's admins, or the Super Admin
exports.getAadharCard = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(404).json({ success: false, message: "User not found" });
        const target = await User.findById(userId).select("aadharCard centreId");
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const isSelf = String(userId) === String(req.user.id);
        const isCentreAdmin = req.user.role === "Admin" && req.user.centreId && String(target.centreId) === req.user.centreId;
        if (!isSelf && !isCentreAdmin && req.user.role !== "SuperAdmin") {
            return res.status(403).json({ success: false, message: "You can't view this Aadhaar card" });
        }
        if (!target.aadharCard || !target.aadharCard.publicId) {
            return res.status(404).json({ success: false, message: "No Aadhaar card uploaded" });
        }
        return res.status(200).json({ success: true, url: signedImageUrl(target.aadharCard) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Request Verification (Participant only) - goes to the admins of their centre
exports.requestVerification = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate("centreId", "name");

        if (user.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Only participants need verification" });
        }
        if (!user.firstName || !user.phoneNumber || !user.centreId || !(user.aadharCard && user.aadharCard.publicId)) {
            return res.status(400).json({ success: false, message: "Add your name, phone number, centre and a photo of your Aadhaar card before requesting verification." });
        }

        const alreadyPending = user.verificationStatus === "Pending";
        if (!alreadyPending) {
            await User.updateOne({ _id: user._id }, { $set: { verificationStatus: "Pending" } });
            invalidateRoleCache(user._id);

            const siteUrl = getSiteUrl(req);
            const adminCount = await notifyCentreAdmins(
                user.centreId._id,
                `Participant Verification Request: ${user.firstName} ${user.lastName}`,
                (admin) => `<p>Dear ${escapeHtml(admin.firstName)},</p>
                 <p><b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.email)}) has requested account verification.</p>
                 <p>Phone: ${escapeHtml(user.phoneNumber)}<br/>Centre: ${escapeHtml(user.centreId.name)}</p>
                 <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to check their Aadhaar card and verify or reject this request.</p>
                 <p>Thank you!</p>`
            );
            console.log(`[requestVerification] Sent verification request for ${user.email} to ${adminCount} recipient(s)`);
        }

        return res.status(200).json({ success: true, message: "Verification requested successfully", user: await loadPublicUser(user._id) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Pending verifications for the admin's centre
exports.getUnverifiedUsers = async (req, res) => {
    try {
        const users = await User.find({ verificationStatus: "Pending", role: "Participant", centreId: req.user.centreId })
            .select(PUBLIC_USER_FIELDS)
            .populate("centreId", "name");
        return res.status(200).json({ success: true, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Verify or reject a participant of the admin's centre
exports.verifyUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { action } = req.body; // 'Verify' or 'Reject'
        if (!["Verify", "Reject"].includes(action)) return res.status(400).json({ success: false, message: "Action must be 'Verify' or 'Reject'" });

        const user = await User.findById(userId).select("role centreId");
        if (!user || String(user.centreId) !== req.user.centreId) return res.status(404).json({ success: false, message: "This person is not a member of your centre" });
        if (user.role !== "Participant") return res.status(400).json({ success: false, message: "Only participants are verified" });

        await User.updateOne({ _id: user._id }, { $set: { verificationStatus: action === "Verify" ? "Verified" : "Unverified" } });
        invalidateRoleCache(user._id);

        return res.status(200).json({ success: true, message: `User ${action === "Verify" ? "verified" : "rejected"} successfully`, user: await loadPublicUser(user._id) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Promote a participant of the admin's centre to manager (permanently or until a date), or demote a manager
exports.changeUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role, until, note = "" } = req.body;

        if (!["Manager", "Participant"].includes(role)) {
            return res.status(400).json({ success: false, message: "Role must be 'Manager' or 'Participant'" });
        }
        if (String(userId) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You can't change your own role" });
        }

        const user = await User.findById(userId).select("-password");
        if (!user || String(user.centreId) !== req.user.centreId) {
            return res.status(404).json({ success: false, message: "This person is not a member of your centre" });
        }
        if (!["Manager", "Participant"].includes(user.role)) {
            return res.status(400).json({ success: false, message: "Admins can't be promoted or demoted here" });
        }
        await syncTemporaryRole(user);

        const adminNote = String(note).trim().slice(0, 1000);
        const previousRequest = user.tempManagerRequest;
        let untilDate = null;

        if (role === "Manager") {
            if (user.role === "Manager" && !user.tempManagerFrom) {
                return res.status(400).json({ success: false, message: "This user is already a manager" });
            }
            if (until) {
                const today = new Date().toISOString().slice(0, 10);
                if (!isDay(until) || until < today) {
                    return res.status(400).json({ success: false, message: "Choose an end date from today onwards" });
                }
                untilDate = dayEnd(until);
            }

            // Any earlier temporary access or open request is replaced by this decision
            if (user.tempManagerFrom) await clearTemporaryAccess(user);
            if (previousRequest) await RoleRequest.updateOne({ _id: previousRequest, status: "Approved" }, { $set: { status: "Revoked", reviewNote: "Replaced by an admin role change" } });
            await RoleRequest.updateMany({ user: user._id, status: "Pending" }, { $set: { status: "Cancelled", reviewNote: "Superseded by an admin role change", reviewedBy: req.user.id, reviewedAt: new Date() } });

            if (untilDate) {
                // Temporary promotion: same mechanism as an approved access request
                const request = await RoleRequest.create({
                    user: user._id,
                    startDate: dayStart(new Date().toISOString().slice(0, 10)),
                    endDate: untilDate,
                    reason: "Promoted by an admin",
                    status: "Approved",
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    reviewNote: adminNote
                });
                const update = { tempManagerFrom: request.startDate, tempManagerUntil: request.endDate, tempManagerRequest: request._id };
                await User.updateOne({ _id: user._id }, { $set: update });
                Object.assign(user, update);
                await syncTemporaryRole(user);
            } else {
                const update = { role: "Manager", status: "Approved", managerApprovedBy: req.user.id };
                await User.updateOne({ _id: user._id }, { $set: update });
                Object.assign(user, update);
            }
        } else {
            if (user.role !== "Manager" && !user.tempManagerFrom) {
                return res.status(400).json({ success: false, message: "This user is already a participant" });
            }
            if (user.tempManagerFrom) {
                await clearTemporaryAccess(user);
                if (previousRequest) await RoleRequest.updateOne({ _id: previousRequest, status: "Approved" }, { $set: { status: "Revoked", reviewNote: adminNote || "Demoted by an admin" } });
            }
            const update = { role: "Participant", status: "Approved" };
            await User.updateOne({ _id: user._id }, { $set: update });
            Object.assign(user, update);
        }

        invalidateRoleCache(user._id);

        const promoted = role === "Manager";
        const untilText = untilDate ? untilDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
        await mailSender(
            user.email,
            promoted ? "You are now a Manager" : "Your account is now a Participant account",
            `<p>Dear ${escapeHtml(user.firstName)},</p>
             <p>${promoted
                ? `An admin has given you manager access${untilText ? ` until ${untilText}` : ""}. Sign in to start using it.`
                : "An admin has changed your account to a participant account. You no longer have manager access."}</p>
             ${adminNote ? `<p><b>Note from the admin:</b> ${escapeHtml(adminNote)}</p>` : ""}
             <p>Thank you!</p>`
        );

        return res.status(200).json({
            success: true,
            message: promoted ? `${user.firstName} is now a manager${untilText ? ` until ${untilText}` : ""}` : `${user.firstName} is now a participant`,
            user
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get All Users with search, filters and pagination (centre admins: their centre; Super Admin: everyone)
exports.getAllUsers = async (req, res) => {
    try {
        const { search, role, status, verificationStatus, centreId, page = 1, limit = 20 } = req.query;

        // Admins see their own centre; the Super Admin sees everyone, or one centre
        const scope = {};
        if (req.user.role === "Admin") scope.centreId = new mongoose.Types.ObjectId(req.user.centreId);
        else if (centreId === "none") scope.centreId = null;
        else if (centreId && mongoose.Types.ObjectId.isValid(centreId)) scope.centreId = new mongoose.Types.ObjectId(centreId);

        const filter = { ...scope };
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (verificationStatus) filter.verificationStatus = verificationStatus;

        if (search && search.trim()) {
            const escaped = escapeRegex(search.trim());
            const regex = new RegExp(escaped, "i");
            filter.$or = [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
                { phoneNumber: regex },
                // Full name, e.g. "Hari Das"
                { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: escaped, options: "i" } } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const [users, total, roleCounts] = await Promise.all([
            User.find(filter)
                .select(PUBLIC_USER_FIELDS)
                .populate("centreId", "name")
                .sort({ createdAt: -1, _id: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            User.countDocuments(filter),
            User.aggregate([{ $match: scope }, { $group: { _id: "$role", count: { $sum: 1 } } }])
        ]);

        const counts = { SuperAdmin: 0, Admin: 0, Manager: 0, Participant: 0 };
        roleCounts.forEach(r => { counts[r._id] = r.count; });

        return res.status(200).json({
            success: true,
            users,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
            counts
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
