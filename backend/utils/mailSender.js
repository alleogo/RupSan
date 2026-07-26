const nodemailer = require("nodemailer");
require("dotenv").config();

const mailSender = async (email, title, body) => {
    try {
        let transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || "smtp.gmail.com",
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });

        let info = await transporter.sendMail({
            from: 'Accounts Management Platform',
            to: `${email}`,
            subject: `${title}`,
            html: `${body}`,
        });
        console.log("Email Sent Info: ", info.response);
        return info;
    } catch (error) {
        console.error("Error occurred while sending email: ", error.message);
        return null;
    }
};

module.exports = mailSender;
