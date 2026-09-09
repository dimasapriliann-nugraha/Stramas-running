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

// ================= 2. PETA & GOOGLE SATELLITE HYBRID =================
let map, marker, pathLayer, routePolyline;
let currentTileLayer = null;
let pathCoordinates = [];
let is3DMode = false;

// Perbaikan Map Satelit agar muncul Jalan dan Bangunan (Google Maps Hybrid)
const mapTiles = {
    default: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }),
    satelit: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google' }),
    medan: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' })
};

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-6.200000, 106.816666], 15);
    currentTileLayer = mapTiles['default']; currentTileLayer.addTo(map);

    pathLayer = L.polyline([], { color: '#ff4500', weight: 6, opacity: 0.9 }).addTo(map);
    routePolyline = L.polyline([], { color: '#5ac8fa', weight: 5, dashArray: '10, 10' }).addTo(map); // Garis rute planning
    
    const icon = L.divIcon({ className: 'custom-marker', html: '<div style="background:#007AFF; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [20, 20] });
    marker = L.marker([-6.200000, 106.816666], { icon: icon }).addTo(map);

    mapInitialized = true; checkGPS();

    // Event Listener Klik Map untuk FITUR RUTE
    map.on('click', function(e) {
        if(isModeRute && lastPos) {
            buatRute(lastPos, {lat: e.latlng.lat, lng: e.latlng.lng});
        }
    });
}

function changeMapLayer(type, el) {
    if (currentTileLayer) map.removeLayer(currentTileLayer);
    currentTileLayer = mapTiles[type]; currentTileLayer.addTo(map);
    document.querySelectorAll('.map-type-item').forEach(i => i.classList.remove('active')); el.classList.add('active');
    setTimeout(() => closeModal('modal-map-type'), 300);
}

document.getElementById('btn-recenter').addEventListener('click', () => {
    if(lastPos) map.panTo([lastPos.lat, lastPos.lng]);
});

document.getElementById('btn-3d').addEventListener('click', () => {
    is3DMode = !is3DMode; const mapEl = document.getElementById('map'); const btn = document.getElementById('btn-3d');
    if (is3DMode) { mapEl.classList.add('is-3d'); btn.style.background = '#ff6b00'; } else { mapEl.classList.remove('is-3d'); btn.style.background = 'rgba(28, 28, 30, 0.9)'; }
});

// ================= 3. FITUR PEMBUAT RUTE (ROUTING) =================
let isModeRute = false;

function aktifkanModeRute() {
    isModeRute = true;
    document.getElementById('icon-rute').classList.remove('gray');
    document.getElementById('icon-rute').classList.add('active-rute');
    document.getElementById('route-info-banner').classList.remove('hidden');
}

function batalRute() {
    isModeRute = false;
    document.getElementById('icon-rute').classList.add('gray');
    document.getElementById('icon-rute').classList.remove('active-rute');
    document.getElementById('route-info-banner').classList.add('hidden');
    routePolyline.setLatLngs([]); // Hapus garis biru
}

function buatRute(start, end) {
    // Meminta jalur dari API OSRM (Bebas API Key)
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    
    document.getElementById('route-info-banner').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghitung Rute...';
    
    fetch(url).then(res => res.json()).then(data => {
        if(data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON lon,lat to lat,lon
            routePolyline.setLatLngs(coords);
            const dist = (data.routes[0].distance / 1000).toFixed(2);
            
            // Atur jarak target ke rute ini otomatis
            targetDistance = dist;
            document.getElementById('display-target-btn').innerText = dist + " km";
            
            document.getElementById('route-info-banner').innerHTML = `Rute Dibuat: ${dist} km <button onclick="batalRute()" style="margin-left: 10px; background: #ff3b30; color:white; border:none; padding:3px 8px; border-radius:5px;">Tutup</button>`;
            setTimeout(() => { if(isModeRute) batalRute(); }, 3000); // Otomatis tutup info
        }
    }).catch(err => {
        alert("Gagal memuat rute, periksa koneksi internet.");
        batalRute();
    });
}

// ================= 4. LOGIKA TRACKING REAL-TIME =================
let isRunning = false; let watchId = null; let startTime = 0; let timerInterval = null;
let totalDist = 0; let lastPos = null; let targetDistance = 0; let tempTargetValue = 2; let isTargetNotified = false;

function checkGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { 
                document.getElementById('gps-status').innerHTML = '<i class="fa-solid fa-signal"></i> GPS Didapat'; 
                document.getElementById('gps-status').style.color = '#4cd964';
                lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                map.setView([lastPos.lat, lastPos.lng], 17); marker.setLatLng([lastPos.lat, lastPos.lng]); 
            },
            () => {}, { enableHighAccuracy: true }
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
    const m = String(Math.floor(elapsedSecs / 60)).padStart(2, '0'); const s = String(elapsedSecs % 60).padStart(2, '0');
    document.getElementById('run-time').innerText = `${m}:${s}`;
    if (totalDist > 0.01) {
        const pace = (elapsedSecs / 60) / totalDist; const pMin = Math.floor(pace); const pSec = String(Math.floor((pace - pMin) * 60)).padStart(2, '0');
        document.getElementById('run-pace').innerText = `${pMin}'${pSec}"`;
    }
}

