import type { BridgePin, PinPosition } from '../shared/bridge-protocol.ts';

/** The pin markers drawn in `layer`, one button per pin; `onClick` gets the pin id. */
export function createMarkers(layer: HTMLElement, onClick: (id: string) => void) {
    const markers = new Map<string, HTMLButtonElement>();

    return {
        /** Adds, updates and removes markers to match `pins`. */
        render(pins: BridgePin[]) {
            for (const [id, marker] of markers) {
                if (!pins.some((pin) => pin.id === id)) {
                    marker.remove();
                    markers.delete(id);
                }
            }
            for (const pin of pins) {
                let marker = markers.get(pin.id);
                if (!marker) {
                    marker = document.createElement('button');
                    marker.addEventListener('click', (event) => {
                        event.stopPropagation();
                        onClick(pin.id);
                    });
                    layer.append(marker);
                    markers.set(pin.id, marker);
                }
                marker.className = `pin${pin.muted ? ' muted' : ''}${pin.active ? ' active' : ''}`;
                marker.textContent = pin.label;
                marker.style.setProperty('--color', pin.color);
            }
        },

        /** Moves the markers to their positions, hiding those out of view. */
        place(positions: PinPosition[]) {
            for (const position of positions) {
                const marker = markers.get(position.id);
                if (!marker) continue;
                marker.hidden = !position.visible;
                marker.classList.toggle('orphaned', position.orphaned);
                marker.style.left = `${position.x}px`;
                marker.style.top = `${position.y}px`;
            }
        },
    };
}
