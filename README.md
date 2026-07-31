# Accounts Management System

A comprehensive MERN stack application designed for managing Yatras (spiritual journeys/tours), tracking expenses, handling participant registrations, and providing role-based access for Admins, Managers, and Participants.

## Features

- **Role-Based Access Control (RBAC):**
  - **Admin:** Full access to manage all Yatras, approve/reject Manager accounts, verify Participants, and oversee global finances.
  - **Manager:** Can create and manage specific Yatras, track related expenses/income, and handle participant tickets. Needs Admin approval to become active.
  - **Participant:** Can register for Yatras, view their enrollment status, track their payments, and submit reviews.
- **Yatra Management:** Create, update, and track Yatras (Upcoming, Ongoing, Completed). Includes destination, dates, and registration fees.
- **Financial Tracking (Ledger):** Comprehensive income and expense tracking per Yatra.
- **Registration & Ticketing:** Handle participant enrollments and manage travel tickets.
- **Media Uploads:** Integrated with Cloudinary for handling image uploads (thumbnails, gallery, QR codes, etc.).
- **Secure Authentication:** JWT-based authentication with OTP email verification during registration.

## Technology Stack

- **Frontend:** React.js, React Router DOM, Axios
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** JSON Web Tokens (JWT), bcrypt
- **File Uploads:** express-fileupload, Cloudinary
- **Emails:** Nodemailer

## Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- A [Cloudinary](https://cloudinary.com/) account for image uploads
- An Email account for sending OTPs (e.g., Gmail with App Passwords enabled)

### 1. Clone the Repository

```bash
git clone https://github.com/alleogo/RupSan.git
cd RupSan
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory based on the `.env.example`:

```env
PORT=4000
MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ADMIN_SECRET=your_admin_secret
MAIL_HOST=smtp.gmail.com
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
FOLDER_NAME=your_folder_name
```

Start the backend server:

```bash
npm run dev
```
*(Server runs on http://localhost:4000 by default)*

### 3. Frontend Setup

Open a new terminal window:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory based on the `.env.example`:

*(If your frontend requires specific env variables, configure them here. By default, it expects the backend at `http://localhost:4000`)*

Start the React development server:

```bash
npm start
```
*(App runs on http://localhost:3000 by default)*

## Admin Registration

To register an **Admin** account, select the Admin role on the signup page and provide the `ADMIN_SECRET` that matches the value in your backend `.env` file. This prevents unauthorized users from creating Admin accounts.

## License

This project is licensed under the ISC License.
