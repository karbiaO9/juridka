import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React from 'react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ClickHandler({ onPin }) {
  useMapEvents({ click(e) { onPin({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function FlyTo({ pin }) {
  const map = useMap();
  if (pin) map.flyTo([pin.lat, pin.lng], 15, { duration: 1.2 });
  return null;
}

export default function MapPicker({ pin, onPin, onSearch }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=tn`
      );
      const data = await res.json();
      if (data[0]) {
        const { lat, lon, display_name } = data[0];
        onPin({ lat: parseFloat(lat), lng: parseFloat(lon) });
        onSearch(display_name);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Carte */}
      <div style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: '1.5px solid #e0d8cc',
      }}>
        <MapContainer
          center={[36.8188, 10.1658]}
          zoom={12}
          style={{ height: 280, width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          <ClickHandler onPin={onPin} />
          <FlyTo pin={pin} />
          {pin && <Marker position={[pin.lat, pin.lng]} />}
        </MapContainer>
      </div>

      {/* Barre de recherche */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="ao-input"
          placeholder={t('mapPicker.searchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button
          className="ao-btn"
          onClick={handleSearch}
          type="button"
          disabled={searching}
        >
          {searching ? t('mapPicker.searching') : t('mapPicker.searchBtn')}
        </button>
        {pin && (
          <button
            type="button"
            onClick={() => onPin(null)}
            style={{
              padding: '10px 14px',
              border: '1.5px solid #e0d8cc',
              borderRadius: 8,
              background: 'white',
              color: '#888',
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('mapPicker.clearPin')}
          </button>
        )}
      </div>

      {/* Hint */}
      {!pin && (
        <div style={{
          background: '#fff8ee',
          border: '1px solid #f4d090',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 13,
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>📌</span>
          {t('mapPicker.hint')}
        </div>
      )}

      {/* Coordonnées */}
      {pin && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 13,
          color: '#166534',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>✅</span>
          {t('mapPicker.pinned', { lat: pin.lat.toFixed(5), lng: pin.lng.toFixed(5) })}
        </div>
      )}

    </div>
  );
}