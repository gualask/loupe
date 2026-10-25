import { useEffect, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { CenteredCard } from '../ui/CenteredCard.tsx';
import { ReviewSpace } from '../viewer/ReviewSpace.tsx';
import { loadSharedMockup } from '../viewer/session.ts';

type Loaded = Awaited<ReturnType<typeof loadSharedMockup>>;

/** What reviewers, and the editors managing the mockup, see when they open a share link. */
export function ViewerPage() {
    const { params } = useRoute();
    const token = params.token ?? '';
    const [loaded, setLoaded] = useState<Loaded | null>();

    useEffect(() => {
        loadSharedMockup(token).then(setLoaded, () => setLoaded(null));
    }, [token]);

    if (loaded === undefined) return null;
    if (loaded === null) {
        return (
            <CenteredCard title="Link not available">
                <p class="text-sm text-stone-600">
                    This review link is disabled, expired or does not exist. Ask whoever shared it
                    for a new one.
                </p>
            </CenteredCard>
        );
    }
    return (
        <ReviewSpace
            key={token}
            token={token}
            shared={loaded.shared}
            viewerKey={loaded.key}
            onUnavailable={() => setLoaded(null)}
        />
    );
}
