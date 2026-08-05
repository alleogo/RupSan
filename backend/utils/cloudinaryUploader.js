const cloudinary = require("cloudinary").v2;

const uploadImageToCloudinary = async (file, folder, height, quality) => {
    try {
        console.log(`[Cloudinary Uploader] Starting upload - Folder: ${folder}, File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        // Configure lazily so env vars are always current at call time
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const options = { folder };
        if(height) options.height = height;
        if(quality) options.quality = quality;
        options.resource_type = "auto";

        let result;
        // Use upload_large for files > 10MB to bypass standard Cloudinary limits
        if (file.size && file.size > 10 * 1024 * 1024) {
            console.log(`[Cloudinary Uploader] Using upload_large for file > 10MB`);
            result = await cloudinary.uploader.upload_large(file.tempFilePath, options);
        } else {
            result = await cloudinary.uploader.upload(file.tempFilePath, options);
        }
        console.log(`[Cloudinary Uploader] Upload successful - Public ID: ${result.public_id}, URL: ${result.secure_url}`);
        return result;
    } catch (error) {
        console.error(`[Cloudinary Uploader] Upload failed for folder ${folder}: ${error.message}`);
        throw error;
    }
};
module.exports = uploadImageToCloudinary;
