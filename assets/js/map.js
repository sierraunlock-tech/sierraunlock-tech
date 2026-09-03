/* =====================================================================
   SIERRAUNLOCK • GPS SHOP MAP ENGINE v6 (numbers FINAL)
   Alhassan/Waterloo = +232 75 908 206 • Baimba/Koidu = +232 31 363 736
   ===================================================================== */
'use strict';
(function () {

  const HUBS = [
    { name:'SIERRAUNLOCK Waterloo Hub', owner:'Alhassan Mansaray', area:'Tombo Park, Waterloo (opposite Peninsula School)', district:'Western Area', phone:'+232 75 908 206', lat:8.3486, lng:-12.8201, verified:true, type:'Unlock Shop' },
    { name:'SIERRAUNLOCK Koidu Hub',    owner:'Baimba Conteh',     area:'Koidu City',                                       district:'Kono',         phone:'+232 31 363 736', lat:8.6447, lng:-10.9700, verified:true, type:'Engineering Hub' }
  ];

  const TOWNS = {
    'freetown':[8.4844,-13.2344], 'waterloo':[8.3486,-12.8201], 'bo':[7.9647,-11.7384],
    'kenema':[7.8770,-11.1870], 'makeni':[8.8850,-12.0450], 'koidu':[8.6447,-10.9700],
    'port loko':[8.7650,-12.7900], 'kabala':[9.6333,-11.5500], 'bonthe':[7.2667,-12.5000],
    'kailahun':[8.2833,-10.5667], 'moyamba':[8.1667,-12.4333], 'pujehun':[7.3500,-11.9333],
    'magburaka':[8.7167,-11.9500], 'falaba':[9.5500,-11.3833]
  };

  let map = null, markers = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const loadUserShops = () => { try { return JSON.parse(localStorage.getItem('su_shops') || '[]'); } catch (e) { return []; } };
  const saveUserShops = (a) => localStorage.setItem('su_shops', JSON.stringify(a));
  const allShops = () => HUBS.concat(loadUserShops());
  const hav = (a, b, c, d) => {
    const R = 6371, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  function fileToThumb(file, cb) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 320;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.62));
    };
    img.src = url;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('map')) return;
    if (typeof L === 'undefined') {
      document.getElementById('map').innerHTML = '<p style="padding:2rem;text-align:center">Map library needs internet — reconnect and refresh.</p>';
      return;
    }
    map = L.map('map', { scrollWheelZoom:false }).setView([8.6, -11.8], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
    markers = L.layerGroup().addTo(map);
    renderMarkers();
    updateNear(null);
    wireControls();
  });

  function pinIcon(verified) {
    return L.divIcon({
      className:'su-pin-wrap',
      html:'<div class="su-pin ' + (verified ? 'pin-hub' : 'pin-shop') + '">' + (verified ? '🏢' : '🔓') + '</div>',
      iconSize:[38,38], iconAnchor:[19,38], popupAnchor:[0,-36]
    });
  }

  function renderMarkers() {
    markers.clearLayers();
    allShops().forEach(s => {
      L.marker([s.lat, s.lng], { icon: pinIcon(s.verified) }).addTo(markers)
        .bindPopup(
          (s.img ? '<img src="' + s.img + '" alt="" style="width:100%;max-width:220px;border-radius:10px;margin-bottom:6px">' : '') +
          '<strong>' + esc(s.name) + '</strong><br>' + esc(s.area) + ', ' + esc(s.district) +
          (s.type ? '<br>Type: ' + esc(s.type) : '') +
          (s.owner ? '<br>Owner: ' + esc(s.owner) : '') +
          '<br><a href="tel:' + esc(s.phone) + '">' + esc(s.phone) + '</a>' +
          (s.verified ? '<br><em>✔ Verified SIERRAUNLOCK hub</em>' : '<br><em>Community shop</em>')
        );
    });
  }

  function updateNear(center) {
    const list = document.getElementById('nearList');
    if (!list) return;
    let shops = allShops();
    if (center) shops = shops.map(s => Object.assign({}, s, { d: hav(center[0], center[1], s.lat, s.lng) })).sort((a, b) => a.d - b.d);
    list.innerHTML = shops.slice(0, 6).map(s =>
      '<div class="near-item">' +
      (s.img ? '<img src="' + s.img + '" alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none">' : '') +
      '<div class="info"><strong>' + esc(s.name) + '</strong>' +
      (s.verified ? ' <span class="vtag">✔ VERIFIED</span>' : '') +
      '<br><small>' + esc(s.type || 'Shop') + ' • ' + esc(s.area) + ', ' + esc(s.district) + '</small></div>' +
      '<div style="text-align:right">' + (s.d != null ? '<span class="dist">' + s.d.toFixed(1) + ' km</span><br>' : '') +
      '<button class="btn btn-brand btn-sm go-pin" data-lat="' + s.lat + '" data-lng="' + s.lng + '">View on Map</button></div></div>'
    ).join('');
    list.querySelectorAll('.go-pin').forEach(b => b.addEventListener('click', () => {
      map.setView([+b.dataset.lat, +b.dataset.lng], 15);
      document.getElementById('map').scrollIntoView({ behavior:'smooth', block:'center' });
    }));
  }

  function wireControls() {
    document.getElementById('areaForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('areaSearch').value.trim().toLowerCase();
      const hit = Object.keys(TOWNS).find(t => t.includes(q) || q.includes(t));
      if (!hit) { alert('Area not found — try a major town or press "Use My Location".'); return; }
      map.setView(TOWNS[hit], 11);
      updateNear(TOWNS[hit]);
    });

    document.getElementById('locateBtn').addEventListener('click', () => {
      if (!navigator.geolocation) { alert('Geolocation not supported on this device.'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = [pos.coords.latitude, pos.coords.longitude];
          L.circleMarker(p, { radius:9, color:'#0072C6', fillColor:'#0072C6', fillOpacity:.55 }).addTo(map).bindPopup('You are here').openPopup();
          map.setView(p, 11);
          updateNear(p);
        },
        () => alert('Location permission denied — use the town search instead.')
      );
    });

    document.getElementById('gpsBtn').addEventListener('click', () => {
      if (!navigator.geolocation) { alert('Geolocation not supported on this device.'); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('shopLat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('shopLng').value = pos.coords.longitude.toFixed(6);
        alert('✔ Exact GPS captured: ' + pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6));
      }, () => alert('GPS denied — we will use your town center instead.'));
    });

    document.getElementById('shopForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (id) => document.getElementById(id).value.trim();
      const file = document.getElementById('shopPhoto').files[0];
      if (!file) { alert('A snapshot of your shop is required.'); return; }
      let lat = parseFloat(g('shopLat')), lng = parseFloat(g('shopLng'));
      const finish = (imgData) => {
        if (isNaN(lat) || isNaN(lng)) {
          const area = g('shopArea').toLowerCase();
          const hit = Object.keys(TOWNS).find(t => area.includes(t));
          if (!hit) { alert('Press "Get My GPS Position" for your exact location, or mention a known town in the Area field.'); return; }
          lat = TOWNS[hit][0]; lng = TOWNS[hit][1];
        }
        const shop = { name:g('shopName'), owner:g('ownerName'), area:g('shopArea'), district:g('shopDistrict'), phone:g('shopPhone'), type:g('shopType'), img:imgData, lat:lat, lng:lng, verified:false };
        const arr = loadUserShops(); arr.push(shop); saveUserShops(arr);
        renderMarkers(); updateNear(null);
        window.open('https://wa.me/23275908206?text=' + encodeURIComponent(
          'SIERRAUNLOCK — NEW SHOP SUBMISSION\nShop: ' + shop.name + '\nType: ' + shop.type + '\nOwner: ' + shop.owner +
          '\nArea: ' + shop.area + ', ' + shop.district + '\nPhone: ' + shop.phone +
          '\nGPS: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '\n(Shop snapshot photo attached in this chat)'
        ), '_blank');
        e.target.reset();
        alert('✔ Your shop pin + photo are live on your map now! Attach the snapshot in the WhatsApp chat. Admin approval publishes it site-wide.');
      };
      fileToThumb(file, finish);
    });

    document.querySelectorAll('.view-hub').forEach(b => b.addEventListener('click', () => {
      map.setView([+b.dataset.lat, +b.dataset.lng], 15);
      document.getElementById('map').scrollIntoView({ behavior:'smooth', block:'center' });
    }));
  }
})();