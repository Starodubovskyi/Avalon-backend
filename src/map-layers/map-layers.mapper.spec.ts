import { CatalogPin } from './domain/map-layer';
import { toLayersResponse, toPointFeature } from './map-layers.mapper';

describe('map-layers.mapper', () => {
  it('should require kind on every feature', () => {
    const pin: CatalogPin = {
      kind: 'company',
      title: 'Stark Shipping',
      subtitle: 'Odesa',
      lat: 46.4825,
      lng: 30.7233,
    };

    const feature = toPointFeature(pin);
    expect(feature).not.toBeNull();
    expect(feature?.properties.kind).toBe('company');
    expect(feature?.geometry.coordinates).toEqual([30.7233, 46.4825]);
  });

  it('should skip pins without a title or with invalid coordinates', () => {
    expect(
      toPointFeature({
        kind: 'port',
        title: '   ',
        subtitle: null,
        lat: 44.15,
        lng: 28.63,
      }),
    ).toBeNull();

    expect(
      toPointFeature({
        kind: 'port',
        title: 'Constanța',
        subtitle: 'ROCND',
        lat: 99,
        lng: 28.63,
      }),
    ).toBeNull();
  });

  it('should only include requested kinds', () => {
    const pins: CatalogPin[] = [
      {
        kind: 'company',
        title: 'A',
        subtitle: null,
        lat: 1,
        lng: 2,
      },
      {
        kind: 'port',
        title: 'B',
        subtitle: null,
        lat: 3,
        lng: 4,
      },
    ];

    const response = toLayersResponse(pins, ['company']);
    expect(response.company?.features).toHaveLength(1);
    expect(response.port).toBeUndefined();
    expect(response.vessel).toBeUndefined();
    expect(response.company?.features[0]?.properties.kind).toBe('company');
  });
});
