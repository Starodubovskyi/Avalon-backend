import { MapLayersService, parseCatalogKinds } from './map-layers.service';

describe('MapLayersService', () => {
  const service = new MapLayersService();

  it('should treat empty kinds as all catalog layers', () => {
    expect(parseCatalogKinds(undefined)).toEqual(['company', 'vessel', 'port']);
    expect(parseCatalogKinds('')).toEqual(['company', 'vessel', 'port']);
  });

  it('should ignore person and unknown kinds', () => {
    expect(parseCatalogKinds('person,company,unknown,vessel')).toEqual([
      'company',
      'vessel',
    ]);
  });

  it('should not include person features in the catalog payload', () => {
    const layers = service.getLayers('company,vessel,port');
    expect(layers.company).toBeDefined();
    expect(layers.vessel).toBeDefined();
    expect(layers.port).toBeDefined();
    const kinds = [
      ...(layers.company?.features ?? []),
      ...(layers.vessel?.features ?? []),
      ...(layers.port?.features ?? []),
    ].map((feature) => feature.properties.kind);
    expect(kinds.includes('person')).toBe(false);
    expect(kinds.every((kind) => kind !== 'person')).toBe(true);
  });

  it('should return an empty object when only person is requested', () => {
    expect(service.getLayers('person')).toEqual({});
  });
});
