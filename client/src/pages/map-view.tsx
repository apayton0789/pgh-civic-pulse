import { ActivityMapComponent } from "@/components/activity-map";

export default function MapView() {
  return (
    <div className="h-full flex flex-col" data-testid="map-page">
      <div className="px-4 py-3 border-b">
        <h2 className="text-xl font-bold">Map</h2>
        <p className="text-xs text-muted-foreground">
          Interactive activity map of Pittsburgh neighborhoods and Allegheny County municipalities
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ActivityMapComponent className="h-full" />
      </div>
    </div>
  );
}
