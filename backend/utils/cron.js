const cron = require('node-cron');
const Yatra = require('../models/Yatra');
const YatraRegistration = require('../models/YatraRegistration');
const mailSender = require('./mailSender');
const { escapeHtml } = require('./notify');

const EMAIL_BATCH_SIZE = 10;

// Daily job: ask attendees of ended yatras for a review, then mark those yatras Completed.
// Safe to stop part-way (e.g. a serverless timeout): attendees already emailed are skipped next run,
// and a yatra is only marked Completed once everyone has been emailed.
const runYatraReviewJob = async () => {
    try {
        const startTime = new Date();
        console.log(`[Cron Job] Daily Yatra review job started at ${startTime.toISOString()}`);

        // Find ongoing yatras whose endDate has passed
        const endedYatras = await Yatra.find({
            status: "Ongoing",
            endDate: { $lt: startTime }
        });
        console.log(`[Cron Job] Found ${endedYatras.length} completed yatras to process`);

        let emailsSent = 0;
        for (const yatra of endedYatras) {
            // Approved attendees who haven't been asked for a review yet
            const registrations = await YatraRegistration.find({
                yatra: yatra._id,
                status: "Approved",
                reviewEmailSentAt: null
            }).populate('user');

            for (let i = 0; i < registrations.length; i += EMAIL_BATCH_SIZE) {
                const batch = registrations.slice(i, i + EMAIL_BATCH_SIZE);
                await Promise.all(batch.map(async (reg) => {
                    if (reg.user && reg.user.email) {
                        const info = await mailSender(
                            reg.user.email,
                            `Please Review Your Yatra: ${yatra.title}`,
                            `<p>Dear ${escapeHtml(reg.user.firstName)},</p>
                             <p>We hope you had a great time at <b>${escapeHtml(yatra.title)}</b>.</p>
                             <p>Please log in to your account and leave a review for the Yatra!</p>
                             <p>Thank you!</p>`
                        );
                        // mailSender returns null on failure; leave it unmarked so the next run retries
                        if (!info) return;
                        emailsSent++;
                    }
                    reg.reviewEmailSentAt = new Date();
                    await reg.save();
                }));
            }

            const remaining = await YatraRegistration.countDocuments({ yatra: yatra._id, status: "Approved", reviewEmailSentAt: null });
            if (remaining === 0) {
                yatra.status = "Completed";
                await yatra.save();
                console.log(`[Cron Job] Updated yatra status to Completed: ${yatra.title}`);
            } else {
                console.warn(`[Cron Job] ${remaining} review email(s) failed for ${yatra.title}; will retry next run`);
            }
        }
        const duration = (new Date() - startTime) / 1000;
        console.log(`[Cron Job] Daily job completed in ${duration}s - Sent ${emailsSent} review emails`);
    } catch (error) {
        console.error(`[Cron Job] Error in daily Yatra review job:`, error);
    }
};

// On Vercel the job is triggered by Vercel Cron (see vercel.json); locally use node-cron
if (!process.env.VERCEL) {
    // Run every day at 8:00 AM
    cron.schedule('0 8 * * *', runYatraReviewJob);
}

module.exports = { runYatraReviewJob };
