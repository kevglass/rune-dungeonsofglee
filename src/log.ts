export function errorLog(...args: unknown[]) {
    console.error("ERROR: ", ...args);
}

export function debugLog(...args: unknown[]) {
    console.log("DEBUG: ", ...args);
}