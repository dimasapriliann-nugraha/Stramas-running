// ================= NAVIGASI TAB =================
const navItems = document.querySelectorAll('.nav-item');
const appViews = document.querySelectorAll('.app-view');
let mapInitialized = false;

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        appViews.forEach(view => view.classList.remove('active'));
        
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        // Render ulang Map agar ukurannya pas ketika tab dibuka
        if (targetId === 'view-olahraga') {
            if (!mapInitialized) initMap();
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    });
});

// ================= LOGIKA PETA (LEAFLET.JS) =================
let map, marker, pathLayer;
let pathCoordinates = [];

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-6.200000, 106.816666], 15);
    
    // Tema Peta Satelit / Gelap ala UI Lari
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    pathLayer = L.polyline([], { color: '#ff4500', weight: 6, opacity: 0.9 }).addTo(map);
    
    // Custom Marker
    const icon = L.divIcon({ className: 'custom-marker', html: '<div style="background:#007AFF; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [20, 20] });
    marker = L.marker([-6.200000, 106.816666], { icon: icon }).addTo(map);

    mapInitialized = true;
    checkGPS();
}

document.getElementById('btn-recenter').addEventListener('click', () => {
    if (pathCoordinates.length > 0) {
        map.panTo(pathCoordinates[pathCoordinates.length - 1]);
    }
});

// ================= LOGIKA TRACKING REAL-TIME =================
let isRunning = false;
let watchId = null;
let startTime = 0;
let timerInterval = null;
let totalDist = 0; // Kilometer
let lastPos = null;

// Referensi DOM
const btnRun = document.getElementById('btn-run-action');
const gpsStatus = document.getElementById('gps-status');
const valTime = document.getElementById('run-time');
const valPace = document.getElementById('run-pace');
const valDist = document.getElementById('run-dist');

// Data Kesehatan Kumulatif
let dataHealth = { steps: 0, cals: 0, duration: 0, distance: 0 };

function checkGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                gpsStatus.innerHTML = '<i class="fa-solid fa-signal"></i> GPS Didapat';
                gpsStatus.style.color = '#4cd964';
                const initLoc = [pos.coords.latitude, pos.coords.longitude];
                map.setView(initLoc, 17);
                marker.setLatLng(initLoc);
            },
            () => {
                gpsStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GPS Lemah';
                gpsStatus.style.color = '#ffcc00';
            }, { enableHighAccuracy: true }
        );
    }
}

// Rumus Haversine Akurat
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function updateTimer() {
    const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const s = String(elapsedSecs % 60).padStart(2, '0');
    valTime.innerText = `${m}:${s}`;
    
    if (totalDist > 0.01) { // Hitung pace jika jarak > 10m
        const pace = (elapsedSecs / 60) / totalDist;
        const pMin = Math.floor(pace);
        const pSec = String(Math.floor((pace - pMin) * 60)).padStart(2, '0');
        valPace.innerText = `${pMin}'${pSec}"`;
    }
}

// Tombol Play / Stop Ditekan
btnRun.addEventListener('click', () => {
    if (!isRunning) {
        // --- MULAI LARI ---
        isRunning = true;
        btnRun.innerHTML = '<i class="fa-solid fa-stop"></i>';
        btnRun.classList.add('stop');
        
        totalDist = 0; lastPos = null; pathCoordinates = [];
        pathLayer.setLatLngs([]);
        valDist.innerText = "0.00"; valTime.innerText = "00:00"; valPace.innerText = "-'--\"";
        
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);

        watchId = navigator.geolocation.watchPosition((pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude;
            const newPos = [lat, lng];
            
            pathCoordinates.push(newPos);
            pathLayer.setLatLngs(pathCoordinates);
            marker.setLatLng(newPos);
            map.panTo(newPos);

            if (lastPos) {
                totalDist += calcDistance(lastPos.lat, lastPos.lng, lat, lng);
                valDist.innerText = totalDist.toFixed(2);
            }
            lastPos = { lat, lng };
        }, (err) => console.warn(err), { enableHighAccuracy: true, maximumAge: 0 });

    } else {
        // --- BERHENTI LARI ---
        isRunning = false;
        btnRun.innerHTML = '<i class="fa-solid fa-play"></i>';
        btnRun.classList.remove('stop');
        
        clearInterval(timerInterval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        
        showSummary();
    }
});

// ================= LOGIKA MODAL & KESEHATAN =================
function showSummary() {
    const elapsedMins = Math.floor((Date.now() - startTime) / 60000);
    // Kalkulasi Kalori & Langkah yang Realistis
    const runCals = Math.round(totalDist * 65); // Est: 65 kcal / km
    const runSteps = Math.round(totalDist * 1312); // Est: 1312 langkah / km

    // Tampilkan di Modal
    document.getElementById('sum-dist').innerText = totalDist.toFixed(2);
    document.getElementById('sum-time').innerText = valTime.innerText;
    document.getElementById('sum-pace').innerText = valPace.innerText;
    document.getElementById('sum-cal').innerText = runCals;
    
    // Update Data Global
    dataHealth.distance += totalDist;
    dataHealth.steps += runSteps;
    dataHealth.cals += runCals;
    dataHealth.duration += elapsedMins;

    document.getElementById('modal-summary').classList.remove('hidden');
}

function closeSummary() {
    document.getElementById('modal-summary').classList.add('hidden');
    // Integrasikan data ke Dashboard Kesehatan
    document.getElementById('health-dist').innerText = dataHealth.distance.toFixed(2);
    document.getElementById('health-steps').innerText = dataHealth.steps;
    document.getElementById('health-cals').innerText = dataHealth.cals;
    document.getElementById('health-duration').innerText = dataHealth.duration;
    
    // Reset display olahraga
    valDist.innerText = "0.00"; valTime.innerText = "00:00"; valPace.innerText = "-:--";
}

// Fungsi Buka / Tutup Modal "SAYA" (Info, Notif, Tentang)
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }