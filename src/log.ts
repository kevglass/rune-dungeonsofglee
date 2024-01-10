export function errorLog(...args: unknown[]) {
    console.log("ERROR: ", ...args);
}

export function debugLog(...args: unknown[]) {
    console.log("DEBUG: ", ...args);
}