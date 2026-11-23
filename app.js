let token = localStorage.getItem('skybook_token') || '';
let currentUser = JSON.parse(localStorage.getItem('skybook_user') || 'null');
let selectedFlight = null;
const $ = id => document.getElementById(id);
const api = async (url, options={}) => {
  const headers = { 'Content-Type':'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('/api' + url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');
  if (id === 'mybookings') loadMyBookings();
  if (id === 'admin') loadAdmin();
}
function updateNav() {
  $('authNav').classList.toggle('hidden', !!currentUser);
  $('logoutNav').classList.toggle('hidden', !currentUser);
  $('adminNav').classList.toggle('hidden', !currentUser || currentUser.role !== 'admin');
}
function setSession(data) {
  token = data.token; currentUser = data.user;
  localStorage.setItem('skybook_token', token);
  localStorage.setItem('skybook_user', JSON.stringify(currentUser));
  updateNav();
}
function logout() {
  token=''; currentUser=null;
  localStorage.removeItem('skybook_token'); localStorage.removeItem('skybook_user');
  updateNav(); show('home');
}
function message(text, error=false) {
  $('accountMsg').textContent = text;
  $('accountMsg').style.color = error ? '#b91c1c' : '#087e8b';
}
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try { setSession(await api('/register',{method:'POST',body:JSON.stringify(body)})); message('Account created. You are now logged in.'); e.target.reset(); show('search'); }
  catch(err) { message(err.message,true); }
});
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try { setSession(await api('/login',{method:'POST',body:JSON.stringify(body)})); message('Login successful.'); e.target.reset(); show('search'); }
  catch(err) { message(err.message,true); }
});
$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = new URLSearchParams(Object.fromEntries(new FormData(e.target)));
  try {
    const flights = await api('/flights?' + q.toString());
    $('flightResults').innerHTML = flights.length ? flights.map(f => `
      <article class="flight-card">
       <div><span class="eyebrow">${escapeHtml(f.airline)}</span><h3>${escapeHtml(f.flight_number)}</h3>
       <p>${escapeHtml(f.source_city)} → ${escapeHtml(f.destination_city)}</p></div>
       <div><b>${formatDate(f.departure_time)}</b><p>Arrival: ${formatDate(f.arrival_time)}</p><p>${f.available_seats} seats available</p></div>
       <div><div class="price">₹${Number(f.price).toLocaleString('en-IN')}</div><button class="primary" onclick="beginBooking(${f.id})">Book now</button></div>
      </article>`).join('') : '<p class="message">No flights found. Try another route or date.</p>';
  } catch(err) { $('flightResults').textContent = err.message; }
});
async function beginBooking(id) {
  if (!token) { alert('Please register or log in before booking.'); show('account'); return; }
  try {
    selectedFlight = (await api('/flights')).find(f => f.id === id);
    const seats = await api(`/flights/${id}/seats`);
    $('modalContent').innerHTML = `
      <h2>Book your flight</h2><p>${escapeHtml(selectedFlight.airline)} · ${escapeHtml(selectedFlight.source_city)} to ${escapeHtml(selectedFlight.destination_city)}</p>
      <form id="bookingForm">
       <label>Passenger name</label><input name="passengerName" required>
       <label>Age</label><input name="passengerAge" type="number" min="1" max="120" required>
       <label>Gender</label><select name="passengerGender" required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
       <label>Select seat</label><div class="seats">${seats.map(s=>`<button type="button" class="seat ${s.booked?'taken':''}" ${s.booked?'disabled':''} data-seat="${s.seat}">${s.seat}</button>`).join('')}</div>
       <p>Fare: <b>₹${Number(selectedFlight.price).toLocaleString('en-IN')}</b></p>
       <button class="primary">Confirm booking & demo payment</button>
      </form><p class="muted">Demo payment only. No real money is charged.</p>`;
    $('modal').classList.remove('hidden');
    document.querySelectorAll('[data-seat]').forEach(btn => btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-seat]').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
    }));
    $('bookingForm').addEventListener('submit', submitBooking);
  } catch(err) { alert(err.message); }
}
async function submitBooking(e) {
  e.preventDefault();
  const chosen = document.querySelector('.seat.selected');
  if (!chosen) { alert('Please select an available seat.'); return; }
  const body = Object.fromEntries(new FormData(e.target));
  body.flightId = selectedFlight.id; body.seatNumber = chosen.dataset.seat;
  try {
    const result = await api('/bookings',{method:'POST',body:JSON.stringify(body)});
    $('modalContent').innerHTML = `<h2>🎉 Booking confirmed!</h2><p>Your ticket has been booked successfully.</p>
      <div class="booking-row"><b>Booking ID:</b> ${escapeHtml(result.bookingCode)}<br>
      <b>Payment reference:</b> ${escapeHtml(result.transactionRef)}<br>
      <b>Amount:</b> ₹${Number(result.amount).toLocaleString('en-IN')}<br>
      <span class="badge">Confirmed · Demo payment</span></div>
      <button class="primary" onclick="closeModal();show('mybookings')">View my bookings</button>`;
  } catch(err) { alert(err.message); }
}
function closeModal(){ $('modal').classList.add('hidden'); }
async function loadMyBookings() {
  if (!token) { $('myBookingList').innerHTML='<p>Please log in to view your bookings.</p>'; return; }
  try {
    const rows = await api('/my-bookings');
    $('myBookingList').innerHTML = rows.length ? rows.map(b=>`
      <div class="booking-row"><span class="badge">${escapeHtml(b.booking_status)}</span>
       <h3>${escapeHtml(b.airline)} · ${escapeHtml(b.flight_number)}</h3>
       <b>${escapeHtml(b.source_city)} → ${escapeHtml(b.destination_city)}</b><br>
       Booking ID: ${escapeHtml(b.booking_code)} · Seat: ${escapeHtml(b.seat_number)}<br>
       Passenger: ${escapeHtml(b.passenger_name)} · Fare: ₹${Number(b.amount).toLocaleString('en-IN')}<br>
       Departure: ${formatDate(b.departure_time)}<br>Payment: ${escapeHtml(b.payment_status || 'N/A')}
      </div>`).join('') : '<p>No bookings yet.</p>';
  } catch(err) { $('myBookingList').textContent=err.message; }
}
async function loadAdmin() {
  if (!currentUser || currentUser.role !== 'admin') { $('adminBookingList').textContent='Admin login required.'; return; }
  try {
    const rows = await api('/admin/bookings');
    $('adminBookingList').innerHTML = rows.length ? rows.map(b=>`
      <div class="booking-row"><b>${escapeHtml(b.booking_code)}</b> · ${escapeHtml(b.user_name)} (${escapeHtml(b.email)})<br>
      ${escapeHtml(b.flight_number)}: ${escapeHtml(b.source_city)} → ${escapeHtml(b.destination_city)} · ${escapeHtml(b.booking_status)}</div>`).join('') : '<p>No bookings yet.</p>';
  } catch(err) { $('adminBookingList').textContent=err.message; }
}
$('flightForm').addEventListener('submit', async e=>{
  e.preventDefault();
  try {
    const body=Object.fromEntries(new FormData(e.target));
    const result=await api('/admin/flights',{method:'POST',body:JSON.stringify(body)});
    alert(result.message); e.target.reset();
  } catch(err) { alert(err.message); }
});
function formatDate(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ','T'));
  return isNaN(d) ? String(value) : d.toLocaleString();
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
updateNav();
