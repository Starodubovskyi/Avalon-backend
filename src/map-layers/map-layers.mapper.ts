import {
  CatalogLayerKind,
  CatalogPin,
  GeoJsonFeatureCollection,
  GeoJsonPointFeature,
  MapLayersResponse,
} from './domain/map-layer';

export function toPointFeature(pin: CatalogPin): GeoJsonPointFeature | null {
  if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) {
    return null;
  }
  if (pin.lat < -90 || pin.lat > 90 || pin.lng < -180 || pin.lng > 180) {
    return null;
  }
  const title = pin.title.trim();
  if (title.length === 0) {
    return null;
  }

  const feature: GeoJsonPointFeature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [pin.lng, pin.lat],
    },
    properties: {
      kind: pin.kind,
      title,
      subtitle: pin.subtitle?.trim() ? pin.subtitle.trim() : null,
    },
  };

  if (pin.href && pin.href.trim().length > 0) {
    feature.properties.href = pin.href.trim();
  }

  return feature;
}

export function toFeatureCollection(
  features: GeoJsonPointFeature[],
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}

export function toLayersResponse(
  pins: readonly CatalogPin[],
  kinds: CatalogLayerKind[],
): MapLayersResponse {
  const response: MapLayersResponse = {};

  for (const kind of kinds) {
    const features = pins
      .filter((pin) => pin.kind === kind)
      .map(toPointFeature)
      .filter((feature): feature is GeoJsonPointFeature => feature !== null);
    response[kind] = toFeatureCollection(features);
  }

  return response;
}
