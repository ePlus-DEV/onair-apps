export const getAdjacentStation = (
  stations,
  activeStationId,
  offset,
) => {
  if (!Array.isArray(stations) || stations.length < 2) return undefined;
  if (offset !== -1 && offset !== 1) return undefined;

  const currentIndex = stations.findIndex(
    (station) => station?.id === activeStationId,
  );

  if (currentIndex < 0) {
    return offset > 0 ? stations[0] : stations[stations.length - 1];
  }

  const nextIndex =
    (currentIndex + offset + stations.length) % stations.length;

  return stations[nextIndex];
};
