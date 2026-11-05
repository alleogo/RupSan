const User = require("../models/User");
const OTP = require("../models/OTP");
const bcrypt = require("bcrypt");
const otpGenerator = require("otp-generator");
const mailSender = require("../utils/mailSender");
const { escapeHtml, getSiteUrl, notifyCentreAdmins } = require("../utils/notify");
const mongoose = require("mongoose");
const Centre = require("../models/Centre");

// Fields returned to the browser for the signed-in user
const SELF_FIELDS = "-password -aadharNumber -aadharCard.publicId -aadharCard.format";
const { syncTemporaryRole, signToken } = require("../utils/tempManager");
const { getAccountPermissions } = require("../utils/accountAccess");

// The user as sent to the browser, with their access level to their centre's account
const withAccountLevel = async (user) => {
    const permissions = await getAccountPermissions(user, user.role === "SuperAdmin" ? "any" : user.centreId && (user.centreId._id || user.centreId));
    return { ...user.toObject(), accountLevel: permissions.level };
};
const { invalidateRoleCache } = require("../middlewares/auth");
require("dotenv").config();

// Auth Controller - Handles user authentication and registration

// Send OTP
exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`[sendOTP] Received request for email: ${email}`);

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const checkUserPresent = await User.findOne({ email });
        if (checkUserPresent) {
            return res.status(401).json({ success: false, message: "User is already registered" });
        }

        var otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });

        // Ensure unique OTP
        let result = await OTP.findOne({ otp: otp });
        while (result) {
            otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
            });
            result = await OTP.findOne({ otp: otp });
        }

        const otpPayload = { email, otp };
        await OTP.create(otpPayload);

        await mailSender(
            email,
            "Verification Email from Accounts Management",
            `<p>Your OTP is: <b>${otp}</b></p><p>This OTP is valid for 5 minutes.</p>`
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Register User
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, role, centreId, otp } = req.body;
        console.log(`[register] New registration attempt for: ${email} (Role: ${role})`);

        if (!firstName || !lastName || !email || !password || !role || !otp) {
            return res.status(400).json({ success: false, message: "All fields including OTP are required" });
        }
        // Admins are appointed by the Super Admin, not self-registered
        if (!["Participant", "Manager"].includes(role)) {
            return res.status(400).json({ success: false, message: "You can sign up as a participant or a manager" });
        }
        if (!centreId || !mongoose.Types.ObjectId.isValid(centreId) || !(await Centre.exists({ _id: centreId }))) {
            return res.status(400).json({ success: false, message: "Choose your centre" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        // Verify OTP
        const recentOtp = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1);
        if (recentOtp.length === 0 || otp !== recentOtp[0].otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role,
            centreId
        });

        // Notify the centre's admins that a new manager account is waiting for approval
        if (user.role === "Manager") {
            const siteUrl = getSiteUrl(req);
            const adminCount = await notifyCentreAdmins(
                user.centreId,
                `Manager Approval Request: ${user.firstName} ${user.lastName}`,
                (admin) => `<p>Dear ${escapeHtml(admin.firstName)},</p>
                 <p><b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.email)}) has signed up as a Manager and is waiting for your approval.</p>
                 <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to approve or reject this request.</p>
                 <p>Thank you!</p>`
            );
            console.log(`[register] Sent manager approval request for ${user.email} to ${adminCount} admin(s)`);
        }

        // Don't send password in response
        user.password = undefined;

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "User is not registered, please sign up first" });
        }

        if (await bcrypt.compare(password, user.password)) {
            await syncTemporaryRole(user);
            const token = signToken(user);

            const publicUser = await User.findById(user._id).select(SELF_FIELDS).populate("centreId", "name");
            return res.status(200).json({
                success: true,
                message: "Logged in successfully",
                token,
                user: await withAccountLevel(publicUser)
            });
        } else {
            return res.status(401).json({ success: false, message: "Incorrect password" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Approve Manager
exports.approveManager = async (req, res) => {
    try {
        const { managerId, action } = req.body; // action: 'Approve' or 'Reject'

        if (!managerId || !action) {
            return res.status(400).json({ success: false, message: "Manager ID and action are required" });
        }

        const manager = await User.findById(managerId);
        if (!manager || manager.role !== "Manager" || String(manager.centreId) !== req.user.centreId) {
            return res.status(404).json({ success: false, message: "Manager not found in your centre" });
        }

        manager.status = action === "Approve" ? "Approved" : "Rejected";
        manager.managerApprovedBy = req.user.id;
        await manager.save();
        invalidateRoleCache(manager._id);

        return res.status(200).json({
            success: true,
            message: `Manager account ${action.toLowerCase()}d successfully`,
            manager
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Pending Managers of the admin's centre
exports.getPendingManagers = async (req, res) => {
    try {
        const managers = await User.find({ role: "Manager", status: "Pending", centreId: req.user.centreId }).select(SELF_FIELDS).populate("centreId", "name");
        return res.status(200).json({ success: true, managers });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Current User (used by the frontend to validate a stored session)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(SELF_FIELDS).populate("centreId", "name");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        await syncTemporaryRole(user);

        // Hand out a fresh token when the role or approval changed since this one was issued
        // (e.g. temporary manager access started, ended or was revoked, or a manager was approved)
        const claims = req.tokenClaims || req.user;
        const stale = claims.role !== user.role || claims.status !== user.status || Boolean(claims.tempManager) !== Boolean(user.tempManagerFrom);
        return res.status(200).json({ success: true, user: await withAccountLevel(user), ...(stale ? { token: signToken(user) } : {}) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
