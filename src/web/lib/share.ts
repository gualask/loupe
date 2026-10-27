import type { Mockup } from '../../shared/api/projects.ts';

/** The token at the end of a mockup's share link (`<public URL>/s/<token>`). */
const shareToken = (mockup: Mockup) => mockup.shareUrl.slice(mockup.shareUrl.lastIndexOf('/') + 1);

/** The review space of a mockup, within this app; with `viewerId`, filtered to their pins. */
export const reviewSpaceHref = (mockup: Mockup, viewerId?: string) =>
    `/s/${shareToken(mockup)}${viewerId ? `?viewer=${viewerId}` : ''}`;

/** The sandboxed document of a mockup's current version. */
export const mockupContentSrc = (mockup: Mockup) => `/s/${shareToken(mockup)}/content`;
