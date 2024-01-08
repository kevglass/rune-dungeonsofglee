import tiles from "./assets/tiles-64.png";
import sfxDoorUrl from "./assets/opendoor.mp3";
import sfxStepUrl from "./assets/mapstep.mp3";

import { GameEvent, GameState, GameUpdate, STEP_TIME } from "./logic";
import { Actor } from "./actor";
import { getActorAt, getActorById, getDoorAt, getDungeonById, getRoomAt } from "./dungeon";
import { PlayerClass, PlayerInfo } from "./player";

const WALL_TOPS = [92, 92, 92, 92, 92, 92, 93, 94, 95];
const WALL_FRONTS = [100, 100, 100, 100, 100, 100, 101, 102, 103];

interface PlayerClassDef {
    icon: number;
    name: string;
    type: PlayerClass;
}

interface Sound {
    buffer?: AudioBuffer;
    data?: ArrayBuffer;
}

function intersects(x: number, y: number, x1: number, y1: number, width: number, height: number): boolean {
    return (x >= x1 && y >= y1 && x < x1 + width && y < y1 + height);
}

export class DungeonsOfGlee {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tiles: HTMLImageElement;
    resourcesToLoad = 0;
    playerAvatars: Record<string, HTMLImageElement> = {};
    game?: GameState;
    localPlayerId?: string;
    anim = 0;
    state?: GameUpdate;
    offsetx = 0;
    offsety = 0;
    tileSize = 48;
    moving = false;
    audioContext: AudioContext = new AudioContext();

    classes: PlayerClassDef[] = [
        { icon: 0, name: "Dwarf", type: "dwarf" },
        { icon: 1, name: "Witch", type: "witch" },
        { icon: 2, name: "Elf", type: "elf" },
        { icon: 3, name: "Knight", type: "knight" },
    ];

    sfxDoor: Sound;
    sfxStep: Sound;

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.canvas = document.getElementById("gamecanvas")! as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.tiles = this.loadImage(tiles);
        this.sfxDoor = this.loadSound(sfxDoorUrl);
        this.sfxStep = this.loadSound(sfxStepUrl);

        this.canvas.addEventListener("mouseup", (event) => {
            this.mouseDown(event.x, event.y);
        });

