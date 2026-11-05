const YatraRegistration = require("../models/YatraRegistration");
const Yatra = require("../models/Yatra");
const User = require("../models/User");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");
const mailSender = require("../utils/mailSender");

// Never send password hashes or private Aadhaar details with a registration
const USER_FIELDS = "firstName lastName email phoneNumber centreId role verificationStatus aadharCard.uploadedAt";
const { escapeHtml, getSiteUrl } = require("../utils/notify");

// Registration Controller - Manages Yatra registration and participant approval

// Only the manager who created a yatra (or an admin) may handle its enrollment requests
const canManageYatra = (user, yatra) => user.role === "Admin" || yatra.createdBy?.toString() === user.id?.toString();

exports.registerForYatra = async (req, res) => {
    try {
        const { yatraId, paymentRefId } = req.body;
        console.log(`[registerForYatra] User ${req.user.id} attempting to register for Yatra: ${yatraId}`);

        if (!yatraId) {
            return res.status(400).json({ success: false, message: "Yatra ID is required" });
        }

        const user = await User.findById(req.user.id);
        if (user.role === "Participant" && user.verificationStatus !== "Verified") {
            return res.status(403).json({ success: false, message: "You must be verified by an Admin to register." });
        }

        const yatra = await Yatra.findById(yatraId);
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }

        if (yatra.status === "Completed") {
            return res.status(400).json({ success: false, message: "Cannot register for a completed Yatra." });
        }

        // Check if already registered
        const existingRegistration = await YatraRegistration.findOne({ user: req.user.id, yatra: yatraId });
        if (existingRegistration) {
            return res.status(400).json({ success: false, message: "You are already registered for this Yatra" });
        }

        let paymentScreenshot = null;
        if (req.files && req.files.paymentScreenshot) {
            const result = await uploadImageToCloudinary(req.files.paymentScreenshot, `${process.env.FOLDER_NAME}/registrations`);
            paymentScreenshot = result.secure_url;
        }

        const registration = await YatraRegistration.create({
            user: req.user.id,
            yatra: yatraId,
            paymentRefId,
            paymentScreenshot,
            status: "Pending"
        });

        // Notify the manager who created the yatra of the new enrollment request
        const manager = await User.findById(yatra.createdBy).select("email firstName");
        if (manager) {
            const siteUrl = getSiteUrl(req);
            await mailSender(
                manager.email,
                `Yatra Enrollment Request: ${yatra.title}`,
                `<p>Dear ${escapeHtml(manager.firstName)},</p>
                 <p><b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.email)}) has enrolled in <b>${escapeHtml(yatra.title)}</b> and is awaiting approval.</p>
                 ${paymentRefId ? `<p>Payment Reference: ${escapeHtml(paymentRefId)}</p>` : ""}
                 <p>Please <a href="${siteUrl}/yatra/${yatra._id}">open the Yatra page</a> to approve or reject this enrollment.</p>
                 <p>Thank you!</p>`
            );
            console.log(`[registerForYatra] Sent enrollment request for ${user.email} to manager ${manager.email}`);
        }

        return res.status(201).json({
            success: true,
            message: "Successfully registered for Yatra. Awaiting Manager approval.",
            registration
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRegistrationDetails = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { amountToBePaid, paidOnline, paidCash, firstName, lastName } = req.body;
        console.log(`[updateRegistrationDetails] Updating registration: ${registrationId}, Amount: ${amountToBePaid}`);

        const existing = await YatraRegistration.findById(registrationId).populate("yatra", "createdBy");
        if (!existing) {
            return res.status(404).json({ success: false, message: "Registration not found" });
        }
        if (!existing.yatra || !canManageYatra(req.user, existing.yatra)) {
            return res.status(403).json({ success: false, message: "Only this Yatra's manager can update its registrations" });
        }

        const registration = await YatraRegistration.findByIdAndUpdate(
            registrationId, 
            { amountToBePaid, paidOnline, paidCash }, 
            { new: true }
        ).populate({ path: "user", select: USER_FIELDS, populate: { path: "centreId", select: "name" } }).populate("yatra");

        if (!registration) {
            return res.status(404).json({ success: false, message: "Registration not found" });
        }

        if (firstName || lastName) {
            const updates = {};
            if (firstName) updates.firstName = firstName;
            if (lastName) updates.lastName = lastName;
            await User.findByIdAndUpdate(registration.user._id, updates);
            
            // Re-populate user to return updated name
            await registration.populate({ path: "user", select: USER_FIELDS, populate: { path: "centreId", select: "name" } });
        }

        return res.status(200).json({
            success: true,
            message: "Registration details updated successfully",
            registration
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraRegistrations = async (req, res) => {
    try {
        const { yatraId } = req.params;
        const { status } = req.query; // 'Pending' or 'Approved'
        console.log(`[getYatraRegistrations] Fetching registrations for Yatra: ${yatraId}, Status filter: ${status || 'All'}`);

        const yatra = await Yatra.findById(yatraId).select("createdBy");
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }
        // Other managers may see the approved registrations log, but not enrollment requests
        if (status !== "Approved" && !canManageYatra(req.user, yatra)) {
            return res.status(403).json({ success: false, message: "Only this Yatra's manager can view its enrollment requests" });
        }
        
        let query = { yatra: yatraId };
        if (status) {
            query.status = status;
        }

        const registrations = await YatraRegistration.find(query).populate({ path: "user", select: USER_FIELDS, populate: { path: "centreId", select: "name" } });
        
        return res.status(200).json({
            success: true,
            registrations
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMyRegistrationStatus = async (req, res) => {
    try {
        const { yatraId } = req.params;
        const registration = await YatraRegistration.findOne({ user: req.user.id, yatra: yatraId });
        
        if (!registration) {
            return res.status(200).json({ success: true, registration: null });
        }

        return res.status(200).json({
            success: true,
            registration
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.approveRegistration = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { action } = req.body; // 'Approve' or 'Reject'
        console.log(`[approveRegistration] Manager action: ${action} for registration: ${registrationId}`);

        const registration = await YatraRegistration.findById(registrationId).populate({ path: "user", select: USER_FIELDS, populate: { path: "centreId", select: "name" } }).populate("yatra");
        if (!registration) {
            return res.status(404).json({ success: false, message: "Registration not found" });
        }
        if (!registration.yatra || !canManageYatra(req.user, registration.yatra)) {
            return res.status(403).json({ success: false, message: "Only this Yatra's manager can approve or reject its enrollments" });
        }

        registration.status = action === 'Approve' ? 'Approved' : 'Rejected';
        if (action === 'Approve') {
            registration.amountToBePaid = registration.yatra.registrationFee;
        }
        await registration.save();

        return res.status(200).json({
            success: true,
            message: `Registration ${action.toLowerCase()}d successfully`,
            registration
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMyRegistrations = async (req, res) => {
    try {
        const registrations = await YatraRegistration.find({ user: req.user.id })
            .populate("yatra", "title destination startDate endDate registrationFee status thumbnail")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            registrations
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
