import { IconUpload } from '@tabler/icons-preact';
import { useRef, useState } from 'preact/hooks';

/** Drop target and file picker for HTML mockups. */
export function UploadDropzone({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

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
                class={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors disabled:opacity-60 ${
                    dragging
                        ? 'border-stone-500 bg-stone-100'
                        : 'border-stone-300 bg-white hover:border-stone-400'
                }`}
            >
                <IconUpload size={22} class="text-stone-400" />
                <span class="font-medium text-sm">
                    {busy ? 'Uploading…' : 'Drop an HTML mockup here, or click to choose a file'}
                </span>
                <span class="text-stone-500 text-xs">A single self-contained .html file</span>
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
