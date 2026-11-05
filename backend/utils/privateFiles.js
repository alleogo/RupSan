const cloudinary = require("cloudinary").v2;

// Private uploads (Aadhaar cards): stored as "authenticated" Cloudinary assets, which have no public URL.
// They can only be opened through signed links generated here for people allowed to see them.

const configure = () => cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadPrivateImage = async (file, folder) => {
    configure();
    const result = await cloudinary.uploader.upload(file.tempFilePath, { folder, type: "authenticated", resource_type: "image" });
    return { publicId: result.public_id, format: result.format };
};

const signedImageUrl = ({ publicId, format }) => {
    configure();
    return cloudinary.url(publicId, { type: "authenticated", resource_type: "image", sign_url: true, secure: true, format });
};

const deletePrivateImage = async (publicId) => {
    if (!publicId) return;
    configure();
    try {
        await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image" });
    } catch (error) {
        console.warn("[Private Files] Could not delete old file:", error.message);
    }
};

module.exports = { uploadPrivateImage, signedImageUrl, deletePrivateImage };
