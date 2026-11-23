# Flight Ticket Booking System

A student-project demo built with HTML, CSS, JavaScript, Node.js, Express and MySQL.

## Features
- User registration and login (bcrypt password hashing, JWT sessions)
- Search flights by source, destination and date
- View flight details and available seats
- Select a seat and book a passenger
- Demo payment record and booking confirmation
- View personal bookings
- Admin dashboard to view bookings and add flights

## Requirements
- Node.js 18 or later
- MySQL 8 (or compatible MySQL/MariaDB)
- VS Code (recommended)

## Setup

1. Start MySQL using XAMPP (MySQL) or MySQL Server.
2. Open phpMyAdmin or MySQL Workbench.
3. Import `database.sql`. This creates the `flight_booking` database and sample flights.
4. Open this project folder in VS Code.
5. Open a terminal in the project folder and run:

   ```bash
   npm install
   ```

6. Copy `.env.example` to a new file named `.env`.
7. Edit `.env` and enter your MySQL username/password. Keep `DB_NAME=flight_booking`.
8. Start the application:

   ```bash
   npm start
   ```

9. Open `http://localhost:3000` in your browser.

Do **not** open `public/index.html` directly or use Live Server for this full-stack version. The Express server serves the frontend and API together.

## Create an admin account

1. Register a normal account through the website.
2. In phpMyAdmin, open the `flight_booking` database and run this SQL, replacing the email:

   ```sql
   UPDATE users SET role='admin' WHERE email='your-email@example.com';
   ```

3. Log out and log in again. The Admin button will appear.

## Sample flight searches

The included sample flights use future dates in January 2027. Example:
- Bengaluru → Mumbai, 2027-01-10
- Bengaluru → Delhi, 2027-01-10

Change or add flight dates using the Admin dashboard.

## Important demo limitations
- Payment is simulated. No real payment gateway or money transfer is connected.
- This is an educational starter project, not a production airline booking platform.
- Before public deployment, use HTTPS, a strong JWT secret, rate limiting, input validation, secure cookie/session strategy, audit logs, backups and a real payment provider.
- The sample `.env.example` contains placeholders only. Never upload your `.env` file or credentials to GitHub.
