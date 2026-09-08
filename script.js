// --- 1. LOGIKA NAVIGASI TAB ---
const navItems = document.querySelectorAll('.nav-item');
const appViews = document.querySelectorAll('.app-view');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Hapus status aktif dari semua tab & view
        navItems.forEach(nav => nav.classList.remove('active'));
        appViews.forEach(view => view.classList.remove('active'));
        
        // Aktifkan yang diklik
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// --- 2. LOGIKA KATEGORI OLAHRAGA ---
const categories = document.querySelectorAll('.sport-categories span');
categories.forEach(cat => {
    cat.addEventListener('click', () => {
        categories.forEach(c => c.classList.remove('active'));
        cat.classList.add('active');
    });
});

// --- 3. LOGIKA TRACKING GPS REAL-TIME (BEBAS BUG) ---
let watchId = null;
let startTime = 0;
let timerInterval = null;
let totalDistance = 0; // dalam KM
let lastPosition = null;

const distanceDisplay = document.getElementById('tracking-distance');
const timeDisplay = document.getElementById('tracking-time');
const paceDisplay = document.getElementById('tracking-pace');
const btnStart = document.getElementById('btn-start-run');
const btnStop = document.getElementById('btn-stop-run');
const liveMetrics = document.getElementById('live-metrics');

// Rumus Haversine Akurat
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Update UI Waktu & Pace
function updateDashboard() {
    const now = Date.now();
    const elapsedMs = now - startTime;
    const elapsedSecs = Math.floor(elapsedMs / 1000);
    
    // Format Waktu
    const h = String(Math.floor(elapsedSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsedSecs % 3600) / 60)).padStart(2, '0');
    const s = String(elapsedSecs % 60).padStart(2, '0');
    timeDisplay.innerText = `${h}:${m}:${s}`;
    
    // Format Pace (Menit/KM)
    if (totalDistance > 0.05) { // Hitung pace jika jarak > 50 meter
        const elapsedMinutes = elapsedMs / 60000;
        const pace = elapsedMinutes / totalDistance; 
        const paceMin = Math.floor(pace);
        const paceSec = String(Math.floor((pace - paceMin) * 60)).padStart(2, '0');
        paceDisplay.innerText = `${paceMin}:${paceSec}`;
    }
}

// Mulai Pelacakan
btnStart.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert("Sensor GPS tidak didukung di perangkat ini.");
        return;
    }

    // Transisi UI
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    liveMetrics.classList.remove('hidden');

    // Reset Data
    totalDistance = 0;
    lastPosition = null;
    distanceDisplay.innerHTML = `0.00 <span>km</span>`;
    timeDisplay.innerText = "00:00:00";
    paceDisplay.innerText = "0:00";
    
    startTime = Date.now();
    timerInterval = setInterval(updateDashboard, 1000);

    // Pengaturan Akurasi Maksimal GPS
    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    };

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (lastPosition) {
                const dist = calculateDistance(lastPosition.lat, lastPosition.lng, lat, lng);
                totalDistance += dist;
                distanceDisplay.innerHTML = `${totalDistance.toFixed(2)} <span>km</span>`;
            }
            
            lastPosition = { lat, lng };
        },
        (error) => { console.warn("GPS Signal Error:", error.message); },
        options
    );
});

// Hentikan Pelacakan
btnStop.addEventListener('click', () => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    clearInterval(timerInterval);
    
    // Transisi UI kembali
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
    
    // Simpan data terakhir ke UI Kesehatan (Opsional, agar terintegrasi)
    if(totalDistance > 0) {
        document.querySelector('.grid-cards .card:first-child .card-value').innerHTML = `${totalDistance.toFixed(2)} <span>km</span>`;
    }
});