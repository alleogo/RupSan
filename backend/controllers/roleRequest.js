const User = require("../models/User");
const RoleRequest = require("../models/RoleRequest");
const mailSender = require("../utils/mailSender");
const { escapeHtml, getSiteUrl, notifyAdmins } = require("../utils/notify");
const { isDay, dayStart, dayEnd, syncTemporaryRole, clearTemporaryAccess } = require("../utils/tempManager");
const { invalidateRoleCache } = require("../middlewares/auth");

// Role Request Controller - Participants request temporary manager access; admins review it

const formatDay = (date) => date
    ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
const describeWindow = (start, end) => end ? `${formatDay(start)} to ${formatDay(end)}` : `${formatDay(start)} with no end date`;

// Validate requested dates (YYYY-MM-DD); endDate may be empty for "no end date"
const parseWindow = ({ startDate, endDate }) => {
    if (!isDay(startDate)) return { error: "Choose a start date" };
    if (endDate && !isDay(endDate)) return { error: "Invalid end date" };
    // Allow "today" in any timezone ahead of UTC
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (startDate < yesterday) return { error: "Start date can't be in the past" };
    if (endDate && endDate < startDate) return { error: "End date must be on or after the start date" };
    return { start: dayStart(startDate), end: endDate ? dayEnd(endDate) : null };
};

// Participant: ask for manager access for a period of time
exports.createRequest = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        await syncTemporaryRole(user);

        if (user.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Only participants can request manager access" });
        }
        if (user.tempManagerFrom) {
            return res.status(400).json({ success: false, message: "You already have manager access scheduled" });
        }
        if (await RoleRequest.exists({ user: user._id, status: "Pending" })) {
            return res.status(400).json({ success: false, message: "You already have a pending request" });
        }

        const reason = (req.body.reason || "").trim();
        if (!reason) return res.status(400).json({ success: false, message: "Please give a reason for the request" });
        if (reason.length > 1000) return res.status(400).json({ success: false, message: "Reason must be 1000 characters or fewer" });

        const window = parseWindow(req.body);
        if (window.error) return res.status(400).json({ success: false, message: window.error });

        const request = await RoleRequest.create({ user: user._id, startDate: window.start, endDate: window.end, reason });

        const siteUrl = getSiteUrl(req);
        const adminCount = await notifyAdmins(
            `Manager Access Request: ${user.firstName} ${user.lastName}`,
            (admin) => `<p>Dear ${escapeHtml(admin.firstName)},</p>
             <p><b>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</b> (${escapeHtml(user.email)}) has requested manager access from ${describeWindow(window.start, window.end)}.</p>
             <p><b>Reason:</b> ${escapeHtml(reason)}</p>
             <p>Please <a href="${siteUrl}/">log in to the dashboard</a> to approve or reject this request.</p>
             <p>Thank you!</p>`
        );
        console.log(`[createRequest] Manager access request from ${user.email} sent to ${adminCount} admin(s)`);

        return res.status(201).json({ success: true, message: "Request sent to the admins", request });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Current user: their requests (newest first) and current access
