const User = require("../models/User");
const RoleRequest = require("../models/RoleRequest");
const mailSender = require("../utils/mailSender");
const { isDay, dayStart, dayEnd, syncTemporaryRole, clearTemporaryAccess } = require("../utils/tempManager");
const { invalidateRoleCache } = require("../middlewares/auth");
const { escapeHtml, escapeRegex, getSiteUrl, notifyAdmins } = require("../utils/notify");

// Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, email, aadharNumber, phoneNumber, centre } = req.body;
        
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Email is already in use by another account" });
            }
        }

        const updates = {};
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (email !== undefined) updates.email = email;
        if (aadharNumber !== undefined) updates.aadharNumber = aadharNumber;
        if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
        if (centre !== undefined) updates.centre = centre;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true }
        );

        user.password = undefined;
        return res.status(200).json({ success: true, message: "Profile updated successfully", user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Request Verification (Participant only)
exports.requestVerification = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (user.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Only participants need verification" });
        }
        
        if (!user.aadharNumber || !user.firstName || !user.phoneNumber || !user.centre) {
            return res.status(400).json({ success: false, message: "Aadhar, Name, Phone Number, and Centre are required to request verification." });
        }

        const alreadyPending = user.verificationStatus === "Pending";
        user.verificationStatus = "Pending";
        await user.save();

        // Notify all admins of the new verification request (skip repeat requests while still pending)
        if (!alreadyPending) {
            const siteUrl = getSiteUrl(req);
            const adminCount = await notifyAdmins(
                `Participant Verification Request: ${user.firstName} ${user.lastName}`,
                (admin) => `<p>Dear ${escapeHtml(admin.firstName)},</p>
                 <p><b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.email)}) has requested account verification.</p>
                 <p>Phone: ${escapeHtml(user.phoneNumber)}<br/>Centre: ${escapeHtml(user.centre)}</p>
                 <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to verify or reject this request.</p>
                 <p>Thank you!</p>`
            );
            console.log(`[requestVerification] Sent verification request for ${user.email} to ${adminCount} admin(s)`);
        }

        user.password = undefined;
        return res.status(200).json({ success: true, message: "Verification requested successfully", user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Unverified Users (Admin only)
exports.getUnverifiedUsers = async (req, res) => {
    try {
        const users = await User.find({ verificationStatus: "Pending", role: "Participant" }).select("-password");
        return res.status(200).json({ success: true, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Verify User (Admin only)
exports.verifyUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { action } = req.body; // 'Verify' or 'Reject'

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.verificationStatus = action === 'Verify' ? "Verified" : "Unverified";
        await user.save();

        return res.status(200).json({ success: true, message: `User ${action.toLowerCase()}ed successfully`, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Promote a participant to manager (permanently or until a date) or demote a manager to participant (Admin only)
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
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role === "Admin") {
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

// Get All Users with search, filters and pagination (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const { search, role, status, verificationStatus, page = 1, limit = 20 } = req.query;

        const filter = {};
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
                { centre: regex },
                { aadharNumber: regex },
                // Full name, e.g. "Hari Das"
                { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: escaped, options: "i" } } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const [users, total, roleCounts] = await Promise.all([
            User.find(filter)
                .select("-password")
                .sort({ createdAt: -1, _id: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            User.countDocuments(filter),
            User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }])
        ]);

        const counts = { Admin: 0, Manager: 0, Participant: 0 };
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
