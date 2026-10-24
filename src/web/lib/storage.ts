// localStorage can be unavailable (private windows, blocked site data); Loupe then keeps
// working without remembering anything.
export const storage = {
    get(name: string) {
        try {
            return localStorage.getItem(name);
        } catch {
            return null;
        }
    },
    set(name: string, value: string) {
        try {
            localStorage.setItem(name, value);
        } catch {
            // Not persisted.
        }
    },
    remove(name: string) {
        try {
            localStorage.removeItem(name);
        } catch {
            // Nothing to remove.
        }
    },
};
