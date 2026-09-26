import fs from "node:fs";

const path = "src/ui/explorer.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) {
    throw new Error("Missing patch anchor: " + label);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "      mapReady: false,\n      selectedCell: null,",
  "      mapReady: false,\n      mapLevel: \"zones\",\n      selectedCell: null,\n      selectedAddress: null,",
  "map state",
);

replaceOnce(
  '      url.searchParams.set("z", state.map.getZoom().toFixed(2));\n      history.replaceState(null, "", url);',
  '      url.searchParams.set("z", state.map.getZoom().toFixed(2));\n      url.searchParams.set("level", state.mapLevel);\n      history.replaceState(null, "", url);',
  "persist level",
);

const refreshStart = source.indexOf("    async function refreshMapData()");
const refreshEnd = source.indexOf("    function mapTechnologies", refreshStart);
if (refreshStart < 0 || refreshEnd < 0) {
  throw new Error("Map refresh block not found");
}

const refresh = String.raw`    function emptyFeatureCollection() {
      return { type: "FeatureCollection", features: [] };
    }

    function setMapLayerVisibility(level) {
      if (!state.mapReady || !state.map) return;
      state.map.setLayoutProperty(
        "netco-h3-fill",
        "visibility",
        level === "zones" ? "visible" : "none",
      );
      state.map.setLayoutProperty(
        "netco-h3-outline",
        "visibility",
        level === "zones" ? "visible" : "none",
      );
      state.map.setLayoutProperty(
        "netco-buildings",
        "visibility",
        level === "buildings" ? "visible" : "none",
      );
    }

    function updateMapLevelControls() {
      document.querySelectorAll("[data-map-level]").forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.mapLevel === state.mapLevel,
        );
      });
    }

    async function setMapLevel(level) {
      if (level !== "zones" && level !== "buildings") return;
      if (state.mapLevel === level) return;

      state.mapLevel = level;
      state.selectedCell = null;
      state.selectedAddress = null;
      updateMapLevelControls();
      closeMapDrawer();
      setMapLayerVisibility(level);
      persistMapState();
      await refreshMapData();
    }

    async function refreshMapData() {
      if (!state.mapReady || !state.map) return;

      const bounds = state.map.getBounds();
      const viewport = {
        west: String(bounds.getWest()),
        south: String(bounds.getSouth()),
        east: String(bounds.getEast()),
        north: String(bounds.getNorth()),
      };

      if (state.mapLevel === "buildings") {
        const params = new URLSearchParams({
          geometry: "present",
          ...viewport,
        });
        const response = await getJson(
          "/api/v1/geo/coverage-points?" + params.toString(),
        );

        if (!response.ok) {
          throw new Error(
            response.body?.error || "coverage_points_query_failed",
          );
        }

        const buildings = response.body;
        state.map.getSource("netco-buildings")?.setData(buildings);
        state.map.getSource("netco-h3")?.setData(emptyFeatureCollection());
        setMapLayerVisibility("buildings");

        const count = Number(buildings?.count ?? 0);
        document.getElementById("map-cell-count").textContent =
          String(count) + " " +
          ukPlural(count, "будинок", "будинки", "будинків");
        return;
      }

      const params = new URLSearchParams({
        resolution: "9",
        ...viewport,
      });
      const response = await getJson(
        "/api/v1/geo/h3-cells?" + params.toString(),
      );

      if (!response.ok) {
        throw new Error(response.body?.error || "h3_query_failed");
      }

      const cells = response.body;
      state.map.getSource("netco-h3")?.setData(cells);
      state.map.getSource("netco-buildings")?.setData(emptyFeatureCollection());
      setMapLayerVisibility("zones");

      const count = Number(cells?.count ?? 0);
      document.getElementById("map-cell-count").textContent =
        String(count) + " " +
        ukPlural(count, "комірка", "комірки", "комірок");
    }

`;

source =
  source.slice(0, refreshStart) +
  refresh +
  source.slice(refreshEnd);

const renderStart = source.indexOf("    function renderCellSummary");
const inspectCellStart = source.indexOf(
  "    async function inspectMapCell",
  renderStart,
);
if (renderStart < 0 || inspectCellStart < 0) {
  throw new Error("Map summary block not found");
}

const drawer = String.raw`    function openMapDrawer(kicker, title) {
      const drawer = document.getElementById("map-drawer");
      document.getElementById("map-drawer-kicker").textContent = kicker;
      document.getElementById("map-drawer-title").textContent = title;
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
    }

    function closeMapDrawer() {
      const drawer = document.getElementById("map-drawer");
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      state.selectedCell = null;
      state.selectedAddress = null;
    }

    function renderCellSummary(properties, detailHtml = "") {
      const technologies = mapTechnologies(properties.technologies);
      const h3Index = properties.h3_index || "невідомо";
      openMapDrawer("Зона H3", String(h3Index));

      document.getElementById("map-drawer-body").innerHTML =
        '<div class="map-stats">' +
        '<div class="map-stat"><div class="label">Адреси</div><strong>' +
        escapeHtml(properties.address_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Провайдери</div><strong>' +
        escapeHtml(properties.provider_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Записи доступності</div><strong>' +
        escapeHtml(properties.availability_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Технології</div><strong>' +
        escapeHtml(technologies.join(", ") || "немає") +
        '</strong></div>' +
        '</div>' +
        detailHtml;
    }

`;

source =
  source.slice(0, renderStart) +
  drawer +
  source.slice(inspectCellStart);

replaceOnce(
  "      state.selectedCell = response.body;\n      const addresses = Array.isArray(response.body?.addresses)",
  "      state.selectedCell = response.body;\n      state.selectedAddress = null;\n      const addresses = Array.isArray(response.body?.addresses)",
  "cell selection",
);

replaceOnce(
  '    async function inspectMapAddress(index) {\n      const item = state.selectedCell?.addresses?.[index];\n      if (!item) throw new Error("address_not_found_in_selected_cell");\n\n      const address = item.address || {};',
  '    async function inspectMapAddress(index) {\n      const item = state.selectedCell?.addresses?.[index];\n      if (!item) throw new Error("address_not_found_in_selected_cell");\n\n      state.selectedAddress = item;\n      const address = item.address || {};\n      const addressLabel = [address.city, address.street, address.house_number]\n        .filter(Boolean)\n        .join(", ");\n      openMapDrawer(\n        "Будинок",\n        addressLabel || item.normalized_key || item.address_id,\n      );',
  "address drawer header",
);

const ensureMapPos = source.indexOf("    async function ensureMap()");
if (ensureMapPos < 0) throw new Error("ensureMap not found");

const buildingHelpers = String.raw`    function buildingFeatureToAddress(feature) {
      const properties = feature.properties || {};
      const coordinates = feature.geometry?.coordinates || [];

      return {
        address_id: properties.address_id,
        normalized_key: properties.normalized_key,
        address: {
          country_code: properties.country_code,
          region: properties.region || null,
          city: properties.city,
          district: properties.district || null,
          street: properties.street,
          house_number: properties.house_number,
          corpus: properties.corpus || null,
          building_letter: properties.building_letter || null,
          postal_code: properties.postal_code || null,
        },
        point: {
          longitude: coordinates[0],
          latitude: coordinates[1],
        },
        freshness_state: properties.freshness_state,
        provider_count: Number(properties.provider_count || 0),
        availability_count: Number(properties.availability_count || 0),
        technologies: mapTechnologies(properties.technologies),
        latest_observed_at: properties.latest_observed_at,
      };
    }

    async function inspectMapBuilding(feature) {
      const item = buildingFeatureToAddress(feature);
      state.selectedCell = { addresses: [item] };
      state.selectedAddress = item;

      const address = item.address || {};
      const label = [
        address.city,
        address.street,
        address.house_number,
      ].filter(Boolean).join(", ");

      openMapDrawer(
        "Будинок",
        label || item.normalized_key || item.address_id,
      );
      document.getElementById("map-drawer-body").innerHTML =
        '<div id="map-address-detail" class="map-address-detail muted">' +
        'Завантаження покриття та доказів…</div>';

      await inspectMapAddress(0);
    }

`;

