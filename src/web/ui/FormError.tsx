export function FormError({ message }: { message: string | undefined }) {
    if (!message) return null;
    return (
        <p
            role="alert"
            class="whitespace-pre-line rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
            {message}
        </p>
    );
}