const btnRun = document.getElementById('btn-run-action');
let dataHealth = { steps: 0, cals: 0, duration: 0, distance: 0 };

btnRun.addEventListener('click', () => {
    if (!isRunning) {
        isRunning = true; btnRun.innerHTML = '<i class="fa-solid fa-stop"></i>'; btnRun.classList.add('stop');
        totalDist = 0; pathCoordinates = []; pathLayer.setLatLngs([]); isTargetNotified = false;
        if(lastPos) pathCoordinates.push([lastPos.lat, lastPos.lng]);
        
        document.getElementById('run-dist').innerText = "0.00"; 
        startTime = Date.now(); timerInterval = setInterval(updateTimer, 1000);

        watchId = navigator.geolocation.watchPosition((pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude; const newPos = [lat, lng];
            
            if (lastPos) {
                const dist = calcDistance(lastPos.lat, lastPos.lng, lat, lng);
                if(dist > 0.002) { // Minimal bergerak 2 meter agar tidak lompat-lompat GPS
                    totalDist += dist;
                    pathCoordinates.push(newPos); pathLayer.setLatLngs(pathCoordinates);
                    marker.setLatLng(newPos); map.panTo(newPos);
                    document.getElementById('run-dist').innerText = totalDist.toFixed(2);
                }
                if (targetDistance > 0 && totalDist >= targetDistance && !isTargetNotified) {
                    isTargetNotified = true; openModal('modal-target-reached'); 
                }
            }
            lastPos = { lat, lng };
        }, (err) => {}, { enableHighAccuracy: true, maximumAge: 0 });

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

// ================= 5. KESEHATAN (DETAK FISIK & TIDUR) =================
// Logika Sensor Detak Fisik
const touchZone = document.getElementById('heart-touch-zone');
const circleProgress = document.querySelector('.progress-ring__circle');
let hrTimer = null; let hrProgress = 0; let hrInterval = null;

const startHeartScan = (e) => {
    e.preventDefault();
    document.getElementById('detak-status').innerText = "Membaca detak jantung... Tahan terus!";
    document.getElementById('heart-icon-scan').classList.add('heart-beat-anim');
    
    hrProgress = 0; circleProgress.style.strokeDashoffset = 339.292;
    
    hrInterval = setInterval(() => {
        hrProgress += 2; // 50 iterasi = 5 detik (100ms * 50)
        const offset = 339.292 - (hrProgress / 100) * 339.292;
        circleProgress.style.strokeDashoffset = offset;
        
        if(hrProgress >= 100) {
            clearInterval(hrInterval);
            document.getElementById('heart-icon-scan').classList.remove('heart-beat-anim');
            // Menghasilkan Detak Jantung Random Realistis (70-95 BPM)
            const bpm = Math.floor(Math.random() * (95 - 70 + 1)) + 70;
            document.getElementById('hasil-detak').innerText = bpm + " bpm";
            document.getElementById('display-detak-hasil').innerText = bpm + " bpm";
            document.getElementById('display-detak-desc').innerText = "Normal";
            document.getElementById('detak-status').innerText = "Berhasil dipindai!";
            if(navigator.vibrate) navigator.vibrate(200); // Getar jika didukung
        }
    }, 50);
};

const stopHeartScan = () => {
    if(hrProgress < 100) {
        clearInterval(hrInterval);
        document.getElementById('heart-icon-scan').classList.remove('heart-beat-anim');
        document.getElementById('detak-status').innerText = "Dilepas! Tahan selama 5 detik.";
        circleProgress.style.strokeDashoffset = 339.292;
        hrProgress = 0;
    }
};

// Event Sensor (Bisa Sentuh Mouse atau Touchscreen di HP)
touchZone.addEventListener('touchstart', startHeartScan);
touchZone.addEventListener('touchend', stopHeartScan);
touchZone.addEventListener('mousedown', startHeartScan);
touchZone.addEventListener('mouseup', stopHeartScan);

// Logika Hitung Jam Tidur
function simpanTidur() {
    const mulai = document.getElementById('tidur-mulai').value;
    const bangun = document.getElementById('tidur-bangun').value;
    
    if(mulai && bangun) {
        let t1 = new Date(`01/01/2000 ${mulai}`);
        let t2 = new Date(`01/01/2000 ${bangun}`);
        
        // Jika jam bangun lebih kecil dari jam tidur (melewati tengah malam)
        if (t2 < t1) t2.setDate(t2.getDate() + 1);
        
        const diffMs = t2 - t1;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        
        const hsl = `${diffHrs}j ${diffMins}m`;
        document.getElementById('display-tidur-hasil').innerText = hsl;
        closeModal('modal-tidur');
    }
}

// ================= 6. UTILITIES (Target, Profile, Nav) =================
function adjTarget(val) { tempTargetValue += val; if(tempTargetValue < 1) tempTargetValue = 1; document.getElementById('target-value').innerText = tempTargetValue; }
function setTargetVal(val) { tempTargetValue = val; document.getElementById('target-value').innerText = Number.isInteger(val) ? val : val.toFixed(1); }
function mulaiTarget() { targetDistance = tempTargetValue; isTargetNotified = false; document.getElementById('display-target-btn').innerText = targetDistance + " km"; closeModal('modal-target'); if (!isRunning) btnRun.click(); }
function lanjutRun() { closeModal('modal-target-reached'); }
function stopRunFromTarget() { closeModal('modal-target-reached'); if (isRunning) btnRun.click(); }

function closeSummary() {
    closeModal('modal-summary');
    document.getElementById('health-dist').innerText = dataHealth.distance.toFixed(2);
    document.getElementById('health-steps').innerText = dataHealth.steps;
    document.getElementById('health-cals').innerText = dataHealth.cals;
    document.getElementById('health-duration').innerText = dataHealth.duration;
    document.getElementById('run-dist').innerText = "0.00"; document.getElementById('run-time').innerText = "00:00"; document.getElementById('run-pace').innerText = "-:--";
    document.getElementById('display-target-btn').innerText = "Target"; targetDistance = 0; routePolyline.setLatLngs([]);
}

let isRegistered = false; let userProfile = { nama: '', usia: 0, tinggi: 0, berat: 0, avatar: '' };
function checkLogin(modalId) { if(!isRegistered) alert("Daftar profil Anda terlebih dahulu."); else openModal(modalId); }
document.getElementById('input-avatar').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { userProfile.avatar = e.target.result; }; reader.readAsDataURL(file); }
});

function simpanProfil() {
    const nama = document.getElementById('input-nama').value; const usia = document.getElementById('input-usia').value;
    const tinggi = document.getElementById('input-tinggi').value; const berat = document.getElementById('input-berat-awal').value;
    if(!nama || !usia || !tinggi || !berat) { alert("Lengkapi data!"); return; }
    userProfile = { nama, usia, tinggi, berat, avatar: userProfile.avatar }; isRegistered = true;
    document.getElementById('profile-unlogged').classList.add('hidden'); document.getElementById('profile-logged').classList.remove('hidden');
    document.getElementById('profile-name-display').innerText = nama; document.getElementById('profile-img').src = userProfile.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    document.getElementById('display-berat').innerText = berat;
    document.getElementById('info-nama').innerText = nama; document.getElementById('info-usia').innerText = usia; document.getElementById('info-tinggi').innerText = tinggi; document.getElementById('info-berat').innerText = berat;
    document.getElementById('info-bmi').innerText = (berat / Math.pow(tinggi/100, 2)).toFixed(1);
    document.getElementById('notif-dot').classList.remove('hidden'); closeModal('modal-register');
}
function hubungiAdmin() { closeModal('modal-admin'); window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Stramas,%20saya%20butuh%20bantuan.', '_blank'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }