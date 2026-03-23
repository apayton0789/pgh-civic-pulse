import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { Layers, MapPin } from "lucide-react";

interface ActivityItem {
  title: string;
  type: string;
  date: string;
  source: string;
}

interface ActivityEntry {
  count: number;
  items: ActivityItem[];
}

type ActivityData = Record<string, ActivityEntry>;

interface MarkerData {
  lat: number;
  lon: number;
  address: string;
  neighborhood: string;
  title: string;
  type: string;
  meetingId?: number;
}

interface GeoResponse {
  activity: ActivityData;
  markers: MarkerData[];
}

function getColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "hsla(215, 60%, 85%, 0.3)";
  const ratio = Math.min(count / maxCount, 1);
  const lightness = 85 - ratio * 55;
  const saturation = 60 + ratio * 5;
  const alpha = 0.3 + ratio * 0.5;
  return `hsla(215, ${saturation}%, ${lightness}%, ${alpha})`;
}

/** Get marker color by type */
function getMarkerColor(type: string): string {
  switch (type) {
    case "meeting": return "#2563b0";
    case "news": return "#b07a00";
    case "development": return "#7c3aed";
    default: return "#6b7280";
  }
}

/** Create a small circle marker SVG for map pins */
function createMarkerIcon(type: string): L.DivIcon {
  const color = getMarkerColor(type);
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 12px; height: 12px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

/** Normalize name for matching: lowercase, trim */
function normalizeGeoName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

interface ActivityMapProps {
  mini?: boolean;
  className?: string;
}

export function ActivityMapComponent({
  mini = false,
  className = "",
}: ActivityMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const neighborhoodLayerRef = useRef<L.GeoJSON | null>(null);
  const municipalityLayerRef = useRef<L.GeoJSON | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const [showMunicipalities, setShowMunicipalities] = useState(!mini);
  const [showMarkers, setShowMarkers] = useState(true);

  const { data: geoResponse } = useQuery<GeoResponse>({
    queryKey: ["/api/geo-activity"],
  });

  const activityData = geoResponse?.activity;
  const markers = geoResponse?.markers || [];

  const maxCount = activityData
    ? Math.max(...Object.values(activityData).map((v) => v.count), 1)
    : 1;

  const getActivity = useCallback(
    (name: string): ActivityEntry | undefined => {
      if (!activityData) return undefined;
      const directKey = normalizeGeoName(name);
      if (activityData[directKey]) return activityData[directKey];

      for (const key of Object.keys(activityData)) {
        if (normalizeGeoName(key) === directKey) return activityData[key];
      }

      if (directKey.includes("pittsburgh") || directKey === "city of pittsburgh") {
        return activityData["pittsburgh"];
      }

      return undefined;
    },
    [activityData]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [40.4406, -79.9959],
      zoom: mini ? 11 : 11,
      zoomControl: !mini,
      scrollWheelZoom: !mini,
      dragging: !mini,
      attributionControl: !mini,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [mini]);

  // Load and render neighborhoods
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activityData) return;

    if (neighborhoodLayerRef.current) {
      map.removeLayer(neighborhoodLayerRef.current);
      neighborhoodLayerRef.current = null;
    }

    if (!showNeighborhoods) return;

    fetch("/data/pgh_neighborhoods.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const name = feature?.properties?.hood || feature?.properties?.name || "";
            const activity = getActivity(name);
            const count = activity?.count || 0;
            return {
              fillColor: getColor(count, maxCount),
              weight: 1,
              opacity: 0.6,
              color: "hsl(215, 40%, 60%)",
              fillOpacity: count > 0 ? 0.7 : 0.3,
            };
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.hood || feature.properties?.name || "Unknown";
            const activity = getActivity(name);

            (layer as L.Path).on({
              mouseover: (e) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 3, color: "hsl(47, 95%, 55%)", opacity: 1 });
                target.bringToFront();
              },
              mouseout: (e) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 1, color: "hsl(215, 40%, 60%)", opacity: 0.6 });
              },
            });

            let popupContent = `<div style="min-width:180px;max-width:280px;font-family:General Sans,sans-serif;">
              <p style="font-weight:600;font-size:13px;margin:0 0 4px 0;">${name}</p>
              <p style="font-size:11px;color:#666;margin:0 0 8px 0;">
                ${activity?.count || 0} item${(activity?.count || 0) !== 1 ? "s" : ""}
              </p>`;

            if (activity?.items.length) {
              popupContent += `<ul style="list-style:none;padding:0;margin:0;">`;
              for (const item of activity.items.slice(0, 5)) {
                const typeColor = getMarkerColor(item.type);
                const typeLabel = item.type === "development" ? "🏗️" : item.type === "meeting" ? "📋" : "📰";
                popupContent += `<li style="font-size:11px;margin-bottom:4px;line-height:1.4;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${typeColor};margin-right:4px;vertical-align:middle;"></span>
                  <span style="font-weight:500;">${item.title.length > 55 ? item.title.slice(0, 52) + "..." : item.title}</span>
                  <br/><span style="color:#888;font-size:10px;">${typeLabel} ${item.source} ${item.date ? `· ${item.date}` : ""}</span>
                </li>`;
              }
              popupContent += `</ul>`;
            }
            popupContent += `</div>`;

            layer.bindPopup(popupContent, { maxWidth: 300 });
          },
        });
        layer.addTo(map);
        neighborhoodLayerRef.current = layer;
        // Bring markers to front if they exist
        if (markerLayerRef.current) {
          markerLayerRef.current.bringToFront();
        }
      })
      .catch(console.error);
  }, [activityData, showNeighborhoods, getActivity, maxCount]);

  // Load and render municipalities
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activityData || mini) return;

    if (municipalityLayerRef.current) {
      map.removeLayer(municipalityLayerRef.current);
      municipalityLayerRef.current = null;
    }

    if (!showMunicipalities) return;

    fetch("/data/ac_municipalities.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const name = feature?.properties?.name || "";
            const activity = getActivity(name);
            const count = activity?.count || 0;
            return {
              fillColor: getColor(count, maxCount),
              weight: 1,
              opacity: 0.4,
              color: "hsl(215, 30%, 70%)",
              fillOpacity: count > 0 ? 0.5 : 0.15,
            };
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.name || "Unknown";
            const activity = getActivity(name);

            (layer as L.Path).on({
              mouseover: (e) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 2, color: "hsl(47, 95%, 55%)", opacity: 0.8 });
              },
              mouseout: (e) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 1, color: "hsl(215, 30%, 70%)", opacity: 0.4 });
              },
            });

            let popupContent = `<div style="min-width:160px;max-width:260px;font-family:General Sans,sans-serif;">
              <p style="font-weight:600;font-size:13px;margin:0 0 4px 0;">${name}</p>
              <p style="font-size:11px;color:#666;margin:0 0 8px 0;">
                ${activity?.count || 0} item${(activity?.count || 0) !== 1 ? "s" : ""}
              </p>`;

            if (activity?.items.length) {
              popupContent += `<ul style="list-style:none;padding:0;margin:0;">`;
              for (const item of activity.items.slice(0, 5)) {
                const typeColor = getMarkerColor(item.type);
                popupContent += `<li style="font-size:11px;margin-bottom:4px;line-height:1.4;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${typeColor};margin-right:4px;vertical-align:middle;"></span>
                  <span style="font-weight:500;">${item.title.length > 60 ? item.title.slice(0, 57) + "..." : item.title}</span>
                  <br/><span style="color:#888;font-size:10px;">${item.source} · ${item.date}</span>
                </li>`;
              }
              popupContent += `</ul>`;
            }
            popupContent += `</div>`;

            layer.bindPopup(popupContent, { maxWidth: 280 });
          },
        });
        layer.addTo(map);
        if (neighborhoodLayerRef.current) {
          neighborhoodLayerRef.current.bringToFront();
        }
        municipalityLayerRef.current = layer;
      })
      .catch(console.error);
  }, [activityData, showMunicipalities, mini, getActivity, maxCount]);

  // Render address markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current);
      markerLayerRef.current = null;
    }

    if (!showMarkers || markers.length === 0) return;

    const layerGroup = L.layerGroup();

    for (const m of markers) {
      const icon = createMarkerIcon(m.type);
      const marker = L.marker([m.lat, m.lon], { icon });

      const popupContent = `<div style="min-width:160px;max-width:240px;font-family:General Sans,sans-serif;">
        <p style="font-weight:600;font-size:12px;margin:0 0 2px 0;">${m.address}</p>
        <p style="font-size:10px;color:#888;margin:0 0 6px 0;">${m.neighborhood || "Pittsburgh"}</p>
        <p style="font-size:11px;margin:0;line-height:1.4;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${getMarkerColor(m.type)};margin-right:4px;vertical-align:middle;"></span>
          ${m.title.length > 70 ? m.title.slice(0, 67) + "..." : m.title}
        </p>
      </div>`;

      marker.bindPopup(popupContent, { maxWidth: 260 });
      layerGroup.addLayer(marker);
    }

    layerGroup.addTo(map);
    markerLayerRef.current = layerGroup;
  }, [markers, showMarkers]);

  return (
    <div className={`relative ${className}`} data-testid="activity-map">
      <div ref={mapContainerRef} className="h-full w-full rounded-lg" />

      {/* Layer toggle (full map only) */}
      {!mini && (
        <div className="absolute top-3 right-3 z-[1000] bg-card/95 backdrop-blur border rounded-lg p-2 shadow-md space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Layers className="h-3 w-3" />
            Layers
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer" data-testid="toggle-neighborhoods">
            <input
              type="checkbox"
              checked={showNeighborhoods}
              onChange={(e) => setShowNeighborhoods(e.target.checked)}
              className="rounded"
            />
            Neighborhoods
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer" data-testid="toggle-municipalities">
            <input
              type="checkbox"
              checked={showMunicipalities}
              onChange={(e) => setShowMunicipalities(e.target.checked)}
              className="rounded"
            />
            Municipalities
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer" data-testid="toggle-markers">
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(e) => setShowMarkers(e.target.checked)}
              className="rounded"
            />
            <MapPin className="h-3 w-3" />
            Address Pins
          </label>
        </div>
      )}

      {/* Legend */}
      {!mini && (
        <div className="absolute bottom-6 left-3 z-[1000] bg-card/95 backdrop-blur border rounded-lg p-2 shadow-md">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Activity</p>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded-sm" style={{ background: "hsla(215, 60%, 85%, 0.3)" }} />
            <span className="text-[10px] text-muted-foreground">None</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded-sm" style={{ background: "hsla(215, 63%, 57%, 0.55)" }} />
            <span className="text-[10px] text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded-sm" style={{ background: "hsla(215, 65%, 30%, 0.8)" }} />
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
          <div className="border-t border-border mt-1.5 pt-1.5">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Markers</p>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#2563b0" }} />
              <span className="text-[10px] text-muted-foreground">Meeting</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#b07a00" }} />
              <span className="text-[10px] text-muted-foreground">News</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7c3aed" }} />
              <span className="text-[10px] text-muted-foreground">Development</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
