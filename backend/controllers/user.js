const User = require("../models/User");
const mailSender = require("../utils/mailSender");

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
            const admins = await User.find({ role: "Admin" }).select("email firstName");
            const siteUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;
            await Promise.all(admins.map(admin => mailSender(
                admin.email,
                `Participant Verification Request: ${user.firstName} ${user.lastName}`,
                `<p>Dear ${admin.firstName},</p>
                 <p><b>${user.firstName} ${user.lastName}</b> (${user.email}) has requested account verification.</p>
                 <p>Phone: ${user.phoneNumber}<br/>Centre: ${user.centre}</p>
                 <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to verify or reject this request.</p>
                 <p>Thank you!</p>`
            )));
            console.log(`[requestVerification] Sent verification request for ${user.email} to ${admins.length} admin(s)`);
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

// Get All Users with search, filters and pagination (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const { search, role, status, verificationStatus, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (verificationStatus) filter.verificationStatus = verificationStatus;

        if (search && search.trim()) {
            // Escape regex special characters so the search is treated as plain text
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
