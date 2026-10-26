// Every item Loupe stores is named under this prefix, apart from other apps on the same origin.
const NAMESPACE = 'loupe:';

// localStorage can be unavailable (private windows, blocked site data); Loupe then keeps
// working without remembering anything.
export const storage = {
    get(name: string) {
        try {
            return localStorage.getItem(NAMESPACE + name);
        } catch {
            return null;
        }
    },
    set(name: string, value: string) {
        try {
            localStorage.setItem(NAMESPACE + name, value);
        } catch {
            // Not persisted.
        }
    },
    /** Names of the stored items starting with `prefix`. */
    names(prefix: string) {
        try {
            return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
                .filter((name): name is string => !!name?.startsWith(NAMESPACE + prefix))
                .map((name) => name.slice(NAMESPACE.length));
        } catch {
            return [];
        }
    },
    remove(name: string) {
        try {
            localStorage.removeItem(NAMESPACE + name);
        } catch {
            // Nothing to remove.
        }
    },
};
