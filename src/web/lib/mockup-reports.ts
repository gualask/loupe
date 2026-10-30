import { useCallback, useState } from 'preact/hooks';
import type { BridgeMessage } from '../../shared/bridge-protocol.ts';
import type { MockupPermission } from '../../shared/mockup-permissions.ts';

type Report = Extract<BridgeMessage, { type: 'loupe:attempt' | 'loupe:link' }>;

/** Whether `message` is a report about the mockup, for `useMockupReports`. */
export const isReport = (message: BridgeMessage): message is Report =>
    message.type === 'loupe:attempt' || message.type === 'loupe:link';

/**
 * What the bridges of mockup frames reported about the mockup: the permissions it used and the
 * latest link that would have left it. Pass `handle` their reports.
 */
export function useMockupReports() {
    const [used, setUsed] = useState<MockupPermission[]>([]);
    const [dismissed, setDismissed] = useState<MockupPermission[]>([]);
    const [link, setLink] = useState<string | null>(null);

    const handle = useCallback((report: Report) => {
        if (report.type === 'loupe:link') {
            setLink(report.url);
        } else {
            const { permission } = report;
            setUsed((list) => (list.includes(permission) ? list : [...list, permission]));
        }
    }, []);

    return {
        /** Permissions used and not dismissed; reported again on reload, they stay dismissed. */
        used: used.filter((permission) => !dismissed.includes(permission)),
        link,
        handle,
        dismissUsed: () => setDismissed(used),
        dismissLink: () => setLink(null),
    };
}

export type MockupReports = ReturnType<typeof useMockupReports>;
