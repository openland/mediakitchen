export function delay(delay: number) {
    return new Promise((r) => setTimeout(r, delay));
}