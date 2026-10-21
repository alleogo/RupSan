const User = require("../models/User");
const OTP = require("../models/OTP");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailSender = require("../utils/mailSender");
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
        const { firstName, lastName, email, password, role, adminSecret, otp } = req.body;
        console.log(`[register] New registration attempt for: ${email} (Role: ${role})`);

        if (!firstName || !lastName || !email || !password || !role || !otp) {
            return res.status(400).json({ success: false, message: "All fields including OTP are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        // Admin Secret Validation
        if (role === "Admin") {
            const envSecret = process.env.ADMIN_SECRET || "admin123";
            if (adminSecret !== envSecret) {
                return res.status(403).json({ success: false, message: "Invalid Admin Secret" });
            }
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
        });

        // Notify all admins that a new manager account is waiting for approval
        if (user.role === "Manager") {
            const admins = await User.find({ role: "Admin" }).select("email firstName");
            const siteUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
            await Promise.all(admins.map(admin => mailSender(
                admin.email,
                `Manager Approval Request: ${user.firstName} ${user.lastName}`,
                `<p>Dear ${admin.firstName},</p>
                 <p><b>${user.firstName} ${user.lastName}</b> (${user.email}) has signed up as a Manager and is waiting for your approval.</p>
                 <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to approve or reject this request.</p>
                 <p>Thank you!</p>`
            )));
            console.log(`[register] Sent manager approval request for ${user.email} to ${admins.length} admin(s)`);
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
            const payload = {
                email: user.email,
                id: user._id,
                role: user.role,
                status: user.status
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret", {
                expiresIn: "24h"
            });

            user.password = undefined;
            return res.status(200).json({
                success: true,
                message: "Logged in successfully",
                token,
                user
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
        if (!manager || manager.role !== "Manager") {
            return res.status(404).json({ success: false, message: "Manager not found" });
        }

        manager.status = action === "Approve" ? "Approved" : "Rejected";
        manager.managerApprovedBy = req.user.id;
        await manager.save();

        return res.status(200).json({
            success: true,
            message: `Manager account ${action.toLowerCase()}d successfully`,
            manager
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Pending Managers (Admin only)
exports.getPendingManagers = async (req, res) => {
    try {
        const managers = await User.find({ role: "Manager", status: "Pending" }).select("-password");
        return res.status(200).json({ success: true, managers });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Current User (used by the frontend to validate a stored session)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
