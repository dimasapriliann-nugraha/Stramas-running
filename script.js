// ================= 1. SPLASH & NAVIGASI =================
window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => { splash.classList.add('hidden'); }, 500);
    }, 2000);
});

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

        if (targetId === 'view-olahraga') {
            if (!mapInitialized) initMap();
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    });
});
function goToOlahraga() { navItems[1].click(); }


// ================= 2. LOGIKA PETA (MAP LAYERS & 3D) =================
let map, marker, pathLayer;
let currentTileLayer = null;
let pathCoordinates = [];
let is3DMode = false;

// Kumpulan Layer Peta Bebas API Key
const mapTiles = {
    default: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }),
    satelit: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
    medan: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' })
};

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-6.200000, 106.816666], 15);
    
    // Set map awal ke Default
    currentTileLayer = mapTiles['default'];
    currentTileLayer.addTo(map);

    pathLayer = L.polyline([], { color: '#ff4500', weight: 6, opacity: 0.9 }).addTo(map);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div style="background:#007AFF; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [20, 20] });
    marker = L.marker([-6.200000, 106.816666], { icon: icon }).addTo(map);

    mapInitialized = true; checkGPS();
}

// Ganti Layer Peta Tanpa Bug
function changeMapLayer(type, el) {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = mapTiles[type];
    currentTileLayer.addTo(map);
    
    document.querySelectorAll('.map-type-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    setTimeout(() => closeModal('modal-map-type'), 300);
}

document.getElementById('btn-recenter').addEventListener('click', () => {
    if (pathCoordinates.length > 0) map.panTo(pathCoordinates[pathCoordinates.length - 1]);
});

document.getElementById('btn-3d').addEventListener('click', () => {
    is3DMode = !is3DMode;
    const mapEl = document.getElementById('map');
    const btn = document.getElementById('btn-3d');
    if (is3DMode) { mapEl.classList.add('is-3d'); btn.style.background = '#ff6b00'; } 
    else { mapEl.classList.remove('is-3d'); btn.style.background = 'rgba(28, 28, 30, 0.9)'; }
});


// ================= 3. LOGIKA TARGET JARAK =================
let targetDistance = 0; 
let tempTargetValue = 2; // Nilai sementara di modal
let isTargetNotified = false; // Mencegah notifikasi muncul berulang kali

function adjTarget(val) {
    tempTargetValue += val;
    if(tempTargetValue < 1) tempTargetValue = 1;
    document.getElementById('target-value').innerText = tempTargetValue;
}

function setTargetVal(val) {
    tempTargetValue = val;
    // Tampilkan 1 desimal jika itu nilai maraton, selain itu bulat
    document.getElementById('target-value').innerText = Number.isInteger(val) ? val : val.toFixed(1);
}

function mulaiTarget() {
    targetDistance = tempTargetValue;
    isTargetNotified = false; // Reset notif
    
    // Ubah teks tombol menjadi target
    document.getElementById('display-target-btn').innerText = targetDistance + " km";
    closeModal('modal-target');

    // Jika belum lari, otomatis mulai larinya
    if (!isRunning) {
        document.getElementById('btn-run-action').click();
    }
}

// Fungsi Modal Peringatan Target
function lanjutRun() {
    closeModal('modal-target-reached');
}
function stopRunFromTarget() {
    closeModal('modal-target-reached');
    if (isRunning) document.getElementById('btn-run-action').click(); // Panggil Stop
}


// ================= 4. LOGIKA TRACKING REAL-TIME =================
let isRunning = false; let watchId = null; let startTime = 0; let timerInterval = null;
let totalDist = 0; let lastPos = null;
const btnRun = document.getElementById('btn-run-action');
const gpsStatus = document.getElementById('gps-status');
let dataHealth = { steps: 0, cals: 0, duration: 0, distance: 0 };

function checkGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { gpsStatus.innerHTML = '<i class="fa-solid fa-signal"></i> GPS Didapat'; gpsStatus.style.color = '#4cd964';
            const initLoc = [pos.coords.latitude, pos.coords.longitude]; map.setView(initLoc, 17); marker.setLatLng(initLoc); },
            () => { gpsStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GPS Lemah'; gpsStatus.style.color = '#ffcc00'; }, 
            { enableHighAccuracy: true }
        );
    }
}

function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function updateTimer() {
    const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const s = String(elapsedSecs % 60).padStart(2, '0');
    document.getElementById('run-time').innerText = `${m}:${s}`;
    if (totalDist > 0.01) {
        const pace = (elapsedSecs / 60) / totalDist;
        const pMin = Math.floor(pace); const pSec = String(Math.floor((pace - pMin) * 60)).padStart(2, '0');
        document.getElementById('run-pace').innerText = `${pMin}'${pSec}"`;
    }
}

