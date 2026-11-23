CREATE DATABASE IF NOT EXISTS flight_booking
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flight_booking;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flight_number VARCHAR(20) NOT NULL UNIQUE,
  airline VARCHAR(100) NOT NULL,
  source_city VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  departure_time DATETIME NOT NULL,
  arrival_time DATETIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total_seats INT NOT NULL DEFAULT 40,
  available_seats INT NOT NULL DEFAULT 40,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_route_date (source_city, destination_city, departure_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(30) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  flight_id INT NOT NULL,
  passenger_name VARCHAR(100) NOT NULL,
  passenger_age INT NOT NULL,
  passenger_gender ENUM('Male','Female','Other') NOT NULL,
  seat_number VARCHAR(10) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  booking_status ENUM('Confirmed','Cancelled') NOT NULL DEFAULT 'Confirmed',
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_booking_flight FOREIGN KEY (flight_id) REFERENCES flights(id),
  UNIQUE KEY unique_active_seat (flight_id, seat_number, booking_status)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  transaction_ref VARCHAR(50) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'Demo',
  payment_status ENUM('Success','Failed','Refunded') NOT NULL DEFAULT 'Success',
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

INSERT IGNORE INTO flights
(flight_number, airline, source_city, destination_city, departure_time, arrival_time, price, total_seats, available_seats)
VALUES
('AI101','Air India','Bengaluru','Mumbai','2027-01-10 08:00:00','2027-01-10 09:45:00',4500,40,40),
('6E205','IndiGo','Bengaluru','Delhi','2027-01-10 10:30:00','2027-01-10 13:15:00',5200,40,40),
('UK330','Vistara','Mumbai','Bengaluru','2027-01-11 14:00:00','2027-01-11 15:50:00',4800,40,40),
('6E410','IndiGo','Delhi','Hyderabad','2027-01-12 07:15:00','2027-01-12 09:20:00',3900,40,40),
('AI550','Air India','Bengaluru','Hyderabad','2027-01-13 16:00:00','2027-01-13 17:20:00',3200,40,40);
