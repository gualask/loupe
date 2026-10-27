import { Notice } from './Notice.tsx';

export function FormError({ message }: { message: string | undefined }) {
    if (!message) return null;
    return (
        <Notice tone="danger" role="alert">
            <p class="whitespace-pre-line">{message}</p>
        </Notice>
    );
}
