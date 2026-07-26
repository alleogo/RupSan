const cloudinary = require("cloudinary").v2;

const uploadImageToCloudinary = async (file, folder, height, quality) => {
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

    // Use upload_large for files > 10MB to bypass standard Cloudinary limits
    if (file.size && file.size > 10 * 1024 * 1024) {
        return await cloudinary.uploader.upload_large(file.tempFilePath, options);
    }
    return await cloudinary.uploader.upload(file.tempFilePath, options);
}
module.exports = uploadImageToCloudinary;