source =
  source.slice(0, ensureMapPos) +
  buildingHelpers +
  source.slice(ensureMapPos);

replaceOnce(
  "      const initial = mapInitialState();\n      const map = new maplibregl.Map({",
  '      const initial = mapInitialState();\n      const requestedLevel =\n        new URL(window.location.href).searchParams.get("level");\n      state.mapLevel =\n        requestedLevel === "buildings" ? "buildings" : "zones";\n      updateMapLevelControls();\n\n      const map = new maplibregl.Map({',
  "initial level",
);

replaceOnce(
  '        map.on("click", "netco-h3-fill", (event) => {',
  String.raw`        map.addSource("netco-buildings", {
          type: "geojson",
          data: emptyFeatureCollection(),
        });

        map.addLayer({
          id: "netco-buildings",
          type: "circle",
          source: "netco-buildings",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "match",
              ["get", "freshness_state"],
              "fresh",
              "#54d59d",
              "#f2c96d",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#eef4fb",
            "circle-opacity": 0.9,
          },
        });

        map.on("click", "netco-h3-fill", (event) => {`,
  "building source",
);

replaceOnce(
  String.raw`            document.getElementById("map-inspector").innerHTML =
              '<div class="map-empty">Не вдалося відкрити комірку: ' +`,
  String.raw`            openMapDrawer("Зона H3", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Не вдалося відкрити комірку: ' +`,
  "cell error drawer",
);

replaceOnce(
  '        map.on("mouseenter", "netco-h3-fill", () => {',
  String.raw`        map.on("click", "netco-buildings", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          inspectMapBuilding(feature).catch((error) => {
            openMapDrawer("Будинок", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Не вдалося відкрити будинок: ' +
              escapeHtml(
                error instanceof Error
                  ? error.message
                  : "невідома помилка",
              ) +
              '</div>';
          });
        });

        map.on("mouseenter", "netco-h3-fill", () => {`,
  "building click",
);

replaceOnce(
  '        map.on("mouseleave", "netco-h3-fill", () => {\n          map.getCanvas().style.cursor = "";\n        });\n\n        state.mapReady = true;\n        await refreshMapData();',
  String.raw`        map.on("mouseleave", "netco-h3-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "netco-buildings", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "netco-buildings", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", (event) => {
          const layers =
            state.mapLevel === "buildings"
              ? ["netco-buildings"]
              : ["netco-h3-fill"];
          const hits = map.queryRenderedFeatures(event.point, { layers });
          if (hits.length === 0) closeMapDrawer();
        });

        state.mapReady = true;
        setMapLayerVisibility(state.mapLevel);
        await refreshMapData();`,
  "map empty click",
);

replaceOnce(
  '      document.getElementById("map-reset-kyiv").addEventListener("click", () => {\n        map.flyTo({\n          center: [30.340224, 50.47843],\n          zoom: 13.5,\n          essential: true,\n        });\n      });\n\n      map.on("moveend", () => {',
  String.raw`      document.getElementById("map-reset-kyiv").addEventListener("click", () => {
        map.flyTo({
          center: [30.340224, 50.47843],
          zoom: 13.5,
          essential: true,
        });
      });

      document
        .getElementById("map-drawer-close")
        .addEventListener("click", closeMapDrawer);

      document.querySelectorAll("[data-map-level]").forEach((button) => {
        if (button.disabled) return;
        button.addEventListener("click", () => {
          setMapLevel(button.dataset.mapLevel).catch((error) => {
            document.getElementById("map-cell-count").textContent =
              "помилка запиту";
            console.error("netco_map_level_failed", error);
          });
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMapDrawer();
      });

      map.on("moveend", () => {`,
  "map controls",
);

replaceOnce(
  String.raw`            document.getElementById("map-inspector").innerHTML =
              '<div class="map-empty">Помилка карти: ' +`,
  String.raw`            openMapDrawer("Карта", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Помилка карти: ' +`,
  "map activation error",
);

fs.writeFileSync(path, source);
