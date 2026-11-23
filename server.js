require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flight_booking',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_change_me';

function makeToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Please log in first.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please log in again.' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Flight Booking API is running' }));

app.post('/api/register', asyncRoute(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, valid email and password (minimum 6 characters) are required.' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)',
      [name.trim(), email.trim().toLowerCase(), phone || null, hash]
    );
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: 'user' };
    res.status(201).json({ token: makeToken(user), user });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered.' });
    throw e;
  }
}));

app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [(email || '').trim().toLowerCase()]);
  if (!rows.length || !(await bcrypt.compare(password || '', rows[0].password_hash)))
    return res.status(401).json({ error: 'Invalid email or password.' });
  const u = rows[0];
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  res.json({ token: makeToken(user), user });
}));

app.get('/api/flights', asyncRoute(async (req, res) => {
  const { from, to, date } = req.query;
  let sql = 'SELECT * FROM flights WHERE departure_time >= NOW()';
  const params = [];
  if (from) { sql += ' AND LOWER(source_city)=LOWER(?)'; params.push(from.trim()); }
  if (to) { sql += ' AND LOWER(destination_city)=LOWER(?)'; params.push(to.trim()); }
  if (date) { sql += ' AND DATE(departure_time)=?'; params.push(date); }
  sql += ' ORDER BY departure_time LIMIT 100';
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
}));

app.get('/api/flights/:id/seats', asyncRoute(async (req, res) => {
  const [flights] = await pool.execute('SELECT id,total_seats FROM flights WHERE id=?', [req.params.id]);
  if (!flights.length) return res.status(404).json({ error: 'Flight not found.' });
  const [rows] = await pool.execute(
    "SELECT seat_number FROM bookings WHERE flight_id=? AND booking_status='Confirmed'", [req.params.id]
  );
  const taken = new Set(rows.map(r => r.seat_number));
  const seats = Array.from({ length: flights[0].total_seats }, (_, i) => {
    const row = Math.floor(i / 4) + 1;
    const col = ['A','B','C','D'][i % 4];
    const number = `${row}${col}`;
    return { seat: number, booked: taken.has(number) };
  });
  res.json(seats);
}));

app.post('/api/bookings', auth, asyncRoute(async (req, res) => {
  const { flightId, passengerName, passengerAge, passengerGender, seatNumber } = req.body;
  if (!flightId || !passengerName || !passengerAge || !passengerGender || !seatNumber)
    return res.status(400).json({ error: 'Please complete all passenger and seat details.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [flights] = await conn.execute('SELECT * FROM flights WHERE id=? FOR UPDATE', [flightId]);
    if (!flights.length) { await conn.rollback(); return res.status(404).json({ error: 'Flight not found.' }); }
    const flight = flights[0];
    const [taken] = await conn.execute(
      "SELECT id FROM bookings WHERE flight_id=? AND seat_number=? AND booking_status='Confirmed' FOR UPDATE",
      [flightId, seatNumber]
    );
    if (taken.length) { await conn.rollback(); return res.status(409).json({ error: 'That seat is already booked. Choose another seat.' }); }
    const bookingCode = 'FTB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const [booking] = await conn.execute(
      `INSERT INTO bookings
       (booking_code,user_id,flight_id,passenger_name,passenger_age,passenger_gender,seat_number,amount)
       VALUES (?,?,?,?,?,?,?,?)`,
      [bookingCode, req.user.id, flightId, passengerName.trim(), Number(passengerAge), passengerGender, seatNumber, flight.price]
    );
    const transactionRef = 'DEMO-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    await conn.execute(
      'INSERT INTO payments (booking_id,transaction_ref,amount,payment_method,payment_status) VALUES (?,?,?,?,?)',
      [booking.insertId, transactionRef, flight.price, 'Demo Payment', 'Success']
    );
    await conn.execute('UPDATE flights SET available_seats=GREATEST(available_seats-1,0) WHERE id=?', [flightId]);
    await conn.commit();
    res.status(201).json({ message: 'Booking confirmed. Demo payment successful.', bookingCode, transactionRef, amount: flight.price });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Seat already booked. Please select another.' });
    throw e;
  } finally { conn.release(); }
}));

app.get('/api/my-bookings', auth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT b.*, f.flight_number, f.airline, f.source_city, f.destination_city,
            f.departure_time, f.arrival_time, p.transaction_ref, p.payment_status
     FROM bookings b JOIN flights f ON f.id=b.flight_id
     LEFT JOIN payments p ON p.booking_id=b.id
     WHERE b.user_id=? ORDER BY b.booked_at DESC`, [req.user.id]
  );
  res.json(rows);
}));

app.get('/api/admin/bookings', auth, adminOnly, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT b.*, u.name AS user_name, u.email, f.flight_number, f.source_city,
            f.destination_city FROM bookings b JOIN users u ON u.id=b.user_id
     JOIN flights f ON f.id=b.flight_id ORDER BY b.booked_at DESC`
  );
  res.json(rows);
}));

app.post('/api/admin/flights', auth, adminOnly, asyncRoute(async (req, res) => {
  const { flightNumber, airline, sourceCity, destinationCity, departureTime, arrivalTime, price, totalSeats } = req.body;
  if (!flightNumber || !airline || !sourceCity || !destinationCity || !departureTime || !arrivalTime || !price || !totalSeats)
    return res.status(400).json({ error: 'All flight fields are required.' });
  const [result] = await pool.execute(
    `INSERT INTO flights (flight_number,airline,source_city,destination_city,departure_time,arrival_time,price,total_seats,available_seats)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [flightNumber,airline,sourceCity,destinationCity,departureTime,arrivalTime,Number(price),Number(totalSeats),Number(totalSeats)]
  );
  res.status(201).json({ message: 'Flight added.', id: result.insertId });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error. Check MySQL connection and server console.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Flight Booking System running at http://localhost:${port}`));