        this.audioContext.resume();
    }

    iconForClass(type: PlayerClass): number {
        const def = this.classes.find(d => d.type === type);
        if (def) {
            return def.icon;
        }

        return 0;
    }

    get localPlayerClass(): PlayerClass | undefined {
        return this.game?.playerInfo[this.localPlayerId ?? ""]?.type;
    }

    get myPlayerInfo(): PlayerInfo | undefined {
        return this.game?.playerInfo[this.localPlayerId ?? ""];
    }

    get myTurn(): boolean {
        return this.game?.whoseTurn === this.localPlayerId;
    }

    get myActor(): Actor | undefined {
        if (this.myPlayerInfo && this.game) {
            return getActorById(this.game, this.myPlayerInfo.dungeonId, this.myPlayerInfo.actorId);
        }

        return undefined;
    }

    mouseDown(x: number, y: number): void {
        this.audioContext.resume();
        // player select
        if (!this.localPlayerClass) {
            const selected = Math.floor((y - 140) / 70);
            if (this.classes[selected]) {
                Rune.actions.setPlayerType({ type: this.classes[selected].type });
            }
        } else {
            const tx = Math.floor((x - this.offsetx) / this.tileSize);
            const ty = Math.floor((y - this.offsety) / this.tileSize);
            if (this.game && !this.game.currentActivity && this.myActor) {
                const dungeon = getDungeonById(this.game, this.myActor.dungeonId);
                if (!dungeon) {
                    return;
                }
                const move = this.game.possibleMoves.find(m => m.x === tx && m.y === ty);
                const actor = getActorAt(dungeon, tx, ty);
                if (move && (!actor || move.type === "attack")) {
                    Rune.actions.makeMove({ x: tx, y: ty });
                }
            }

            if (intersects(x, y, this.canvas.width - 100, this.canvas.height - 99, 90, 25)) {
                // pressed end turn
                if (this.myTurn) {
                    Rune.actions.endTurn();
                }
            }
        }
    }

    loadSound(url: string): Sound {
        this.resourcesToLoad++;
        const result: Sound = {};

        const req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.responseType = "arraybuffer";

        req.onload = () => {
            this.resourcesToLoad--;
            const arrayBuffer = req.response;
            if (arrayBuffer) {
                result.data = arrayBuffer;
                this.tryLoadSound(result);
            }
        };

        req.send();
        return result;
    }

    tryLoadSound(sound: Sound): Promise<void> {
        return new Promise<void>((resolve) => {
            if (sound.buffer) {
                resolve();
            } else {
                if (sound.data && !sound.buffer) {
                    this.audioContext.decodeAudioData(sound.data, (buffer: AudioBuffer) => {
                        sound.buffer = buffer;
                        resolve();
                    });
                }
            }
        });
    }

    playSound(sound: Sound): void {
        // don't play sounds until we've joined the game proper
        if (!this.localPlayerClass) {
            return;
        }

        this.tryLoadSound(sound).then(() => {
            if (sound.buffer) {
                const source = this.audioContext.createBufferSource();
                source.buffer = sound.buffer;
                source.connect(this.audioContext.destination);
                source.start(0);
            }
        })
    }

    loadImage(url: string): HTMLImageElement {
        this.resourcesToLoad++;
        const image = new Image();
        image.onload = () => {
            this.resourcesToLoad--;
        };
        image.src = url;

        return image;
    }

    drawTile(x: number, y: number, tile: number, size: number = this.tileSize): void {
        const tw = this.tiles.width / 64;
        const tx = (tile % tw) * 64;
        const ty = Math.floor(tile / tw) * 64;

        this.ctx.drawImage(this.tiles, tx, ty, 64, 64, x, y, size, size);
    }

    drawText(x: number, y: number, str: string, size: number, col: string): void {
        this.ctx.fillStyle = col;
        this.ctx.font = "bold " + size + "px serif";
        this.ctx.fillText(str, x, y);
    }

    drawRect(x: number, y: number, width: number, height: number, col: string): void {
        this.ctx.fillStyle = col;
        this.ctx.fillRect(x, y, width, 1);
        this.ctx.fillRect(x, y + height - 1, width, 1);
        this.ctx.fillRect(x, y, 1, height);
        this.ctx.fillRect(x + width - 1, y, 1, height);
    }

    stringWidth(text: string, size: number) {
        this.ctx.font = "bold " + size + "px serif";
        return this.ctx.measureText(text).width;
    }

    centerText(text: string, size: number, y: number, col: string): void {
        const cx = Math.floor(this.canvas.width / 2);
        this.drawText(cx - (this.stringWidth(text, size) / 2), y, text, size, col);
    }

    start(): void {
        Rune.initClient({
            onChange: (game) => {
                this.gameUpdate(game);
            },
        });

        requestAnimationFrame(() => { this.loop() });
    }

    gameUpdate(state: GameUpdate) {
        this.localPlayerId = state.yourPlayerId;

        this.game = state.game;
        this.state = state;

        for (const playerId in state.players) {
            if (!this.playerAvatars[playerId]) {
                this.playerAvatars[playerId] = new Image();
                this.playerAvatars[playerId].src = state.players[playerId].avatarUrl;
            }
        }


        for (const event of state.game.events) {
            this.processEvent(event);
        }
    }

    processEvent(event: GameEvent) {
        if (event === "open") {
            this.playSound(this.sfxDoor);
        }
        if (event === "step") {
            setTimeout(() => {
                this.playSound(this.sfxStep);
            }, STEP_TIME);
        }
    }

    loop(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.fillStyle = "rgb(20,20,20)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = Math.floor(this.canvas.width / 2);

        if (this.game) {
            this.anim++;
            if (!this.localPlayerClass) {
                //
                // player selection screen
                ///
                this.centerText("Select Your Hero", 24, 120, "white");
                let p = 0;
                for (const clazz of this.classes) {
                    this.ctx.fillStyle = "rgb(40,40,40)";
                    this.ctx.fillRect(cx - 80, 140 + (p * 70), 160, 64);
                    this.drawTile(cx - 80, 140 + (p * 70), clazz.icon, 64);
                    this.drawText(cx - 10, 180 + (p * 70), clazz.name, 24, "white");
                    p++;
                }
            } else {
                this.ctx.save();
                this.renderDungeon();
                this.ctx.restore();
            }

            // bar at the top
            let p = 0;
            for (const playerId of this.game.playerOrder) {
                this.ctx.fillStyle = "rgb(40,40,40)";
                this.ctx.fillRect((p * 68), 0, 64, 64);
                if (this.game.playerInfo[playerId]) {
                    this.drawTile(p * 68, 0, this.iconForClass(this.game.playerInfo[playerId].type), 64);
                } else {
                    this.drawText((p * 68) + 24, 43, "?", 32, "white");
                }
                this.ctx.drawImage(this.playerAvatars[playerId], (p * 68) + 40, 38, 20, 20);

                if (this.game.whoseTurn === playerId) {
                    this.drawRect((p * 68), 0, 64, 64, "yellow");
                }
                p++;
            }

            // status bar at the bottom
            if (this.localPlayerClass) {
                this.ctx.fillStyle = "rgb(40,40,40)";
                this.ctx.fillRect(0, this.canvas.height - 100, this.canvas.width, 100);
                this.ctx.fillStyle = "rgb(60,60,60)";
                this.ctx.fillRect(0, this.canvas.height - 70, this.canvas.width, 70);
                if (this.game.whoseTurn === this.localPlayerId) {
                    this.ctx.fillStyle = "#8ac34d";
                    this.ctx.fillRect(0, this.canvas.height - 100, this.canvas.width, 27);
                    this.ctx.fillStyle = "white";
                    this.ctx.font = "bold 20px serif";
                    this.ctx.fillText("YOUR TURN", 10, this.canvas.height - 80);

                    // end turn button
                    this.ctx.fillStyle = "rgb(40,40,40)";
                    this.ctx.fillRect(this.canvas.width - 100, this.canvas.height - 99, 90, 25);
                    this.ctx.fillStyle = "white";
                    this.ctx.font = "bold 14px serif";
                    this.ctx.fillText("END TURN", this.canvas.width - 91, this.canvas.height - 81);
                } else {
                    this.ctx.fillStyle = "#cc3a3a";
                    this.ctx.fillRect(0, this.canvas.height - 100, this.canvas.width, 27);

                    const playerTurn = this.state?.players[this.game.whoseTurn];
                    if (playerTurn) {
                        this.centerText(playerTurn.displayName.toUpperCase() + "'S TURN", 20, this.canvas.height - 80, "white");
                    } else {
                        this.centerText("MONSTER'S TURN", 20, this.canvas.height - 80, "white");
                    }
                }

                if (this.myActor) {
                    this.drawTile(cx - 150, this.canvas.height - 65, 70, 24);
                    for (let i = 0; i < this.myActor?.health; i++) {
                        this.ctx.fillStyle = "#cc3a3a";
                        this.ctx.fillRect(cx - 150 + 30 + (i * 20), this.canvas.height - 60, 15, 15);
                        this.drawRect(cx - 150 + 30 + (i * 20), this.canvas.height - 60, 15, 15, "black");
                    }

                    this.drawTile(cx - 155, this.canvas.height - 40, 75, 32);
                    for (let i = 0; i < this.myActor?.magic; i++) {
                        this.ctx.fillStyle = "#2d7de9";
                        this.ctx.fillRect(cx - 150 + 30 + (i * 20), this.canvas.height - 30, 15, 15);
                        this.drawRect(cx - 150 + 30 + (i * 20), this.canvas.height - 30, 15, 15, "black");
                    }

                    this.drawTile(cx + 10, this.canvas.height - 65, 77, 24);
                    for (let i = 0; i < this.myActor?.moves; i++) {
                        this.ctx.fillStyle = "#436c15";
                        this.ctx.fillRect(cx + 10 + 30 + (i * 20), this.canvas.height - 60, 15, 15);
                        this.drawRect(cx + 10 + 30 + (i * 20), this.canvas.height - 60, 15, 15, "black");
                    }
                    this.ctx.fillStyle = "white";
                    this.ctx.font = "bold 24px serif";
                    this.drawTile(cx + 20, this.canvas.height - 38, 45, 28);
                    this.ctx.fillText("" + this.myActor.attack, cx + 50, this.canvas.height - 16);
                    this.drawTile(cx + 90, this.canvas.height - 38, 69, 28);
                    this.ctx.fillText("" + this.myActor.defense, cx + 120, this.canvas.height - 16);
                }
            }
        }

        requestAnimationFrame(() => { this.loop() });
    }

    renderOptions(): void {
        const offset = (20 / 64) * this.tileSize;
        if (this.game && this.myActor) {
            const dungeon = getDungeonById(this.game, this.myActor.dungeonId);
            if (!dungeon) {
                return;
            }
            this.ctx.globalAlpha = 0.5;
            for (const option of this.game.possibleMoves) {
                if (option.type === "move") {
                    if (!getActorAt(dungeon, option.x, option.y)) {
                        this.drawTile((option.x * this.tileSize) + offset, (option.y * this.tileSize) + offset, 5);
                    }
                }
                if (option.type === "open") {
                    this.drawTile((option.x * this.tileSize) + offset, (option.y * this.tileSize) + offset, 6);
                }
                if (option.type === "attack") {
                    this.drawTile((option.x * this.tileSize) + offset, (option.y * this.tileSize) + offset, 7);
                }

                // this.ctx.fillStyle = "white";
                // this.ctx.fillText(option.depth+"", (option.x * 64), (option.y * 64)+20);
            }
            this.ctx.globalAlpha = 1;
        }
    }

    renderDungeon(): void {
        if (this.game && this.myActor) {
            const dungeon = getDungeonById(this.game, this.myActor.dungeonId);
            if (!dungeon) {
                return;
            }

            this.ctx.save();

            let x = this.myActor.x;
            let y = this.myActor.y;
            const delta = Rune.gameTime() - this.myActor.lt;
            if (delta < STEP_TIME) {
                const lerp = delta / STEP_TIME;
                x = (this.myActor.x * lerp) + (this.myActor.lx * (1 - lerp));
                y = (this.myActor.y * lerp) + (this.myActor.ly * (1 - lerp));
            }

            this.offsetx = Math.floor((this.canvas.width / 2) - (x * this.tileSize) - 32);
            this.offsety = Math.floor((this.canvas.height / 2) - (y * this.tileSize) - 32);
            this.ctx.translate(this.offsetx, this.offsety);

            for (const room of dungeon.rooms) {
                if (!room.discovered) {
                    continue;
                }

                for (let x = 0; x < room.width; x++) {
                    for (let y = 0; y < room.height; y++) {
                        const tx = room.x + x;
                        const ty = room.y + y;

                        this.drawTile(tx * this.tileSize, ty * this.tileSize, 89 + (Math.abs((tx * ty) % 2)) * 8);
                        const door = getDoorAt(dungeon, tx, ty);

                        if (door) {
                            if (door.open) {
                                this.drawTile(tx * this.tileSize, ty * this.tileSize, 98);
                            } else {
                                this.drawTile(tx * this.tileSize, ty * this.tileSize, 99);
                            }
                        } else {
                            if ((x === 0) || (x === room.width - 1)) {
                                this.drawTile(tx * this.tileSize, ty * this.tileSize, WALL_TOPS[Math.abs(((tx * ty) % WALL_TOPS.length))]);
                            } else if (y === 0) {
                                this.drawTile(tx * this.tileSize, ty * this.tileSize, WALL_FRONTS[Math.abs(((tx * ty) % WALL_FRONTS.length))]);
                            }
                            if (y === room.height - 1) {
                                if (getRoomAt(dungeon, tx, ty + 1)) {
                                    this.drawTile(tx * this.tileSize, ty * this.tileSize, WALL_FRONTS[Math.abs(((tx * ty) % WALL_FRONTS.length))]);
                                } else {
                                    this.drawTile(tx * this.tileSize, ty * this.tileSize, WALL_FRONTS[Math.abs((tx * ty) % WALL_FRONTS.length)]);
                                }
                            }
                        }
                    }
                }

                if (room.start) {
                    this.drawTile((room.x + room.width - 2) * this.tileSize, (room.y + 1) * this.tileSize, 88);
                }
            }

            // draw the actors with their movements if required
            this.moving = false;
            for (const actor of dungeon.actors) {
                const room = getRoomAt(dungeon, actor.x, actor.y);
                if (room?.discovered) {
                    let yoffset = -5;
                    let frameOffset = 0;
                    if (actor.playerId === this.game.whoseTurn) {
                        if (Math.floor(this.anim / 15) % 2 === 0) {
                            frameOffset = 16;
                        }
                    }

                    let x = actor.x;
                    let y = actor.y;
                    const delta = Rune.gameTime() - actor.lt;
                    if (delta < STEP_TIME) {
                        const lerp = delta / STEP_TIME;
                        x = (actor.x * lerp) + (actor.lx * (1 - lerp));
                        y = (actor.y * lerp) + (actor.ly * (1 - lerp));
                        yoffset = -Math.sin(lerp * Math.PI) * 13;
                        this.moving = true;
                    }
                    this.drawTile(x * this.tileSize, (y * this.tileSize) + yoffset, actor.icon + frameOffset);
                }
            }

            if (this.myTurn && !this.game.currentActivity && !this.moving) {
                this.renderOptions();
            }
            this.ctx.restore();
        }
    }
}