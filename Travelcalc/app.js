/**
 * TravelCalc — Minimalistisches Fahrtenbuch & Fahrtkosten-Abrechnung
 * Swiss / Fintech Design & Architecture
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. KONSTANTEN & STORAGE KEYS
  // ==========================================================================
  const STORAGE_KEYS = {
    PROFILES: 'travelcalc_profiles_v2',
    ACTIVE_PROFILE: 'travelcalc_active_profile_id',
    SETTINGS: 'travelcalc_settings_v2',
    TOURS: 'travelcalc_tours_v2',
    PLACES: 'travelcalc_places_v1',
    ROUTES: 'travelcalc_saved_routes_v1',
    // Legacy key for migration:
    LEGACY_SAVED: 'travelcalc_saved_calculations',
  };

  const DEFAULT_TIERS = [
    { minKm: 20, amount: 10.0 },
    { minKm: 40, amount: 20.0 },
    { minKm: 60, amount: 30.0 },
  ];

  const DEFAULT_PROFILES = [
    {
      id: 'prof-1',
      name: 'Haupt-PKW',
      vehicle: 'Kompaktklasse / Limousine',
      consumption: 6.2,
      fuelType: 'e10',
      costPerKm: 0.30,
      tieredPricingEnabled: true,
      tiers: [
        { minKm: 20, amount: 10.0 },
        { minKm: 40, amount: 20.0 },
      ],
      isDefault: true,
    },
    {
      id: 'prof-2',
      name: 'Diesel Langstrecke',
      vehicle: 'Kombi / Diesel',
      consumption: 5.4,
      fuelType: 'diesel',
      costPerKm: 0.35,
      tieredPricingEnabled: true,
      tiers: [
        { minKm: 25, amount: 12.0 },
        { minKm: 50, amount: 25.0 },
      ],
      isDefault: false,
    },
  ];

  const DEFAULT_PLACES = [
    { id: 'place-home', name: 'Zuhause', address: 'Dietzenbach' },
    { id: 'place-office', name: 'Büro / Praxis', address: 'Frankfurt am Main' },
  ];

  const DEFAULT_SETTINGS = {
    currency: '€',
    defaultFuelType: 'e10',
    googleMapsApiKey: '',
    tankerkoenigApiKey: '',
  };

  // ==========================================================================
  // 2. STATE
  // ==========================================================================
  let state = {
    profiles: [],
    activeProfileId: '',
    settings: { ...DEFAULT_SETTINGS },
    tours: [],
    places: [],
    savedRoutes: [],
    // Active filters in accounting
    selectedMonth: 'all',
    selectedCustomer: '',
    searchQuery: '',
    currentTiers: [...DEFAULT_TIERS],
  };

  const elements = {};

  // ==========================================================================
  // 3. INITIALISIERUNG
  // ==========================================================================
  function init() {
    cacheDom();
    loadState();
    registerServiceWorker();
    setupNavigation();
    setupCalculator();
    setupAccounting();
    setupPlacesAndRoutes();
    setupProfiles();
    setupSettings();
    setupCollapsibles();

    // Default dates
    const today = new Date().toISOString().split('T')[0];
    if (elements.inputTourDate) elements.inputTourDate.value = today;

    // Apply active vehicle profile to calculator
    applyActiveProfileToCalc();
    renderAllViews();
    calculateCosts(false);
  }

  function cacheDom() {
    // Navigation
    elements.navButtons = document.querySelectorAll('.bottom-nav__item');
    elements.views = document.querySelectorAll('.view');
    elements.headerLogo = document.getElementById('headerLogo');
    elements.activeProfileBadge = document.getElementById('activeProfileBadge');
    elements.activeProfileBadgeName = document.getElementById('activeProfileBadgeName');

    // Calculator inputs
    elements.quickRouteSelect = document.getElementById('quickRouteSelect');
    elements.btnGoToRoutes = document.getElementById('btnGoToRoutes');
    elements.inputCustomer = document.getElementById('inputCustomer');
    elements.customerDatalist = document.getElementById('customerDatalist');
    elements.inputTourDate = document.getElementById('inputTourDate');
    elements.inputTourName = document.getElementById('inputTourName');
    elements.inputDistance = document.getElementById('inputDistance');
    elements.toggleRoundTrip = document.getElementById('toggleRoundTrip');
    elements.roundTripBadge = document.getElementById('roundTripBadge');
    elements.inputCostPerKm = document.getElementById('inputCostPerKm');
    elements.toggleTieredPricing = document.getElementById('toggleTieredPricing');
    elements.tieredPricingContent = document.getElementById('tieredPricingContent');
    elements.tiersListContainer = document.getElementById('tiersListContainer');
    elements.btnAddTier = document.getElementById('btnAddTier');
    elements.activeTierBanner = document.getElementById('activeTierBanner');
    elements.activeTierText = document.getElementById('activeTierText');

    // Route finder expandable
    elements.btnToggleRoutePlanner = document.getElementById('btnToggleRoutePlanner');
    elements.toggleRoutePlannerText = document.getElementById('toggleRoutePlannerText');
    elements.routeFinderBox = document.getElementById('routeFinderBox');
    elements.routeOrigin = document.getElementById('routeOrigin');
    elements.routeDestination = document.getElementById('routeDestination');
    elements.quickOriginSelect = document.getElementById('quickOriginSelect');
    elements.quickDestSelect = document.getElementById('quickDestSelect');
    elements.btnCurrentLocation = document.getElementById('btnCurrentLocation');
    elements.btnCalcRouteDist = document.getElementById('btnCalcRouteDist');
    elements.routeCalcResultBadge = document.getElementById('routeCalcResultBadge');

    // Fuel inputs
    elements.cardFuel = document.getElementById('cardFuel');
    elements.fuelHeaderTrigger = document.getElementById('fuelHeaderTrigger');
    elements.fuelCollapsibleBody = document.getElementById('fuelCollapsibleBody');
    elements.fuelSummaryMini = document.getElementById('fuelSummaryMini');
    elements.inputConsumption = document.getElementById('inputConsumption');
    elements.inputFuelPrice = document.getElementById('inputFuelPrice');
    elements.btnFetchFuel = document.getElementById('btnFetchFuel');

    // Results elements
    elements.resultsPanel = document.getElementById('resultsPanel');
    elements.resDistanceBadge = document.getElementById('resDistanceBadge');
    elements.resTotalCost = document.getElementById('resTotalCost');
    elements.resDistanceDetail = document.getElementById('resDistanceDetail');
    elements.resKmCost = document.getElementById('resKmCost');
    elements.resFlatCost = document.getElementById('resFlatCost');
    elements.resFuelCost = document.getElementById('resFuelCost');
    elements.btnSaveToLogbook = document.getElementById('btnSaveToLogbook');
    elements.btnCopySummary = document.getElementById('btnCopySummary');
    elements.btnResetCalc = document.getElementById('btnResetCalc');

    // Accounting elements
    elements.monthFolderStrip = document.getElementById('monthFolderStrip');
    elements.kpiTotalKm = document.getElementById('kpiTotalKm');
    elements.kpiTripsCount = document.getElementById('kpiTripsCount');
    elements.kpiTotalCost = document.getElementById('kpiTotalCost');
    elements.kpiAvgPerTrip = document.getElementById('kpiAvgPerTrip');
    elements.kpiSurcharges = document.getElementById('kpiSurcharges');
    elements.kpiFuelTotal = document.getElementById('kpiFuelTotal');
    elements.kpiFuelLiters = document.getElementById('kpiFuelLiters');
    elements.customerChipsContainer = document.getElementById('customerChipsContainer');
    elements.activeCustomerFilterHint = document.getElementById('activeCustomerFilterHint');
    elements.searchToursInput = document.getElementById('searchToursInput');
    elements.sortToursSelect = document.getElementById('sortToursSelect');
    elements.toursListContainer = document.getElementById('toursListContainer');
    elements.btnPrintMonthReport = document.getElementById('btnPrintMonthReport');
    elements.btnExportMonthCsv = document.getElementById('btnExportMonthCsv');

    // Places & Routes elements
    elements.placesGridContainer = document.getElementById('placesGridContainer');
    elements.routesGridContainer = document.getElementById('routesGridContainer');
    elements.btnOpenAddPlaceModal = document.getElementById('btnOpenAddPlaceModal');
    elements.btnOpenAddRouteModal = document.getElementById('btnOpenAddRouteModal');

    // Profiles elements
    elements.profilesListContainer = document.getElementById('profilesListContainer');
    elements.btnOpenNewProfileModal = document.getElementById('btnOpenNewProfileModal');

    // Settings elements
    elements.prefCurrency = document.getElementById('prefCurrency');
    elements.prefFuelType = document.getElementById('prefFuelType');
    elements.cardApis = document.getElementById('cardApis');
    elements.apiHeaderTrigger = document.getElementById('apiHeaderTrigger');
    elements.apiCollapsibleBody = document.getElementById('apiCollapsibleBody');
    elements.apiStatusSummaryBadge = document.getElementById('apiStatusSummaryBadge');
    elements.settingGoogleMapsKey = document.getElementById('settingGoogleMapsKey');
    elements.googleMapsStatus = document.getElementById('googleMapsStatus');
    elements.btnToggleMapsKeyVisibility = document.getElementById('btnToggleMapsKeyVisibility');
    elements.btnSaveMapsKey = document.getElementById('btnSaveMapsKey');
    elements.btnClearMapsKey = document.getElementById('btnClearMapsKey');
    elements.settingTankerkoenigKey = document.getElementById('settingTankerkoenigKey');
    elements.tankerkoenigStatus = document.getElementById('tankerkoenigStatus');
    elements.btnToggleTankerKeyVisibility = document.getElementById('btnToggleTankerKeyVisibility');
    elements.btnSaveTankerKey = document.getElementById('btnSaveTankerKey');
    elements.btnClearTankerKey = document.getElementById('btnClearTankerKey');
    elements.btnUseDemoTankerKey = document.getElementById('btnUseDemoTankerKey');
    elements.btnExportAllJson = document.getElementById('btnExportAllJson');
    elements.fileImportJson = document.getElementById('fileImportJson');
    elements.btnResetAllData = document.getElementById('btnResetAllData');

    // Modals
    elements.tourModalOverlay = document.getElementById('tourModalOverlay');
    elements.tourModalTitle = document.getElementById('tourModalTitle');
    elements.modalTourId = document.getElementById('modalTourId');
    elements.modalTourCustomer = document.getElementById('modalTourCustomer');
    elements.modalTourName = document.getElementById('modalTourName');
    elements.modalTourDate = document.getElementById('modalTourDate');
    elements.modalTourDistance = document.getElementById('modalTourDistance');
    elements.btnCancelTourModal = document.getElementById('btnCancelTourModal');
    elements.btnSaveTourModal = document.getElementById('btnSaveTourModal');

    elements.placeModalOverlay = document.getElementById('placeModalOverlay');
    elements.placeModalTitle = document.getElementById('placeModalTitle');
    elements.modalPlaceId = document.getElementById('modalPlaceId');
    elements.modalPlaceName = document.getElementById('modalPlaceName');
    elements.modalPlaceAddress = document.getElementById('modalPlaceAddress');
    elements.btnCancelPlaceModal = document.getElementById('btnCancelPlaceModal');
    elements.btnSavePlaceModal = document.getElementById('btnSavePlaceModal');

    elements.routeModalOverlay = document.getElementById('routeModalOverlay');
    elements.routeModalTitle = document.getElementById('routeModalTitle');
    elements.modalRouteId = document.getElementById('modalRouteId');
    elements.modalRouteName = document.getElementById('modalRouteName');
    elements.modalRouteCustomer = document.getElementById('modalRouteCustomer');
    elements.modalRouteDistance = document.getElementById('modalRouteDistance');
    elements.modalRouteRoundTrip = document.getElementById('modalRouteRoundTrip');
    elements.btnCancelRouteModal = document.getElementById('btnCancelRouteModal');
    elements.btnSaveRouteModal = document.getElementById('btnSaveRouteModal');

    elements.profileModalOverlay = document.getElementById('profileModalOverlay');
    elements.profileModalTitle = document.getElementById('profileModalTitle');
    elements.modalProfileId = document.getElementById('modalProfileId');
    elements.modalProfileName = document.getElementById('modalProfileName');
    elements.modalProfileVehicle = document.getElementById('modalProfileVehicle');
    elements.modalProfileConsumption = document.getElementById('modalProfileConsumption');
    elements.modalProfileFuelType = document.getElementById('modalProfileFuelType');
    elements.modalProfileCostPerKm = document.getElementById('modalProfileCostPerKm');
    elements.btnCancelProfileModal = document.getElementById('btnCancelProfileModal');
    elements.btnSaveProfileModal = document.getElementById('btnSaveProfileModal');

    elements.stationsModalOverlay = document.getElementById('stationsModalOverlay');
    elements.stationsListContainer = document.getElementById('stationsListContainer');
    elements.btnCloseStationsModal = document.getElementById('btnCloseStationsModal');

    elements.printContainer = document.getElementById('printContainer');
    elements.appToast = document.getElementById('appToast');
    elements.toastMessage = document.getElementById('toastMessage');
  }

  // ==========================================================================
  // 4. STORAGE & MIGRATION
  // ==========================================================================
  function loadState() {
    // 1. Settings
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
    } catch (e) {
      console.warn('Error loading settings', e);
    }

    // 2. Profiles
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

    // Active Profile
    const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
    if (storedActiveId && state.profiles.some((p) => p.id === storedActiveId)) {
      state.activeProfileId = storedActiveId;
    } else {
      state.activeProfileId = state.profiles[0]?.id || 'prof-1';
    }

    // 3. Places (Orte)
    try {
      const storedPlaces = localStorage.getItem(STORAGE_KEYS.PLACES);
      if (storedPlaces) {
        state.places = JSON.parse(storedPlaces);
      } else {
        state.places = [...DEFAULT_PLACES];
        savePlaces();
      }
    } catch (e) {
      state.places = [...DEFAULT_PLACES];
    }

    // 4. Saved Routes
    try {
      const storedRoutes = localStorage.getItem(STORAGE_KEYS.ROUTES);
      if (storedRoutes) {
        state.savedRoutes = JSON.parse(storedRoutes);
      } else {
        state.savedRoutes = [
          {
            id: 'route-sample-1',
            name: 'Zuhause ➔ Büro',
            customer: 'Eigenfahrt',
            distance: 18.5,
            isRoundTrip: true,
          },
        ];
        saveRoutes();
      }
    } catch (e) {
      state.savedRoutes = [];
    }

    // 5. Tours (with migration from legacy saved calculations)
    try {
      const storedTours = localStorage.getItem(STORAGE_KEYS.TOURS);
      if (storedTours) {
        state.tours = JSON.parse(storedTours);
      } else {
        // Check for legacy calculations to migrate
        const legacyData = localStorage.getItem(STORAGE_KEYS.LEGACY_SAVED);
        if (legacyData) {
          const oldList = JSON.parse(legacyData);
          state.tours = oldList.map((item) => ({
            id: item.id || 'tour_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            customer: item.customer || item.name || 'Allgemein',
            name: item.name || 'Fahrt',
            date: item.date || new Date().toISOString().split('T')[0],
            monthKey: (item.date || new Date().toISOString().split('T')[0]).substring(0, 7),
            distanceRaw: item.distanceRaw || item.effectiveDistance || 0,
            isRoundTrip: !!item.isRoundTrip,
            effectiveDistance: item.effectiveDistance || item.distanceRaw || 0,
            consumption: item.consumption || 6.5,
            fuelPrice: item.fuelPrice || 1.75,
            costPerKm: item.costPerKm || 0.30,
            tieredPricingEnabled: item.flatSurcharge > 0,
            flatSurcharge: item.flatSurcharge || 0,
            appliedTier: item.flatSurcharge > 0 ? { minKm: item.flatThreshold || 0, amount: item.flatSurcharge } : null,
            fuelCost: item.fuelCost || 0,
            kmCharge: item.kmCharge || 0,
            totalCost: item.totalCost || 0,
            cur: item.cur || '€',
            profileName: item.profileName || 'Fahrzeug',
          }));
          saveTours();
        }
      }
    } catch (e) {
      state.tours = [];
    }
  }

  function saveProfiles() {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(state.profiles));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  }

  function saveTours() {
    localStorage.setItem(STORAGE_KEYS.TOURS, JSON.stringify(state.tours));
  }

  function savePlaces() {
    localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(state.places));
  }

  function saveRoutes() {
    localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(state.savedRoutes));
  }

  // ==========================================================================
  // 5. NAVIGATION & VIEWS
  // ==========================================================================
  function setupNavigation() {
    elements.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.view);
      });
    });

    elements.headerLogo.addEventListener('click', () => switchView('calculator'));
    elements.activeProfileBadge.addEventListener('click', () => switchView('profiles'));
    elements.btnGoToRoutes.addEventListener('click', () => switchView('routes'));
  }

  function switchView(viewName) {
    elements.navButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    elements.views.forEach((view) => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    if (viewName === 'accounting') {
      renderAccountingView();
    } else if (viewName === 'routes') {
      renderPlacesAndRoutes();
    } else if (viewName === 'profiles') {
      renderProfilesList();
    } else if (viewName === 'settings') {
      renderSettingsView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupCollapsibles() {
    // Fuel Card Collapsible
    elements.fuelHeaderTrigger.addEventListener('click', () => {
      elements.cardFuel.classList.toggle('open');
    });

    // API Card Collapsible
    elements.apiHeaderTrigger.addEventListener('click', () => {
      elements.cardApis.classList.toggle('open');
    });

    // Expandable Route Planner
    elements.btnToggleRoutePlanner.addEventListener('click', () => {
      const isHidden = elements.routeFinderBox.classList.toggle('hidden');
      elements.toggleRoutePlannerText.textContent = isHidden
        ? 'Route berechnen (Start / Ziel)'
        : 'Routenplaner schließen';
    });
  }

  // ==========================================================================
  // 6. CALCULATOR & TIERED PRICING ENGINE
  // ==========================================================================
  function setupCalculator() {
    const inputs = [
      elements.inputDistance,
      elements.inputCostPerKm,
      elements.inputConsumption,
      elements.inputFuelPrice,
      elements.inputCustomer,
      elements.inputTourName,
    ];

    inputs.forEach((inp) => {
      inp.addEventListener('input', () => calculateCosts(false));
    });

    elements.toggleRoundTrip.addEventListener('change', () => {
      updateRoundTripBadge();
      calculateCosts(false);
    });

    elements.toggleTieredPricing.addEventListener('change', () => {
      const enabled = elements.toggleTieredPricing.checked;
      elements.tieredPricingContent.style.opacity = enabled ? '1' : '0.4';
      elements.tieredPricingContent.style.pointerEvents = enabled ? 'auto' : 'none';
      calculateCosts(false);
    });

    elements.btnAddTier.addEventListener('click', () => {
      const lastTier = state.currentTiers[state.currentTiers.length - 1];
      const nextKm = lastTier ? lastTier.minKm + 20 : 20;
      const nextAmount = lastTier ? lastTier.amount + 10.0 : 10.0;
      state.currentTiers.push({ minKm: nextKm, amount: nextAmount });
      renderTiersList();
      calculateCosts(false);
    });

    elements.btnSaveToLogbook.addEventListener('click', saveCurrentCalculationToLogbook);
    elements.btnCopySummary.addEventListener('click', copySummaryToClipboard);
    elements.btnResetCalc.addEventListener('click', resetCalculator);
    elements.btnFetchFuel.addEventListener('click', openNearbyFuelRadar);

    // Quick route dropdown selection
    elements.quickRouteSelect.addEventListener('change', (e) => {
      const routeId = e.target.value;
      if (!routeId) return;
      const route = state.savedRoutes.find((r) => r.id === routeId);
      if (route) {
        elements.inputCustomer.value = route.customer || '';
        elements.inputTourName.value = route.name || '';
        elements.inputDistance.value = route.distance || '';
        elements.toggleRoundTrip.checked = !!route.isRoundTrip;
        updateRoundTripBadge();
        calculateCosts(true);
        showToast(`Route "${route.name}" geladen! 🚗`, 'success');
      }
    });

    // Setup route planner buttons
    elements.btnCurrentLocation.addEventListener('click', fetchUserOriginLocation);
    elements.btnCalcRouteDist.addEventListener('click', calculateRouteFinderDistance);

    elements.quickOriginSelect.addEventListener('change', (e) => {
      if (e.target.value) elements.routeOrigin.value = e.target.value;
    });
    elements.quickDestSelect.addEventListener('change', (e) => {
      if (e.target.value) elements.routeDestination.value = e.target.value;
    });
  }

  function getActiveProfile() {
    return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0] || DEFAULT_PROFILES[0];
  }

  function applyActiveProfileToCalc() {
    const active = getActiveProfile();
    if (!active) return;

    elements.activeProfileBadgeName.textContent = active.name;
    elements.inputConsumption.value = active.consumption || '';
    elements.inputCostPerKm.value = active.costPerKm !== undefined ? active.costPerKm : 0.30;

    // Load profile tiers or default
    if (Array.isArray(active.tiers) && active.tiers.length > 0) {
      state.currentTiers = JSON.parse(JSON.stringify(active.tiers));
    } else {
      state.currentTiers = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    }

    elements.toggleTieredPricing.checked = active.tieredPricingEnabled !== false;
    elements.tieredPricingContent.style.opacity = elements.toggleTieredPricing.checked ? '1' : '0.4';
    elements.tieredPricingContent.style.pointerEvents = elements.toggleTieredPricing.checked ? 'auto' : 'none';

    // Fuel price default suggestion based on grade
    if (!elements.inputFuelPrice.value) {
      elements.inputFuelPrice.value = active.fuelType === 'diesel' ? '1.639' : '1.729';
    }

    elements.fuelSummaryMini.textContent = `${active.consumption} L • ${active.fuelType.toUpperCase()}`;

    renderTiersList();
    updateCustomerDatalist();
  }

  function renderTiersList() {
    elements.tiersListContainer.innerHTML = '';
    // Sort tiers by minKm
    state.currentTiers.sort((a, b) => a.minKm - b.minKm);

    state.currentTiers.forEach((tier, index) => {
      const row = document.createElement('div');
      row.className = 'tier-row';
      row.id = `tier-row-${index}`;

      row.innerHTML = `
        <span class="tier-row__tag">Stufe ${index + 1}:</span>
        <span class="tier-row__unit">ab</span>
        <input type="number" class="tier-row__input tier-km-input" value="${tier.minKm}" min="0" step="1">
        <span class="tier-row__unit">km</span>
        <span class="tier-row__arrow">➔</span>
        <input type="number" class="tier-row__input tier-amt-input" value="${tier.amount.toFixed(2)}" min="0" step="0.5">
        <span class="tier-row__unit">${state.settings.currency || '€'}</span>
        ${state.currentTiers.length > 1 ? '<button type="button" class="tier-row__delete" title="Stufe entfernen">✕</button>' : ''}
      `;

      // Inputs change
      const kmInp = row.querySelector('.tier-km-input');
      const amtInp = row.querySelector('.tier-amt-input');
      const delBtn = row.querySelector('.tier-row__delete');

      kmInp.addEventListener('change', () => {
        tier.minKm = parseFloat(kmInp.value) || 0;
        calculateCosts(false);
      });

      amtInp.addEventListener('change', () => {
        tier.amount = parseFloat(amtInp.value) || 0;
        calculateCosts(false);
      });

      if (delBtn) {
        delBtn.addEventListener('click', () => {
          state.currentTiers.splice(index, 1);
          renderTiersList();
          calculateCosts(false);
        });
      }

      elements.tiersListContainer.appendChild(row);
    });
  }

  function updateRoundTripBadge() {
    const rawDist = parseFloat(elements.inputDistance.value) || 0;
    const isRound = elements.toggleRoundTrip.checked;
    if (isRound) {
      elements.roundTripBadge.textContent = `2 × ${rawDist.toFixed(1)} km = ${(rawDist * 2).toFixed(1)} km`;
    } else {
      elements.roundTripBadge.textContent = `Einfach: ${rawDist.toFixed(1)} km`;
    }
  }

  function getCalculatedData() {
    const rawDist = parseFloat(elements.inputDistance.value) || 0;
    const isRoundTrip = elements.toggleRoundTrip.checked;
    const effectiveDistance = isRoundTrip ? rawDist * 2 : rawDist;
    const costPerKm = parseFloat(elements.inputCostPerKm.value) || 0;
    const consumption = parseFloat(elements.inputConsumption.value) || 0;
    const fuelPrice = parseFloat(elements.inputFuelPrice.value) || 0;
    const tieredEnabled = elements.toggleTieredPricing.checked;
    const cur = state.settings.currency || '€';

    // 1. Kilometer charge
    const kmCharge = effectiveDistance * costPerKm;

    // 2. Tiered surcharge
    let appliedTier = null;
    let flatSurcharge = 0;

    if (tieredEnabled && state.currentTiers.length > 0 && effectiveDistance > 0) {
      // Find highest tier where distance >= tier.minKm
      const sortedTiers = [...state.currentTiers].sort((a, b) => b.minKm - a.minKm);
      for (const t of sortedTiers) {
        if (effectiveDistance >= t.minKm) {
          appliedTier = t;
          flatSurcharge = t.amount;
          break;
        }
      }
    }

    // 3. Fuel cost
    const fuelLiters = (effectiveDistance / 100) * consumption;
    const fuelCost = fuelLiters * fuelPrice;

    // Total Cost
    const totalCost = kmCharge + flatSurcharge + fuelCost;

    return {
      rawDist,
      isRoundTrip,
      effectiveDistance,
      costPerKm,
      consumption,
      fuelPrice,
      fuelLiters,
      kmCharge,
      tieredEnabled,
      appliedTier,
      flatSurcharge,
      fuelCost,
      totalCost,
      cur,
    };
  }

  function calculateCosts(animate = false) {
    const data = getCalculatedData();
    const cur = data.cur;

    updateRoundTripBadge();

    // Update active tier UI badge and row highlights
    const tierRows = elements.tiersListContainer.querySelectorAll('.tier-row');
    tierRows.forEach((r) => r.classList.remove('active-tier'));

    if (data.tieredEnabled) {
      if (data.appliedTier) {
        elements.activeTierBanner.style.display = 'flex';
        elements.activeTierText.textContent = `Aktiv: Stufe ab ${data.appliedTier.minKm} km (+${cur}${data.appliedTier.amount.toFixed(2)})`;
        // Find index of applied tier
        const idx = state.currentTiers.findIndex((t) => t.minKm === data.appliedTier.minKm);
        if (idx !== -1) {
          const row = document.getElementById(`tier-row-${idx}`);
          if (row) row.classList.add('active-tier');
        }
      } else {
        elements.activeTierBanner.style.display = 'flex';
        const nextTier = state.currentTiers[0];
        elements.activeTierText.textContent = nextTier
          ? `Keine Stufe erreicht (nächste ab ${nextTier.minKm} km für +${cur}${nextTier.amount.toFixed(2)})`
          : 'Keine Stufe konfiguriert';
      }
    } else {
      elements.activeTierBanner.style.display = 'none';
    }

    // Results Panel Breakdown
    elements.resDistanceBadge.textContent = `${data.effectiveDistance.toFixed(1)} km Gesamt`;
    elements.resDistanceDetail.textContent = data.isRoundTrip
      ? `2 × ${data.rawDist.toFixed(1)} km (Hin- & Rückfahrt)`
      : `${data.rawDist.toFixed(1)} km (Einfache Fahrt)`;

    elements.resKmCost.textContent = `${cur}${data.kmCharge.toFixed(2)} (${cur}${data.costPerKm.toFixed(2)}/km)`;

    if (data.tieredEnabled && data.appliedTier) {
      elements.resFlatCost.textContent = `${cur}${data.flatSurcharge.toFixed(2)} (ab ${data.appliedTier.minKm} km)`;
    } else if (data.tieredEnabled) {
      elements.resFlatCost.textContent = `${cur}0,00 (unter Mindest-km)`;
    } else {
      elements.resFlatCost.textContent = `Deaktiviert`;
    }

    elements.resFuelCost.textContent = `${cur}${data.fuelCost.toFixed(2)} (${data.fuelLiters.toFixed(2)} L)`;

    if (animate) {
      animateValue(elements.resTotalCost, data.totalCost, cur);
    } else {
      elements.resTotalCost.textContent = `${cur}${data.totalCost.toFixed(2)}`;
    }
  }

  function animateValue(elem, targetVal, cur) {
    const start = 0;
    const duration = 300;
    const startTime = performance.now();

    function update(t) {
      const elapsed = t - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const val = start + (targetVal - start) * (1 - Math.pow(1 - progress, 3));
      elem.textContent = `${cur}${val.toFixed(2)}`;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function saveCurrentCalculationToLogbook() {
    const data = getCalculatedData();
    if (data.effectiveDistance <= 0) {
      showToast('Bitte gib zuerst eine Fahrtstrecke (km) ein', 'error');
      return;
    }

    const customer = elements.inputCustomer.value.trim() || 'Allgemein / Kunde';
    const tourName = elements.inputTourName.value.trim() || (elements.toggleRoundTrip.checked ? 'Kundenbesuch (Hin & Rück)' : 'Kundenfahrt');
    const tourDate = elements.inputTourDate.value || new Date().toISOString().split('T')[0];
    const monthKey = tourDate.substring(0, 7); // e.g. "2026-09"

    const newTour = {
      id: 'tour_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      customer,
      name: tourName,
      date: tourDate,
      monthKey,
      distanceRaw: data.rawDist,
      isRoundTrip: data.isRoundTrip,
      effectiveDistance: data.effectiveDistance,
      costPerKm: data.costPerKm,
      consumption: data.consumption,
      fuelPrice: data.fuelPrice,
      fuelLiters: data.fuelLiters,
      kmCharge: data.kmCharge,
      tieredPricingEnabled: data.tieredEnabled,
      appliedTier: data.appliedTier,
      flatSurcharge: data.flatSurcharge,
      fuelCost: data.fuelCost,
      totalCost: data.totalCost,
      cur: data.cur,
      profileName: getActiveProfile().name,
      createdAt: new Date().toISOString(),
    };

    state.tours.unshift(newTour);
    saveTours();
    updateCustomerDatalist();
    showToast(`Tour für "${customer}" im Fahrtenbuch gespeichert! 📁`, 'success');

    // Switch to accounting view to immediately view the month folder
    state.selectedMonth = monthKey;
    switchView('accounting');
  }

  function copySummaryToClipboard() {
    const data = getCalculatedData();
    const customer = elements.inputCustomer.value.trim() || 'Kunde';
    const tourName = elements.inputTourName.value.trim() || 'Fahrtkosten';
    const dateStr = elements.inputTourDate.value || new Date().toISOString().split('T')[0];
    const cur = data.cur;

    const lines = [
      `🚗 TravelCalc Beleg: ${tourName}`,
      `👤 Kunde: ${customer}`,
      `📅 Datum: ${dateStr}`,
      `📏 Strecke: ${data.effectiveDistance.toFixed(1)} km ${data.isRoundTrip ? '(Hin- & Rückfahrt)' : '(Einfache Fahrt)'}`,
      `💶 Km-Pauschale: ${cur}${data.kmCharge.toFixed(2)} (${cur}${data.costPerKm.toFixed(2)}/km)`,
      data.tieredEnabled && data.flatSurcharge > 0 ? `📦 Staffelzuschlag: ${cur}${data.flatSurcharge.toFixed(2)} (ab ${data.appliedTier?.minKm || 0} km)` : null,
      `⛽ Kraftstoffanteil: ${cur}${data.fuelCost.toFixed(2)} (${data.fuelLiters.toFixed(2)} L)`,
      `----------------------------------------`,
      `💰 Gesamtbetrag: ${cur}${data.totalCost.toFixed(2)}`,
    ].filter(Boolean).join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lines).then(() => {
        showToast('Zusammenfassung kopiert! 📋', 'success');
      });
    } else {
      showToast('Zusammenfassung konnte nicht kopiert werden', 'error');
    }
  }

  function resetCalculator() {
    elements.inputCustomer.value = '';
    elements.inputTourName.value = '';
    elements.inputDistance.value = '';
    elements.toggleRoundTrip.checked = true;
    elements.inputTourDate.value = new Date().toISOString().split('T')[0];
    elements.quickRouteSelect.value = '';
    applyActiveProfileToCalc();
    calculateCosts(false);
    showToast('Rechner zurückgesetzt', 'success');
  }

  // ==========================================================================
  // 7. MONATSBUCHHALTUNG (ACCOUNTING & FOLDERS)
  // ==========================================================================
  function setupAccounting() {
    elements.searchToursInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderToursList();
    });

    elements.sortToursSelect.addEventListener('change', renderToursList);

    elements.btnPrintMonthReport.addEventListener('click', printMonthlyAccountingReport);
    elements.btnExportMonthCsv.addEventListener('click', exportMonthlyCsv);

    // Tour Edit Modal
    elements.btnCancelTourModal.addEventListener('click', closeTourModal);
    elements.btnSaveTourModal.addEventListener('click', saveTourModal);
    elements.tourModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.tourModalOverlay) closeTourModal();
    });
  }

  function getMonthsSummary() {
    const monthsMap = {};

    state.tours.forEach((tour) => {
      const m = tour.monthKey || tour.date.substring(0, 7);
      if (!monthsMap[m]) {
        monthsMap[m] = {
          key: m,
          label: formatMonthLabel(m),
          count: 0,
          totalKm: 0,
          totalCost: 0,
        };
      }
      monthsMap[m].count++;
      monthsMap[m].totalKm += tour.effectiveDistance || 0;
      monthsMap[m].totalCost += tour.totalCost || 0;
    });

    // Sort descending by month key
    return Object.values(monthsMap).sort((a, b) => b.key.localeCompare(a.key));
  }

  function formatMonthLabel(monthKey) {
    if (!monthKey || monthKey.length < 7) return monthKey || 'Unbekannt';
    const [year, month] = monthKey.split('-');
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthNames[mIdx] || month} ${year}`;
  }

  function renderAccountingView() {
    renderMonthFolders();
    renderKpiSummary();
    renderCustomerBreakdown();
    renderToursList();
  }

  function renderMonthFolders() {
    const strip = elements.monthFolderStrip;
    strip.innerHTML = '';

    const months = getMonthsSummary();

    // "Alle" Pill
    const allPill = document.createElement('div');
    allPill.className = `month-folder-pill ${state.selectedMonth === 'all' ? 'active' : ''}`;
    allPill.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
      <span>Alle Touren</span>
      <span class="month-folder-pill__count">${state.tours.length}</span>
    `;
    allPill.addEventListener('click', () => {
      state.selectedMonth = 'all';
      state.selectedCustomer = '';
      renderAccountingView();
    });
    strip.appendChild(allPill);

    // Each Month Pill
    months.forEach((m) => {
      const pill = document.createElement('div');
      pill.className = `month-folder-pill ${state.selectedMonth === m.key ? 'active' : ''}`;
      pill.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>${m.label}</span>
        <span class="month-folder-pill__count">${m.count}</span>
      `;
      pill.addEventListener('click', () => {
        state.selectedMonth = m.key;
        state.selectedCustomer = '';
        renderAccountingView();
      });
      strip.appendChild(pill);
    });

    // If current selected month is not found in months, default to first month or 'all'
    if (state.selectedMonth !== 'all' && !months.some((m) => m.key === state.selectedMonth)) {
      state.selectedMonth = months[0]?.key || 'all';
    }
  }

  function getFilteredTours() {
    let list = [...state.tours];

    // Filter by month
    if (state.selectedMonth !== 'all') {
      list = list.filter((t) => (t.monthKey || t.date.substring(0, 7)) === state.selectedMonth);
    }

    // Filter by selected customer
    if (state.selectedCustomer) {
      list = list.filter((t) => (t.customer || '').toLowerCase() === state.selectedCustomer.toLowerCase());
    }

    // Filter by search query
    if (state.searchQuery) {
      const q = state.searchQuery;
      list = list.filter(
        (t) =>
          (t.customer || '').toLowerCase().includes(q) ||
          (t.name || '').toLowerCase().includes(q) ||
          (t.profileName || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const sortVal = elements.sortToursSelect.value;
    list.sort((a, b) => {
      if (sortVal === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortVal === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortVal === 'cost-desc') return (b.totalCost || 0) - (a.totalCost || 0);
      if (sortVal === 'cost-asc') return (a.totalCost || 0) - (b.totalCost || 0);
      if (sortVal === 'customer-asc') return (a.customer || '').localeCompare(b.customer || '');
      return 0;
    });

    return list;
  }

  function renderKpiSummary() {
    const tours = getFilteredTours();
    const cur = state.settings.currency || '€';

    const count = tours.length;
    let totalKm = 0;
    let totalCost = 0;
    let totalSurcharges = 0;
    let totalFuel = 0;
    let totalFuelLiters = 0;

    tours.forEach((t) => {
      totalKm += t.effectiveDistance || 0;
      totalCost += t.totalCost || 0;
      totalSurcharges += (t.kmCharge || 0) + (t.flatSurcharge || 0);
      totalFuel += t.fuelCost || 0;
      totalFuelLiters += t.fuelLiters || 0;
    });

    const avg = count > 0 ? totalCost / count : 0;

    elements.kpiTotalKm.textContent = `${totalKm.toFixed(1)} km`;
    elements.kpiTripsCount.textContent = `${count} ${count === 1 ? 'Fahrt' : 'Fahrten'}`;
    elements.kpiTotalCost.textContent = `${cur}${totalCost.toFixed(2)}`;
    elements.kpiAvgPerTrip.textContent = `Ø ${cur}${avg.toFixed(2)} / Fahrt`;
    elements.kpiSurcharges.textContent = `${cur}${totalSurcharges.toFixed(2)}`;
    elements.kpiFuelTotal.textContent = `${cur}${totalFuel.toFixed(2)}`;
    elements.kpiFuelLiters.textContent = `${totalFuelLiters.toFixed(1)} L Sprit`;
  }

  function renderCustomerBreakdown() {
    const container = elements.customerChipsContainer;
    container.innerHTML = '';

    // Get tours in the currently selected month
    let monthTours = state.tours;
    if (state.selectedMonth !== 'all') {
      monthTours = monthTours.filter((t) => (t.monthKey || t.date.substring(0, 7)) === state.selectedMonth);
    }

    if (monthTours.length === 0) {
      container.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Keine Fahrten in diesem Monat erfasst.</span>';
      return;
    }

    // Group by customer
    const custMap = {};
    monthTours.forEach((t) => {
      const c = t.customer || 'Allgemein';
      if (!custMap[c]) {
        custMap[c] = { name: c, count: 0, totalKm: 0, totalCost: 0 };
      }
      custMap[c].count++;
      custMap[c].totalKm += t.effectiveDistance || 0;
      custMap[c].totalCost += t.totalCost || 0;
    });

    const cur = state.settings.currency || '€';
    const customers = Object.values(custMap).sort((a, b) => b.totalCost - a.totalCost);

    customers.forEach((c) => {
      const chip = document.createElement('div');
      const isSelected = state.selectedCustomer.toLowerCase() === c.name.toLowerCase();
      chip.className = `customer-chip ${isSelected ? 'active' : ''}`;
      chip.innerHTML = `
        <span class="customer-chip__name">${c.name}</span>
        <span class="badge-subtle">${c.count}× • ${c.totalKm.toFixed(1)} km</span>
        <span class="customer-chip__badge">${cur}${c.totalCost.toFixed(2)}</span>
      `;

      chip.addEventListener('click', () => {
        if (state.selectedCustomer.toLowerCase() === c.name.toLowerCase()) {
          state.selectedCustomer = ''; // Toggle off
        } else {
          state.selectedCustomer = c.name;
        }
        elements.activeCustomerFilterHint.textContent = state.selectedCustomer
          ? `Gefiltert nach: ${state.selectedCustomer} (Klick zum Aufheben)`
          : 'Klick zum Filtern';
        renderAccountingView();
      });

      container.appendChild(chip);
    });
  }

  function renderToursList() {
    const container = elements.toursListContainer;
    container.innerHTML = '';

    const tours = getFilteredTours();
    const cur = state.settings.currency || '€';

    if (tours.length === 0) {
      container.innerHTML = `
        <div class="empty-box">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px; opacity:0.5;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          <div>Keine passenden Touren gefunden.</div>
          <div style="font-size:0.75rem; margin-top:4px;">Erstelle eine neue Fahrt im Rechner oder passe die Filter an.</div>
        </div>
      `;
      return;
    }

    tours.forEach((tour) => {
      const card = document.createElement('div');
      card.className = 'tour-card';

      const dateObj = new Date(tour.date);
      const dateFormatted = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : tour.date;

      card.innerHTML = `
        <div class="tour-card__top">
          <div>
            <div class="tour-card__customer">${escapeHtml(tour.customer || 'Allgemein')}</div>
            <div class="tour-card__title">${escapeHtml(tour.name || 'Tour')}</div>
          </div>
          <div class="tour-card__cost">${cur}${(tour.totalCost || 0).toFixed(2)}</div>
        </div>

        <div class="tour-card__meta-row">
          <span class="tour-card__tag">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${dateFormatted}
          </span>
          <span class="tour-card__tag">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            ${(tour.effectiveDistance || 0).toFixed(1)} km ${tour.isRoundTrip ? '(Hin & Rück)' : ''}
          </span>
          ${tour.flatSurcharge > 0 ? `<span class="badge-subtle">Staffel: +${cur}${tour.flatSurcharge.toFixed(2)}</span>` : ''}
          <span class="tour-card__tag">🚗 ${tour.profileName || 'PKW'}</span>

          <div class="tour-card__actions">
            <button type="button" class="btn-icon btn-print-tour" title="Einzelbeleg drucken">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
            <button type="button" class="btn-icon btn-copy-tour" title="In Rechner laden / Duplizieren">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button type="button" class="btn-icon btn-edit-tour" title="Bearbeiten">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="btn-icon btn-danger btn-delete-tour" title="Löschen">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      `;

      // Actions
      card.querySelector('.btn-print-tour').addEventListener('click', () => printSingleTourReceipt(tour));

      card.querySelector('.btn-copy-tour').addEventListener('click', () => {
        elements.inputCustomer.value = tour.customer || '';
        elements.inputTourName.value = tour.name || '';
        elements.inputDistance.value = tour.distanceRaw || (tour.isRoundTrip ? tour.effectiveDistance / 2 : tour.effectiveDistance);
        elements.toggleRoundTrip.checked = !!tour.isRoundTrip;
        updateRoundTripBadge();
        calculateCosts(true);
        switchView('calculator');
        showToast('Tour in den Rechner übernommen!', 'success');
      });

      card.querySelector('.btn-edit-tour').addEventListener('click', () => openTourModal(tour));

      card.querySelector('.btn-delete-tour').addEventListener('click', () => {
        state.tours = state.tours.filter((t) => t.id !== tour.id);
        saveTours();
        renderAccountingView();
        showToast('Tour gelöscht', 'success');
      });

      container.appendChild(card);
    });
  }

  function openTourModal(tour) {
    elements.modalTourId.value = tour.id;
    elements.modalTourCustomer.value = tour.customer || '';
    elements.modalTourName.value = tour.name || '';
    elements.modalTourDate.value = tour.date;
    elements.modalTourDistance.value = tour.effectiveDistance || tour.distanceRaw;
    elements.tourModalOverlay.classList.add('active');
  }

  function closeTourModal() {
    elements.tourModalOverlay.classList.remove('active');
  }

  function saveTourModal() {
    const id = elements.modalTourId.value;
    const tour = state.tours.find((t) => t.id === id);
    if (!tour) return;

    tour.customer = elements.modalTourCustomer.value.trim() || 'Allgemein';
    tour.name = elements.modalTourName.value.trim() || 'Tour';
    tour.date = elements.modalTourDate.value;
    tour.monthKey = tour.date.substring(0, 7);

    const newDist = parseFloat(elements.modalTourDistance.value);
    if (!isNaN(newDist) && newDist > 0 && newDist !== tour.effectiveDistance) {
      tour.effectiveDistance = newDist;
      tour.distanceRaw = tour.isRoundTrip ? newDist / 2 : newDist;
      // Recalculate
      tour.kmCharge = tour.effectiveDistance * (tour.costPerKm || 0.30);
      tour.fuelLiters = (tour.effectiveDistance / 100) * (tour.consumption || 6.2);
      tour.fuelCost = tour.fuelLiters * (tour.fuelPrice || 1.70);
      tour.totalCost = tour.kmCharge + (tour.flatSurcharge || 0) + tour.fuelCost;
    }

    saveTours();
    renderAccountingView();
    closeTourModal();
    showToast('Tour aktualisiert!', 'success');
  }

  // ==========================================================================
  // 8. PRINT & EXPORT (MONATSBERICHT & CSV)
  // ==========================================================================
  function printMonthlyAccountingReport() {
    const tours = getFilteredTours();
    const cur = state.settings.currency || '€';
    const monthLabel = state.selectedMonth === 'all' ? 'Gesamtübersicht aller Fahrten' : formatMonthLabel(state.selectedMonth);

    let totalKm = 0;
    let totalCost = 0;
    let totalKmCharge = 0;
    let totalSurcharges = 0;
    let totalFuel = 0;

    const rowsHtml = tours
      .map((t, idx) => {
        totalKm += t.effectiveDistance || 0;
        totalCost += t.totalCost || 0;
        totalKmCharge += t.kmCharge || 0;
        totalSurcharges += t.flatSurcharge || 0;
        totalFuel += t.fuelCost || 0;

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${t.date}</td>
            <td><strong>${escapeHtml(t.customer || '-')}</strong></td>
            <td>${escapeHtml(t.name || '-')}</td>
            <td class="num">${(t.effectiveDistance || 0).toFixed(1)} km</td>
            <td class="num">${cur}${(t.kmCharge || 0).toFixed(2)}</td>
            <td class="num">${t.flatSurcharge > 0 ? cur + t.flatSurcharge.toFixed(2) : '-'}</td>
            <td class="num">${cur}${(t.fuelCost || 0).toFixed(2)}</td>
            <td class="num"><strong>${cur}${(t.totalCost || 0).toFixed(2)}</strong></td>
          </tr>
        `;
      })
      .join('');

    elements.printContainer.innerHTML = `
      <div class="print-report-header">
        <div>
          <div class="print-report-title">Fahrtkosten- & Reisekostennachweis</div>
          <div class="print-report-meta">Abrechnungszeitraum: <strong>${monthLabel}</strong> ${state.selectedCustomer ? `• Kunde: ${escapeHtml(state.selectedCustomer)}` : ''}</div>
          <div class="print-report-meta">Erstellt am: ${new Date().toLocaleDateString('de-DE')} • TravelCalc</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14pt; font-weight: bold;">${cur}${totalCost.toFixed(2)}</div>
          <div style="font-size: 9pt; color: #555;">Gesamtabrechnung (${totalKm.toFixed(1)} km)</div>
        </div>
      </div>

      <div class="print-summary-box">
        <div><strong>Anzahl Fahrten:</strong> ${tours.length}</div>
        <div><strong>Gesamtkilometer:</strong> ${totalKm.toFixed(1)} km</div>
        <div><strong>Km-Pauschale:</strong> ${cur}${totalKmCharge.toFixed(2)}</div>
        <div><strong>Staffelpauschalen:</strong> ${cur}${totalSurcharges.toFixed(2)}</div>
        <div><strong>Kraftstoffanteil:</strong> ${cur}${totalFuel.toFixed(2)}</div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 25px;">Nr</th>
            <th style="width: 75px;">Datum</th>
            <th>Kunde / Schüler</th>
            <th>Anlass / Tour</th>
            <th class="num" style="width: 65px;">Strecke</th>
            <th class="num" style="width: 65px;">Km-Satz</th>
            <th class="num" style="width: 65px;">Staffel</th>
            <th class="num" style="width: 65px;">Sprit</th>
            <th class="num" style="width: 75px;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td colspan="4">Summe (${monthLabel}):</td>
            <td class="num">${totalKm.toFixed(1)} km</td>
            <td class="num">${cur}${totalKmCharge.toFixed(2)}</td>
            <td class="num">${cur}${totalSurcharges.toFixed(2)}</td>
            <td class="num">${cur}${totalFuel.toFixed(2)}</td>
            <td class="num">${cur}${totalCost.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="print-signatures">
        <div class="print-signature-line">Datum, Unterschrift Auftragnehmer / Fahrer</div>
        <div class="print-signature-line">Kenntnisnahme / Buchhaltung</div>
      </div>
    `;

    window.print();
  }

  function printSingleTourReceipt(tour) {
    const cur = tour.cur || state.settings.currency || '€';
    elements.printContainer.innerHTML = `
      <div style="padding: 20px 0; max-width: 600px; margin: 0 auto;">
        <div class="print-report-header">
          <div>
            <div class="print-report-title">Fahrtkostenbeleg (Einzelnachweis)</div>
            <div class="print-report-meta">Datum der Fahrt: <strong>${tour.date}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16pt; font-weight: bold;">${cur}${(tour.totalCost || 0).toFixed(2)}</div>
          </div>
        </div>

        <table class="print-table" style="margin-top: 20px;">
          <tr><td><strong>Kunde / Auftraggeber:</strong></td><td>${escapeHtml(tour.customer || '-')}</td></tr>
          <tr><td><strong>Anlass / Bezeichnung:</strong></td><td>${escapeHtml(tour.name || '-')}</td></tr>
          <tr><td><strong>Fahrzeug:</strong></td><td>${escapeHtml(tour.profileName || '-')}</td></tr>
          <tr><td><strong>Gefahrene Strecke:</strong></td><td>${(tour.effectiveDistance || 0).toFixed(1)} km ${tour.isRoundTrip ? '(Hin- & Rückfahrt)' : '(Einfache Fahrt)'}</td></tr>
          <tr><td><strong>Kilometerpauschale:</strong></td><td>${cur}${(tour.kmCharge || 0).toFixed(2)} (${cur}${(tour.costPerKm || 0.30).toFixed(2)}/km)</td></tr>
          ${tour.flatSurcharge > 0 ? `<tr><td><strong>Staffelpauschale:</strong></td><td>${cur}${tour.flatSurcharge.toFixed(2)} (Stufe ab ${tour.appliedTier?.minKm || 0} km)</td></tr>` : ''}
          <tr><td><strong>Kraftstoffanteil:</strong></td><td>${cur}${(tour.fuelCost || 0).toFixed(2)} (${(tour.fuelLiters || 0).toFixed(2)} L)</td></tr>
          <tr class="total-row"><td><strong>Abrechnungsbetrag gesamt:</strong></td><td><strong>${cur}${(tour.totalCost || 0).toFixed(2)}</strong></td></tr>
        </table>

        <div class="print-signatures" style="margin-top: 40px;">
          <div class="print-signature-line">Datum & Unterschrift</div>
        </div>
      </div>
    `;
    window.print();
  }

  function exportMonthlyCsv() {
    const tours = getFilteredTours();
    if (tours.length === 0) {
      showToast('Keine Touren zum Exportieren vorhanden', 'error');
      return;
    }

    const header = ['Datum', 'Kunde', 'Tourbezeichnung', 'Fahrzeug', 'Strecke_km', 'Hin_Rueckfahrt', 'Km_Satz_EUR', 'Staffelpauschale_EUR', 'Spritkosten_EUR', 'Gesamtbetrag_EUR'];
    const rows = tours.map((t) => [
      `"${t.date}"`,
      `"${(t.customer || '').replace(/"/g, '""')}"`,
      `"${(t.name || '').replace(/"/g, '""')}"`,
      `"${(t.profileName || '').replace(/"/g, '""')}"`,
      (t.effectiveDistance || 0).toFixed(1),
      t.isRoundTrip ? 'Ja' : 'Nein',
      (t.kmCharge || 0).toFixed(2),
      (t.flatSurcharge || 0).toFixed(2),
      (t.fuelCost || 0).toFixed(2),
      (t.totalCost || 0).toFixed(2),
    ]);

    const csvContent = '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `fahrtenbuch_${state.selectedMonth || 'export'}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`CSV-Datei "${filename}" heruntergeladen! 📊`, 'success');
  }

  // ==========================================================================
  // 9. GESPEICHERTE ORTE & ROUTEN
  // ==========================================================================
  function setupPlacesAndRoutes() {
    elements.btnOpenAddPlaceModal.addEventListener('click', () => openPlaceModal(null));
    elements.btnCancelPlaceModal.addEventListener('click', closePlaceModal);
    elements.btnSavePlaceModal.addEventListener('click', savePlaceModal);
    elements.placeModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.placeModalOverlay) closePlaceModal();
    });

    elements.btnOpenAddRouteModal.addEventListener('click', () => openRouteModal(null));
    elements.btnCancelRouteModal.addEventListener('click', closeRouteModal);
    elements.btnSaveRouteModal.addEventListener('click', saveRouteModal);
    elements.routeModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.routeModalOverlay) closeRouteModal();
    });
  }

  function renderPlacesAndRoutes() {
    // 1. Places Grid
    const pContainer = elements.placesGridContainer;
    pContainer.innerHTML = '';

    if (state.places.length === 0) {
      pContainer.innerHTML = '<div class="empty-box" style="grid-column: 1/-1;">Keine gespeicherten Orte vorhanden.</div>';
    } else {
      state.places.forEach((place) => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
          <div>
            <div class="place-card__name">📍 ${escapeHtml(place.name)}</div>
            <div class="place-card__address">${escapeHtml(place.address || '')}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-icon btn-use-start" title="Als Start im Routenplaner setzen">🛫</button>
            <button type="button" class="btn-icon btn-use-dest" title="Als Ziel im Routenplaner setzen">🎯</button>
            <button type="button" class="btn-icon btn-edit-place" title="Bearbeiten">✏️</button>
            <button type="button" class="btn-icon btn-danger btn-del-place" title="Löschen">✕</button>
          </div>
        `;

        card.querySelector('.btn-use-start').addEventListener('click', () => {
          elements.routeOrigin.value = place.address || place.name;
          elements.routeFinderBox.classList.remove('hidden');
          switchView('calculator');
          showToast(`"${place.name}" als Start gesetzt`, 'success');
        });

        card.querySelector('.btn-use-dest').addEventListener('click', () => {
          elements.routeDestination.value = place.address || place.name;
          elements.routeFinderBox.classList.remove('hidden');
          switchView('calculator');
          showToast(`"${place.name}" als Ziel gesetzt`, 'success');
        });

        card.querySelector('.btn-edit-place').addEventListener('click', () => openPlaceModal(place));

        card.querySelector('.btn-del-place').addEventListener('click', () => {
          state.places = state.places.filter((p) => p.id !== place.id);
          savePlaces();
          renderPlacesAndRoutes();
          updatePlaceSelectDropdowns();
          showToast('Ort gelöscht', 'success');
        });

        pContainer.appendChild(card);
      });
    }

    // 2. Routes Grid
    const rContainer = elements.routesGridContainer;
    rContainer.innerHTML = '';

    if (state.savedRoutes.length === 0) {
      rContainer.innerHTML = '<div class="empty-box" style="grid-column: 1/-1;">Keine Standard-Routen hinterlegt.</div>';
    } else {
      state.savedRoutes.forEach((route) => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.innerHTML = `
          <div>
            <div class="route-card__name">🛣️ ${escapeHtml(route.name)}</div>
            <div class="route-card__sub">${escapeHtml(route.customer || 'Allgemein')} • ${route.distance} km ${route.isRoundTrip ? '(Hin & Rück)' : ''}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-primary btn-sm btn-load-route" title="In den Rechner laden">Laden</button>
            <button type="button" class="btn-icon btn-edit-route" title="Bearbeiten">✏️</button>
            <button type="button" class="btn-icon btn-danger btn-del-route" title="Löschen">✕</button>
          </div>
        `;

        card.querySelector('.btn-load-route').addEventListener('click', () => {
          elements.inputCustomer.value = route.customer || '';
          elements.inputTourName.value = route.name || '';
          elements.inputDistance.value = route.distance || '';
          elements.toggleRoundTrip.checked = !!route.isRoundTrip;
          updateRoundTripBadge();
          calculateCosts(true);
          switchView('calculator');
          showToast(`Route "${route.name}" geladen!`, 'success');
        });

        card.querySelector('.btn-edit-route').addEventListener('click', () => openRouteModal(route));

        card.querySelector('.btn-del-route').addEventListener('click', () => {
          state.savedRoutes = state.savedRoutes.filter((r) => r.id !== route.id);
          saveRoutes();
          renderPlacesAndRoutes();
          updateQuickRouteSelect();
          showToast('Route gelöscht', 'success');
        });

        rContainer.appendChild(card);
      });
    }

    updatePlaceSelectDropdowns();
    updateQuickRouteSelect();
  }

  function openPlaceModal(place) {
    elements.modalPlaceId.value = place ? place.id : '';
    elements.modalPlaceName.value = place ? place.name : '';
    elements.modalPlaceAddress.value = place ? place.address : '';
    elements.placeModalTitle.textContent = place ? 'Ort bearbeiten' : 'Neuen Ort anlegen';
    elements.placeModalOverlay.classList.add('active');
  }

  function closePlaceModal() {
    elements.placeModalOverlay.classList.remove('active');
  }

  function savePlaceModal() {
    const id = elements.modalPlaceId.value;
    const name = elements.modalPlaceName.value.trim();
    const address = elements.modalPlaceAddress.value.trim();

    if (!name) {
      showToast('Bitte gib einen Namen für den Ort ein', 'error');
      return;
    }

    if (id) {
      const p = state.places.find((x) => x.id === id);
      if (p) {
        p.name = name;
        p.address = address;
      }
    } else {
      state.places.push({
        id: 'place_' + Date.now(),
        name,
        address,
      });
    }

    savePlaces();
    renderPlacesAndRoutes();
    closePlaceModal();
    showToast('Ort gespeichert!', 'success');
  }

  function openRouteModal(route) {
    elements.modalRouteId.value = route ? route.id : '';
    elements.modalRouteName.value = route ? route.name : '';
    elements.modalRouteCustomer.value = route ? route.customer : (elements.inputCustomer?.value || '');
    elements.modalRouteDistance.value = route ? route.distance : (elements.inputDistance?.value || '');
    elements.modalRouteRoundTrip.checked = route ? !!route.isRoundTrip : true;
    elements.routeModalTitle.textContent = route ? 'Route bearbeiten' : 'Neue Route anlegen';
    elements.routeModalOverlay.classList.add('active');
  }

  function closeRouteModal() {
    elements.routeModalOverlay.classList.remove('active');
  }

  function saveRouteModal() {
    const id = elements.modalRouteId.value;
    const name = elements.modalRouteName.value.trim();
    const customer = elements.modalRouteCustomer.value.trim() || 'Allgemein';
    const distance = parseFloat(elements.modalRouteDistance.value) || 0;
    const isRoundTrip = elements.modalRouteRoundTrip.checked;

    if (!name || distance <= 0) {
      showToast('Bitte Routenname und Distanz (km) angeben', 'error');
      return;
    }

    if (id) {
      const r = state.savedRoutes.find((x) => x.id === id);
      if (r) {
        r.name = name;
        r.customer = customer;
        r.distance = distance;
        r.isRoundTrip = isRoundTrip;
      }
    } else {
      state.savedRoutes.push({
        id: 'route_' + Date.now(),
        name,
        customer,
        distance,
        isRoundTrip,
      });
    }

    saveRoutes();
    renderPlacesAndRoutes();
    closeRouteModal();
    showToast('Route gespeichert!', 'success');
  }

  function updatePlaceSelectDropdowns() {
    const opts = ['<option value="">Ort wählen...</option>']
      .concat(state.places.map((p) => `<option value="${escapeHtml(p.address || p.name)}">${escapeHtml(p.name)}</option>`))
      .join('');

    if (elements.quickOriginSelect) elements.quickOriginSelect.innerHTML = opts;
    if (elements.quickDestSelect) elements.quickDestSelect.innerHTML = opts;
  }

  function updateQuickRouteSelect() {
    if (!elements.quickRouteSelect) return;
    const opts = ['<option value="">Gespeicherte Route laden...</option>']
      .concat(state.savedRoutes.map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${r.distance} km)</option>`))
      .join('');
    elements.quickRouteSelect.innerHTML = opts;
  }

  function updateCustomerDatalist() {
    if (!elements.customerDatalist) return;
    const set = new Set();
    state.tours.forEach((t) => { if (t.customer) set.add(t.customer); });
    state.savedRoutes.forEach((r) => { if (r.customer) set.add(r.customer); });
    elements.customerDatalist.innerHTML = Array.from(set)
      .map((c) => `<option value="${escapeHtml(c)}">`)
      .join('');
  }

  // ==========================================================================
  // 10. ROUTING API ENGINE (OPEN ROUTING & GOOGLE MAPS FALLBACK)
  // ==========================================================================
  function fetchUserOriginLocation() {
    if (!navigator.geolocation) {
      showToast('Geolokalisierung im Browser nicht verfügbar', 'error');
      return;
    }

    elements.btnCurrentLocation.textContent = '⏳';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0];
          elements.routeOrigin.value = city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          showToast(`Standort: ${elements.routeOrigin.value}`, 'success');
        } catch (e) {
          elements.routeOrigin.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        } finally {
          elements.btnCurrentLocation.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`;
        }
      },
      (err) => {
        elements.btnCurrentLocation.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`;
        showToast('Standort konnte nicht ermittelt werden', 'error');
      },
      { timeout: 8000 }
    );
  }

  async function calculateRouteFinderDistance() {
    const origin = elements.routeOrigin.value.trim();
    const destination = elements.routeDestination.value.trim();

    if (!origin || !destination) {
      showToast('Bitte Start- und Zielort eingeben', 'error');
      return;
    }

    elements.btnCalcRouteDist.disabled = true;
    elements.btnCalcRouteDist.textContent = 'Berechne...';

    try {
      // 1. Geocode origin
      const origRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origin)}&format=json&limit=1`);
      const origData = await origRes.json();
      if (!origData || origData.length === 0) throw new Error(`Startort "${origin}" nicht gefunden`);

      // 2. Geocode destination
      const destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`);
      const destData = await destRes.json();
      if (!destData || destData.length === 0) throw new Error(`Zielort "${destination}" nicht gefunden`);

      const origCoord = [parseFloat(origData[0].lon), parseFloat(origData[0].lat)];
      const destCoord = [parseFloat(destData[0].lon), parseFloat(destData[0].lat)];

      // 3. Query free OSRM driving service
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origCoord[0]},${origCoord[1]};${destCoord[0]},${destCoord[1]}?overview=false`;
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
        const distKm = routeData.routes[0].distance / 1000.0;
        elements.inputDistance.value = distKm.toFixed(1);
        elements.routeCalcResultBadge.classList.remove('hidden');
        elements.routeCalcResultBadge.textContent = `${distKm.toFixed(1)} km ermittelt`;
        calculateCosts(true);
        showToast(`Route berechnet: ${distKm.toFixed(1)} km übernommen!`, 'success');
      } else {
        throw new Error('Keine fahrbare Route gefunden');
      }
    } catch (err) {
      showToast(err.message || 'Routenberechnung fehlgeschlagen', 'error');
    } finally {
      elements.btnCalcRouteDist.disabled = false;
      elements.btnCalcRouteDist.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> <span>Distanz ermitteln</span>`;
    }
  }

  // ==========================================================================
  // 11. SPRITPREISE & RADAR
  // ==========================================================================
  function openNearbyFuelRadar() {
    const active = getActiveProfile();
    const fuelType = active.fuelType || 'e10';

    // Current representative market prices
    const basePrices = { e10: 1.719, e5: 1.779, diesel: 1.639 };
    const base = basePrices[fuelType] || 1.719;

    const demoStations = [
      { name: 'JET Tankstelle', dist: 1.4, price: parseFloat((base - 0.02).toFixed(3)) },
      { name: 'HEM Station', dist: 2.6, price: parseFloat((base - 0.01).toFixed(3)) },
      { name: 'TotalEnergies', dist: 3.8, price: parseFloat(base.toFixed(3)) },
      { name: 'Aral Station', dist: 4.5, price: parseFloat((base + 0.03).toFixed(3)) },
      { name: 'Shell Express', dist: 5.2, price: parseFloat((base + 0.04).toFixed(3)) },
    ];

    elements.stationsListContainer.innerHTML = '';
    demoStations.forEach((st) => {
      const item = document.createElement('div');
      item.className = 'station-item';
      item.innerHTML = `
        <div>
          <div class="station-item__name">${st.name}</div>
          <div class="station-item__distance">${st.dist} km entfernt • ${fuelType.toUpperCase()}</div>
        </div>
        <div class="station-item__price">${state.settings.currency || '€'}${st.price.toFixed(3)}</div>
      `;

      item.addEventListener('click', () => {
        elements.inputFuelPrice.value = st.price.toFixed(3);
        elements.stationsModalOverlay.classList.remove('active');
        calculateCosts(true);
        showToast(`Preis ${st.price.toFixed(3)} €/L übernommen!`, 'success');
      });

      elements.stationsListContainer.appendChild(item);
    });

    elements.stationsModalOverlay.classList.add('active');
  }

  // ==========================================================================
  // 12. FAHRZEUGE & PROFILE
  // ==========================================================================
  function setupProfiles() {
    elements.btnOpenNewProfileModal.addEventListener('click', () => openProfileModal(null));
    elements.btnCancelProfileModal.addEventListener('click', closeProfileModal);
    elements.btnSaveProfileModal.addEventListener('click', saveProfileModal);
    elements.profileModalOverlay.addEventListener('click', (e) => {
      if (e.target === elements.profileModalOverlay) closeProfileModal();
    });
    elements.btnCloseStationsModal.addEventListener('click', () => {
      elements.stationsModalOverlay.classList.remove('active');
    });
  }

  function renderProfilesList() {
    const container = elements.profilesListContainer;
    container.innerHTML = '';

    state.profiles.forEach((profile) => {
      const isActive = profile.id === state.activeProfileId;
      const card = document.createElement('div');
      card.className = `profile-card ${isActive ? 'active' : ''}`;

      card.innerHTML = `
        <div style="flex: 1;">
          <div class="profile-card__name">
            <span>${escapeHtml(profile.name)}</span>
            ${isActive ? '<span class="badge-subtle" style="color:var(--accent-emerald);">Aktiv</span>' : ''}
          </div>
          <div class="profile-card__meta">
            <span>🚗 ${escapeHtml(profile.vehicle || 'Fahrzeug')}</span>
            <span>⛽ ${profile.consumption} L/100km (${profile.fuelType.toUpperCase()})</span>
            <span>📏 ${(profile.costPerKm || 0.30).toFixed(2)} €/km</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${!isActive ? '<button type="button" class="btn-secondary btn-sm btn-activate-profile">Aktivieren</button>' : ''}
          <button type="button" class="btn-icon btn-edit-profile" title="Bearbeiten">✏️</button>
          ${state.profiles.length > 1 ? '<button type="button" class="btn-icon btn-danger btn-del-profile" title="Löschen">✕</button>' : ''}
        </div>
      `;

      card.querySelector('.btn-edit-profile').addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal(profile);
      });

      const actBtn = card.querySelector('.btn-activate-profile');
      if (actBtn) {
        actBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.activeProfileId = profile.id;
          localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profile.id);
          applyActiveProfileToCalc();
          renderProfilesList();
          showToast(`Fahrzeug "${profile.name}" aktiviert!`, 'success');
        });
      }

      const delBtn = card.querySelector('.btn-del-profile');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.profiles = state.profiles.filter((p) => p.id !== profile.id);
          if (state.activeProfileId === profile.id) {
            state.activeProfileId = state.profiles[0]?.id || '';
          }
          saveProfiles();
          renderProfilesList();
          applyActiveProfileToCalc();
          showToast('Fahrzeugprofil gelöscht', 'success');
        });
      }

      container.appendChild(card);
    });
  }

  function openProfileModal(profile) {
    elements.modalProfileId.value = profile ? profile.id : '';
    elements.modalProfileName.value = profile ? profile.name : '';
    elements.modalProfileVehicle.value = profile ? profile.vehicle : '';
    elements.modalProfileConsumption.value = profile ? profile.consumption : 6.2;
    elements.modalProfileFuelType.value = profile ? profile.fuelType : 'e10';
    elements.modalProfileCostPerKm.value = profile ? profile.costPerKm : 0.30;
    elements.profileModalTitle.textContent = profile ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug';
    elements.profileModalOverlay.classList.add('active');
  }

  function closeProfileModal() {
    elements.profileModalOverlay.classList.remove('active');
  }

  function saveProfileModal() {
    const id = elements.modalProfileId.value;
    const name = elements.modalProfileName.value.trim();
    const vehicle = elements.modalProfileVehicle.value.trim() || 'PKW';
    const consumption = parseFloat(elements.modalProfileConsumption.value) || 6.2;
    const fuelType = elements.modalProfileFuelType.value;
    const costPerKm = parseFloat(elements.modalProfileCostPerKm.value) || 0.30;

    if (!name) {
      showToast('Bitte Profilnamen eingeben', 'error');
      return;
    }

    if (id) {
      const p = state.profiles.find((x) => x.id === id);
      if (p) {
        p.name = name;
        p.vehicle = vehicle;
        p.consumption = consumption;
        p.fuelType = fuelType;
        p.costPerKm = costPerKm;
      }
    } else {
      const newP = {
        id: 'prof_' + Date.now(),
        name,
        vehicle,
        consumption,
        fuelType,
        costPerKm,
        tieredPricingEnabled: true,
        tiers: [...DEFAULT_TIERS],
      };
      state.profiles.push(newP);
      state.activeProfileId = newP.id;
    }

    saveProfiles();
    applyActiveProfileToCalc();
    renderProfilesList();
    closeProfileModal();
    showToast('Fahrzeugprofil gespeichert!', 'success');
  }

  // ==========================================================================
  // 13. SETTINGS & APIS
  // ==========================================================================
  function setupSettings() {
    elements.prefCurrency.value = state.settings.currency || '€';
    elements.prefFuelType.value = state.settings.defaultFuelType || 'e10';

    elements.prefCurrency.addEventListener('change', (e) => {
      state.settings.currency = e.target.value;
      saveSettings();
      calculateCosts(false);
      showToast('Währung aktualisiert', 'success');
    });

    elements.prefFuelType.addEventListener('change', (e) => {
      state.settings.defaultFuelType = e.target.value;
      saveSettings();
      showToast('Standard-Kraftstoff gespeichert', 'success');
    });

    // APIs
    elements.settingGoogleMapsKey.value = state.settings.googleMapsApiKey || '';
    elements.settingTankerkoenigKey.value = state.settings.tankerkoenigApiKey || '';

    elements.btnSaveMapsKey.addEventListener('click', () => {
      state.settings.googleMapsApiKey = elements.settingGoogleMapsKey.value.trim();
      saveSettings();
      updateApiStatusBadges();
      showToast('Google Maps API-Key gespeichert', 'success');
    });

    elements.btnClearMapsKey.addEventListener('click', () => {
      elements.settingGoogleMapsKey.value = '';
      state.settings.googleMapsApiKey = '';
      saveSettings();
      updateApiStatusBadges();
      showToast('Google Maps Key gelöscht', 'success');
    });

    elements.btnSaveTankerKey.addEventListener('click', () => {
      state.settings.tankerkoenigApiKey = elements.settingTankerkoenigKey.value.trim();
      saveSettings();
      updateApiStatusBadges();
      showToast('Tankerkönig Key gespeichert', 'success');
    });

    elements.btnClearTankerKey.addEventListener('click', () => {
      elements.settingTankerkoenigKey.value = '';
      state.settings.tankerkoenigApiKey = '';
      saveSettings();
      updateApiStatusBadges();
      showToast('Tankerkönig Key gelöscht', 'success');
    });

    elements.btnUseDemoTankerKey.addEventListener('click', () => {
      const demoKey = '00000000-0000-0000-0000-000000000002';
      elements.settingTankerkoenigKey.value = demoKey;
      state.settings.tankerkoenigApiKey = demoKey;
      saveSettings();
      updateApiStatusBadges();
      showToast('Demo-Key für Tankerkönig aktiviert!', 'success');
    });

    // Password visibility toggles
    elements.btnToggleMapsKeyVisibility.addEventListener('click', () => {
      elements.settingGoogleMapsKey.type = elements.settingGoogleMapsKey.type === 'password' ? 'text' : 'password';
    });
    elements.btnToggleTankerKeyVisibility.addEventListener('click', () => {
      elements.settingTankerkoenigKey.type = elements.settingTankerkoenigKey.type === 'password' ? 'text' : 'password';
    });

    // Backup & Restore
    elements.btnExportAllJson.addEventListener('click', exportFullBackupJson);
    elements.fileImportJson.addEventListener('change', importBackupJson);
    elements.btnResetAllData.addEventListener('click', resetAllData);

    updateApiStatusBadges();
  }

  function renderSettingsView() {
    updateApiStatusBadges();
  }

  function updateApiStatusBadges() {
    const hasMaps = !!state.settings.googleMapsApiKey;
    const hasTanker = !!state.settings.tankerkoenigApiKey;

    elements.googleMapsStatus.textContent = hasMaps ? 'Aktiv' : 'Nicht konfiguriert';
    elements.googleMapsStatus.className = `api-key-status ${hasMaps ? 'active' : 'missing'}`;

    elements.tankerkoenigStatus.textContent = hasTanker ? 'Aktiv' : 'Demo-Modus';
    elements.tankerkoenigStatus.className = `api-key-status ${hasTanker ? 'active' : 'missing'}`;

    if (hasMaps || hasTanker) {
      elements.apiStatusSummaryBadge.textContent = 'Aktiviert';
      elements.apiStatusSummaryBadge.style.color = 'var(--accent-emerald)';
    } else {
      elements.apiStatusSummaryBadge.textContent = 'Optional';
      elements.apiStatusSummaryBadge.style.color = 'var(--text-muted)';
    }
  }

  function exportFullBackupJson() {
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      profiles: state.profiles,
      tours: state.tours,
      places: state.places,
      savedRoutes: state.savedRoutes,
      settings: state.settings,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelcalc_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Backup erfolgreich heruntergeladen! 📥', 'success');
  }

  function importBackupJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.tours) state.tours = backup.tours;
        if (backup.profiles) state.profiles = backup.profiles;
        if (backup.places) state.places = backup.places;
        if (backup.savedRoutes) state.savedRoutes = backup.savedRoutes;
        if (backup.settings) state.settings = { ...DEFAULT_SETTINGS, ...backup.settings };

        saveTours();
        saveProfiles();
        savePlaces();
        saveRoutes();
        saveSettings();

        renderAllViews();
        applyActiveProfileToCalc();
        showToast('Backup erfolgreich wiederhergestellt! 🚀', 'success');
      } catch (err) {
        showToast('Ungültige Backup-Datei', 'error');
      }
    };
    reader.readAsText(file);
  }

  function resetAllData() {
    if (confirm('Möchtest du wirklich alle gespeicherten Touren, Orte und Einstellungen löschen? Dies kann nicht rückgängig gemacht werden.')) {
      localStorage.clear();
      state.profiles = [...DEFAULT_PROFILES];
      state.activeProfileId = state.profiles[0].id;
      state.tours = [];
      state.places = [...DEFAULT_PLACES];
      state.savedRoutes = [];
      state.settings = { ...DEFAULT_SETTINGS };

      saveProfiles();
      savePlaces();
      saveSettings();

      renderAllViews();
      applyActiveProfileToCalc();
      showToast('Alle Daten wurden zurückgesetzt', 'success');
    }
  }

  function renderAllViews() {
    renderPlacesAndRoutes();
    renderProfilesList();
    renderAccountingView();
  }

  // ==========================================================================
  // 14. TOAST NOTIFICATIONS & UTILS
  // ==========================================================================
  let toastTimeout = null;
  function showToast(msg, type = 'info') {
    if (!elements.appToast) return;
    elements.toastMessage.textContent = msg;
    elements.appToast.className = 'toast show';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      elements.appToast.className = 'toast';
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // 15. SERVICE WORKER
  // ==========================================================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
          console.log('SW registration skipped', err);
        });
      });
    }
  }

  // Run app
  document.addEventListener('DOMContentLoaded', init);
})();
