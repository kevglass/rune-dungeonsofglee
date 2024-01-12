import { resumeAudioOnInput } from "./sound";

// This is a very brute force simple renderer. It's just blitting images and text to 
// a canvas. It's wrapped with a view to replacing it with something decent

const canvas = document.getElementById("gamecanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let eventListener: InputEventListener | undefined;

// a tile set cuts an imag into pieces to be used as sprites
export interface TileSet {
    image: HTMLImageElement;
    tileWidth: number;
    tileHeight: number;
}

// a hook back for mouse/touch events
export interface InputEventListener {
    mouseUp(x: number, y: number, button: number): void;
}

// register an event listener for mouse/touch events
export function registerInputEventListener(listener: InputEventListener): void {
    eventListener = listener;
}

document.addEventListener('contextmenu', event => {
    event.preventDefault();
});

// we're only c
canvas.addEventListener("mouseup", (event) => {
    resumeAudioOnInput();
    eventListener?.mouseUp(event.x, event.y, event.button);
});

export function screenWidth(): number {
    return canvas.width;
}

export function screenHeight(): number {
    return canvas.height;
}

// load an image and store it with tileset information
export function loadTileSet(url: string, tw: number, th: number): TileSet {
    const image = new Image();
    image.src = url;

    return { image, tileWidth: tw, tileHeight: th };
}

// Draw a single tile from a tile set by default at its natural size
export function drawTile(tiles: TileSet, x: number, y: number, tile: number, width: number = tiles.tileWidth, height: number = tiles.tileHeight): void {
    const tw = Math.floor(tiles.image.width / tiles.tileWidth);
    const tx = (tile % tw) * tiles.tileWidth;
    const ty = Math.floor(tile / tw) * tiles.tileHeight;

    ctx.drawImage(tiles.image, tx, ty, tiles.tileWidth, tiles.tileHeight, x, y, width, height);
}

// draw text at the given location 
export function drawText(x: number, y: number, str: string, size: number, col: string): void {
    ctx.fillStyle = col;
    ctx.font = "bold " + size + "px \"Fira Sans\", sans-serif";
    ctx.fillText(str, x, y);
}

// draw a rectangle outlined to the canvas
export function drawRect(x: number, y: number, width: number, height: number, col: string): void {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, width, 1);
    ctx.fillRect(x, y + height - 1, width, 1);
    ctx.fillRect(x, y, 1, height);
    ctx.fillRect(x + width - 1, y, 1, height);
}

// determine the width of a string when rendered at a given size
export function stringWidth(text: string, size: number) {
    ctx.font = "bold " + size + "px \"Fira Sans\", sans-serif";
    return ctx.measureText(text).width;
}

// draw a string onto the canvas centring it on the screen
export function centerText(text: string, size: number, y: number, col: string): void {
    const cx = Math.floor(screenWidth() / 2);
    drawText(cx - (stringWidth(text, size) / 2), y, text, size, col);
}

// give the graphics to do anything it needs to do per frame
export function updateGraphics(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// fill a rectangle to the canvas
export function fillRect(x: number, y: number, width: number, height: number, col: string) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, width, height);
}

// draw an image to the canvas 
export function drawImage(image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
    ctx.drawImage(image, x, y, width, height);
}

// store the current 'state' of the canvas. This includes transforms, alphas, clips etc
export function pushState() {
    ctx.save();
}

// restore the next 'state' of the canvas on the stack.
export function popState() {
    ctx.restore();
}

// set the alpha value to use when rendering 
export function setAlpha(alpha: number): void {
    ctx.globalAlpha = alpha;
}

// translate the rendering context by a given amount
export function translate(x: number, y: number): void {
    ctx.translate(x, y);
}

// scale the rendering context by a given amount
export function scale(x: number, y: number): void {
    ctx.scale(x, y);
}

export function rotate(ang: number): void {
    ctx.rotate(ang);
}

export function fillCircle(x: number, y: number, radius: number, col: string): void {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}