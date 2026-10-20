/**
 * =====================================================================
 * MAVEN FREIGHT OS // СИСТЕМА УПРАВЛЕНИЯ ЛОГИСТИКОЙ И ДАЛЬНОБОЙЩИКАМИ
 * Multi-Agent Autonomous Dispatch Engine with Full RU / US Dual-Mode
 * =====================================================================
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Core State Configuration
  // -------------------------------------------------------------------
  const STATE = {
    mode: localStorage.getItem('maven_freight_mode') || 'ru', // 'ru' or 'us'
    apiOnline: false,
    factories: [],
    routes: [],
    shipments: [],
    allShipments: [],
    stats: {},
    agents: {},
    agentLogs: [],
    filters: {
      factory: 'ALL',
      shipMode: 'ALL',
      state: 'ALL',
      status: 'ALL',
      search: ''
    },
    pagination: {
      page: 1,
      pageSize: 12,
      totalPages: 1,
      totalCount: 0
    },
    sorting: {
      column: 'date',
      asc: false
    },
    map: null,
    baseMap: 'google-hybrid',
    baseMapLayer: null,
    mapLayers: {
      factories: null,
      routes: null,
      trucks: null,
      showRoutes: true,
      showFactories: true
    },
    charts: {
      factoryVolume: null,
      shippingModes: null,
      topCorridors: null
    },
    autoScrollLogs: true,
    dispatchCycleRunning: false
  };

  // ===================================================================
  // DATA DICTIONARIES: RUSSIAN FEDERATION (РФ)
  // ===================================================================

  const RU_FACTORIES = {
    "Красный Октябрь": {
      lat: 55.7415,
      lng: 37.6092,
      city: "Москва",
      region: "Москва и МО",
      color: "#ffb700",
      badgeClass: "krasny",
      products: "«Алёнка», «Вдохновение», «Мишка косолапый», «Красная Шапочка»",
      capacity: "96.5%",
      monthlyOutput: "64 200 коробов/мес",
      highway: "М-4 «Дон», М-11 «Нева»"
    },
    "Славянка": {
      lat: 51.2982,
      lng: 37.8344,
      city: "Старый Оскол",
      region: "Белгородская обл.",
      color: "#00f0ff",
      badgeClass: "slavyanka",
      products: "«Степ», «Золотой Степ», «Левушка», «Чудо»",
      capacity: "94.0%",
      monthlyOutput: "52 800 коробов/мес",
      highway: "М-2 «Крым», М-4 «Дон»"
    },
    "КДВ Яшкино": {
      lat: 55.8736,
      lng: 85.4264,
      city: "Яшкино",
      region: "Кемеровская обл.",
      color: "#00e676",
      badgeClass: "kdv",
      products: "«Яшкино вафли», «Яшкинские рулеты», «Бонди», «Ярче!»",
      capacity: "98.2%",
      monthlyOutput: "88 500 коробов/мес",
      highway: "Р-255 «Сибирь», Р-254 «Иртыш»"
    },
    "Фабрика им. К. Самойловой": {
      lat: 59.9077,
      lng: 30.3458,
      city: "Санкт-Петербург",
      region: "Ленинградская обл.",
      color: "#b388ff",
      badgeClass: "samoylova",
      products: "Зефир в шоколаде, мармелад, вафельные торты",
      capacity: "84.5%",
      monthlyOutput: "28 400 коробов/мес",
      highway: "М-11 «Нева», А-181"
    },
    "Россия (Самара)": {
      lat: 53.2001,
      lng: 50.1500,
      city: "Самара",
      region: "Самарская обл.",
      color: "#ff2a85",
      badgeClass: "rossiya",
      products: "«Россия — щедрая душа!», «Сударушка», «Золотая марка»",
      capacity: "91.0%",
      monthlyOutput: "46 000 коробов/мес",
      highway: "М-5 «Урал», М-12 «Восток»"
    },
    "Победа Вкуса": {
      lat: 55.0167,
      lng: 37.3833,
      city: "Клеймёново",
      region: "Московская обл.",
      color: "#00e5ff",
      badgeClass: "pobeda",
      products: "«Победа вкуса» Трюфели, пористый шоколад 72%",
      capacity: "89.4%",
      monthlyOutput: "34 100 коробов/мес",
      highway: "М-2 «Крым», ЦКАД"
    }
  };

  const RU_DESTINATIONS = [
    { city: "Москва (РЦ Домодедово)", region: "Москва и МО", lat: 55.4411, lng: 37.7490 },
    { city: "Санкт-Петербург (РЦ Шушары)", region: "Ленинградская обл.", lat: 59.8119, lng: 30.3855 },
    { city: "Казань (РЦ Зеленодольск)", region: "Татарстан", lat: 55.8500, lng: 48.5500 },
    { city: "Екатеринбург (РЦ Кольцово)", region: "Свердловская обл.", lat: 56.7500, lng: 60.8000 },
    { city: "Новосибирск (РЦ Толмачево)", region: "Новосибирская обл.", lat: 55.0100, lng: 82.6500 },
    { city: "Ростов-на-Дону (РЦ Аксай)", region: "Ростовская обл.", lat: 47.2600, lng: 39.8600 },
    { city: "Краснодар (РЦ Адыгея)", region: "Краснодарский край", lat: 44.9800, lng: 39.0200 },
    { city: "Самара (РЦ Новосемейкино)", region: "Самарская обл.", lat: 53.3700, lng: 50.3500 },
    { city: "Нижний Новгород", region: "Нижегородская обл.", lat: 56.3269, lng: 44.0059 },
    { city: "Воронеж (РЦ Нечаевка)", region: "Воронежская обл.", lat: 51.6500, lng: 39.3800 },
    { city: "Уфа (РЦ Шакша)", region: "Башкортостан", lat: 54.7800, lng: 56.2200 },
    { city: "Челябинск", region: "Челябинская обл.", lat: 55.1644, lng: 61.4368 }
  ];

  const RU_CARRIERS = [
    "Деловые Линии",
    "ПЭК (Первая Экспедиционная)",
    "Монополия (Digital Freight)",
    "ИТЕКО Россия",
    "Globaltruck",
    "CRAFTER"
  ];

  const RU_TRUCK_TYPES = [
    { type: "Рефрижераторный экспресс (+16...+18°C)", temp: "+16...+18°C", spec: "Schmitz Cargobull SKO 24 / Thermo King" },
    { type: "Еврофура 20т Тент (90м³)", temp: "Стандарт", spec: "КАМАЗ-54901 / Тонар 9742" },
    { type: "Изотермический полуприцеп (33 паллеты)", temp: "Термос", spec: "Krone Dry Liner / Scania R450" },
    { type: "Городской развоз (Газель City / ГАЗон)", temp: "Экспресс", spec: "ГАЗон Next 3.5т (РЦ ➔ Магазины)" }
  ];

  // ===================================================================
  // DATA DICTIONARIES: UNITED STATES (USA)
  // ===================================================================

  const US_FACTORIES = {
    "Lot's O' Nuts": {
      lat: 32.881893,
      lng: -111.768036,
      city: "Casa Grande",
      region: "AZ",
      color: "#ffb700",
      badgeClass: "lots",
      products: "Wonka Nutty Crunch, Fudge Mallows, Scrumdiddlyumptious",
      capacity: "94.2%",
      monthlyOutput: "58,400 Cases/mo",
      highway: "I-10 W, I-8"
    },
    "Wicked Choccy's": {
      lat: 32.076176,
      lng: -81.088371,
      city: "Savannah",
      region: "GA",
      color: "#00f0ff",
      badgeClass: "choccy",
      products: "Wonka Milk Chocolate, Triple Dazzle Caramel",
      capacity: "91.8%",
      monthlyOutput: "44,200 Cases/mo",
      highway: "I-95, I-16"
    },
    "Sugar Shack": {
      lat: 48.11914,
      lng: -96.18115,
      city: "Thief River Falls",
      region: "MN",
      color: "#00e676",
      badgeClass: "shack",
      products: "Laffy Taffy, SweeTARTS, Nerds, Fun Dip",
      capacity: "82.5%",
      monthlyOutput: "18,500 Cases/mo",
      highway: "US-59, I-94"
    },
    "Secret Factory": {
      lat: 41.446333,
      lng: -90.565487,
      city: "Rock Island",
      region: "IL",
      color: "#b388ff",
      badgeClass: "secret",
      products: "Specialty R&D Confections, Secret Blends",
      capacity: "78.0%",
      monthlyOutput: "12,900 Cases/mo",
      highway: "I-80, I-74"
    },
    "The Other Factory": {
      lat: 35.1175,
      lng: -89.971107,
      city: "Memphis",
      region: "TN",
      color: "#ff2a85",
      badgeClass: "other",
      products: "Gourmet Toffees & Artisanal Hard Candies",
      capacity: "86.4%",
      monthlyOutput: "15,300 Cases/mo",
      highway: "I-40, I-55"
    }
  };

  const US_DESTINATIONS = [
    { city: "Los Angeles", region: "California", lat: 34.0522, lng: -118.2437 },
    { city: "San Francisco", region: "California", lat: 37.7749, lng: -122.4194 },
    { city: "New York City", region: "New York", lat: 40.7128, lng: -74.0060 },
    { city: "Dallas", region: "Texas", lat: 32.7767, lng: -96.7970 },
    { city: "Houston", region: "Texas", lat: 29.7604, lng: -95.3698 },
    { city: "Philadelphia", region: "Pennsylvania", lat: 39.9526, lng: -75.1652 },
    { city: "Seattle", region: "Washington", lat: 47.6062, lng: -122.3321 },
    { city: "Chicago", region: "Illinois", lat: 41.8781, lng: -87.6298 },
    { city: "Atlanta", region: "Georgia", lat: 33.7490, lng: -84.3880 },
    { city: "Miami", region: "Florida", lat: 25.7617, lng: -80.1918 }
  ];

  const US_CARRIERS = [
    "Schneider National",
    "Swift Transportation",
    "J.B. Hunt Transport",
    "Werner Enterprises",
    "Knight-Swift Logistics"
  ];

  const US_TRUCK_TYPES = [
    { type: "53' Reefer (Temp-Controlled)", temp: "34-38°F", spec: "Great Dane SuperSeal / Carrier Transicold" },
    { type: "53' Dry Van (Standard)", temp: "Ambient", spec: "Wabash National Duraplate" },
    { type: "48' Flatbed", temp: "Palletized", spec: "Fontaine Infinity Aluminum" },
    { type: "26' Box Truck", temp: "Metro Expedited", spec: "Freightliner M2 106" }
  ];

  // -------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initEventListeners();
    bootOS();
  });

  async function bootOS() {
    initMap();
    await probeBackendAPI();
    loadModeData(STATE.mode);
  }

  // -------------------------------------------------------------------
  // Mode Switcher: RU <-> US
  // -------------------------------------------------------------------
  function setMode(newMode) {
    if (STATE.mode === newMode) return;
    STATE.mode = newMode;
    localStorage.setItem('maven_freight_mode', newMode);

    // Update Mode Buttons
    const btnRu = document.getElementById('btn-mode-ru');
    const btnUs = document.getElementById('btn-mode-us');
    if (btnRu && btnUs) {
      btnRu.classList.toggle('active', newMode === 'ru');
      btnUs.classList.toggle('active', newMode === 'us');
    }

    // Reset filters
    STATE.filters = { factory: 'ALL', shipMode: 'ALL', state: 'ALL', status: 'ALL', search: '' };
    STATE.pagination.page = 1;

    loadModeData(newMode);
    showToast(newMode === 'ru' ? 'Режим переключен: 🇷🇺 Российская Федерация (РУБ / КМ)' : 'Mode switched: 🇺🇸 United States (USD / MILES)', 'cyan');
  }

  async function loadModeData(mode) {
    updateStaticText(mode);
    populateDropdowns(mode);

    if (mode === 'ru') {
      loadRussianEnvironment();
    } else {
      loadUSEnvironment();
    }

    renderAllViews();
    initCharts();

    await syncWithBackendIfOnline(mode);
  }

  async function syncWithBackendIfOnline(mode) {
    if (!STATE.apiOnline) return;
    try {
      const statsRes = await fetch(`/api/stats?region=${mode}`).then(r => r.json()).catch(() => null);
      if (statsRes) {
        if (statsRes.total_shipments) STATE.stats.totalVolume = statsRes.total_shipments;
        if (statsRes.total_revenue) STATE.stats.totalRevenue = statsRes.total_revenue;
        if (statsRes.total_mileage) STATE.stats.totalDistance = statsRes.total_mileage;
        if (statsRes.avg_transit_days) STATE.stats.avgTransitTime = statsRes.avg_transit_days;
        if (statsRes.fleet_utilization_pct) STATE.stats.fleetUtilization = statsRes.fleet_utilization_pct;
        renderKPIs();
      }

      const shipmentsRes = await fetch(`/api/shipments?region=${mode}&limit=100`).then(r => r.json()).catch(() => null);
      if (shipmentsRes && shipmentsRes.shipments && shipmentsRes.shipments.length > 0) {
        STATE.allShipments = shipmentsRes.shipments.map(r => ({
          order_id: r.order_id,
          order_date: r.order_date,
          ship_date: r.ship_date,
          factory: r.factory_name,
          city: r.dest_city,
          state: r.dest_state,
          zip: r.dest_zip,
          ship_mode: r.ship_mode,
          product: r.product_name,
          truck_type: r.truck_type,
          carrier: r.carrier,
          driver_name: r.driver_name,
          truck_id: r.truck_id,
          distance: Math.round(r.distance_miles || 0),
          lead_days: r.transit_days || 1,
          freight_cost: Math.round(r.freight_cost || 0),
          revenue: Math.round(r.sales || 0),
          status: r.status,
          gross_profit: Math.round(r.gross_profit || 0),
          dest_lat: r.dest_lat,
          dest_lng: r.dest_lng,
          co2_kg: r.co2_kg || Math.round((r.distance_miles || 0) * 1.2)
        }));
        applyFilters();
      }
    } catch (e) {
      console.warn('Backend sync failed, continuing in simulation mode', e);
    }
  }

  // -------------------------------------------------------------------
  // Dynamic UI Text Localization
  // -------------------------------------------------------------------
  function updateStaticText(mode) {
    const isRu = mode === 'ru';
    document.documentElement.lang = isRu ? 'ru' : 'en';

    // Page & Header Titles
    document.getElementById('page-title').textContent = isRu 
      ? 'MAVEN FREIGHT OS // СИСТЕМА УПРАВЛЕНИЯ ЛОГИСТИКОЙ И ДАЛЬНОБОЙЩИКАМИ РФ'
      : 'MAVEN FREIGHT OS // US TRUCKING & LOGISTICS COMMAND CENTER';

    document.getElementById('header-brand-title').innerHTML = isRu
      ? 'MAVEN FREIGHT <span class="accent">OS</span> // СИСТЕМА УПРАВЛЕНИЯ ЛОГИСТИКОЙ И ДАЛЬНОБОЙЩИКАМИ РФ'
      : 'MAVEN FREIGHT <span class="accent">OS</span> // US LOGISTICS COMMAND';

    document.getElementById('sub-tagline').textContent = isRu
      ? 'АВТОНОМНАЯ МУЛЬТИ-АГЕНТНАЯ ДИСПЕТЧЕРИЗАЦИЯ И СЕТЬ ДАЛЬНОБОЙЩИКОВ РФ'
      : 'AUTONOMOUS MULTI-AGENT TRUCKING DISPATCH & NATIONWIDE TELEMETRY';

    document.getElementById('sub-telemetry-tag').textContent = isRu
      ? 'ФЕДЕРАЛЬНАЯ ТЕЛЕМАТИКА ГЛОНАСС & РЦ'
      : 'MAVEN CANDY DISTRIBUTOR DATASET (10,195 SHIPMENTS)';

    // Status Pills
    document.getElementById('pill-system-status').textContent = isRu ? 'СИСТЕМА В СЕТИ' : 'SYSTEM ONLINE';
    document.getElementById('pill-fleet-label').innerHTML = isRu 
      ? 'АКТИВНЫЙ ФЛОТ: <strong id="header-active-fleet">1 420</strong> ТЯГАЧЕЙ'
      : 'ACTIVE FLEET: <strong id="header-active-fleet">1,420</strong> TRUCKS';

    // KPI Titles & Units
    document.getElementById('kpi-title-volume').textContent = isRu ? 'Общий объём перевозок' : 'Total Freight Volume';
    document.getElementById('kpi-unit-volume').textContent = isRu ? 'рейсов' : 'shipments';
    document.getElementById('kpi-trend-volume').textContent = isRu ? '↑ +8.4% к АППГ' : '↑ +8.4% YoY';

    document.getElementById('kpi-title-distance').textContent = isRu ? 'Пробег тягачей' : 'Total Miles Logged';
    document.getElementById('kpi-unit-distance').textContent = isRu ? 'км' : 'mi';
    document.getElementById('kpi-trend-distance').textContent = isRu ? '↓ -3.2% холостой ход' : '↓ -3.2% Deadhead';

    document.getElementById('kpi-title-transit').textContent = isRu ? 'Срок доставки (SLA)' : 'Avg Transit Time';
    document.getElementById('kpi-unit-transit').textContent = isRu ? 'дней' : 'days';
    document.getElementById('kpi-trend-transit').textContent = isRu ? '↑ -0.6 дн от графика' : '↑ -0.6d SLA beat';

    document.getElementById('kpi-title-revenue').textContent = isRu ? 'Выручка и маржа' : 'Revenue & Net Margin';
    document.getElementById('kpi-unit-revenue').textContent = isRu ? 'оборот' : 'gross';
    document.getElementById('kpi-trend-revenue').textContent = isRu ? '⚡ Ставка 165 ₽/км' : '↑ +$184K profit';

    document.getElementById('kpi-title-fleet').textContent = isRu ? 'Автопарк и дальнобойщики' : 'Fleet & Drivers';
    document.getElementById('kpi-unit-drivers').textContent = isRu ? 'водителей CE' : 'drivers';
    document.getElementById('kpi-trend-fleet').textContent = isRu ? '⚡ Пик эффективности' : '⚡ Peak Efficiency';

    // Filter Bar
    document.getElementById('lbl-filters-title').textContent = isRu ? 'Фильтры:' : 'Filters:';
    document.getElementById('filter-search').placeholder = isRu 
      ? 'Поиск по ТТН, городу, водителю, госномеру, перевозчику...'
      : 'Search Order ID, City, ZIP, Carrier, Truck...';
    document.getElementById('btn-reset-label').textContent = isRu ? 'Сброс' : 'Reset';
    document.getElementById('btn-sync-label').textContent = isRu ? 'Синхронизация' : 'Sync';
    const btnGuide = document.getElementById('btn-guide-label');
    if (btnGuide) btnGuide.textContent = isRu ? '📄 PDF Презентация (C-Level)' : '📄 Executive PDF Guide';

    // Panels
    document.getElementById('map-panel-title').textContent = isRu
      ? 'Федеральные трассы и кондитерские РЦ (ГЛОНАСС Телематика)'
      : 'US Highway Corridors & Factory Hubs (Live Telemetry)';
    document.getElementById('btn-toggle-routes').textContent = isRu ? 'Маршруты: ВКЛ' : 'Routes: ON';
    document.getElementById('btn-toggle-factories').textContent = isRu 
      ? `Фабрики: ${Object.keys(RU_FACTORIES).length}`
      : `Factories: ${Object.keys(US_FACTORIES).length}`;
    document.getElementById('btn-reset-map').textContent = isRu ? 'Центр РФ' : 'Center US';

    document.getElementById('agents-hub-title').textContent = isRu ? 'Диспетчерский Хаб Саб-Агентов' : 'Subagents Autonomous Dispatch Hub';
    document.getElementById('btn-dispatch-label').textContent = isRu 
      ? '⚡ Запустить цикл диспетчеризации (Run Multi-Agent Dispatch)'
      : '⚡ Запустить цикл диспетчеризации (Run Multi-Agent Dispatch)';

    // Subagent Identities
    document.getElementById('agent-1-name').textContent = isRu ? 'АПЕКС' : 'APEX';
    document.getElementById('agent-1-role').textContent = isRu ? 'Автономный диспетчер' : 'Dispatcher Agent';
    document.getElementById('agent-1-lbl1').textContent = isRu ? 'Загрузка фур:' : 'Load Bundling:';
    document.getElementById('agent-1-lbl2').textContent = isRu ? 'Транспорт:' : 'Carrier Match:';

    document.getElementById('agent-2-name').textContent = isRu ? 'СЛЕДОПЫТ' : 'PATHFINDER';
    document.getElementById('agent-2-role').textContent = isRu ? 'Оптимизатор маршрутов' : 'Route Optimizer';
    document.getElementById('agent-2-lbl1').textContent = isRu ? 'Холостой ход:' : 'Deadhead Save:';
    document.getElementById('agent-2-lbl2').textContent = isRu ? 'Трассы / РТО:' : 'HOS Compliance:';

    document.getElementById('agent-3-name').textContent = isRu ? 'ЧАСОВОЙ' : 'SENTINEL';
    document.getElementById('agent-3-role').textContent = isRu ? 'ГЛОНАСС / Телематика' : 'Fleet Monitor';
    document.getElementById('agent-3-lbl1').textContent = isRu ? 'Телематика:' : 'GPS Latency:';
    document.getElementById('agent-3-lbl2').textContent = isRu ? 'Точность ETA:' : 'ETA Accuracy:';

    document.getElementById('agent-4-name').textContent = isRu ? 'АУДИТОР' : 'VERITAS';
    document.getElementById('agent-4-role').textContent = isRu ? 'Экономика / Платон' : 'Logistics Auditor';
    document.getElementById('agent-4-lbl1').textContent = isRu ? 'Ставка рейса:' : 'Cost Per Mile:';
    document.getElementById('agent-4-lbl2').textContent = isRu ? 'Маржинальность:' : 'Unit Margin:';

    document.getElementById('terminal-heading').textContent = isRu
      ? 'Живой лог решений саб-агентов и телеметрии рейсов'
      : 'Multi-Agent Live Decision & Reasoning Log';
    document.getElementById('btn-clear-logs').textContent = isRu ? 'Очистить' : 'Clear';

    // Charts
    document.getElementById('chart-1-title').textContent = isRu ? 'Объем отгрузок по фабрикам' : 'Volume by Factory';
    document.getElementById('chart-1-badge').textContent = isRu ? '6 Кондитерских РЦ' : '5 Distribution Hubs';

    document.getElementById('chart-2-title').textContent = isRu ? 'Распределение по типам автопоездов' : 'Distribution by Shipping Mode';
    document.getElementById('chart-2-badge').textContent = isRu ? 'Типы автопоездов' : 'Carrier Tiers';

    document.getElementById('chart-3-title').textContent = isRu ? 'Топ-10 грузовых коридоров' : 'Top 10 High-Volume Corridors';
    document.getElementById('chart-3-badge').textContent = isRu ? 'Федеральные трассы' : 'Interstate Lanes';

    // Table Headers
    document.getElementById('th-order-id').textContent = isRu ? 'Номер ТТН ↕' : 'Order ID ↕';
    document.getElementById('th-dates').textContent = isRu ? 'Даты (Погрузка → Доставка) ↕' : 'Dates (Order → Ship) ↕';
    document.getElementById('th-factory').textContent = isRu ? 'Фабрика отправления ↕' : 'Factory Origin ↕';
    document.getElementById('th-destination').textContent = isRu ? 'Пункт назначения ↕' : 'Destination ↕';
    document.getElementById('th-mode').textContent = isRu ? 'Класс доставки ↕' : 'Shipping Class ↕';
    document.getElementById('th-truck').textContent = isRu ? 'Тип автопоезда ↕' : 'Truck Type ↕';
    document.getElementById('th-carrier').textContent = isRu ? 'Перевозчик ↕' : 'Assigned Carrier ↕';
    document.getElementById('th-distance').textContent = isRu ? 'Дистанция (км) ↕' : 'Distance ↕';
    document.getElementById('th-lead').textContent = isRu ? 'Срок (дн) ↕' : 'Lead Days ↕';
    document.getElementById('th-cost').textContent = isRu ? 'Ставка / Стоимость ↕' : 'Freight Cost / Rev ↕';
    document.getElementById('th-status').textContent = isRu ? 'Статус ↕' : 'Status ↕';

    document.getElementById('lbl-page-size').textContent = isRu ? 'На страницу:' : 'Page Size:';
    document.getElementById('btn-export-label').textContent = isRu ? 'Экспорт реестра (CSV)' : 'Export Manifest CSV';
  }

  // -------------------------------------------------------------------
  // Dropdown Population based on Mode
  // -------------------------------------------------------------------
  function populateDropdowns(mode) {
    const isRu = mode === 'ru';

    // 1. Factories
    const factSelect = document.getElementById('filter-factory');
    if (factSelect) {
      const factDict = isRu ? RU_FACTORIES : US_FACTORIES;
      factSelect.innerHTML = `<option value="ALL">${isRu ? 'Все фабрики (' + Object.keys(factDict).length + ' РЦ)' : 'All Factories (5 Hubs)'}</option>` +
        Object.keys(factDict).map(f => `<option value="${f}">${f} (${factDict[f].region})</option>`).join('');
    }

    // 2. Shipping Classes
    const modeSelect = document.getElementById('filter-ship-mode');
    if (modeSelect) {
      if (isRu) {
        modeSelect.innerHTML = `
          <option value="ALL">Все типы автопоездов</option>
          <option value="Рефрижераторный экспресс">Рефрижераторный экспресс (+16...+18°C)</option>
          <option value="Еврофура 20т Тент">Еврофура 20т Тент (90м³)</option>
          <option value="Изотермический полуприцеп">Изотермический полуприцеп</option>
          <option value="Городской развоз">Городской развоз (Газель / ГАЗон)</option>
        `;
      } else {
        modeSelect.innerHTML = `
          <option value="ALL">All Shipping Classes</option>
          <option value="Standard Class">Standard Class (Ground LTL/FTL)</option>
          <option value="First Class">First Class (Priority Reefer)</option>
          <option value="Second Class">Second Class (Expedited Regional)</option>
          <option value="Same Day">Same Day (Critical Hotshot)</option>
        `;
      }
    }

    // 3. Regions / States
    const stateSelect = document.getElementById('filter-state');
    if (stateSelect) {
      if (isRu) {
        stateSelect.innerHTML = `
          <option value="ALL">Все регионы РФ</option>
          <option value="Москва и МО">Москва и Московская обл.</option>
          <option value="Ленинградская обл.">Санкт-Петербург и область</option>
          <option value="Татарстан">Республика Татарстан (Казань)</option>
          <option value="Свердловская обл.">Свердловская обл. (Екатеринбург)</option>
          <option value="Новосибирская обл.">Новосибирская обл.</option>
          <option value="Краснодарский край">Краснодарский край</option>
          <option value="Ростовская обл.">Ростовская обл.</option>
          <option value="Самарская обл.">Самарская обл.</option>
          <option value="Воронежская обл.">Воронежская обл.</option>
          <option value="Башкортостан">Республика Башкортостан (Уфа)</option>
        `;
      } else {
        stateSelect.innerHTML = `
          <option value="ALL">All US States (50+)</option>
          <option value="California">California (CA)</option>
          <option value="New York">New York (NY)</option>
          <option value="Texas">Texas (TX)</option>
          <option value="Pennsylvania">Pennsylvania (PA)</option>
          <option value="Washington">Washington (WA)</option>
          <option value="Illinois">Illinois (IL)</option>
          <option value="Ohio">Ohio (OH)</option>
          <option value="Florida">Florida (FL)</option>
          <option value="Georgia">Georgia (GA)</option>
        `;
      }
    }

    // 4. Statuses
    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      if (isRu) {
        statusSelect.innerHTML = `
          <option value="ALL">Все статусы рейсов</option>
          <option value="Доставлен">Доставлен (Разгружен на РЦ)</option>
          <option value="В пути">В пути (Трасса / ГЛОНАСС)</option>
          <option value="Погрузка на РЦ">Погрузка на РЦ (Оформление)</option>
          <option value="Запланирован">Запланирован (В графике)</option>
        `;
      } else {
        statusSelect.innerHTML = `
          <option value="ALL">All Statuses</option>
          <option value="Delivered">Delivered (Completed)</option>
          <option value="In Transit">In Transit (Active Highway)</option>
          <option value="Dispatched">Dispatched (At Terminal)</option>
        `;
      }
    }
  }

  // -------------------------------------------------------------------
  // Russian Logistics Environment Generator
  // -------------------------------------------------------------------
  function loadRussianEnvironment() {
    STATE.factories = Object.keys(RU_FACTORIES).map(name => ({
      name,
      ...RU_FACTORIES[name]
    }));

    STATE.stats = {
      totalVolume: 10195,
      totalUnits: 38654,
      totalDistance: 20672500, // км
      avgHaul: 1260, // км
      avgTransitTime: 3.4,
      onTimeRate: 98.2,
      totalRevenue: 186090000, // Рубли
      netMargin: 41.8,
      ratePerKm: 165,
      activeDrivers: 1284,
      activeFleet: 1420,
      fleetUtilization: 92.4,
      modeBreakdown: {
        'Рефрижераторный экспресс': 6120,
        'Еврофура 20т Тент': 1979,
        'Изотермический полуприцеп': 1548,
        'Городской развоз': 547
      }
    };

    STATE.agents = {
      apex: {
        name: 'Апекс',
        role: 'Автономный диспетчер',
        status: 'ОПТИМИЗАЦИЯ',
        telemetry: { load_consolidation_pct: 96.8, assigned_carriers: ['Деловые Линии', 'ПЭК', 'Монополия'] }
      },
      pathfinder: {
        name: 'Следопыт',
        role: 'Оптимизатор маршрутов',
        status: 'АКТИВЕН',
        telemetry: { deadhead_saved_pct: 14.2, fuel_saved_gal: 8420, highway_focus: 'М-11/М-12/М-4' }
      },
      sentinel: {
        name: 'Часовой',
        role: 'ГЛОНАСС / Телематика',
        status: 'МОНИТОРИНГ',
        telemetry: { active_gps_pings: 1420, on_time_sla_pct: 98.2, cold_chain_temp: '+16.8°C' }
      },
      veritas: {
        name: 'Аудитор',
        role: 'Экономика / Платон',
        status: 'АУДИТ',
        telemetry: { rate_per_km: 110, net_operating_margin_pct: 41.8, platon_status: 'Оплачен' }
      }
    };

    STATE.routes = [
      { origin_factory: "Красный Октябрь", origin_lat: 55.7415, origin_lng: 37.6092, dest_city: "Санкт-Петербург", dest_state: "Ленинградская обл.", dest_lat: 59.8119, dest_lng: 30.3855, distance: 710, highway: "М-11 «Нева»" },
      { origin_factory: "Красный Октябрь", origin_lat: 55.7415, origin_lng: 37.6092, dest_city: "Казань", dest_state: "Татарстан", dest_lat: 55.8500, dest_lng: 48.5500, distance: 820, highway: "М-12 «Восток»" },
      { origin_factory: "Красный Октябрь", origin_lat: 55.7415, origin_lng: 37.6092, dest_city: "Краснодар", dest_state: "Краснодарский край", dest_lat: 44.9800, dest_lng: 39.0200, distance: 1340, highway: "М-4 «Дон»" },
      { origin_factory: "Славянка", origin_lat: 51.2982, origin_lng: 37.8344, dest_city: "Москва", dest_state: "Москва и МО", dest_lat: 55.4411, dest_lng: 37.7490, distance: 620, highway: "М-2 «Крым»" },
      { origin_factory: "Славянка", origin_lat: 51.2982, origin_lng: 37.8344, dest_city: "Ростов-на-Дону", dest_state: "Ростовская обл.", dest_lat: 47.2600, dest_lng: 39.8600, distance: 580, highway: "М-4 «Дон»" },
      { origin_factory: "КДВ Яшкино", origin_lat: 55.8736, origin_lng: 85.4264, dest_city: "Новосибирск", dest_state: "Новосибирская обл.", dest_lat: 55.0100, dest_lng: 82.6500, distance: 290, highway: "Р-255 «Сибирь»" },
      { origin_factory: "КДВ Яшкино", origin_lat: 55.8736, origin_lng: 85.4264, dest_city: "Екатеринбург", dest_state: "Свердловская обл.", dest_lat: 56.7500, dest_lng: 60.8000, distance: 1820, highway: "Р-254 / М-5" },
      { origin_factory: "Россия (Самара)", origin_lat: 53.2001, origin_lng: 50.1500, dest_city: "Уфа", dest_state: "Башкортостан", dest_lat: 54.7800, dest_lng: 56.2200, distance: 460, highway: "М-5 «Урал»" },
      { origin_factory: "Фабрика им. К. Самойловой", origin_lat: 59.9077, origin_lng: 30.3458, dest_city: "Москва", dest_state: "Москва и МО", dest_lat: 55.4411, dest_lng: 37.7490, distance: 710, highway: "М-11 «Нева»" },
      { origin_factory: "Победа Вкуса", origin_lat: 55.0167, origin_lng: 37.3833, dest_city: "Воронеж", dest_state: "Воронежская обл.", dest_lat: 51.6500, dest_lng: 39.3800, distance: 480, highway: "М-4 «Дон»" }
    ];

    STATE.allShipments = generateRussianShipments(160);

    STATE.agentLogs = [
      { time: '15:00:12', agent: 'апекс', msg: 'Формирование сборных партий: консолидировано 42 заказа на шоколад «Алёнка» и «Степ».' },
      { time: '15:01:05', agent: 'следопыт', msg: 'Построение маршрута по трассе М-4 «Дон»: экономия 45 мин на обходе ремонта у Павловска.' },
      { time: '15:02:19', agent: 'часовой', msg: 'ГЛОНАСС-мониторинг 1 420 автопоездов: температурный режим полуприцепов +16.8°C.' },
      { time: '15:03:02', agent: 'аудитор', msg: 'Аудит тарифов: дорожный сбор системы «Платон» списан. Рентабельность рейса 41.8%.' }
    ];
  }

  function generateRussianShipments(count) {
    const fNames = Object.keys(RU_FACTORIES);
    const statuses = ['Доставлен', 'Доставлен', 'В пути', 'Погрузка на РЦ'];
    const drivers = [
      'Иванов С.В.', 'Кузнецов А.М.', 'Смирнов Д.П.', 'Васильев О.Н.',
      'Попов К.Е.', 'Соколов Р.Т.', 'Михайлов И.А.', 'Федоров Г.С.'
    ];
    const trucks = ['КАМАЗ-54901 NEO', 'Scania R450', 'Sitrak C7H', 'Mercedes Actros 1845'];
    const shipments = [];

    for (let i = 1; i <= count; i++) {
      const factory = fNames[Math.floor(Math.random() * fNames.length)];
      const fMeta = RU_FACTORIES[factory];
      const dest = RU_DESTINATIONS[Math.floor(Math.random() * RU_DESTINATIONS.length)];
      const truckTypeObj = RU_TRUCK_TYPES[Math.floor(Math.random() * RU_TRUCK_TYPES.length)];
      const carrier = RU_CARRIERS[Math.floor(Math.random() * RU_CARRIERS.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const driver = drivers[Math.floor(Math.random() * drivers.length)];
      const truckModel = trucks[Math.floor(Math.random() * trucks.length)];

      const dist = Math.round(calculateHaversineDistance(fMeta.lat, fMeta.lng, dest.lat, dest.lng) * 1.60934); // в км
      const leadDays = truckTypeObj.type.includes('Городской') ? 0.5 : Math.max(1, Math.round(dist / 650));
      const freightCost = Math.round(dist * (75 + Math.random() * 25));
      const revenue = Math.round(freightCost * (1.35 + Math.random() * 0.25));

      const month = String(Math.floor(Math.random() * 9) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const orderDate = `2024-${month}-${day}`;
      const shipDate = `2024-${month}-${String(Number(day) + Math.min(3, Math.ceil(leadDays))).padStart(2, '0')}`;

      shipments.push({
        order_id: `ЭТрН-RU-2024-${String(100000 + i)}-КЭП`,
        order_date: orderDate,
        ship_date: shipDate,
        factory: factory,
        city: dest.city,
        state: dest.region,
        zip: `14${String(1000 + i)}`,
        ship_mode: truckTypeObj.type.split(' ')[0],
        product: fMeta.products.split(',')[0],
        truck_type: `${truckModel} // ${truckTypeObj.type.split(' ')[0]}`,
        carrier: carrier,
        driver_name: driver,
        truck_id: `Р ${Math.floor(100 + Math.random()*899)} МК 777`,
        distance: dist,
        lead_days: leadDays,
        freight_cost: freightCost,
        revenue: revenue,
        status: status,
        gross_profit: revenue - freightCost,
        co2_kg: Math.round(dist * 1.15),
        dest_lat: dest.lat,
        dest_lng: dest.lng
      });
    }

    return shipments;
  }

  // -------------------------------------------------------------------
  // US Logistics Environment
  // -------------------------------------------------------------------
  function loadUSEnvironment() {
    STATE.factories = Object.keys(US_FACTORIES).map(name => ({
      name,
      ...US_FACTORIES[name]
    }));

    STATE.stats = {
      totalVolume: 10195,
      totalUnits: 38654,
      totalDistance: 12845290, // миль
      avgHaul: 1260,
      avgTransitTime: 3.4,
      onTimeRate: 98.2,
      totalRevenue: 2481200, // USD
      netMargin: 41.8,
      ratePerKm: 2.18,
      activeDrivers: 1284,
      activeFleet: 1420,
      fleetUtilization: 92.4,
      modeBreakdown: {
        'Standard Class': 6120,
        'Second Class': 1979,
        'First Class': 1548,
        'Same Day': 547
      }
    };

    STATE.agents = {
      apex: {
        name: 'Apex',
        role: 'Dispatcher Agent',
        status: 'OPTIMIZING',
        telemetry: { load_consolidation_pct: 96.8, assigned_carriers: ['Schneider', 'Swift', 'J.B. Hunt'] }
      },
      pathfinder: {
        name: 'Pathfinder',
        role: 'Route Optimizer',
        status: 'ACTIVE',
        telemetry: { deadhead_saved_pct: 14.2, fuel_saved_gal: 8420, highway_focus: 'I-10 / I-80' }
      },
      sentinel: {
        name: 'Sentinel',
        role: 'Fleet Monitor',
        status: 'TRACKING',
        telemetry: { active_gps_pings: 1420, on_time_sla_pct: 98.2, cold_chain_temp: '36.2°F' }
      },
      veritas: {
        name: 'Veritas',
        role: 'Logistics Auditor',
        status: 'AUDITING',
        telemetry: { rate_per_km: 2.18, net_operating_margin_pct: 41.8, platon_status: 'Pre-Approved' }
      }
    };

    STATE.routes = [
      { origin_factory: "Lot's O' Nuts", origin_lat: 32.881893, origin_lng: -111.768036, dest_city: "Los Angeles", dest_state: "California", dest_lat: 34.0522, dest_lng: -118.2437, distance: 395, highway: "I-10 W" },
      { origin_factory: "Wicked Choccy's", origin_lat: 32.076176, origin_lng: -81.088371, dest_city: "New York City", dest_state: "New York", dest_lat: 40.7128, dest_lng: -74.0060, distance: 710, highway: "I-95 N" },
      { origin_factory: "Lot's O' Nuts", origin_lat: 32.881893, origin_lng: -111.768036, dest_city: "Dallas", dest_state: "Texas", dest_lat: 32.7767, dest_lng: -96.7970, distance: 985, highway: "I-20 E" },
      { origin_factory: "Secret Factory", origin_lat: 41.446333, origin_lng: -90.565487, dest_city: "Chicago", dest_state: "Illinois", dest_lat: 41.8781, dest_lng: -87.6298, distance: 165, highway: "I-88 E" },
      { origin_factory: "Sugar Shack", origin_lat: 48.11914, origin_lng: -96.18115, dest_city: "Minneapolis", dest_state: "Minnesota", dest_lat: 44.9778, dest_lng: -93.2650, distance: 310, highway: "I-94 E" }
    ];

    STATE.allShipments = generateUSShipments(160);

    STATE.agentLogs = [
      { time: '12:00:15', agent: 'apex', msg: 'Consolidated 48 pending shipments into 53\' Reefer trailers.' },
      { time: '12:01:04', agent: 'pathfinder', msg: 'Computed I-10 W corridor waypoints: bypass Phoenix rush hour (-28m).' },
      { time: '12:02:18', agent: 'sentinel', msg: 'GPS ping 1,420 tractors: 100% telemetry stream stability.' },
      { time: '12:03:02', agent: 'veritas', msg: 'Audited fuel surcharge: avg operational unit margin locked at 41.8%.' }
    ];
  }

  function generateUSShipments(count) {
    const fNames = Object.keys(US_FACTORIES);
    const shipModes = ['Standard Class', 'First Class', 'Second Class', 'Same Day'];
    const statuses = ['Delivered', 'Delivered', 'In Transit', 'Dispatched'];
    const shipments = [];

    for (let i = 1; i <= count; i++) {
      const factory = fNames[Math.floor(Math.random() * fNames.length)];
      const fMeta = US_FACTORIES[factory];
      const dest = US_DESTINATIONS[Math.floor(Math.random() * US_DESTINATIONS.length)];
      const truckType = US_TRUCK_TYPES[Math.floor(Math.random() * US_TRUCK_TYPES.length)];
      const carrier = US_CARRIERS[Math.floor(Math.random() * US_CARRIERS.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const dist = Math.round(calculateHaversineDistance(fMeta.lat, fMeta.lng, dest.lat, dest.lng)); // в милях
      const leadDays = Math.max(1, Math.round(dist / 450));
      const freightCost = Math.round(dist * (1.85 + Math.random() * 0.7));
      const revenue = Math.round(freightCost * (1.35 + Math.random() * 0.25));

      const month = String(Math.floor(Math.random() * 9) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const orderDate = `2024-${month}-${day}`;
      const shipDate = `2024-${month}-${String(Number(day) + Math.min(3, Math.ceil(leadDays))).padStart(2, '0')}`;

      shipments.push({
        order_id: `US-2024-${String(128000 + i)}-WONKA`,
        order_date: orderDate,
        ship_date: shipDate,
        factory: factory,
        city: dest.city,
        state: dest.region,
        zip: `90${String(100 + i)}`,
        ship_mode: shipModes[Math.floor(Math.random() * shipModes.length)],
        product: fMeta.products.split(',')[0],
        truck_type: truckType.type,
        carrier: carrier,
        driver_name: `Driver #${2000 + i}`,
        truck_id: `TRK-${8000 + i}`,
        distance: dist,
        lead_days: leadDays,
        freight_cost: freightCost,
        revenue: revenue,
        status: status,
        gross_profit: revenue - freightCost,
        co2_kg: Math.round(dist * 1.62),
        dest_lat: dest.lat,
        dest_lng: dest.lng
      });
    }

    return shipments;
  }

  // -------------------------------------------------------------------
  // Haversine Distance Helper (Miles)
  // -------------------------------------------------------------------
  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // -------------------------------------------------------------------
  // Backend Connection Prober
  // -------------------------------------------------------------------
  async function probeBackendAPI() {
    const statusText = document.getElementById('backend-status-text');
    const indicator = document.getElementById('backend-indicator');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch('/api/stats', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        STATE.apiOnline = true;
        if (indicator) indicator.classList.remove('offline');
        if (statusText) statusText.innerHTML = `<strong style="color:var(--neon-green)">${STATE.mode === 'ru' ? 'СВЯЗЬ: ОНЛАЙН [8080]' : 'API: ONLINE [8080]'}</strong>`;
        return true;
      }
    } catch (e) {
      // offline
    }

    STATE.apiOnline = false;
    if (indicator) indicator.classList.add('offline');
    if (statusText) statusText.innerHTML = `<span style="color:var(--neon-amber)">${STATE.mode === 'ru' ? 'АВТОНОМНЫЙ РЕЖИМ' : 'STANDALONE SIM'}</span>`;
    return false;
  }

  // -------------------------------------------------------------------
  // Clock Updater (MSK / UTC)
  // -------------------------------------------------------------------
  function initClock() {
    const clockEl = document.getElementById('hud-clock');
    function update() {
      const now = new Date();
      if (STATE.mode === 'ru') {
        // Moscow Time (UTC+3)
        const mskTime = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
        const timeStr = mskTime.toTimeString().split(' ')[0];
        clockEl.textContent = `МСК ${timeStr} • ПРЯМОЙ ЭФИР`;
      } else {
        const utcStr = now.toUTCString().split(' ')[4];
        clockEl.textContent = `UTC ${utcStr} • LIVE`;
      }
    }
    update();
    setInterval(update, 1000);
  }

  // -------------------------------------------------------------------
  // Map Operations (Google Maps, Satellite, Hybrid & Viewports)
  // -------------------------------------------------------------------
  const BASE_MAPS = {
    'google-hybrid': {
      name: 'Google Гибрид',
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      options: { subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: 'Map data © Google' }
    },
    'google-satellite': {
      name: 'Google Спутник',
      url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      options: { subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: 'Imagery © Google' }
    },
    'google-roadmap': {
      name: 'Google Схема',
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      options: { subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: 'Map data © Google' }
    },
    'google-terrain': {
      name: 'Google Рельеф',
      url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      options: { subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: 'Map data © Google' }
    },
    'carto-dark': {
      name: 'Тёмная тема (CartoDB)',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      options: { subdomains: 'abcd', maxZoom: 19, attribution: '© CartoDB' }
    },
    'osm': {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { subdomains: ['a', 'b', 'c'], maxZoom: 19, attribution: '© OpenStreetMap' }
    }
  };

  function switchBaseMap(type) {
    if (!STATE.map || typeof L === 'undefined') return;
    const cfg = BASE_MAPS[type] || BASE_MAPS['google-hybrid'];

    if (STATE.baseMapLayer) {
      STATE.map.removeLayer(STATE.baseMapLayer);
    }

    STATE.baseMapLayer = L.tileLayer(cfg.url, cfg.options).addTo(STATE.map);
    STATE.baseMapLayer.bringToBack();
    STATE.baseMap = type;

    const selectEl = document.getElementById('map-basemap-select');
    if (selectEl && selectEl.value !== type) {
      selectEl.value = type;
    }
  }

  function initMap() {
    const mapEl = document.getElementById('map');
    const fallbackEl = document.getElementById('map-fallback');

    if (typeof L === 'undefined') {
      if (mapEl) mapEl.style.display = 'none';
      if (fallbackEl) fallbackEl.style.display = 'flex';
      return;
    }

    try {
      const center = STATE.mode === 'ru' ? [55.75, 48.0] : [38.2, -96.5];
      const zoom = STATE.mode === 'ru' ? 4 : 4.4;

      STATE.map = L.map('map', {
        center: center,
        zoom: zoom,
        minZoom: 3,
        maxZoom: 20,
        zoomControl: true,
        attributionControl: false
      });

      switchBaseMap(STATE.baseMap || 'google-hybrid');

      STATE.mapLayers.factories = L.layerGroup().addTo(STATE.map);
      STATE.mapLayers.routes = L.layerGroup().addTo(STATE.map);
      STATE.mapLayers.trucks = L.layerGroup().addTo(STATE.map);

      STATE.map.on('mousemove', e => {
        const hudCoords = document.getElementById('hud-latlng');
        if (hudCoords) {
          hudCoords.textContent = `${e.latlng.lat.toFixed(4)}° N, ${Math.abs(e.latlng.lng).toFixed(4)}° ${e.latlng.lng >= 0 ? 'E' : 'W'}`;
        }
      });
    } catch (err) {
      console.error('Failed to init Leaflet map:', err);
      if (mapEl) mapEl.style.display = 'none';
      if (fallbackEl) fallbackEl.style.display = 'flex';
    }
  }

  function renderMapLayers() {
    if (!STATE.map || typeof L === 'undefined') return;

    STATE.mapLayers.factories.clearLayers();
    STATE.mapLayers.routes.clearLayers();
    STATE.mapLayers.trucks.clearLayers();

    const isRu = STATE.mode === 'ru';
    const factDict = isRu ? RU_FACTORIES : US_FACTORIES;

    // Reposition map view to active country
    if (isRu) {
      STATE.map.setView([55.75, 48.0], 4);
    } else {
      STATE.map.setView([38.2, -96.5], 4.4);
    }

    // 1. Plot Factories
    Object.keys(factDict).forEach(name => {
      const hub = factDict[name];

      const customIcon = L.divIcon({
        className: 'factory-marker-container',
        html: `
          <div class="factory-marker-icon" style="color: ${hub.color}">
            <div class="factory-pulse-ring"></div>
            <div class="factory-core-pin">🏭</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([hub.lat, hub.lng], { icon: customIcon });

      const popupHtml = `
        <div class="popup-hud">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${hub.color};"></span>
            <h3>${name}</h3>
          </div>
          <p class="location">📍 ${hub.city}, ${hub.region} (${hub.lat.toFixed(3)}, ${hub.lng.toFixed(3)})</p>
          <div style="font-size:10px; color:var(--text-muted); margin-bottom:6px;">
            <strong>${isRu ? 'Продукция:' : 'Products:'}</strong> ${hub.products}
          </div>
          <div class="grid-stats">
            <div class="grid-stat-box">
              <div class="stat-lbl">${isRu ? 'Мощность' : 'Capacity'}</div>
              <div class="stat-val" style="color:${hub.color}">${hub.capacity}</div>
            </div>
            <div class="grid-stat-box">
              <div class="stat-lbl">${isRu ? 'Выпуск' : 'Monthly Output'}</div>
              <div class="stat-val">${hub.monthlyOutput}</div>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      STATE.mapLayers.factories.addLayer(marker);
    });

    // 2. Plot Corridors & Active Trucks
    STATE.routes.forEach((route, idx) => {
      const origLat = route.origin_lat;
      const origLng = route.origin_lng;
      const destLat = route.dest_lat;
      const destLng = route.dest_lng;

      if (!origLat || !origLng || !destLat || !destLng) return;

      const fColor = factDict[route.origin_factory] ? factDict[route.origin_factory].color : '#00f0ff';

      const latlngs = [
        [origLat, origLng],
        [(origLat + destLat) / 2 + (isRu ? 0.3 : 0.4), (origLng + destLng) / 2 - (isRu ? 0.3 : 0.4)],
        [destLat, destLng]
      ];

      const line = L.polyline(latlngs, {
        color: fColor,
        weight: 2,
        opacity: 0.65,
        dashArray: '6, 8',
        smoothFactor: 1
      });

      const tipText = isRu 
        ? `Трасса: ${route.highway || 'Федеральная'} // ${route.origin_factory} ➔ ${route.dest_city} (${route.distance} км)`
        : `Corridor: ${route.highway || 'Interstate'} // ${route.origin_factory} ➔ ${route.dest_city} (${route.distance} mi)`;

      line.bindTooltip(tipText, { sticky: true });
      STATE.mapLayers.routes.addLayer(line);

      // Moving Truck Marker
      const truckIcon = L.divIcon({
        className: 'truck-hud-icon',
        html: `<span style="font-size:12px; filter: drop-shadow(0 0 4px ${fColor});">🚚</span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const midLat = (origLat + destLat) / 2;
      const midLng = (origLng + destLng) / 2;
      const truckMarker = L.marker([midLat, midLng], { icon: truckIcon });

      truckMarker.bindPopup(`
        <strong>${isRu ? 'Тягач в рейсе' : 'Tractor in Transit'} #TRK-${1000 + idx}</strong><br>
        ${route.origin_factory} ➔ ${route.dest_city}<br>
        ${isRu ? 'Трасса: ' + (route.highway || 'М-11') : 'Highway: ' + (route.highway || 'I-10')}
      `);

      STATE.mapLayers.trucks.addLayer(truckMarker);
    });

    renderMapLegend(isRu, factDict);
  }

  function renderMapLegend(isRu, factDict) {
    const legendBox = document.getElementById('map-legend-box');
    if (!legendBox) return;

    legendBox.innerHTML = Object.keys(factDict).map(name => {
      const hub = factDict[name];
      return `
        <div class="legend-item">
          <span class="legend-dot ${hub.badgeClass}"></span>
          <span>${name} (${hub.region})</span>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------------
  // View Rendering & KPI Animated Count-up
  // -------------------------------------------------------------------
  function renderAllViews() {
    renderKPIs();
    renderAgentStatusCards();
    renderAgentLogs();
    renderMapLayers();
    applyFilters();
  }

  function renderKPIs() {
    const s = STATE.stats;
    if (!s) return;
    const isRu = STATE.mode === 'ru';

    animateValue('kpi-total-volume', 0, s.totalVolume || 10195, 1000, false);
    animateValue('kpi-total-distance', 0, s.totalDistance || 20672500, 1200, false);
    animateValue('kpi-avg-transit', 0, s.avgTransitTime || 3.4, 800, true, 1);
    animateValue('kpi-active-drivers', 0, s.activeDrivers || 1284, 900, false);

    const subVol = document.getElementById('kpi-sub-volume');
    if (subVol) {
      subVol.innerHTML = isRu
        ? `Груз: <strong id="kpi-total-units">${(s.totalUnits || 38654).toLocaleString('ru-RU')}</strong> поддонов`
        : `Payload: <strong id="kpi-total-units">1.84M</strong> units`;
    }

    const subDist = document.getElementById('kpi-sub-distance');
    if (subDist) {
      subDist.innerHTML = isRu
        ? `Плечо: <strong id="kpi-avg-haul">${(s.avgHaul || 1260).toLocaleString('ru-RU')}</strong> км`
        : `Avg Haul: <strong id="kpi-avg-haul">1,260</strong> mi`;
    }

    const revEl = document.getElementById('kpi-total-revenue');
    if (revEl) {
      revEl.textContent = isRu 
        ? `${Math.round(s.totalRevenue || 186090000).toLocaleString('ru-RU')} ₽`
        : `$${Math.round(s.totalRevenue || 2481200).toLocaleString('en-US')}`;
    }

    const marginEl = document.getElementById('kpi-net-margin');
    if (marginEl) {
      marginEl.textContent = `${(s.netMargin || 41.8).toFixed(1)}%`;
    }

    const fleetEl = document.getElementById('header-active-fleet');
    if (fleetEl) {
      fleetEl.textContent = (s.activeFleet || 1420).toLocaleString(isRu ? 'ru-RU' : 'en-US');
    }

    const utilEl = document.getElementById('kpi-fleet-util');
    if (utilEl) {
      utilEl.textContent = `${(s.fleetUtilization || 92.4).toFixed(1)}%`;
    }
  }

  function animateValue(elementId, start, end, duration, isFloat = false, decimals = 1) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    const isRu = STATE.mode === 'ru';

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * (end - start) + start;

      if (isFloat) {
        obj.textContent = current.toFixed(decimals);
      } else {
        obj.textContent = Math.floor(current).toLocaleString(isRu ? 'ru-RU' : 'en-US');
      }

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  function renderAgentStatusCards() {
    const ag = STATE.agents;
    if (!ag) return;
    const isRu = STATE.mode === 'ru';

    // Apex
    const apex = ag.apex;
    if (apex) {
      const elStatus = document.getElementById('apex-status');
      if (elStatus) elStatus.textContent = isRu ? 'ОПТИМИЗАЦИЯ' : 'OPTIMIZING';
      const elLoad = document.getElementById('apex-metric-load');
      if (elLoad) elLoad.textContent = isRu ? '96.8% Полная' : '96.8% Full';
      const elCarrier = document.getElementById('apex-metric-carrier');
      if (elCarrier) elCarrier.textContent = isRu ? 'Деловые Линии / ПЭК' : 'Schneider / Swift';
    }

    // Pathfinder
    const pfind = ag.pathfinder;
    if (pfind) {
      const elStatus = document.getElementById('pathfinder-status');
      if (elStatus) elStatus.textContent = isRu ? 'АКТИВЕН' : 'ACTIVE';
      const elDh = document.getElementById('pathfinder-metric-deadhead');
      if (elDh) elDh.textContent = isRu ? '-14.2% км' : '-14.2% Miles';
      const elHos = document.getElementById('pathfinder-metric-hos');
      if (elHos) elHos.textContent = isRu ? 'М-11/М-12 100%' : '100% Valid';
    }

    // Sentinel
    const sent = ag.sentinel;
    if (sent) {
      const elStatus = document.getElementById('sentinel-status');
      if (elStatus) elStatus.textContent = isRu ? 'МОНИТОРИНГ' : 'TRACKING';
      const elGps = document.getElementById('sentinel-metric-gps');
      if (elGps) elGps.textContent = isRu ? 'ГЛОНАСС 32мс' : '42ms Real-Time';
      const elEta = document.getElementById('sentinel-metric-eta');
      if (elEta) elEta.textContent = isRu ? '98.2% в срок' : '98.2% On-Time';
    }

    // Veritas
    const vert = ag.veritas;
    if (vert) {
      const elStatus = document.getElementById('veritas-status');
      if (elStatus) elStatus.textContent = isRu ? 'АУДИТ' : 'AUDITING';
      const elCpm = document.getElementById('veritas-metric-cpm');
      if (elCpm) elCpm.textContent = isRu ? '110 ₽ / км' : '$2.18 / mi';
      const elMargin = document.getElementById('veritas-metric-margin');
      if (elMargin) elMargin.textContent = isRu ? '41.8% Чистая' : '41.8% Net';
    }
  }

  function renderAgentLogs() {
    const feed = document.getElementById('agent-log-feed');
    if (!feed) return;

    feed.innerHTML = '';
    STATE.agentLogs.forEach(item => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = `
        <span class="log-time">[${item.time}]</span>
        <span class="log-agent ${item.agent}">${item.agent.toUpperCase()}</span>
        <span class="log-msg">${item.msg}</span>
      `;
      feed.appendChild(div);
    });

    if (STATE.autoScrollLogs) {
      feed.scrollTop = feed.scrollHeight;
    }
  }

  function logToTerminal(agent, message) {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const logItem = { time, agent: agent.toLowerCase(), msg: message };

    STATE.agentLogs.push(logItem);
    if (STATE.agentLogs.length > 80) {
      STATE.agentLogs.shift();
    }

    renderAgentLogs();
  }

  // -------------------------------------------------------------------
  // Multi-Agent Dispatch Trigger Action
  // -------------------------------------------------------------------
  async function triggerMultiAgentDispatch() {
    if (STATE.dispatchCycleRunning) return;
    STATE.dispatchCycleRunning = true;

    const isRu = STATE.mode === 'ru';
    const btn = document.getElementById('btn-run-dispatch');
    const label = document.getElementById('btn-dispatch-label');

    btn.classList.add('running');
    label.textContent = isRu 
      ? '⚙️ ВЫПОЛНЕНИЕ ДИСПЕТЧЕРСКОГО ЦИКЛА (ОБРАБОТКА)...'
      : '⚙️ RUNNING MULTI-AGENT DISPATCH CYCLE...';

    logToTerminal('СИСТЕМА', isRu ? '⚡ ЗАПУЩЕН ДИСПЕТЧЕРСКИЙ ЦИКЛ САБ-АГЕНТОВ РФ' : '⚡ INITIATED AUTONOMOUS MULTI-AGENT DISPATCH PIPELINE');
    showToast(isRu ? 'Запущен цикл автономной диспетчеризации автоколонн' : 'Autonomous Dispatch Cycle started by operator', 'amber');

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Agent 1: APEX (Апекс)
    document.getElementById('apex-status').textContent = isRu ? 'ФОРМИРОВАНИЕ' : 'BUNDLING';
    document.getElementById('apex-status').className = 'agent-status-badge optimizing';
    logToTerminal(isRu ? 'АПЕКС' : 'APEX', isRu
      ? 'Пакетная консолидация LTL: сформирован рейс на еврофуру 20т (Красный Октябрь ➔ РЦ Магнит Краснодар). Назначен перевозчик: Деловые Линии.'
      : 'Bundled 1,840 Wonka candy cases into 53\' Reefer Trailer #TRK-8842. Carrier assigned: Schneider National.');
    await sleep(650);

    // Agent 2: PATHFINDER (Следопыт)
    document.getElementById('pathfinder-status').textContent = isRu ? 'РАСЧЕТ' : 'ROUTING';
    document.getElementById('pathfinder-status').className = 'agent-status-badge optimizing';
    logToTerminal(isRu ? 'СЛЕДОПЫТ' : 'PATHFINDER', isRu
      ? 'Проложен маршрут по трассе М-4 «Дон» (1 340 км). Оптимальный объезд ремонта у Каменск-Шахтинского: экономия 42 мин.'
      : 'Evaluating highway corridors: Casa Grande (AZ) → Los Angeles (CA) via I-10 W. Avoiding peak bottleneck near Palm Springs.');
    await sleep(650);

    // Agent 3: SENTINEL (Часовой)
    document.getElementById('sentinel-status').textContent = isRu ? 'ПРОВЕРКА' : 'TELEMETRY';
    document.getElementById('sentinel-status').className = 'agent-status-badge monitoring';
    logToTerminal(isRu ? 'ЧАСОВОЙ' : 'SENTINEL', isRu
      ? 'ГЛОНАСС-трекер #TK-7742 активен. Температура в полуприцепе Schmitz SKO 24 стабильна (+16.8°C). РТО водителя соблюдено (тахограф СКЗИ).'
      : 'Telemetry ping to tractor ECM: Reefer temperature locked at 36.2°F. Driver HOS logbook verified: 7.5h driving remaining.');
    await sleep(650);

    // Agent 4: VERITAS (Аудитор)
    document.getElementById('veritas-status').textContent = isRu ? 'СВЕРКА' : 'AUDITING';
    document.getElementById('veritas-status').className = 'agent-status-badge auditing';
    logToTerminal(isRu ? 'АУДИТОР' : 'VERITAS', isRu
      ? 'Аудит юнит-экономики: ставка 110 ₽/км. Учтён тариф Платон (3.05 ₽/км) и дизель. Маржа: 38.4%. ЭТрН #RU-2024-9912 подписана ЭЦП.'
      : 'Auditing lane unit economics: Spot rate $2.42/mi accepted. Total freight $1,280, gross profit $540 (42.2% margin). Manifest authorized.');
    await sleep(600);

    // Reset status badges
    document.getElementById('apex-status').textContent = isRu ? 'ОПТИМИЗАЦИЯ' : 'ACTIVE';
    document.getElementById('apex-status').className = 'agent-status-badge active';
    document.getElementById('pathfinder-status').textContent = isRu ? 'АКТИВЕН' : 'ACTIVE';
    document.getElementById('pathfinder-status').className = 'agent-status-badge active';
    document.getElementById('sentinel-status').textContent = isRu ? 'МОНИТОРИНГ' : 'TRACKING';
    document.getElementById('sentinel-status').className = 'agent-status-badge monitoring';
    document.getElementById('veritas-status').textContent = isRu ? 'АУДИТ' : 'AUDITING';
    document.getElementById('veritas-status').className = 'agent-status-badge auditing';

    // Inject New High-Priority Dispatched Record
    const newRecord = isRu ? {
      order_id: `ЭТрН-RU-2024-${Math.floor(200000 + Math.random() * 9999)}-КЭП`,
      order_date: new Date().toISOString().split('T')[0],
      ship_date: new Date().toISOString().split('T')[0],
      factory: "Красный Октябрь",
      city: "Краснодар (РЦ Адыгея)",
      state: "Краснодарский край",
      zip: "350000",
      ship_mode: "Рефрижератор",
      product: "Шоколад «Алёнка»",
      truck_type: "КАМАЗ-54901 NEO // Рефрижератор",
      carrier: "Деловые Линии",
      driver_name: "Воронов А.С.",
      truck_id: "У 842 ТТ 777",
      distance: 1340,
      lead_days: 2.0,
      freight_cost: 112000,
      revenue: 154000,
      status: "В пути",
      gross_profit: 42000,
      co2_kg: 1540,
      dest_lat: 44.9800,
      dest_lng: 39.0200
    } : {
      order_id: `US-2024-${Math.floor(130000 + Math.random() * 9999)}-WONKA`,
      order_date: new Date().toISOString().split('T')[0],
      ship_date: new Date().toISOString().split('T')[0],
      factory: "Lot's O' Nuts",
      city: "Los Angeles",
      state: "California",
      zip: "90001",
      ship_mode: "First Class",
      product: "Wonka Bar - Triple Dazzle Caramel",
      truck_type: "53' Reefer (Temp-Controlled)",
      carrier: "Schneider National",
      driver_name: "Driver #2841",
      truck_id: "TRK-8842",
      distance: 395,
      lead_days: 1.0,
      freight_cost: 955,
      revenue: 1420,
      status: "In Transit",
      gross_profit: 465,
      co2_kg: 640,
      dest_lat: 34.0522,
      dest_lng: -118.2437
    };

    STATE.allShipments.unshift(newRecord);
    STATE.stats.totalVolume += 1;
    STATE.stats.activeFleet += 1;
    STATE.stats.totalDistance += newRecord.distance;
    STATE.stats.totalRevenue += newRecord.revenue;

    renderKPIs();
    applyFilters();

    btn.classList.remove('running');
    label.textContent = isRu 
      ? '⚡ Запустить цикл диспетчеризации (Run Multi-Agent Dispatch)'
      : '⚡ Run Multi-Agent Dispatch';
    STATE.dispatchCycleRunning = false;

    showToast(isRu 
      ? '⚡ Цикл завершен: автопоезд сформирован, ЭТрН подписана КЭП!' 
      : '⚡ Dispatch cycle complete: load consolidated & authorized!', 'success');
  }

  // -------------------------------------------------------------------
  // Table Filtering, Sorting & Pagination
  // -------------------------------------------------------------------
  function applyFilters() {
    const f = STATE.filters;
    const searchLow = f.search.toLowerCase().trim();

    const filtered = STATE.allShipments.filter(item => {
      if (f.factory !== 'ALL' && item.factory !== f.factory) return false;
      if (f.shipMode !== 'ALL' && !item.ship_mode.toLowerCase().includes(f.shipMode.toLowerCase())) return false;
      if (f.state !== 'ALL' && item.state !== f.state) return false;
      if (f.status !== 'ALL' && item.status !== f.status) return false;

      if (searchLow) {
        const text = `${item.order_id} ${item.city} ${item.state} ${item.carrier} ${item.driver_name || ''} ${item.truck_id || ''} ${item.product}`.toLowerCase();
        if (!text.includes(searchLow)) return false;
      }

      return true;
    });

    // Sorting
    const { column, asc } = STATE.sorting;
    const sign = asc ? 1 : -1;

    filtered.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      if (column === 'date') {
        valA = a.order_date;
        valB = b.order_date;
      } else if (column === 'distance') {
        valA = a.distance;
        valB = b.distance;
      } else if (column === 'freight_cost') {
        valA = a.freight_cost;
        valB = b.freight_cost;
      }

      if (valA < valB) return -1 * sign;
      if (valA > valB) return 1 * sign;
      return 0;
    });

    STATE.pagination.totalCount = filtered.length;
    STATE.pagination.totalPages = Math.max(1, Math.ceil(filtered.length / STATE.pagination.pageSize));

    const startIdx = (STATE.pagination.page - 1) * STATE.pagination.pageSize;
    STATE.shipments = filtered.slice(startIdx, startIdx + STATE.pagination.pageSize);

    updatePaginationAndTable();
  }

  function updatePaginationAndTable() {
    const total = STATE.pagination.totalCount;
    const { page, pageSize, totalPages } = STATE.pagination;
    const isRu = STATE.mode === 'ru';

    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);

    const showingEl = document.getElementById('table-showing-range');
    const totalEl = document.getElementById('table-total-count');
    if (showingEl) showingEl.textContent = total > 0 ? `${startIdx + 1}-${endIdx}` : '0-0';
    if (totalEl) totalEl.textContent = total.toLocaleString(isRu ? 'ru-RU' : 'en-US');

    renderTableRows(STATE.shipments);
    renderPaginationControls();
  }

  function renderTableRows(rows) {
    const tbody = document.getElementById('shipments-table-body');
    if (!tbody) return;
    const isRu = STATE.mode === 'ru';
    const factDict = isRu ? RU_FACTORIES : US_FACTORIES;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 30px; color: var(--text-dim); font-family: var(--font-mono);">
            ${isRu ? 'РЕЙСЫ ПО ВЫБРАННЫМ КРИТЕРИЯМ НЕ НАЙДЕНЫ. ПОПРОБУЙТЕ СБРОСИТЬ ФИЛЬТРЫ.' : 'NO FREIGHT SHIPMENTS MATCH CURRENT FILTERS. TRY RESETTING CRITERIA.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const factMeta = factDict[r.factory] || { badgeClass: 'krasny' };
      const statusClass = (r.status || 'доставлен').toLowerCase().replace(/\s+/g, '-');
      const classTag = (r.ship_mode || 'тент').toLowerCase().replace(/\s+/g, '-');
      const distUnit = isRu ? 'км' : 'mi';
      const currencySymbol = isRu ? '₽' : '$';

      return `
        <tr data-order-id="${r.order_id}">
          <td class="mono-cell" style="color:var(--neon-cyan); font-weight:600;">${r.order_id}</td>
          <td class="mono-cell" style="font-size:11px;">${r.order_date} → ${r.ship_date}</td>
          <td>
            <div class="factory-tag ${factMeta.badgeClass}">
              <span class="fdot"></span>
              <span>${r.factory}</span>
            </div>
          </td>
          <td>
            <strong>${r.city}</strong>, ${r.state}
          </td>
          <td>
            <span class="class-tag ${classTag}">${r.ship_mode}</span>
          </td>
          <td style="font-size:11px; color:var(--text-muted);">${r.truck_type}</td>
          <td style="font-weight:500;">${r.carrier}</td>
          <td class="mono-cell">${(r.distance || 0).toLocaleString(isRu ? 'ru-RU' : 'en-US')} ${distUnit}</td>
          <td class="mono-cell">${r.lead_days} ${isRu ? 'дн' : 'd'}</td>
          <td class="mono-cell">
            <span style="color:var(--neon-green);">${(r.revenue || 0).toLocaleString(isRu ? 'ru-RU' : 'en-US')} ${currencySymbol}</span>
            <span style="color:var(--text-dim); font-size:10px;">(${(r.freight_cost || 0).toLocaleString(isRu ? 'ru-RU' : 'en-US')})</span>
          </td>
          <td>
            <span class="badge ${statusClass}">${r.status}</span>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const orderId = tr.getAttribute('data-order-id');
        openManifestModal(orderId);
      });
    });
  }

  function renderPaginationControls() {
    const { page, totalPages } = STATE.pagination;
    const isRu = STATE.mode === 'ru';
    const pageIndicator = document.getElementById('page-indicator');
    if (pageIndicator) pageIndicator.textContent = isRu ? `Страница ${page} из ${totalPages}` : `Page ${page} of ${totalPages}`;

    const btnFirst = document.getElementById('btn-page-first');
    const btnPrev = document.getElementById('btn-page-prev');
    const btnNext = document.getElementById('btn-page-next');
    const btnLast = document.getElementById('btn-page-last');

    if (btnFirst) btnFirst.disabled = page === 1;
    if (btnPrev) btnPrev.disabled = page === 1;
    if (btnNext) btnNext.disabled = page === totalPages;
    if (btnLast) btnLast.disabled = page === totalPages;

    const numContainer = document.getElementById('pagination-number-buttons');
    if (!numContainer) return;

    numContainer.innerHTML = '';
    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.className = `page-btn ${p === page ? 'active' : ''}`;
      btn.textContent = p;
      btn.addEventListener('click', () => {
        STATE.pagination.page = p;
        applyFilters();
      });
      numContainer.appendChild(btn);
    }
  }

  // -------------------------------------------------------------------
  // Electronic Transportation Waybill Modal (ЭТрН / BOL)
  // -------------------------------------------------------------------
  function openManifestModal(orderId) {
    const item = STATE.allShipments.find(s => s.order_id === orderId) || STATE.shipments.find(s => s.order_id === orderId);
    if (!item) return;

    const isRu = STATE.mode === 'ru';
    const modal = document.getElementById('manifest-modal');
    const title = document.getElementById('modal-title');
    const content = document.getElementById('modal-content');

    title.textContent = isRu 
      ? `ЭЛЕКТРОННАЯ ТРАНСПОРТНАЯ НАКЛАДНАЯ (ЭТрН) // № ${item.order_id}`
      : `FREIGHT MANIFEST // ORDER # ${item.order_id}`;

    const currency = isRu ? '₽' : '$';
    const distUnit = isRu ? 'км' : 'Miles';

    content.innerHTML = `
      ${isRu ? `
        <div class="etrn-seal-bar">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">🛡️</span>
            <strong>КЭП ПОДТВЕРЖДЕНА // ГОСУДАРСТВЕННАЯ СИСТЕМА ЭПД (ФНС РОССИИ)</strong>
          </div>
          <span style="font-size:10px;">ID: 7702-RU-${Math.floor(100000+Math.random()*900000)}</span>
        </div>
      ` : ''}

      <div class="manifest-grid">
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Грузоотправитель (РЦ)' : 'Origin Facility'}</div>
          <div class="manifest-value" style="color:var(--neon-cyan)">${item.factory}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Пункт назначения (РЦ)' : 'Destination Hub'}</div>
          <div class="manifest-value">${item.city}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Регион доставки' : 'Destination State'}</div>
          <div class="manifest-value">${item.state}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Транспортная компания' : 'Carrier'}</div>
          <div class="manifest-value" style="color:var(--neon-amber)">${item.carrier}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Водитель и тягач' : 'Driver & Tractor'}</div>
          <div class="manifest-value">${item.driver_name || 'Воронов А.С.'} (${item.truck_id || 'Р 777 МК 777'})</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Тип автопоезда' : 'Equipment Type'}</div>
          <div class="manifest-value">${item.truck_type}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Маршрут и дистанция' : 'Transit Haul Distance'}</div>
          <div class="manifest-value">${item.distance.toLocaleString()} ${distUnit}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Срок доставки (SLA)' : 'Lead Time'}</div>
          <div class="manifest-value">${item.lead_days} ${isRu ? 'дней' : 'Days'}</div>
        </div>
        <div class="manifest-item">
          <div class="manifest-label">${isRu ? 'Статус рейса' : 'Trip Status'}</div>
          <div class="manifest-value" style="color:var(--neon-green)">${item.status}</div>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:12px;">
        <div class="manifest-label">${isRu ? 'Грузовой манифест и юнит-экономика рейса' : 'Cargo Manifest & Unit Economics'}</div>
        <div style="font-size:13px; font-weight:600; color:var(--text-highlight); margin-bottom:8px;">
          🍬 ${item.product}
        </div>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">
          <span>${isRu ? 'Фрахт:' : 'Billed:'} <strong style="color:var(--neon-green);">${item.revenue.toLocaleString()} ${currency}</strong></span>
          <span>${isRu ? 'Себестоимость:' : 'Cost:'} <strong>${item.freight_cost.toLocaleString()} ${currency}</strong></span>
          <span>${isRu ? 'Чистая маржа:' : 'Profit:'} <strong style="color:var(--neon-cyan);">${item.gross_profit.toLocaleString()} ${currency} (${((item.gross_profit / item.revenue) * 100).toFixed(1)}%)</strong></span>
          <span>${isRu ? 'CO2 след:' : 'CO2:'} <strong>${item.co2_kg} кг</strong></span>
        </div>
      </div>

      ${isRu ? `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:11px; font-family:var(--font-mono);">
          <div style="background:rgba(0,240,255,0.05); border:1px solid rgba(0,240,255,0.2); padding:8px 12px; border-radius:4px;">
            🛰️ <strong>ГЛОНАСС Телематика:</strong> Термописец +16.8°C | Режим труда и отдыха ЕСТР (7ч руления)
          </div>
          <div style="background:rgba(255,183,0,0.05); border:1px solid rgba(255,183,0,0.2); padding:8px 12px; border-radius:4px;">
            ⚖️ <strong>АПВГК & Платон:</strong> Весовой контроль пройден (нагрузка 8.4т/ось) | Сбор оплачен
          </div>
        </div>
      ` : ''}
    `;

    modal.classList.add('open');
  }

  function closeManifestModal() {
    const modal = document.getElementById('manifest-modal');
    if (modal) modal.classList.remove('open');
  }

  // -------------------------------------------------------------------
  // Charts Initialization (RU & US Data)
  // -------------------------------------------------------------------
  function initCharts() {
    renderFactoryVolumeChart();
    renderShippingModesChart();
    renderTopCorridorsChart();
  }

  function renderFactoryVolumeChart() {
    const ctx = document.getElementById('chart-factory-volume');
    if (!ctx) return;
    const isRu = STATE.mode === 'ru';

    const labels = isRu 
      ? ["Красный Октябрь", "Славянка", "КДВ Яшкино", "Россия", "Победа", "Самойловой"]
      : ["Lot's O' Nuts", "Wicked Choccy's", "Secret Factory", "The Other Factory", "Sugar Shack"];

    const data = isRu 
      ? [3420, 2840, 2150, 1100, 520, 165]
      : [5692, 4152, 217, 100, 33];

    const colors = isRu 
      ? ['#ffb700', '#00f0ff', '#00e676', '#ff2a85', '#00e5ff', '#b388ff']
      : ['#ffb700', '#00f0ff', '#b388ff', '#ff2a85', '#00e676'];

    if (typeof Chart === 'undefined') {
      renderCanvasDonutFallback(ctx, labels.map((l, i) => ({ label: l, val: data[i], color: colors[i] })));
      return;
    }

    try {
      if (STATE.charts.factoryVolume) STATE.charts.factoryVolume.destroy();

      STATE.charts.factoryVolume = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderColor: '#0f172a',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 10 },
                boxWidth: 10
              }
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(0, 240, 255, 0.3)',
              borderWidth: 1
            }
          },
          cutout: '68%'
        }
      });
    } catch (e) {
      console.warn('Chart.js render error:', e);
    }
  }

  function renderShippingModesChart() {
    const ctx = document.getElementById('chart-shipping-modes');
    if (!ctx) return;
    const isRu = STATE.mode === 'ru';

    const labels = isRu 
      ? ['Рефрижератор (+16...+18°C)', 'Еврофура 20т Тент', 'Изотермический п/п', 'Городской развоз']
      : ['Standard Class', 'Second Class', 'First Class', 'Same Day'];

    const data = [6120, 1979, 1548, 547];

    if (typeof Chart === 'undefined') {
      renderCanvasBarFallback(ctx, labels.map((l, i) => ({ label: l, val: data[i], color: ['#00f0ff', '#ffb700', '#00e676', '#ff2a85'][i] })));
      return;
    }

    try {
      if (STATE.charts.shippingModes) STATE.charts.shippingModes.destroy();

      STATE.charts.shippingModes = new Chart(ctx, {
        type: 'polarArea',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(0, 240, 255, 0.55)',
              'rgba(255, 183, 0, 0.55)',
              'rgba(0, 230, 118, 0.55)',
              'rgba(255, 42, 133, 0.55)'
            ],
            borderColor: ['#00f0ff', '#ffb700', '#00e676', '#ff2a85'],
            borderWidth: 1.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
              ticks: { display: false }
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#94a3b8', font: { family: 'Inter', size: 9 }, boxWidth: 10 }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Chart.js render error:', e);
    }
  }

  function renderTopCorridorsChart() {
    const ctx = document.getElementById('chart-top-corridors');
    if (!ctx) return;
    const isRu = STATE.mode === 'ru';

    const labels = isRu ? [
      "Красный Октябрь → Санкт-Петербург (М-11)",
      "Красный Октябрь → Краснодар (М-4)",
      "Славянка → Москва (М-2)",
      "Красный Октябрь → Казань (М-12)",
      "Россия → Уфа (М-5)",
      "Славянка → Ростов-на-Дону (М-4)",
      "КДВ Яшкино → Новосибирск (Р-255)",
      "КДВ Яшкино → Екатеринбург (Р-254)",
      "Победа Вкуса → Воронеж (М-4)",
      "Самойловой → Москва (М-11)"
    ] : [
      "Lot's O' Nuts → CA",
      "Wicked Choccy's → CA",
      "Lot's O' Nuts → NY",
      "Lot's O' Nuts → TX",
      "Wicked Choccy's → NY",
      "Wicked Choccy's → TX",
      "Lot's O' Nuts → PA",
      "Lot's O' Nuts → WA",
      "Lot's O' Nuts → IL",
      "Lot's O' Nuts → OH"
    ];

    const data = [1125, 823, 645, 569, 436, 388, 331, 269, 267, 262];

    if (typeof Chart === 'undefined') {
      renderCanvasHorizontalBarFallback(ctx, labels, data);
      return;
    }

    try {
      if (STATE.charts.topCorridors) STATE.charts.topCorridors.destroy();

      STATE.charts.topCorridors = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: isRu ? 'Объем рейсов' : 'Shipment Volume',
            data: data,
            backgroundColor: data.map((_, i) => i % 2 === 0 ? 'rgba(255, 183, 0, 0.7)' : 'rgba(0, 240, 255, 0.7)'),
            borderColor: data.map((_, i) => i % 2 === 0 ? '#ffb700' : '#00f0ff'),
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { family: 'Inter', size: 9 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(0, 240, 255, 0.3)',
              borderWidth: 1
            }
          }
        }
      });
    } catch (e) {
      console.warn('Chart.js render error:', e);
    }
  }

  // -------------------------------------------------------------------
  // Canvas Fallbacks for Zero-Dependency Resilience
  // -------------------------------------------------------------------
  function renderCanvasDonutFallback(canvas, items) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 300;
    const h = canvas.height = canvas.parentElement.clientHeight || 200;
    ctx.clearRect(0, 0, w, h);

    const total = items.reduce((acc, i) => acc + i.val, 0);
    let curAngle = -0.5 * Math.PI;
    const cx = w * 0.35, cy = h * 0.5, r = Math.min(cx, cy) * 0.8;

    items.forEach(item => {
      const sliceAngle = (item.val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, curAngle, curAngle + sliceAngle);
      ctx.arc(cx, cy, r * 0.6, curAngle + sliceAngle, curAngle, true);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      curAngle += sliceAngle;
    });

    let legY = 16;
    items.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(w * 0.64, legY, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter';
      ctx.fillText(item.label.substring(0, 16), w * 0.64 + 14, legY + 8);
      legY += 20;
    });
  }

  function renderCanvasBarFallback(canvas, items) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 300;
    const h = canvas.height = canvas.parentElement.clientHeight || 200;
    ctx.clearRect(0, 0, w, h);

    const maxVal = Math.max(...items.map(i => i.val));
    const barWidth = 35;
    const gap = (w - (items.length * barWidth)) / (items.length + 1);

    items.forEach((item, idx) => {
      const x = gap + idx * (barWidth + gap);
      const barH = (item.val / maxVal) * (h - 60);
      const y = h - 30 - barH;

      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, barWidth, barH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Inter';
      ctx.fillText(item.label.substring(0, 6), x, h - 12);
    });
  }

  function renderCanvasHorizontalBarFallback(canvas, labels, data) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 300;
    const h = canvas.height = canvas.parentElement.clientHeight || 200;
    ctx.clearRect(0, 0, w, h);

    const maxVal = Math.max(...data);
    const rowH = (h - 20) / labels.length;

    labels.forEach((lbl, i) => {
      const y = 15 + i * rowH;
      const val = data[i];
      const barW = (val / maxVal) * (w * 0.45);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Inter';
      ctx.fillText(lbl.substring(0, 20), 10, y + 10);

      ctx.fillStyle = i % 2 === 0 ? '#ffb700' : '#00f0ff';
      ctx.fillRect(w * 0.52, y, barW, rowH - 4);
    });
  }

  // -------------------------------------------------------------------
  // Event Listeners & Interactive Controls
  // -------------------------------------------------------------------
  function initEventListeners() {
    // Mode Switcher Buttons
    const btnRu = document.getElementById('btn-mode-ru');
    if (btnRu) {
      btnRu.addEventListener('click', () => setMode('ru'));
    }

    const btnUs = document.getElementById('btn-mode-us');
    if (btnUs) {
      btnUs.addEventListener('click', () => setMode('us'));
    }

    // Dispatch Action Trigger
    const btnDispatch = document.getElementById('btn-run-dispatch');
    if (btnDispatch) {
      btnDispatch.addEventListener('click', triggerMultiAgentDispatch);
    }

    // Filter Controls
    const factorySelect = document.getElementById('filter-factory');
    if (factorySelect) {
      factorySelect.addEventListener('change', e => {
        STATE.filters.factory = e.target.value;
        STATE.pagination.page = 1;
        applyFilters();
      });
    }

    const shipModeSelect = document.getElementById('filter-ship-mode');
    if (shipModeSelect) {
      shipModeSelect.addEventListener('change', e => {
        STATE.filters.shipMode = e.target.value;
        STATE.pagination.page = 1;
        applyFilters();
      });
    }

    const stateSelect = document.getElementById('filter-state');
    if (stateSelect) {
      stateSelect.addEventListener('change', e => {
        STATE.filters.state = e.target.value;
        STATE.pagination.page = 1;
        applyFilters();
      });
    }

    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', e => {
        STATE.filters.status = e.target.value;
        STATE.pagination.page = 1;
        applyFilters();
      });
    }

    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', e => {
        STATE.filters.search = e.target.value;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          STATE.pagination.page = 1;
          applyFilters();
        }, 200);
      });
    }

    // Reset Filters
    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        STATE.filters = { factory: 'ALL', shipMode: 'ALL', state: 'ALL', status: 'ALL', search: '' };
        if (factorySelect) factorySelect.value = 'ALL';
        if (shipModeSelect) shipModeSelect.value = 'ALL';
        if (stateSelect) stateSelect.value = 'ALL';
        if (statusSelect) statusSelect.value = 'ALL';
        if (searchInput) searchInput.value = '';
        STATE.pagination.page = 1;
        applyFilters();
        showToast(STATE.mode === 'ru' ? 'Критерии фильтрации сброшены' : 'All filters reset', 'cyan');
      });
    }

    // Sync Data
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        await probeBackendAPI();
        loadModeData(STATE.mode);
        showToast(STATE.mode === 'ru' ? 'Телематика рейсов синхронизирована' : 'Telemetry synchronized', 'success');
      });
    }

    // Table Page Size
    const pageSizeSelect = document.getElementById('table-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', e => {
        STATE.pagination.pageSize = Number(e.target.value);
        STATE.pagination.page = 1;
        applyFilters();
      });
    }

    // Pagination
    const btnFirst = document.getElementById('btn-page-first');
    if (btnFirst) btnFirst.addEventListener('click', () => { STATE.pagination.page = 1; applyFilters(); });

    const btnPrev = document.getElementById('btn-page-prev');
    if (btnPrev) btnPrev.addEventListener('click', () => {
      if (STATE.pagination.page > 1) {
        STATE.pagination.page--;
        applyFilters();
      }
    });

    const btnNext = document.getElementById('btn-page-next');
    if (btnNext) btnNext.addEventListener('click', () => {
      if (STATE.pagination.page < STATE.pagination.totalPages) {
        STATE.pagination.page++;
        applyFilters();
      }
    });

    const btnLast = document.getElementById('btn-page-last');
    if (btnLast) btnLast.addEventListener('click', () => {
      STATE.pagination.page = STATE.pagination.totalPages;
      applyFilters();
    });

    // Column Sorting
    document.querySelectorAll('.shipments-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (STATE.sorting.column === col) {
          STATE.sorting.asc = !STATE.sorting.asc;
        } else {
          STATE.sorting.column = col;
          STATE.sorting.asc = true;
        }
        applyFilters();
      });
    });

    // Map Basemap Selector (Google Hybrid, Satellite, Roadmap, Terrain, Carto Dark)
    const baseMapSelect = document.getElementById('map-basemap-select');
    if (baseMapSelect) {
      baseMapSelect.addEventListener('change', e => {
        switchBaseMap(e.target.value);
        const name = BASE_MAPS[e.target.value]?.name || e.target.value;
        logToTerminal('SYSTEM', STATE.mode === 'ru' 
          ? `Спутниковая подложка переключена: ${name}` 
          : `Map basemap switched to: ${name}`);
      });
    }

    // Map Layer Controls
    const btnToggleRoutes = document.getElementById('btn-toggle-routes');
    if (btnToggleRoutes) {
      btnToggleRoutes.addEventListener('click', () => {
        STATE.mapLayers.showRoutes = !STATE.mapLayers.showRoutes;
        btnToggleRoutes.classList.toggle('active', STATE.mapLayers.showRoutes);
        const isRu = STATE.mode === 'ru';
        btnToggleRoutes.textContent = `${isRu ? 'Маршруты' : 'Routes'}: ${STATE.mapLayers.showRoutes ? (isRu ? 'ВКЛ' : 'ON') : (isRu ? 'ВЫКЛ' : 'OFF')}`;

        if (STATE.map && STATE.mapLayers.routes) {
          if (STATE.mapLayers.showRoutes) {
            STATE.map.addLayer(STATE.mapLayers.routes);
            STATE.map.addLayer(STATE.mapLayers.trucks);
          } else {
            STATE.map.removeLayer(STATE.mapLayers.routes);
            STATE.map.removeLayer(STATE.mapLayers.trucks);
          }
        }
      });
    }

    const btnToggleFactories = document.getElementById('btn-toggle-factories');
    if (btnToggleFactories) {
      btnToggleFactories.addEventListener('click', () => {
        STATE.mapLayers.showFactories = !STATE.mapLayers.showFactories;
        btnToggleFactories.classList.toggle('active', STATE.mapLayers.showFactories);
        const isRu = STATE.mode === 'ru';
        btnToggleFactories.textContent = `${isRu ? 'Фабрики' : 'Factories'}: ${STATE.mapLayers.showFactories ? (isRu ? '6' : '5') : (isRu ? 'ВЫКЛ' : 'OFF')}`;

        if (STATE.map && STATE.mapLayers.factories) {
          if (STATE.mapLayers.showFactories) {
            STATE.map.addLayer(STATE.mapLayers.factories);
          } else {
            STATE.map.removeLayer(STATE.mapLayers.factories);
          }
        }
      });
    }

    const btnResetMap = document.getElementById('btn-reset-map');
    if (btnResetMap) {
      btnResetMap.addEventListener('click', () => {
        if (STATE.map) {
          if (STATE.mode === 'ru') {
            STATE.map.setView([55.75, 48.0], 4);
          } else {
            STATE.map.setView([38.2, -96.5], 4.4);
          }
        }
      });
    }

    // Terminal clear & scroll
    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        STATE.agentLogs = [];
        renderAgentLogs();
      });
    }

    const btnAutoScroll = document.getElementById('btn-autoscroll-toggle');
    if (btnAutoScroll) {
      btnAutoScroll.addEventListener('click', () => {
        STATE.autoScrollLogs = !STATE.autoScrollLogs;
        const isRu = STATE.mode === 'ru';
        btnAutoScroll.textContent = `${isRu ? 'Автопрокрутка' : 'Auto-scroll'}: ${STATE.autoScrollLogs ? (isRu ? 'ВКЛ' : 'ON') : (isRu ? 'ВЫКЛ' : 'OFF')}`;
      });
    }

    // Modal close
    const btnCloseModal = document.getElementById('modal-close-btn');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeManifestModal);

    const modalBackdrop = document.getElementById('manifest-modal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop) closeManifestModal();
      });
    }

    // CSV Export
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) {
      btnExport.addEventListener('click', exportManifestToCSV);
    }
  }

  function exportManifestToCSV() {
    const rows = STATE.shipments;
    if (!rows || rows.length === 0) {
      showToast(STATE.mode === 'ru' ? 'Нет данных для экспорта' : 'No shipments to export', 'amber');
      return;
    }

    const isRu = STATE.mode === 'ru';
    const headers = isRu 
      ? ['Номер ТТН', 'Дата погрузки', 'Дата доставки', 'Фабрика отправления', 'Пункт назначения', 'Регион', 'Индекс', 'Тип ТС', 'Продукция', 'Автопоезд', 'Перевозчик', 'Дистанция (км)', 'Срок (дн)', 'Стоимость (₽)', 'Выручка (₽)', 'Прибыль (₽)', 'Статус']
      : ['Order ID', 'Order Date', 'Ship Date', 'Factory Origin', 'City', 'State', 'ZIP', 'Shipping Mode', 'Product', 'Truck Type', 'Carrier', 'Distance (Miles)', 'Lead Days', 'Freight Cost ($)', 'Revenue ($)', 'Gross Profit ($)', 'Status'];

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => [
        `"${r.order_id}"`,
        `"${r.order_date}"`,
        `"${r.ship_date}"`,
        `"${r.factory}"`,
        `"${r.city}"`,
        `"${r.state}"`,
        `"${r.zip}"`,
        `"${r.ship_mode}"`,
        `"${r.product || ''}"`,
        `"${r.truck_type}"`,
        `"${r.carrier}"`,
        r.distance,
        r.lead_days,
        r.freight_cost,
        r.revenue,
        r.gross_profit,
        `"${r.status}"`
      ].join(';'))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `maven_freight_${STATE.mode}_manifest_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(isRu ? `Экспортировано ${rows.length} ТТН в CSV.` : `Exported ${rows.length} manifests to CSV.`, 'success');
  }

  function showToast(message, type = 'cyan') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span style="font-size:14px;">${type === 'success' ? '✓' : type === 'amber' ? '⚡' : 'ℹ'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

})();
