

// Check where a point intersects a rectangle
export function intersects(x: number, y: number, rx: number, ry: number, width: number, height: number): boolean {
    return (x >= rx && y >= ry && x < rx + width && y < ry + height);
}
