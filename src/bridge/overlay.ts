// Loupe's own layer inside the mockup: inspect glass, hover highlight and pin markers, in a
// closed shadow root so mockup styles and scripts leave it alone.

const STYLE = `
:host { all: initial; }
.glass { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto; display: none; }
.glass.on { display: block; }
.highlight {
  position: fixed; display: none; pointer-events: none; box-sizing: border-box;
  border: 2px solid #2563eb; background: rgb(37 99 235 / 0.12); border-radius: 2px;
}
.label {
  position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; white-space: nowrap;
  padding: 2px 6px; border-radius: 4px; background: #1e3a8a; color: #fff;
  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.label.below { bottom: auto; top: 100%; margin: 4px 0 0; }
.pin {
  position: fixed; width: 28px; height: 28px; margin: -28px 0 0 0; padding: 0;
  display: grid; place-items: center; box-sizing: border-box; cursor: pointer;
  pointer-events: auto; border: 2px solid #fff; border-radius: 50% 50% 50% 0;
  background: var(--color); color: #fff; font: 600 12px/1 system-ui, sans-serif;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35); transition: transform 120ms;
}
.pin:hover { transform: scale(1.1); transform-origin: bottom left; }
.pin.muted { opacity: 0.55; }
.pin.active { outline: 3px solid var(--color); outline-offset: 2px; }
.pin.orphaned { border-style: dashed; }
.pin[hidden], .pin.off { display: none; }
`;

export function createOverlay() {
    const host = document.createElement('loupe-overlay');
    for (const [name, value] of Object.entries({
        position: 'fixed',
        inset: '0',
        'z-index': '2147483647',
        'pointer-events': 'none',
        display: 'block',
    })) {
        host.style.setProperty(name, value, 'important');
    }
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${STYLE}</style><div class="glass"></div><div class="highlight"><span class="label"></span></div><div class="pins"></div>`;
    const query = <T extends Element>(selector: string) => root.querySelector(selector) as T;
    const glass = query<HTMLDivElement>('.glass');
    const highlight = query<HTMLDivElement>('.highlight');
    const label = query<HTMLSpanElement>('.label');
    const pins = query<HTMLDivElement>('.pins');

    return {
        host,
        glass,
        pins,
        /** Mockup code may replace the whole document; put the overlay back if so. */
        attach() {
            if (!host.isConnected) document.documentElement.append(host);
        },
        setInspecting(on: boolean) {
            glass.classList.toggle('on', on);
            if (!on) highlight.style.display = 'none';
        },
        highlight(el: Element | undefined) {
            if (!el) {
                highlight.style.display = 'none';
                return;
            }
            const rect = el.getBoundingClientRect();
            Object.assign(highlight.style, {
                display: 'block',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
            const id = el.id ? `#${el.id}` : '';
            const classes = [...el.classList]
                .slice(0, 2)
                .map((c) => `.${c}`)
                .join('');
            label.textContent = `${el.localName}${id}${classes}  ${Math.round(rect.width)}×${Math.round(rect.height)}`;
            label.classList.toggle('below', rect.top < 24);
        },
    };
}
