import { IconUpload } from '@tabler/icons-preact';
import { useRef, useState } from 'preact/hooks';

/** Drop target and file picker for HTML mockups. */
export function UploadDropzone({
    onFile,
    busy,
    compact = false,
    label = 'Drop an HTML mockup here, or click to choose a file',
    hint = 'A single self-contained .html file',
}: {
    onFile: (file: File) => void;
    busy: boolean;
    /** A single line, once the project already lists mockups. */
    compact?: boolean;
    label?: string;
    hint?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const title = busy ? 'Uploading…' : label;

    function onDrop(e: DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer?.files[0];
        if (file) onFile(file);
    }

    return (
        <>
            <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                class={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors disabled:opacity-60 ${compact ? 'flex-wrap px-4 py-3' : 'flex-col p-8'} ${
                    dragging
                        ? 'border-stone-500 bg-stone-100'
                        : 'border-stone-300 bg-white hover:border-stone-400'
                }`}
            >
                <IconUpload size={22} class="text-stone-400" />
                <span class="font-medium text-sm">{title}</span>
                <span class="text-stone-500 text-xs">{hint}</span>
            </button>
            <input
                ref={input}
                type="file"
                accept=".html,.htm,text/html"
                class="hidden"
                onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) onFile(file);
                    e.currentTarget.value = '';
                }}
            />
        </>
    );
}
