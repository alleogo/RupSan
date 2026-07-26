require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const Settings = require("../models/Settings");
const Yatra = require("../models/Yatra");
const YatraRegistration = require("../models/YatraRegistration");
const Ticket = require("../models/Ticket");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(localUrl, folder) {
    if (!localUrl || !localUrl.startsWith("/uploads/")) {
        return localUrl;
    }

    const localPath = path.join(__dirname, "..", localUrl);
    if (!fs.existsSync(localPath)) {
        console.warn(`File not found locally: ${localPath}`);
        return localUrl;
    }

    try {
        console.log(`Uploading ${localPath} to Cloudinary...`);
        const result = await cloudinary.uploader.upload(localPath, { folder, resource_type: "auto" });
        return result.secure_url;
    } catch (error) {
        console.error(`Failed to upload ${localPath}:`, error);
        return localUrl;
    }
}

async function runMigration() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected to DB");

        // 1. Settings
        const settings = await Settings.findOne();
        if (settings) {
            let updated = false;
            if (settings.accountsThumbnail && settings.accountsThumbnail.startsWith("/uploads/")) {
                settings.accountsThumbnail = await uploadToCloudinary(settings.accountsThumbnail, "accounts-management/settings");
                updated = true;
            }
            if (settings.yatraThumbnail && settings.yatraThumbnail.startsWith("/uploads/")) {
                settings.yatraThumbnail = await uploadToCloudinary(settings.yatraThumbnail, "accounts-management/settings");
                updated = true;
            }
            if (updated) {
                await settings.save();
                console.log("Settings updated.");
            }
        }

        // 2. Yatras
        const yatras = await Yatra.find();
        for (const yatra of yatras) {
            let updated = false;
            if (yatra.thumbnail && yatra.thumbnail.startsWith("/uploads/")) {
                yatra.thumbnail = await uploadToCloudinary(yatra.thumbnail, "accounts-management/yatras");
                updated = true;
            }
            if (yatra.qrCode && yatra.qrCode.startsWith("/uploads/")) {
                yatra.qrCode = await uploadToCloudinary(yatra.qrCode, "accounts-management/yatras");
                updated = true;
            }
            
            if (yatra.gallery && yatra.gallery.length > 0) {
                const newGallery = [];
                for (let g of yatra.gallery) {
                    if (g.startsWith("/uploads/")) {
                        const url = await uploadToCloudinary(g, "accounts-management/yatras/gallery");
                        newGallery.push(url);
                        updated = true;
                    } else {
                        newGallery.push(g);
                    }
                }
                yatra.gallery = newGallery;
            }

            if (updated) {
                await yatra.save();
                console.log(`Yatra ${yatra.title} updated.`);
            }
        }

        // 3. Yatra Registrations
        const registrations = await YatraRegistration.find();
        for (const reg of registrations) {
            if (reg.paymentScreenshot && reg.paymentScreenshot.startsWith("/uploads/")) {
                reg.paymentScreenshot = await uploadToCloudinary(reg.paymentScreenshot, "accounts-management/registrations");
                await reg.save();
                console.log(`Registration ${reg._id} updated.`);
            }
        }

        // 4. Tickets
        const tickets = await Ticket.find();
        for (const ticket of tickets) {
            let updated = false;
            if (ticket.ticketFile && ticket.ticketFile.startsWith("/uploads/")) {
                ticket.ticketFile = await uploadToCloudinary(ticket.ticketFile, "accounts-management/tickets");
                updated = true;
            }
            if (ticket.ticketCancellationFile && ticket.ticketCancellationFile.startsWith("/uploads/")) {
                ticket.ticketCancellationFile = await uploadToCloudinary(ticket.ticketCancellationFile, "accounts-management/tickets");
                updated = true;
            }
            if (updated) {
                await ticket.save();
                console.log(`Ticket ${ticket._id} updated.`);
            }
        }

        console.log("Migration completed successfully!");
    } catch (error) {
        console.error("Migration error:", error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

runMigration();