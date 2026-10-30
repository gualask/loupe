// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "enableIframePageLoading": true } }
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOCKED } from '../../shared/test-fixtures.ts';
import { useBridge } from '../lib/bridge.ts';
import { MockupFrame } from './MockupFrame.tsx';

const LOST = 'The mockup could not be shown here';

/** One bridge for the frames of successive versions, as the comparison pane has. */
// biome-ignore lint/style/useComponentExportOnlyModules: a test harness, never hot-reloaded.
function Pane({ version }: { version: number }) {
    const bridge = useBridge(() => undefined);
    return (
        <MockupFrame
            key={version}
            bridge={bridge}
            src={`about:blank#version-${version}`}
            permissions={BLOCKED}
            title="Checkout"
        />
    );
}

const iframe = () => document.querySelector('iframe') as HTMLIFrameElement;

function show(version: number) {
    void act(() => render(<Pane version={version} />, document.body));
}

/** The frame loads, and its bridge answers in time or not at all. */
function load(answers: boolean) {
    void act(() => {
        iframe().dispatchEvent(new Event('load'));
        if (answers) {
            const data = { type: 'loupe:ready' };
            window.dispatchEvent(
                new MessageEvent('message', { data, source: iframe().contentWindow }),
            );
        }
        vi.advanceTimersByTime(2000);
    });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    render(null, document.body);
    vi.useRealTimers();
});

describe('MockupFrame', () => {
    it('covers a frame whose bridge stays silent after a load', () => {
        show(1);
        load(true);
        expect(document.body.textContent).not.toContain(LOST);
        load(false);
        expect(document.body.textContent).toContain(LOST);
    });

    it('shows the frame of another version afresh, without the cover of the last one', () => {
        show(1);
        load(false);
        expect(document.body.textContent).toContain(LOST);
        show(2);
        expect(iframe().getAttribute('src')).toBe('about:blank#version-2');
        expect(document.body.textContent).not.toContain(LOST);
    });
});
