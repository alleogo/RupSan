const Settings = require("../models/Settings");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");

exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        return res.status(200).json({ success: true, settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        if (req.body && req.body.navbarTitle !== undefined) {
            settings.navbarTitle = req.body.navbarTitle;
        }
        
        if (req.body && req.body.navbarLogoText !== undefined) {
            settings.navbarLogoText = req.body.navbarLogoText;
        }

        if (req.files && req.files.navbarLogo) {
            const result = await uploadImageToCloudinary(req.files.navbarLogo, `${process.env.FOLDER_NAME}/settings`);
            settings.navbarLogo = result.secure_url;
        }

        if (req.files && req.files.accountsThumbnail) {
            const result = await uploadImageToCloudinary(req.files.accountsThumbnail, `${process.env.FOLDER_NAME}/settings`);
            settings.accountsThumbnail = result.secure_url;
        }

        if (req.files && req.files.yatraThumbnail) {
            const result = await uploadImageToCloudinary(req.files.yatraThumbnail, `${process.env.FOLDER_NAME}/settings`);
            settings.yatraThumbnail = result.secure_url;
        }

        await settings.save();

        return res.status(200).json({
            success: true,
            message: "Settings updated successfully",
            settings
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
