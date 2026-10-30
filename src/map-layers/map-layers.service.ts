import { Injectable } from '@nestjs/common';
import {
  CATALOG_LAYER_KINDS,
  CatalogLayerKind,
  MapLayersResponse,
} from './domain/map-layer';
import { MAP_LAYER_CATALOG } from './map-layers.catalog';
import { toLayersResponse } from './map-layers.mapper';

export function parseCatalogKinds(raw?: string): CatalogLayerKind[] {
  if (!raw || raw.trim().length === 0) {
    return [...CATALOG_LAYER_KINDS];
  }

  const allowed = new Set<string>(CATALOG_LAYER_KINDS);
  const ordered: CatalogLayerKind[] = [];
  const seen = new Set<CatalogLayerKind>();

  for (const part of raw.split(',')) {
    const kind = part.trim();
    if (!allowed.has(kind)) {
      continue;
    }
    const catalogKind = kind as CatalogLayerKind;
    if (seen.has(catalogKind)) {
      continue;
    }
    seen.add(catalogKind);
    ordered.push(catalogKind);
  }

  return ordered;
}

@Injectable()
export class MapLayersService {
  getLayers(kindsQuery?: string): MapLayersResponse {
    const kinds = parseCatalogKinds(kindsQuery);
    return toLayersResponse(MAP_LAYER_CATALOG, kinds);
  }
}