exports.getMyRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        await syncTemporaryRole(user);

        const requests = await RoleRequest.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).populate("reviewedBy", "firstName lastName");

        return res.status(200).json({
            success: true,
            requests,
            access: user.tempManagerFrom
                ? { from: user.tempManagerFrom, until: user.tempManagerUntil, active: user.role === "Manager" }
                : null,
            role: user.role
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Requester: withdraw a pending request
exports.cancelRequest = async (req, res) => {
    try {
        const request = await RoleRequest.findOne({ _id: req.params.id, user: req.user.id });
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });
        if (request.status !== "Pending") return res.status(400).json({ success: false, message: "Only pending requests can be cancelled" });

        request.status = "Cancelled";
        await request.save();
        return res.status(200).json({ success: true, message: "Request cancelled", request });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Temporary manager: give up access early
exports.endMyAccess = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user || !user.tempManagerFrom) {
            return res.status(400).json({ success: false, message: "You don't have temporary manager access" });
        }
        const requestId = user.tempManagerRequest;
        await clearTemporaryAccess(user);
        if (requestId) await RoleRequest.updateOne({ _id: requestId, status: "Approved" }, { $set: { status: "Ended" } });
        invalidateRoleCache(user._id);

        return res.status(200).json({ success: true, message: "Manager access ended", user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: list requests. status = Pending (default) | Approved (scheduled or active) | History
exports.listRequests = async (req, res) => {
    try {
        const { status = "Pending" } = req.query;
        const filter = status === "History"
            ? { status: { $in: ["Rejected", "Cancelled", "Ended", "Expired", "Revoked"] } }
            : { status: status === "Approved" ? "Approved" : "Pending" };

        const requests = await RoleRequest.find(filter)
            .sort({ createdAt: status === "Pending" ? 1 : -1 })
            .limit(100)
            .populate("user", "firstName lastName email phoneNumber centre role verificationStatus tempManagerFrom tempManagerUntil")
            .populate("reviewedBy", "firstName lastName");

        return res.status(200).json({ success: true, requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: approve (optionally with adjusted dates) or reject a pending request
exports.reviewRequest = async (req, res) => {
    try {
        const { action, note = "", startDate, endDate } = req.body;
        if (!["Approve", "Reject"].includes(action)) {
            return res.status(400).json({ success: false, message: "Action must be 'Approve' or 'Reject'" });
        }

        const request = await RoleRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });
        if (request.status !== "Pending") return res.status(400).json({ success: false, message: `This request is already ${request.status.toLowerCase()}` });

        const user = await User.findById(request.user).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        request.reviewedBy = req.user.id;
        request.reviewedAt = new Date();
        request.reviewNote = String(note).trim().slice(0, 1000);

        if (action === "Approve") {
            if (user.role !== "Participant" || user.tempManagerFrom) {
                return res.status(400).json({ success: false, message: "This user is no longer a participant without manager access" });
            }
            // Admins may adjust the dates; otherwise use what was requested
            if (startDate !== undefined || endDate !== undefined) {
                const window = parseWindow({
                    startDate: startDate ?? request.startDate.toISOString().slice(0, 10),
                    endDate: endDate === undefined ? (request.endDate ? request.endDate.toISOString().slice(0, 10) : "") : endDate
                });
                if (window.error) return res.status(400).json({ success: false, message: window.error });
                request.startDate = window.start;
                request.endDate = window.end;
            }
            if (request.endDate && request.endDate < new Date()) {
                return res.status(400).json({ success: false, message: "The requested period has already ended" });
            }

            request.status = "Approved";
            await request.save();
            await User.updateOne({ _id: user._id }, { $set: { tempManagerFrom: request.startDate, tempManagerUntil: request.endDate, tempManagerRequest: request._id } });
            Object.assign(user, { tempManagerFrom: request.startDate, tempManagerUntil: request.endDate, tempManagerRequest: request._id });
            await syncTemporaryRole(user);
            invalidateRoleCache(user._id);
        } else {
            request.status = "Rejected";
            await request.save();
        }

        const approved = action === "Approve";
        await mailSender(
            user.email,
            `Manager Access Request ${approved ? "Approved" : "Rejected"}`,
            `<p>Dear ${escapeHtml(user.firstName)},</p>
             <p>Your request for manager access has been <b>${approved ? "approved" : "rejected"}</b>.</p>
             ${approved ? `<p>You will have manager access from ${describeWindow(request.startDate, request.endDate)}. Sign in to start using it.</p>` : ""}
             ${request.reviewNote ? `<p><b>Note from the admin:</b> ${escapeHtml(request.reviewNote)}</p>` : ""}
             <p>Thank you!</p>`
        );

        await request.populate([
            { path: "user", select: "firstName lastName email role tempManagerFrom tempManagerUntil" },
            { path: "reviewedBy", select: "firstName lastName" }
        ]);
        return res.status(200).json({ success: true, message: `Request ${approved ? "approved" : "rejected"}`, request });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: end an approved (scheduled or active) access early
exports.revokeAccess = async (req, res) => {
    try {
        const request = await RoleRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });
        if (request.status !== "Approved") return res.status(400).json({ success: false, message: "Only approved access can be revoked" });

        const user = await User.findById(request.user).select("-password");
        if (user && user.tempManagerRequest && user.tempManagerRequest.toString() === request._id.toString()) {
            await clearTemporaryAccess(user);
            invalidateRoleCache(user._id);
        }

        request.status = "Revoked";
        request.reviewNote = String(req.body.note || request.reviewNote || "").trim().slice(0, 1000);
        await request.save();

        if (user) {
            await mailSender(
                user.email,
                "Manager Access Ended",
                `<p>Dear ${escapeHtml(user.firstName)},</p>
                 <p>Your temporary manager access has been ended by an admin. Your account is back to participant access.</p>
                 ${req.body.note ? `<p><b>Note from the admin:</b> ${escapeHtml(req.body.note)}</p>` : ""}
                 <p>Thank you!</p>`
            );
        }

        return res.status(200).json({ success: true, message: "Manager access revoked", request });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
