const mongoose = require("mongoose");
const Yatra = require("../models/Yatra");
const Centre = require("../models/Centre");
const User = require("../models/User");
const uploadImageToCloudinary = require("../utils/cloudinaryUploader");
const { escapeRegex } = require("../utils/notify");
const { canSeeYatra, canManageYatra, visibleYatraFilter, loadManageableYatra } = require("../utils/yatraAccess");

// Yatra Controller - Yatras belong to their creator's centre; the creator chooses which other centres can see them

const EDITABLE_FIELDS = ["title", "description", "startDate", "endDate", "destination", "registrationFee", "upiId"];
const populateYatra = (query) => query
    .populate("createdBy", "firstName lastName email centreId")
    .populate("centre", "name")
    .populate("visibility.centres", "name");

// Visibility comes as JSON (FormData can't send nested objects): { allCentres, centres: [id] }
const parseVisibility = async (raw, ownCentre) => {
    if (raw === undefined) return undefined;
    let value = raw;
    if (typeof raw === "string") {
        try { value = JSON.parse(raw); } catch { throw Object.assign(new Error("Invalid visibility"), { status: 400 }); }
    }
    const allCentres = Boolean(value && value.allCentres);
    const ids = [...new Set(((value && value.centres) || []).map(String))]
        .filter(id => mongoose.Types.ObjectId.isValid(id) && id !== String(ownCentre));
    const centres = allCentres || !ids.length ? [] : (await Centre.find({ _id: { $in: ids } }).select("_id")).map(c => c._id);
    return { allCentres, centres };
};

// Keep statuses in line with today's date
const refreshStatuses = async () => {
    const now = new Date();
    await Yatra.updateMany({ status: "Upcoming", startDate: { $lte: now }, endDate: { $gte: now } }, { status: "Ongoing" });
    await Yatra.updateMany({ status: { $in: ["Upcoming", "Ongoing"] }, endDate: { $lt: now } }, { status: "Completed" });
};

exports.createYatra = async (req, res) => {
    try {
        const { title, description, startDate, endDate, destination, registrationFee, upiId } = req.body;

        if (!title || !description || !startDate || !endDate || !destination || registrationFee === undefined) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (!req.user.centreId) {
            return res.status(400).json({ success: false, message: "You need to belong to a centre to create a yatra. Ask your admin." });
        }

        const visibility = (await parseVisibility(req.body.visibility, req.user.centreId)) || { allCentres: false, centres: [] };

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
            createdBy: req.user.id,
            centre: req.user.centreId,
            visibility
        });

        return res.status(201).json({
            success: true,
            message: "Yatra created successfully",
            yatra: await populateYatra(Yatra.findById(yatra._id))
        });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// Yatras the user can see
exports.getAllYatras = async (req, res) => {
    try {
        await refreshStatuses();
        const yatras = await populateYatra(Yatra.find(visibleYatraFilter(req.user))).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, yatras });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Super Admin: every yatra, with search, filters and paging
exports.searchYatras = async (req, res) => {
    try {
        await refreshStatuses();
        const { search, status, centreId, from, to, sortBy = "startDate", order = "desc", page = 1, limit = 20 } = req.query;

        const filter = {};
        if (["Upcoming", "Ongoing", "Completed"].includes(status)) filter.status = status;
        if (centreId === "none") filter.centre = null;
        else if (centreId && mongoose.Types.ObjectId.isValid(centreId)) filter.centre = new mongoose.Types.ObjectId(centreId);
        // Yatras that overlap the chosen dates
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) filter.endDate = { $gte: new Date(`${from}T00:00:00.000Z`) };
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) filter.startDate = { $lte: new Date(`${to}T23:59:59.999Z`) };
        if (search && search.trim()) {
            const regex = new RegExp(escapeRegex(search.trim()), "i");
            filter.$or = [{ title: regex }, { destination: regex }, { description: regex }];
        }

        const sortField = ["startDate", "createdAt", "title", "registrationFee"].includes(sortBy) ? sortBy : "startDate";
        const direction = order === "asc" ? 1 : -1;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const [yatras, total, statusCounts] = await Promise.all([
            populateYatra(Yatra.find(filter)).sort({ [sortField]: direction, _id: direction }).skip((pageNum - 1) * limitNum).limit(limitNum),
            Yatra.countDocuments(filter),
            Yatra.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }])
        ]);
        const counts = { Upcoming: 0, Ongoing: 0, Completed: 0 };
        statusCounts.forEach(c => { counts[c._id] = c.count; });

        return res.status(200).json({
            success: true,
            yatras,
            counts,
            pagination: { total, page: pageNum, limit: limitNum, pages: Math.max(1, Math.ceil(total / limitNum)) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getYatraById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ success: false, message: "Yatra not found" });
        const yatra = await populateYatra(Yatra.findById(id));
        if (!yatra || !canSeeYatra(req.user, yatra)) {
            return res.status(404).json({ success: false, message: "Yatra not found" });
        }
        return res.status(200).json({ success: true, yatra, canManage: canManageYatra(req.user, yatra) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateYatra = async (req, res) => {
    try {
        const yatra = await loadManageableYatra(req, res, req.params.id);
        if (!yatra) return;

        // Only known fields can change (never the creator, centre or status)
        EDITABLE_FIELDS.forEach(field => { if (req.body[field] !== undefined) yatra[field] = req.body[field]; });

        // Yatras from before centres join their creator's centre and stay visible to every centre,
        // as they were, unless the editor chooses otherwise
        // (the creator's centre, else the editor's)
        if (!yatra.centre) {
            const creator = await User.findById(yatra.createdBy).select("centreId");
            const ownerCentre = (creator && creator.centreId) || req.user.centreId;
            if (ownerCentre) {
                yatra.centre = ownerCentre;
                yatra.visibility = { allCentres: true, centres: [] };
            }
        }
        const visibility = await parseVisibility(req.body.visibility, yatra.centre);
        if (visibility && !yatra.centre && !visibility.allCentres) {
            // Neither the creator nor the editor belongs to a centre: the first chosen centre becomes the yatra's centre
            if (!visibility.centres.length) {
                return res.status(400).json({ success: false, message: "Choose at least one centre, or All centres." });
            }
            yatra.centre = visibility.centres.shift();
        }
        if (visibility && yatra.centre) yatra.visibility = visibility;

        if (req.files) {
            if (req.files.thumbnail) {
                const result = await uploadImageToCloudinary(req.files.thumbnail, `${process.env.FOLDER_NAME}/yatras`);
                yatra.thumbnail = result.secure_url;
            }
            if (req.files.qrCode) {
                const result = await uploadImageToCloudinary(req.files.qrCode, `${process.env.FOLDER_NAME}/yatras`);
                yatra.qrCode = result.secure_url;
            }
        }

        await yatra.save();
        return res.status(200).json({
            success: true,
            message: "Yatra updated successfully",
            yatra: await populateYatra(Yatra.findById(yatra._id))
        });
    } catch (error) {
        return res.status(error.status || (error.name === "ValidationError" || error.name === "CastError" ? 400 : 500)).json({ success: false, message: error.message });
    }
};

exports.deleteYatra = async (req, res) => {
    try {
        const yatra = await loadManageableYatra(req, res, req.params.id);
        if (!yatra) return;
        await yatra.deleteOne();
        return res.status(200).json({ success: true, message: "Yatra deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
