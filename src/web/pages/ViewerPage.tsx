import { useRoute } from 'preact-iso';
import { useResource } from '../lib/resource.ts';
import { CenteredLoadStatus } from '../ui/LoadStatus.tsx';
import { ReviewSpace } from '../viewer/ReviewSpace.tsx';
import { loadSharedMockup } from '../viewer/session.ts';

/** What reviewers, and the editors managing the mockup, see when they open a share link. */
export function ViewerPage() {
    const { params } = useRoute();
    const token = params.token ?? '';
    const loaded = useResource(token, loadSharedMockup);

    if (loaded.status !== 'ready') {
        return (
            <CenteredLoadStatus
                resource={loaded}
                missingTitle="Link not available"
                missing="This review link is disabled, expired or does not exist. Ask whoever shared it for a new one."
            />
        );
    }
    return (
        <ReviewSpace
            key={token}
            token={token}
            shared={loaded.data.shared}
            viewerKey={loaded.data.key}
            // Loading the link again tells a dead link from a lost connection.
            onUnavailable={loaded.retry}
        />
    );
}
