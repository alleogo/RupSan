const Yatra = require("../models/Yatra");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");

exports.createYatra = async (req, res) => {
    try {
        const { title, description, startDate, endDate, destination, registrationFee, upiId } = req.body;

        if (!title || !description || !startDate || !endDate || !destination || registrationFee === undefined) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        let thumbnail = null;

        let qrCode = null;

        if (req.files) {
            if (req.files.thumbnail) {
                const result = await uploadImageToCloudinary(req.files.thumbnail, `${process.env.FOLDER_NAME}/yatras`);
                thumbnail = result.secure_url;
            }

            if (req.files.qrCode) {
                const result = await uploadImageToCloudinary(req.files.qrCode, `${process.env.FOLDER_NAME}/yatras`);
                qrCode = result.secure_url;
            }
        }

        const yatra = await Yatra.create({
            title,
            description,
            startDate,
            endDate,
            destination,
            registrationFee,

            upiId,
            thumbnail,

            qrCode,
            createdBy: req.user.id
        });

        return res.status(201).json({
            success: true,
            message: "Yatra created successfully",
            yatra
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllYatras = async (req, res) => {
    try {
        const now = new Date();
        // Auto-update statuses before returning
        await Yatra.updateMany({ status: "Upcoming", startDate: { $lte: now }, endDate: { $gte: now } }, { status: "Ongoing" });
        await Yatra.updateMany({ status: { $in: ["Upcoming", "Ongoing"] }, endDate: { $lt: now } }, { status: "Completed" });

        const yatras = await Yatra.find().populate("createdBy", "firstName lastName email").sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            yatras
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraById = async (req, res) => {
    try {
        const { id } = req.params;
        const yatra = await Yatra.findById(id).populate("createdBy", "firstName lastName email");
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }
        return res.status(200).json({
            success: true,
            yatra
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateYatra = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        const yatra = await Yatra.findById(id);
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }

        // Only Admin or the Manager who created it can update
        if (req.user.role !== "Admin" && yatra.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "You are not authorized to update this Yatra" });
        }

        // Handle file uploads
        if (req.files) {
            if (req.files.thumbnail) {
                const result = await uploadImageToCloudinary(req.files.thumbnail, `${process.env.FOLDER_NAME}/yatras`);
                updates.thumbnail = result.secure_url;
            }
            if (req.files.qrCode) {
                const result = await uploadImageToCloudinary(req.files.qrCode, `${process.env.FOLDER_NAME}/yatras`);
                updates.qrCode = result.secure_url;
            }
        }

        const updatedYatra = await Yatra.findByIdAndUpdate(id, updates, { new: true }).populate("createdBy", "firstName lastName email");
        
        return res.status(200).json({
            success: true,
            message: "Yatra updated successfully",
            yatra: updatedYatra
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteYatra = async (req, res) => {
    try {
        const { id } = req.params;
        
        const yatra = await Yatra.findById(id);
        if (!yatra) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }

        // Only Admin or the Manager who created it can delete
        if (req.user.role !== "Admin" && yatra.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "You are not authorized to delete this Yatra" });
        }

        await Yatra.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Yatra deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
