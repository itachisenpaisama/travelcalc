/**
 * Travel Cost Calculator — PWA Application Logic
 * Features:
 * - Real-time cost calculation (fuel, distance charge, flat rates)
 * - Vehicle profile management with localStorage
 * - Google Maps Distance Matrix routing with open routing fallback
 * - Tankerkönig live fuel price integration & nearby radar
 * - Mobile-first SPA navigation & PWA service worker
 */

(function () {
  'use strict';

  // ==========================================
  // 1. CONSTANTS & DEFAULT STATE
  // ==========================================
  const STORAGE_KEYS = {
    PROFILES: 'travelcalc_profiles_v1',
    ACTIVE_PROFILE: 'travelcalc_active_profile_id',
    SETTINGS: 'travelcalc_settings_v1',
  };

  const DEFAULT_PROFILES = [
    {
      id: 'prof-1',
      name: 'Daily Commuter',
      vehicle: 'Compact Car (Gasoline)',
      consumption: 6.4,
      fuelType: 'e10',
      costPerKm: 0.30,
      flatThreshold: 40,
      flatAmount: 10.0,
      isDefault: true,
    },
    {
      id: 'prof-2',
      name: 'Diesel Long Haul',
      vehicle: 'Station Wagon (Diesel)',
      consumption: 5.2,
      fuelType: 'diesel',
      costPerKm: 0.35,
      flatThreshold: 60,
      flatAmount: 15.0,
      isDefault: false,
    },
    {
      id: 'prof-3',
      name: 'Work Van / Cargo',
      vehicle: 'Commercial Transporter',
      consumption: 9.8,
      fuelType: 'diesel',
      costPerKm: 0.50,
      flatThreshold: 25,
      flatAmount: 25.0,
      isDefault: false,
    },
  ];

  const DEFAULT_SETTINGS = {
    googleMapsApiKey: '',
    tankerkoenigApiKey: '',
    defaultFuelType: 'e10',
    currency: '€',
  };

  // State
  let state = {
    profiles: [],
    activeProfileId: '',
    settings: { ...DEFAULT_SETTINGS },
    currentRouteDistanceKm: null,
    deferredInstallPrompt: null,
  };

  // DOM Elements cache
  const elements = {};

  // ==========================================
  // 2. INITIALIZATION & STATE LOADING
  // ==========================================
  function init() {
    cacheDom();
    loadState();
    registerServiceWorker();
    setupNavigation();
    setupCalculatorEvents();
    setupRouteEvents();
    setupProfileEvents();
    setupSettingsEvents();
    setupInstallBanner();

    // Populate UI
    renderProfilesList();
    applyActiveProfileToCalc();
    renderSettingsView();
    calculateCosts(false); // Initial calculation
  }

  function cacheDom() {
    // Navigation
    elements.navButtons = document.querySelectorAll('.bottom-nav__item');
    elements.views = document.querySelectorAll('.view');
    elements.headerLogo = document.getElementById('headerLogo');
    elements.activeProfileBadge = document.getElementById('activeProfileBadge');
    elements.activeProfileBadgeName = document.getElementById('activeProfileBadgeName');

    // Calculator inputs
    elements.inputDistance = document.getElementById('inputDistance');
    elements.toggleRoundTrip = document.getElementById('toggleRoundTrip');
    elements.inputConsumption = document.getElementById('inputConsumption');
    elements.inputFuelPrice = document.getElementById('inputFuelPrice');
    elements.inputCostPerKm = document.getElementById('inputCostPerKm');
    elements.inputFlatThreshold = document.getElementById('inputFlatThreshold');
    elements.inputFlatAmount = document.getElementById('inputFlatAmount');
    elements.btnCalculate = document.getElementById('btnCalculate');
    elements.btnFetchFuel = document.getElementById('btnFetchFuel');
    elements.btnFetchFuelIcon = document.getElementById('btnFetchFuelIcon');
    elements.btnFetchFuelText = document.getElementById('btnFetchFuelText');
    elements.btnCopySummary = document.getElementById('btnCopySummary');
    elements.btnResetCalc = document.getElementById('btnResetCalc');

    // Results panel
    elements.resultsPanel = document.getElementById('resultsPanel');
    elements.resDistance = document.getElementById('resDistance');
    elements.resDistanceDetail = document.getElementById('resDistanceDetail');
    elements.resFuelCost = document.getElementById('resFuelCost');
    elements.resFuelDetail = document.getElementById('resFuelDetail');
    elements.resKmCost = document.getElementById('resKmCost');
    elements.resKmDetail = document.getElementById('resKmDetail');
    elements.resFlatCost = document.getElementById('resFlatCost');
    elements.resFlatDetail = document.getElementById('resFlatDetail');
    elements.resTotalCost = document.getElementById('resTotalCost');

    // Route Planner
    elements.routeOrigin = document.getElementById('routeOrigin');
    elements.routeDestination = document.getElementById('routeDestination');
    elements.btnCurrentLocation = document.getElementById('btnCurrentLocation');
    elements.btnCalculateRoute = document.getElementById('btnCalculateRoute');
    elements.routeResultsCard = document.getElementById('routeResultsCard');
    elements.routeDistanceValue = document.getElementById('routeDistanceValue');
    elements.routeDurationValue = document.getElementById('routeDurationValue');
    elements.btnApplyRouteToCalc = document.getElementById('btnApplyRouteToCalc');
    elements.btnOpenMapsSettings = document.getElementById('btnOpenMapsSettings');

    // Profiles
    elements.profilesListContainer = document.getElementById('profilesListContainer');
    elements.btnOpenNewProfileModal = document.getElementById('btnOpenNewProfileModal');

    // Profile Modal
    elements.profileModalOverlay = document.getElementById('profileModalOverlay');
    elements.profileModalTitle = document.getElementById('profileModalTitle');
    elements.modalProfileId = document.getElementById('modalProfileId');
    elements.modalProfileName = document.getElementById('modalProfileName');
    elements.modalProfileVehicle = document.getElementById('modalProfileVehicle');
    elements.modalProfileConsumption = document.getElementById('modalProfileConsumption');
    elements.modalProfileFuelType = document.getElementById('modalProfileFuelType');
    elements.modalProfileCostPerKm = document.getElementById('modalProfileCostPerKm');
    elements.modalProfileFlatThreshold = document.getElementById('modalProfileFlatThreshold');
    elements.modalProfileFlatAmount = document.getElementById('modalProfileFlatAmount');
    elements.btnCancelProfileModal = document.getElementById('btnCancelProfileModal');
    elements.btnSaveProfileModal = document.getElementById('btnSaveProfileModal');

    // Stations Modal
    elements.stationsModalOverlay = document.getElementById('stationsModalOverlay');
    elements.stationsListContainer = document.getElementById('stationsListContainer');
    elements.btnCloseStationsModal = document.getElementById('btnCloseStationsModal');

    // Settings
    elements.googleMapsStatus = document.getElementById('googleMapsStatus');
    elements.settingGoogleMapsKey = document.getElementById('settingGoogleMapsKey');
    elements.btnToggleMapsKeyVisibility = document.getElementById('btnToggleMapsKeyVisibility');
    elements.btnSaveMapsKey = document.getElementById('btnSaveMapsKey');
    elements.btnClearMapsKey = document.getElementById('btnClearMapsKey');

    elements.tankerkoenigStatus = document.getElementById('tankerkoenigStatus');
    elements.settingTankerkoenigKey = document.getElementById('settingTankerkoenigKey');
    elements.btnToggleTankerKeyVisibility = document.getElementById('btnToggleTankerKeyVisibility');
    elements.btnSaveTankerKey = document.getElementById('btnSaveTankerKey');
    elements.btnClearTankerKey = document.getElementById('btnClearTankerKey');

    elements.prefFuelType = document.getElementById('prefFuelType');
    elements.prefCurrency = document.getElementById('prefCurrency');
    elements.btnResetAllData = document.getElementById('btnResetAllData');

    // Toast & Banner
    elements.appToast = document.getElementById('appToast');
    elements.toastIcon = document.getElementById('toastIcon');
    elements.toastMessage = document.getElementById('toastMessage');
    elements.installBanner = document.getElementById('installBanner');
    elements.btnInstallPwa = document.getElementById('btnInstallPwa');
    elements.btnCloseInstallBanner = document.getElementById('btnCloseInstallBanner');
  }

  function loadState() {
    // 1. Profiles
    try {
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        state.profiles = JSON.parse(storedProfiles);
      } else {
        state.profiles = [...DEFAULT_PROFILES];
        saveProfiles();
      }
    } catch (e) {
      state.profiles = [...DEFAULT_PROFILES];
    }

    // 2. Active Profile
    const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
    if (storedActiveId && state.profiles.some((p) => p.id === storedActiveId)) {
      state.activeProfileId = storedActiveId;
    } else if (state.profiles.length > 0) {
      state.activeProfileId = state.profiles[0].id;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, state.activeProfileId);
    }

    // 3. Settings
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      } else {
        state.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (e) {
      state.settings = { ...DEFAULT_SETTINGS };
    }
  }

  function saveProfiles() {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(state.profiles));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  }

  // ==========================================
  // 3. SPA VIEW NAVIGATION
  // ==========================================
  function setupNavigation() {
    elements.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetViewId = btn.dataset.view;
        switchView(targetViewId);
      });
    });

    elements.headerLogo.addEventListener('click', () => {
      switchView('calculator');
    });

    elements.activeProfileBadge.addEventListener('click', () => {
      switchView('profiles');
    });

    elements.btnOpenMapsSettings.addEventListener('click', () => {
      switchView('settings');
      setTimeout(() => {
        elements.settingGoogleMapsKey.focus();
      }, 300);
    });
  }

  function switchView(viewName) {
    // Update nav buttons
    elements.navButtons.forEach((btn) => {
      if (btn.dataset.view === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update views
    elements.views.forEach((view) => {
      if (view.id === `view-${viewName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // 4. COST CALCULATION ENGINE
  // ==========================================
  function setupCalculatorEvents() {
    const inputFields = [
      elements.inputDistance,
      elements.inputConsumption,
      elements.inputFuelPrice,
      elements.inputCostPerKm,
      elements.inputFlatThreshold,
      elements.inputFlatAmount,
    ];

    inputFields.forEach((inp) => {
      inp.addEventListener('input', () => calculateCosts(false));
    });

    elements.toggleRoundTrip.addEventListener('change', () => calculateCosts(false));

    elements.btnCalculate.addEventListener('click', () => {
      calculateCosts(true);
      elements.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    elements.btnCopySummary.addEventListener('click', copySummaryToClipboard);
    elements.btnResetCalc.addEventListener('click', resetCalculator);

    elements.btnFetchFuel.addEventListener('click', openNearbyFuelRadar);
  }

  function getActiveProfile() {
    return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
  }

  function applyActiveProfileToCalc() {
    const active = getActiveProfile();
    if (!active) return;

    elements.activeProfileBadgeName.textContent = active.name;
    elements.inputConsumption.value = active.consumption || '';
    elements.inputCostPerKm.value = active.costPerKm !== undefined ? active.costPerKm : '';
    elements.inputFlatThreshold.value = active.flatThreshold !== undefined ? active.flatThreshold : '';
    elements.inputFlatAmount.value = active.flatAmount !== undefined ? active.flatAmount : '';

    // If fuel price is empty, suggest default average based on fuel type
    if (!elements.inputFuelPrice.value) {
      if (active.fuelType === 'diesel') {
        elements.inputFuelPrice.value = '1.649';
      } else if (active.fuelType === 'e10') {
        elements.inputFuelPrice.value = '1.729';
      } else {
        elements.inputFuelPrice.value = '1.789';
      }
    }
  }

  function calculateCosts(animateCounter = false) {
    const cur = state.settings.currency || '€';

    const distanceRaw = parseFloat(elements.inputDistance.value) || 0;
    const isRoundTrip = elements.toggleRoundTrip.checked;
    const effectiveDistance = isRoundTrip ? distanceRaw * 2 : distanceRaw;

    const consumption = parseFloat(elements.inputConsumption.value) || 0;
    const fuelPrice = parseFloat(elements.inputFuelPrice.value) || 0;
    const costPerKm = parseFloat(elements.inputCostPerKm.value) || 0;
    const flatThreshold = parseFloat(elements.inputFlatThreshold.value) || 0;
    const flatAmount = parseFloat(elements.inputFlatAmount.value) || 0;

    // 1. Distance Breakdown
    if (isRoundTrip) {
      elements.resDistance.textContent = `${effectiveDistance.toFixed(1)} km`;
      elements.resDistanceDetail.textContent = `2 × ${distanceRaw.toFixed(1)} km (Round Trip)`;
    } else {
      elements.resDistance.textContent = `${effectiveDistance.toFixed(1)} km`;
      elements.resDistanceDetail.textContent = `${distanceRaw.toFixed(1)} km one-way`;
    }

    // 2. Fuel Cost Breakdown
    // Fuel needed (liters) = (distance / 100) * consumption
    const fuelNeededLiters = (effectiveDistance / 100) * consumption;
    const fuelCost = fuelNeededLiters * fuelPrice;

    elements.resFuelCost.textContent = `${cur}${fuelCost.toFixed(2)}`;
    elements.resFuelDetail.textContent = `${fuelNeededLiters.toFixed(2)} L needed (${consumption.toFixed(1)} L/100km @ ${cur}${fuelPrice.toFixed(3)}/L)`;

    // 3. Distance Cost Breakdown
    const kmCharge = effectiveDistance * costPerKm;
    elements.resKmCost.textContent = `${cur}${kmCharge.toFixed(2)}`;
    elements.resKmDetail.textContent = `${cur}${costPerKm.toFixed(2)} per km charge`;

    // 4. Flat Rate Surcharge
    let flatSurcharge = 0;
    if (flatThreshold > 0 && effectiveDistance >= flatThreshold) {
      flatSurcharge = flatAmount;
      elements.resFlatCost.textContent = `${cur}${flatSurcharge.toFixed(2)}`;
      elements.resFlatDetail.textContent = `Applied (dist. ≥ ${flatThreshold.toFixed(0)} km)`;
    } else if (flatThreshold > 0) {
      elements.resFlatCost.textContent = `${cur}0.00`;
      elements.resFlatDetail.textContent = `Below threshold (${effectiveDistance.toFixed(1)} < ${flatThreshold.toFixed(0)} km)`;
    } else if (flatAmount > 0) {
      flatSurcharge = flatAmount;
      elements.resFlatCost.textContent = `${cur}${flatSurcharge.toFixed(2)}`;
      elements.resFlatDetail.textContent = 'Flat fee applied';
    } else {
      elements.resFlatCost.textContent = `${cur}0.00`;
      elements.resFlatDetail.textContent = 'No flat fee configured';
    }

    // 5. Total Cost
    const totalCost = fuelCost + kmCharge + flatSurcharge;

    if (animateCounter) {
      animateValue(elements.resTotalCost, totalCost, cur);
    } else {
      elements.resTotalCost.textContent = `${cur}${totalCost.toFixed(2)}`;
    }
  }

  function animateValue(element, targetValue, currencySymbol) {
    const start = 0;
    const duration = 400;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (targetValue - start) * eased;
      element.textContent = `${currencySymbol}${current.toFixed(2)}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function copySummaryToClipboard() {
    const cur = state.settings.currency || '€';
    const distanceRaw = parseFloat(elements.inputDistance.value) || 0;
    const isRoundTrip = elements.toggleRoundTrip.checked;
    const effectiveDistance = isRoundTrip ? distanceRaw * 2 : distanceRaw;
    const consumption = parseFloat(elements.inputConsumption.value) || 0;
    const fuelPrice = parseFloat(elements.inputFuelPrice.value) || 0;
    const costPerKm = parseFloat(elements.inputCostPerKm.value) || 0;
    const flatThreshold = parseFloat(elements.inputFlatThreshold.value) || 0;
    const flatAmount = parseFloat(elements.inputFlatAmount.value) || 0;

    const fuelCost = (effectiveDistance / 100) * consumption * fuelPrice;
    const kmCharge = effectiveDistance * costPerKm;
    const flatSurcharge = flatThreshold > 0 && effectiveDistance >= flatThreshold ? flatAmount : (flatThreshold === 0 ? flatAmount : 0);
    const total = fuelCost + kmCharge + flatSurcharge;

    const summary = [
      `🚗 Travel Cost Calculation (${getActiveProfile().name}):`,
      `• Distance: ${effectiveDistance.toFixed(1)} km ${isRoundTrip ? '(Round Trip)' : '(One-Way)'}`,
      `• Fuel Cost: ${cur}${fuelCost.toFixed(2)} (${consumption.toFixed(1)} L/100km @ ${cur}${fuelPrice.toFixed(3)}/L)`,
      `• Distance Charge: ${cur}${kmCharge.toFixed(2)} (${cur}${costPerKm.toFixed(2)}/km)`,
      flatSurcharge > 0 ? `• Flat Rate Fee: ${cur}${flatSurcharge.toFixed(2)}` : null,
      `----------------------------------------`,
      `💰 Total Travel Cost: ${cur}${total.toFixed(2)}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summary).then(() => {
        showToast('Summary copied to clipboard! 📋', 'success');
      }).catch(() => {
        fallbackCopyText(summary);
      });
    } else {
      fallbackCopyText(summary);
    }
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Summary copied to clipboard! 📋', 'success');
    } catch (err) {
      showToast('Could not copy summary', 'error');
    }
    document.body.removeChild(textarea);
  }

  function resetCalculator() {
    elements.inputDistance.value = '';
    elements.toggleRoundTrip.checked = false;
    applyActiveProfileToCalc();
    calculateCosts(false);
    showToast('Calculator reset to profile defaults', 'success');
  }

  // ==========================================
  // 5. ROUTE PLANNER (GOOGLE MAPS + OSM)
  // ==========================================
  function setupRouteEvents() {
    elements.btnCurrentLocation.addEventListener('click', fetchUserOriginLocation);
    elements.btnCalculateRoute.addEventListener('click', calculateRouteDistance);
    elements.btnApplyRouteToCalc.addEventListener('click', applyRouteDistanceToCalculator);
  }

  function fetchUserOriginLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by browser', 'error');
      return;
    }

    elements.btnCurrentLocation.textContent = '⏳';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Reverse geocode via open Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const cityOrAddress =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.display_name?.split(',')[0] ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          elements.routeOrigin.value = cityOrAddress;
          showToast(`Location found: ${cityOrAddress}`, 'success');
        } catch (e) {
          elements.routeOrigin.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          showToast('GPS coordinates adopted', 'success');
        } finally {
          elements.btnCurrentLocation.textContent = '🎯';
        }
      },
      (err) => {
        elements.btnCurrentLocation.textContent = '🎯';
        showToast(`Location error: ${err.message}`, 'error');
      },
      { timeout: 10000 }
    );
  }

  async function calculateRouteDistance() {
    const origin = elements.routeOrigin.value.trim();
    const destination = elements.routeDestination.value.trim();

    if (!origin || !destination) {
      showToast('Please enter both origin and destination', 'error');
      return;
    }

    elements.btnCalculateRoute.disabled = true;
    elements.btnCalculateRoute.textContent = 'Calculating Route...';

    const googleApiKey = state.settings.googleMapsApiKey;

    if (googleApiKey) {
      // Use Google Maps Distance Matrix via client library
      try {
        await calculateViaGoogleMaps(origin, destination, googleApiKey);
      } catch (err) {
        console.warn('Google Maps error, falling back to open routing:', err);
        await calculateViaOpenRouting(origin, destination);
      }
    } else {
      // Free open geospatial routing
      await calculateViaOpenRouting(origin, destination);
    }

    elements.btnCalculateRoute.disabled = false;
    elements.btnCalculateRoute.textContent = '🔍 Find Distance & Route';
  }

  async function calculateViaOpenRouting(origin, destination) {
    try {
      // 1. Geocode origin
      const origRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origin)}&format=json&limit=1`
      );
      const origData = await origRes.json();
      if (!origData || origData.length === 0) {
        throw new Error(`Could not find origin "${origin}"`);
      }

      // 2. Geocode destination
      const destRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`
      );
      const destData = await destRes.json();
      if (!destData || destData.length === 0) {
        throw new Error(`Could not find destination "${destination}"`);
      }

      const origCoord = [parseFloat(origData[0].lon), parseFloat(origData[0].lat)];
      const destCoord = [parseFloat(destData[0].lon), parseFloat(destData[0].lat)];

      // 3. Query OSRM routing service
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origCoord[0]},${origCoord[1]};${destCoord[0]},${destCoord[1]}?overview=false`;
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
        const distKm = routeData.routes[0].distance / 1000.0;
        const durationSec = routeData.routes[0].duration;

        displayRouteResults(distKm, durationSec);
        showToast(`Route found: ${distKm.toFixed(1)} km`, 'success');
      } else {
        throw new Error('No driving route found between these points');
      }
    } catch (err) {
      showToast(err.message || 'Error calculating route', 'error');
    }
  }

  function calculateViaGoogleMaps(origin, destination, apiKey) {
    return new Promise((resolve, reject) => {
      // Check if google maps script is already loaded
      if (window.google && window.google.maps && window.google.maps.DistanceMatrixService) {
        runGoogleDistanceMatrix(origin, destination, resolve, reject);
      } else {
        // Load Google Maps script dynamically
        const scriptId = 'google-maps-api-script';
        let existingScript = document.getElementById(scriptId);
        if (existingScript) existingScript.remove();

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = () => {
          runGoogleDistanceMatrix(origin, destination, resolve, reject);
        };
        script.onerror = () => {
          reject(new Error('Failed to load Google Maps script'));
        };
        document.head.appendChild(script);
      }
    });
  }

  function runGoogleDistanceMatrix(origin, destination, resolve, reject) {
    try {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
            const element = response.rows[0].elements[0];
            const distKm = element.distance.value / 1000.0;
            const durationSec = element.duration.value;

            displayRouteResults(distKm, durationSec);
            showToast(`Google Maps: ${distKm.toFixed(1)} km`, 'success');
            resolve();
          } else {
            reject(new Error(status || 'Google Distance Matrix error'));
          }
        }
      );
    } catch (e) {
      reject(e);
    }
  }

  function displayRouteResults(distKm, durationSec) {
    state.currentRouteDistanceKm = distKm;

    elements.routeDistanceValue.textContent = `${distKm.toFixed(1)} km`;

    // Duration formatting
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.round((durationSec % 3600) / 60);
    if (hours > 0) {
      elements.routeDurationValue.textContent = `${hours}h ${minutes}m`;
    } else {
      elements.routeDurationValue.textContent = `${minutes} min`;
    }

    elements.routeResultsCard.classList.remove('hidden');
  }

  function applyRouteDistanceToCalculator() {
    if (!state.currentRouteDistanceKm) return;

    elements.inputDistance.value = state.currentRouteDistanceKm.toFixed(1);
    switchView('calculator');
    calculateCosts(true);
    showToast(`Adopted ${state.currentRouteDistanceKm.toFixed(1)} km into calculator!`, 'success');
  }

  // ==========================================
  // 6. TANKERKÖNIG LIVE FUEL PRICE INTEGRATION
  // ==========================================
  async function openNearbyFuelRadar() {
    const activeProfile = getActiveProfile();
    const fuelType = activeProfile.fuelType || state.settings.defaultFuelType || 'e10';
    const apiKey = state.settings.tankerkoenigApiKey;

    elements.btnFetchFuel.disabled = true;
    elements.btnFetchFuelIcon.textContent = '⏳';
    elements.btnFetchFuelText.textContent = 'Scanning Gas Stations...';

    // Fetch user coords (default to Frankfurt if denied/failed)
    let lat = 50.1109;
    let lng = 8.6821;

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('No geolocation'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (err) {
      console.log('Using central German benchmark location for fuel prices');
    }

    try {
      if (apiKey && apiKey.length > 20) {
        // Query live API via CORS proxy
        await fetchLiveTankerkoenigPrices(lat, lng, fuelType, apiKey);
      } else {
        // Render demo/benchmark prices with real current averages
        renderDemoFuelStations(lat, lng, fuelType);
      }
    } catch (err) {
      console.warn('Live API request failed, showing benchmark prices:', err);
      renderDemoFuelStations(lat, lng, fuelType);
    } finally {
      elements.btnFetchFuel.disabled = false;
      elements.btnFetchFuelIcon.textContent = '🔄';
      elements.btnFetchFuelText.textContent = 'Get Live Fuel Prices Nearby';
      openStationsModal();
    }
  }

  async function fetchLiveTankerkoenigPrices(lat, lng, fuelType, apiKey) {
    const targetUrl = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=15&sort=price&type=${fuelType}&apikey=${apiKey}`;
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;

    const res = await fetch(proxyUrl);
    const data = await res.json();

    if (!data.ok || !data.stations || data.stations.length === 0) {
      throw new Error(data.message || 'No stations returned');
    }

    const openStations = data.stations.filter((s) => s.isOpen && s.price > 0);
    renderStationsList(openStations.slice(0, 8), fuelType);
  }

  function renderDemoFuelStations(lat, lng, fuelType) {
    // Current German market representative base prices
    const basePrices = {
      e5: 1.779,
      e10: 1.719,
      diesel: 1.639,
    };
    const base = basePrices[fuelType] || 1.719;

    const demoStations = [
      {
        name: 'JET Tankstelle',
        brand: 'JET',
        place: 'Nearby City',
        dist: 1.4,
        price: parseFloat((base - 0.02).toFixed(3)),
      },
      {
        name: 'HEM Automatenstation',
        brand: 'HEM',
        place: 'Business Park',
        dist: 2.8,
        price: parseFloat((base - 0.01).toFixed(3)),
      },
      {
        name: 'TotalEnergies Station',
        brand: 'TOTAL',
        place: 'Main Road',
        dist: 3.5,
        price: parseFloat(base.toFixed(3)),
      },
      {
        name: 'Aral Tankstelle',
        brand: 'ARAL',
        place: 'Highway Exit',
        dist: 4.9,
        price: parseFloat((base + 0.03).toFixed(3)),
      },
      {
        name: 'Shell Express',
        brand: 'SHELL',
        place: 'City Center',
        dist: 5.7,
        price: parseFloat((base + 0.04).toFixed(3)),
      },
    ];

    renderStationsList(demoStations, fuelType, true);
  }

  function renderStationsList(stations, fuelType, isDemo = false) {
    elements.stationsListContainer.innerHTML = '';

    if (isDemo) {
      const infoNotice = document.createElement('div');
      infoNotice.style.fontSize = '0.75rem';
      infoNotice.style.color = 'var(--accent-warning)';
      infoNotice.style.padding = '8px 12px';
      infoNotice.style.background = 'rgba(255, 179, 71, 0.08)';
      infoNotice.style.borderRadius = 'var(--radius-sm)';
      infoNotice.style.marginBottom = '10px';
      infoNotice.innerHTML = `💡 Showing current market reference prices for <strong>${fuelType.toUpperCase()}</strong>. Add your free Tankerkönig API key in Settings for 100% station-accurate live data.`;
      elements.stationsListContainer.appendChild(infoNotice);
    }

    stations.forEach((st) => {
      const item = document.createElement('div');
      item.className = 'station-item';
      item.innerHTML = `
        <div class="station-item__price">€${st.price.toFixed(3)}</div>
        <div class="station-item__info">
          <div class="station-item__name">${st.name || st.brand}</div>
          <div class="station-item__distance">${st.dist.toFixed(1)} km away • ${st.place || ''}</div>
        </div>
        <div class="station-item__use">Adopt ➔</div>
      `;

      item.addEventListener('click', () => {
        elements.inputFuelPrice.value = st.price.toFixed(3);
        closeStationsModal();
        calculateCosts(true);
        showToast(`Adopted €${st.price.toFixed(3)}/L from ${st.brand || st.name}!`, 'success');
      });

      elements.stationsListContainer.appendChild(item);
    });
  }

  function openStationsModal() {
    elements.stationsModalOverlay.classList.add('active');
  }

  function closeStationsModal() {
    elements.stationsModalOverlay.classList.remove('active');
  }

  // ==========================================
  // 7. PROFILES MANAGEMENT
  // ==========================================
  function setupProfileEvents() {
    elements.btnOpenNewProfileModal.addEventListener('click', () => {
      openProfileModal(null);
    });

    elements.btnCancelProfileModal.addEventListener('click', closeProfileModal);
    elements.btnSaveProfileModal.addEventListener('click', saveProfileModal);
    elements.btnCloseStationsModal.addEventListener('click', closeStationsModal);

    // Close on overlay backdrop tap
    elements.profileModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.profileModalOverlay) closeProfileModal();
    });
    elements.stationsModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.stationsModalOverlay) closeStationsModal();
    });
  }

  function renderProfilesList() {
    elements.profilesListContainer.innerHTML = '';

    if (state.profiles.length === 0) {
      elements.profilesListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🚘</div>
          <div class="empty-state__text">No vehicle profiles yet.<br>Add your first car to speed up calculations!</div>
        </div>
      `;
      return;
    }

    state.profiles.forEach((profile) => {
      const isActive = profile.id === state.activeProfileId;
      const card = document.createElement('div');
      card.className = `profile-card ${isActive ? 'active' : ''}`;
      card.dataset.id = profile.id;

      const fuelLabels = { e5: 'Super E5', e10: 'Super E10', diesel: 'Diesel' };
      const fuelLabel = fuelLabels[profile.fuelType] || 'Gasoline';

      card.innerHTML = `
        <div class="profile-card__avatar">${profile.name.charAt(0).toUpperCase()}</div>
        <div class="profile-card__info">
          <div class="profile-card__name">${profile.name} ${isActive ? '✓ (Active)' : ''}</div>
          <div class="profile-card__meta">
            <span>🚗 ${profile.vehicle || 'Vehicle'}</span>
            <span>⛽ ${profile.consumption.toFixed(1)} L/100km (${fuelLabel})</span>
            <span>📏 €${(profile.costPerKm || 0).toFixed(2)}/km</span>
            ${profile.flatAmount > 0 ? `<span>📦 €${profile.flatAmount.toFixed(0)} flat (≥${profile.flatThreshold}km)</span>` : ''}
          </div>
        </div>
        <div class="profile-card__actions">
          <button type="button" class="btn-icon btn-edit" title="Edit Profile">✏️</button>
          ${state.profiles.length > 1 ? '<button type="button" class="btn-icon btn-danger btn-delete" title="Delete Profile">✕</button>' : ''}
        </div>
      `;

      // Click card to set active
      card.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card__actions')) return;
        setActiveProfile(profile.id);
      });

      // Edit button
      const editBtn = card.querySelector('.btn-edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal(profile);
      });

      // Delete button
      const delBtn = card.querySelector('.btn-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteProfile(profile.id);
        });
      }

      elements.profilesListContainer.appendChild(card);
    });
  }

  function setActiveProfile(profileId) {
    state.activeProfileId = profileId;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
    renderProfilesList();
    applyActiveProfileToCalc();
    calculateCosts(true);
    showToast(`Active profile: ${getActiveProfile().name}`, 'success');
  }

  function openProfileModal(profileToEdit = null) {
    if (profileToEdit) {
      elements.profileModalTitle.textContent = 'Edit Profile';
      elements.modalProfileId.value = profileToEdit.id;
      elements.modalProfileName.value = profileToEdit.name;
      elements.modalProfileVehicle.value = profileToEdit.vehicle || '';
      elements.modalProfileConsumption.value = profileToEdit.consumption;
      elements.modalProfileFuelType.value = profileToEdit.fuelType || 'e10';
      elements.modalProfileCostPerKm.value = profileToEdit.costPerKm !== undefined ? profileToEdit.costPerKm : '';
      elements.modalProfileFlatThreshold.value = profileToEdit.flatThreshold !== undefined ? profileToEdit.flatThreshold : '';
      elements.modalProfileFlatAmount.value = profileToEdit.flatAmount !== undefined ? profileToEdit.flatAmount : '';
    } else {
      elements.profileModalTitle.textContent = 'Add Vehicle Profile';
      elements.modalProfileId.value = '';
      elements.modalProfileName.value = '';
      elements.modalProfileVehicle.value = '';
      elements.modalProfileConsumption.value = '6.5';
      elements.modalProfileFuelType.value = state.settings.defaultFuelType || 'e10';
      elements.modalProfileCostPerKm.value = '0.30';
      elements.modalProfileFlatThreshold.value = '50';
      elements.modalProfileFlatAmount.value = '15.00';
    }

    elements.profileModalOverlay.classList.add('active');
  }

  function closeProfileModal() {
    elements.profileModalOverlay.classList.remove('active');
  }

  function saveProfileModal() {
    const id = elements.modalProfileId.value;
    const name = elements.modalProfileName.value.trim();
    const vehicle = elements.modalProfileVehicle.value.trim();
    const consumption = parseFloat(elements.modalProfileConsumption.value) || 6.0;
    const fuelType = elements.modalProfileFuelType.value;
    const costPerKm = parseFloat(elements.modalProfileCostPerKm.value) || 0;
    const flatThreshold = parseFloat(elements.modalProfileFlatThreshold.value) || 0;
    const flatAmount = parseFloat(elements.modalProfileFlatAmount.value) || 0;

    if (!name) {
      showToast('Please enter a profile name', 'error');
      return;
    }

    if (id) {
      // Edit existing
      const idx = state.profiles.findIndex((p) => p.id === id);
      if (idx !== -1) {
        state.profiles[idx] = {
          ...state.profiles[idx],
          name,
          vehicle,
          consumption,
          fuelType,
          costPerKm,
          flatThreshold,
          flatAmount,
        };
      }
      showToast('Profile updated!', 'success');
    } else {
      // Create new
      const newProfile = {
        id: `prof-${Date.now()}`,
        name,
        vehicle,
        consumption,
        fuelType,
        costPerKm,
        flatThreshold,
        flatAmount,
      };
      state.profiles.push(newProfile);
      state.activeProfileId = newProfile.id;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, newProfile.id);
      showToast('New profile created & activated!', 'success');
    }

    saveProfiles();
    closeProfileModal();
    renderProfilesList();
    applyActiveProfileToCalc();
    calculateCosts(false);
  }

  function deleteProfile(profileId) {
    if (state.profiles.length <= 1) {
      showToast('Cannot delete the only profile', 'error');
      return;
    }

    if (confirm('Are you sure you want to delete this profile?')) {
      state.profiles = state.profiles.filter((p) => p.id !== profileId);
      if (state.activeProfileId === profileId) {
        state.activeProfileId = state.profiles[0].id;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, state.activeProfileId);
      }
      saveProfiles();
      renderProfilesList();
      applyActiveProfileToCalc();
      calculateCosts(false);
      showToast('Profile deleted', 'success');
    }
  }

  // ==========================================
  // 8. SETTINGS & PREFERENCES
  // ==========================================
  function setupSettingsEvents() {
    // Maps key
    elements.btnToggleMapsKeyVisibility.addEventListener('click', () => {
      elements.settingGoogleMapsKey.type =
        elements.settingGoogleMapsKey.type === 'password' ? 'text' : 'password';
    });

    elements.btnSaveMapsKey.addEventListener('click', () => {
      state.settings.googleMapsApiKey = elements.settingGoogleMapsKey.value.trim();
      saveSettings();
      renderSettingsView();
      showToast('Google Maps key saved!', 'success');
    });

    elements.btnClearMapsKey.addEventListener('click', () => {
      elements.settingGoogleMapsKey.value = '';
      state.settings.googleMapsApiKey = '';
      saveSettings();
      renderSettingsView();
      showToast('Google Maps key cleared', 'success');
    });

    // Tankerkönig key
    elements.btnToggleTankerKeyVisibility.addEventListener('click', () => {
      elements.settingTankerkoenigKey.type =
        elements.settingTankerkoenigKey.type === 'password' ? 'text' : 'password';
    });

    elements.btnSaveTankerKey.addEventListener('click', () => {
      state.settings.tankerkoenigApiKey = elements.settingTankerkoenigKey.value.trim();
      saveSettings();
      renderSettingsView();
      showToast('Tankerkönig key saved!', 'success');
    });

    elements.btnClearTankerKey.addEventListener('click', () => {
      elements.settingTankerkoenigKey.value = '';
      state.settings.tankerkoenigApiKey = '';
      saveSettings();
      renderSettingsView();
      showToast('Tankerkönig key cleared', 'success');
    });

    // Preferences
    elements.prefFuelType.addEventListener('change', (e) => {
      state.settings.defaultFuelType = e.target.value;
      saveSettings();
      showToast('Default fuel type updated', 'success');
    });

    elements.prefCurrency.addEventListener('change', (e) => {
      state.settings.currency = e.target.value;
      saveSettings();
      calculateCosts(false);
      showToast(`Currency set to ${state.settings.currency}`, 'success');
    });

    // Reset all data
    elements.btnResetAllData.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all profiles and settings to default?')) {
        localStorage.clear();
        state.profiles = [...DEFAULT_PROFILES];
        state.activeProfileId = state.profiles[0].id;
        state.settings = { ...DEFAULT_SETTINGS };
        saveProfiles();
        saveSettings();
        renderProfilesList();
        renderSettingsView();
        applyActiveProfileToCalc();
        calculateCosts(false);
        showToast('All app data has been reset', 'success');
      }
    });
  }

  function renderSettingsView() {
    // Google Maps status
    elements.settingGoogleMapsKey.value = state.settings.googleMapsApiKey || '';
    if (state.settings.googleMapsApiKey) {
      elements.googleMapsStatus.textContent = 'Active Key';
      elements.googleMapsStatus.className = 'api-key-status connected';
    } else {
      elements.googleMapsStatus.textContent = 'Open Routing (Free)';
      elements.googleMapsStatus.className = 'api-key-status missing';
    }

    // Tankerkönig status
    elements.settingTankerkoenigKey.value = state.settings.tankerkoenigApiKey || '';
    if (state.settings.tankerkoenigApiKey) {
      elements.tankerkoenigStatus.textContent = 'Active Key';
      elements.tankerkoenigStatus.className = 'api-key-status connected';
    } else {
      elements.tankerkoenigStatus.textContent = 'Benchmark Mode';
      elements.tankerkoenigStatus.className = 'api-key-status missing';
    }

    // Preferences
    elements.prefFuelType.value = state.settings.defaultFuelType || 'e10';
    elements.prefCurrency.value = state.settings.currency || '€';
  }

  // ==========================================
  // 9. PWA INSTALL BANNER & SERVICE WORKER
  // ==========================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('sw.js')
          .then((reg) => {
            console.log('ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.log('ServiceWorker registration skipped:', err);
          });
      });
    }
  }

  function setupInstallBanner() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      state.deferredInstallPrompt = e;

      // Show custom banner
      elements.installBanner.classList.add('show');
    });

    elements.btnInstallPwa.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;

      elements.installBanner.classList.remove('show');
      state.deferredInstallPrompt.prompt();
      const { outcome } = await state.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Thanks for installing TravelCalc! 🚀', 'success');
      }
      state.deferredInstallPrompt = null;
    });

    elements.btnCloseInstallBanner.addEventListener('click', () => {
      elements.installBanner.classList.remove('show');
    });

    window.addEventListener('appinstalled', () => {
      elements.installBanner.classList.remove('show');
      showToast('TravelCalc is installed as an app!', 'success');
    });
  }

  // ==========================================
  // 10. TOAST NOTIFICATIONS
  // ==========================================
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);

    elements.toastMessage.textContent = message;
    elements.toastIcon.textContent = type === 'success' ? '✓' : '⚠️';
    elements.appToast.className = `toast show ${type}`;

    toastTimer = setTimeout(() => {
      elements.appToast.classList.remove('show');
    }, 3200);
  }

  // ==========================================
  // RUN INITIALIZATION
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