btnRun.addEventListener('click', () => {
    if (!isRunning) {
        isRunning = true; btnRun.innerHTML = '<i class="fa-solid fa-stop"></i>'; btnRun.classList.add('stop');
        totalDist = 0; lastPos = null; pathCoordinates = []; pathLayer.setLatLngs([]);
        isTargetNotified = false; // Reset notifikasi jika lari baru
        document.getElementById('run-dist').innerText = "0.00"; 
        startTime = Date.now(); timerInterval = setInterval(updateTimer, 1000);

        watchId = navigator.geolocation.watchPosition((pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude;
            const newPos = [lat, lng];
            
            pathCoordinates.push(newPos); pathLayer.setLatLngs(pathCoordinates);
            marker.setLatLng(newPos); map.panTo(newPos);

            if (lastPos) {
                totalDist += calcDistance(lastPos.lat, lastPos.lng, lat, lng);
                document.getElementById('run-dist').innerText = totalDist.toFixed(2);
                
                // CEK TARGET JARAK
                if (targetDistance > 0 && totalDist >= targetDistance && !isTargetNotified) {
                    isTargetNotified = true;
                    openModal('modal-target-reached'); // Peringatan muncul
                }
            }
            lastPos = { lat, lng };
        }, (err) => console.warn(err), { enableHighAccuracy: true, maximumAge: 0 });

    } else {
        isRunning = false; btnRun.innerHTML = '<i class="fa-solid fa-play"></i>'; btnRun.classList.remove('stop');
        clearInterval(timerInterval); if (watchId) navigator.geolocation.clearWatch(watchId);
        
        const runCals = Math.round(totalDist * (userProfile.berat || 65));
        document.getElementById('sum-dist').innerText = totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = document.getElementById('run-time').innerText;
        document.getElementById('sum-pace').innerText = document.getElementById('run-pace').innerText;
        document.getElementById('sum-cal').innerText = runCals;
        
        dataHealth.distance += totalDist; dataHealth.steps += Math.round(totalDist * 1312);
        dataHealth.cals += runCals; dataHealth.duration += Math.floor((Date.now() - startTime) / 60000);

        openModal('modal-summary');
    }
});

function closeSummary() {
    closeModal('modal-summary');
    document.getElementById('health-dist').innerText = dataHealth.distance.toFixed(2);
    document.getElementById('health-steps').innerText = dataHealth.steps;
    document.getElementById('health-cals').innerText = dataHealth.cals;
    document.getElementById('health-duration').innerText = dataHealth.duration;
    
    document.getElementById('run-dist').innerText = "0.00"; document.getElementById('run-time').innerText = "00:00"; document.getElementById('run-pace').innerText = "-:--";
    document.getElementById('display-target-btn').innerText = "Target"; // Reset teks target
    targetDistance = 0; // Reset target
}

// ================= 5. LOGIKA REGISTER & HUBUNGI ADMIN =================
let isRegistered = false;
let userProfile = { nama: '', usia: 0, tinggi: 0, berat: 0, avatar: '' };

function checkLogin(modalId) {
    if(!isRegistered) alert("Daftar profil Anda terlebih dahulu.");
    else openModal(modalId);
}

document.getElementById('input-avatar').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = function(e) { userProfile.avatar = e.target.result; }; reader.readAsDataURL(file); }
});

function simpanProfil() {
    const nama = document.getElementById('input-nama').value; const usia = document.getElementById('input-usia').value;
    const tinggi = document.getElementById('input-tinggi').value; const berat = document.getElementById('input-berat-awal').value;
    if(!nama || !usia || !tinggi || !berat) { alert("Lengkapi data!"); return; }

    userProfile.nama = nama; userProfile.usia = usia; userProfile.tinggi = tinggi; userProfile.berat = berat;
    isRegistered = true;

    document.getElementById('profile-unlogged').classList.add('hidden');
    document.getElementById('profile-logged').classList.remove('hidden');
    document.getElementById('profile-name-display').innerText = nama;
    document.getElementById('profile-img').src = userProfile.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    document.getElementById('display-berat').innerText = berat;

    document.getElementById('info-nama').innerText = nama; document.getElementById('info-usia').innerText = usia;
    document.getElementById('info-tinggi').innerText = tinggi; document.getElementById('info-berat').innerText = berat;
    document.getElementById('info-bmi').innerText = (berat / Math.pow(tinggi/100, 2)).toFixed(1);
    
    document.getElementById('notif-dot').classList.remove('hidden');
    closeModal('modal-register');
}

// Fitur Hubungi Admin
function hubungiAdmin() {
    closeModal('modal-admin');
    window.open('https://wa.me/6285794249679?text=Halo%20Admin%20Stramas,%20saya%20butuh%20bantuan%20Nichh.', '_blank');
}

// Utilities
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }