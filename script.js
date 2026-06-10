// Wrap everything to ensure DOM is loaded before execution
document.addEventListener('DOMContentLoaded', () => {
  
  // --- Configuration & State ---
  const API_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
  const S_WAVE_SPEED_KM_S = 3.5; 
  
  // Default coordinates set to Cagayan de Oro
  let myLat = 8.4772; 
  let myLon = 124.6459; 
  let currentEventTime = 0;

  // UI Elements
  const elClock = document.getElementById('eq-clock');
  const elMag = document.getElementById('eq-mag-val');
  const elDist = document.getElementById('eq-dist-val');
  const elTitle = document.getElementById('eq-event-title');
  const elTime = document.getElementById('eq-event-time');
  const elLoc = document.getElementById('eq-event-loc');
  const elEtaVal = document.getElementById('eq-eta-val');
  const elEtaLbl = document.getElementById('eq-eta-lbl');
  const elStatus = document.getElementById('eq-sys-status');
  const elApp = document.getElementById('eq-app');

  // --- Clock ---
  setInterval(() => {
    if(elClock) elClock.textContent = new Date().toLocaleTimeString();
  }, 1000);

  // --- Core Functions ---
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

  function initGeolocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          myLat = position.coords.latitude;
          myLon = position.coords.longitude;
          fetchLiveData();
        },
        (error) => {
          console.warn("Location blocked/unavailable. Using fallback CDO coordinates.", error);
          fetchLiveData();
        },
        { timeout: 5000 } // Don't hang forever if GPS fails
      );
    } else {
      fetchLiveData();
    }
  }

  async function fetchLiveData() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        processEarthquake(data.features[0]);
      } else {
        elLoc.textContent = "No recent seismic data found.";
        elStatus.textContent = "STANDBY";
      }
    } catch (error) {
      console.error("Fetch error:", error);
      elLoc.textContent = "Data feed offline. Retrying...";
      elStatus.textContent = "CONNECTION ERROR";
    }
  }

  function processEarthquake(event) {
    const props = event.properties;
    const coords = event.geometry.coordinates; 
    
    const mag = props.mag || 0;
    const place = props.place || "Unknown Location";
    const timeMs = props.time || Date.now();
    currentEventTime = timeMs;
    
    const eqLon = coords[0];
    const eqLat = coords[1];
    const depth = coords[2] || 0;

    const distanceKm = calculateDistance(myLat, myLon, eqLat, eqLon);
    updateUI(mag, place, timeMs, distanceKm, depth);
  }

  function updateUI(mag, place, timeMs, distanceKm, depth) {
    elMag.textContent = mag.toFixed(1);
    elDist.textContent = Math.round(distanceKm) + ' km';
    elTitle.textContent = mag >= 5.0 ? '⚠ MAJOR ACTIVITY' : 'Seismic Event Detected';
    elTime.textContent = new Date(timeMs).toLocaleTimeString();
    elLoc.textContent = `${place} (Depth: ${Math.round(depth)}km)`;

    const timeElapsedSec = (Date.now() - timeMs) / 1000;
    const totalWaveTravelTimeSec = distanceKm / S_WAVE_SPEED_KM_S;
    const remainingEtaSec = totalWaveTravelTimeSec - timeElapsedSec;

    if (remainingEtaSec <= 0) {
      elEtaVal.textContent = "PASSED";
      elEtaLbl.textContent = "WAVES ALREADY ARRIVED/DISSIPATED";
    } else {
      const m = Math.floor(remainingEtaSec / 60).toString().padStart(2, '0');
      const s = Math.floor(remainingEtaSec % 60).toString().padStart(2, '0');
      elEtaVal.textContent = `${m}:${s}`;
      elEtaLbl.textContent = "ESTIMATED S-WAVE ETA";
    }

    if (mag >= 5.0 && distanceKm < 300) {
      elApp.className = 'app-shell state-danger';
      elStatus.textContent = 'EVACUATION WARNING';
    } else {
      elApp.className = 'app-shell';
      elStatus.textContent = 'MONITORING SENSORS';
    }
  }

  // --- Event Listeners ---
  document.getElementById('eq-btn-emergency').addEventListener('click', () => {
    alert('Beta Mode: Emergency dialing is currently disabled to prevent accidental hotline calls.');
  });

  document.getElementById('eq-btn-share').addEventListener('click', async () => {
    const text = `I am safe. My coordinates are: ${myLat.toFixed(4)}, ${myLon.toFixed(4)}. Sent from Live Eq Monitor.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Status Update', text: text });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      alert("Sharing not supported on this browser.\n\n" + text);
    }
  });

  // --- Boot Sequence ---
  initGeolocation();
  setInterval(fetchLiveData, 60000); 

});

// Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('ServiceWorker registered successfully with scope: ', registration.scope);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error);
        });
    });
  }