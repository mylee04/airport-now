import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { feature, mesh } from 'topojson-client';
import statesTopologyJson from 'us-atlas/states-10m.json';

const EXCLUDED_STATE_IDS = new Set(['02', '15', '72']);
const MAP_PADDING = 22;

export const US_MAP_VIEWBOX = {
  width: 960,
  height: 600,
} as const;

type StatePath = {
  id: string;
  path: string;
};

type TopologyRoot = Parameters<typeof feature>[0] & {
  type: 'Topology';
  objects: {
    states: unknown;
  };
};

const statesTopology = statesTopologyJson as unknown as TopologyRoot;
const stateFeatureCollection = feature(
  statesTopology,
  statesTopology.objects.states as Parameters<typeof feature>[1],
) as unknown as FeatureCollection;
const contiguousStateFeatures = stateFeatureCollection.features.filter(
  (state) => !EXCLUDED_STATE_IDS.has(String(state.id ?? '').padStart(2, '0')),
);
const contiguousStates: FeatureCollection = {
  type: 'FeatureCollection',
  features: contiguousStateFeatures,
};
const projection = geoAlbersUsa().fitExtent(
  [
    [MAP_PADDING, MAP_PADDING],
    [US_MAP_VIEWBOX.width - MAP_PADDING, US_MAP_VIEWBOX.height - MAP_PADDING],
  ],
  contiguousStates,
);
const pathGenerator = geoPath(projection);

export const US_STATE_PATHS: StatePath[] = contiguousStateFeatures.flatMap((state, index) => {
  const path = pathGenerator(state);

  if (!path) {
    return [];
  }

  return [
    {
      id: String(state.id ?? `state-${index}`),
      path,
    },
  ];
});

const borderFilter: NonNullable<Parameters<typeof mesh>[2]> = (left, right) =>
  left !== right &&
  !EXCLUDED_STATE_IDS.has(String(left?.id ?? '').padStart(2, '0')) &&
  !EXCLUDED_STATE_IDS.has(String(right?.id ?? '').padStart(2, '0'));

export const US_STATE_BORDERS_PATH =
  pathGenerator(
    mesh(
      statesTopology,
      statesTopology.objects.states as Parameters<typeof mesh>[1],
      borderFilter,
    ),
  ) ?? '';

export function projectUsMapPoint(
  latitude: number,
  longitude: number,
): { x: number; y: number } | null {
  const point = projection([longitude, latitude]);

  if (!point) {
    return null;
  }

  return {
    x: (point[0] / US_MAP_VIEWBOX.width) * 100,
    y: (point[1] / US_MAP_VIEWBOX.height) * 100,
  };
}
