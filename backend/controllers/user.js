const User = require("../models/User");

// Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { aadharNumber, phoneNumber, centre } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { aadharNumber, phoneNumber, centre },
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

        user.verificationStatus = "Pending";
        await user.save();

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
