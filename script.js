// Konfigurasi Variabel
let map, pathLayer;
let watchId = null;
let pathCoordinates = [];
let totalDistance = 0; // dalam KM
let startTime = 0;
let timerInterval = null;

// Referensi DOM UI
const valDistance = document.getElementById('val-distance');
const valPace = document.getElementById('val-pace');
const valTime = document.getElementById('val-time');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');

// 1. Logika Splash Screen (STRAMAS)
window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            initMap(); // Muat peta setelah splash screen hilang
        }, 500); // Sinkron dengan durasi transisi CSS
    }, 2000); // Tahan opening selama 2 detik
});

// 2. Inisialisasi Peta (Leaflet.js)
function initMap() {
    // Set view awal (Default: koordinat Bandung jika GPS belum siap)
    map = L.map('map').setView([-6.9147, 107.6098], 15);
    
    // Menggunakan tiles dari OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Persiapan garis jalur pelacakan (Polyline warna oranye STRAMAS)
    pathLayer = L.polyline([], { color: '#fc4c02', weight: 5, opacity: 0.8 }).addTo(map);
}

// 3. Rumus Haversine untuk Mengukur Jarak GPS Presisi
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius bumi dalam KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 4. Update Format Waktu Stopwatch (HH:MM:SS)
function updateTimer() {
    const now = Date.now();
    const diff = new Date(now - startTime);
    const h = String(diff.getUTCHours()).padStart(2, '0');
    const m = String(diff.getUTCMinutes()).padStart(2, '0');
    const s = String(diff.getUTCSeconds()).padStart(2, '0');
    valTime.innerText = `${h}:${m}:${s}`;
    
    updatePace(now - startTime);
}

// 5. Kalkulasi Pace Lari (Menit per Kilometer)
function updatePace(elapsedMs) {
    if (totalDistance < 0.05) return; // Butuh minimal 50 meter agar Pace stabil
    const elapsedMinutes = elapsedMs / 60000;
    const pace = elapsedMinutes / totalDistance; 
    
    const paceMin = Math.floor(pace);
    const paceSec = Math.floor((pace - paceMin) * 60);
    valPace.innerText = `${paceMin}:${String(paceSec).padStart(2, '0')}`;
}

// 6. Logika Pelacakan GPS (Real-Time)
function startTracking() {
    if (!navigator.geolocation) {
        alert("GPS tidak didukung di browser ini!");
        return;
    }

    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');

    // Reset Variabel
    totalDistance = 0;
    pathCoordinates = [];
    pathLayer.setLatLngs([]);
    valDistance.innerText = "0.00";
    valPace.innerText = "0:00";
    
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    // Watch Position dengan High Accuracy
    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    };

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const newPos = [lat, lng];

            // Update Peta dan Garis
            pathCoordinates.push(newPos);
            pathLayer.setLatLngs(pathCoordinates);
            map.panTo(newPos);

            // Hitung Jarak jika titik sebelumnya ada
            if (pathCoordinates.length > 1) {
                const prev = pathCoordinates[pathCoordinates.length - 2];
                const dist = calculateDistance(prev[0], prev[1], lat, lng);
                totalDistance += dist;
                valDistance.innerText = totalDistance.toFixed(2);
            }
        },
        (error) => {
            console.warn("Kesalahan GPS:", error.message);
        },
        options
    );
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    clearInterval(timerInterval);
    
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
    btnStart.innerText = "ULANGI LARI";
}

// Event Listeners Tombol
btnStart.addEventListener('click', startTracking);
btnStop.addEventListener('click', stopTracking);