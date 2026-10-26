/** Says that a newer version replaced the one shown, with the reload that shows it (§5.3). */
export function NewVersionNotice({ class: className }: { class?: string }) {
    return (
        <p role="status" class={className}>
            A new version of this mockup is available.{' '}
            <button
                type="button"
                onClick={() => location.reload()}
                class="font-semibold underline underline-offset-2"
            >
                Reload
            </button>
        </p>
    );
}
