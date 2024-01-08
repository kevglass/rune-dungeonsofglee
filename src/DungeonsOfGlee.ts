import tiles from "./assets/tiles-64.png";
import cokeandcodeUrl from "./assets/cokeandcode.png";
import logoUrl from "./assets/logo.png";
import sfxDoorUrl from "./assets/opendoor.mp3";
import sfxStepUrl from "./assets/mapstep.mp3";
import sfxSwishUrl from "./assets/swish.mp3";
import sfxPainUrl from "./assets/pain1.mp3";
import sfxMonsterUrl from "./assets/monster1.mp3";
import sfxYourTurnUrl from "./assets/yourturn.mp3";
import sfxRangedUrl from "./assets/arrow.mp3";
import sfxMagicUrl from "./assets/fireball.mp3";
import sfxHealUrl from "./assets/heal.mp3";
import sfxClickUrl from "./assets/click.mp3";

import { GameEvent, GameState, GameUpdate, STEP_TIME } from "./logic";
import { Actor } from "./actor";
import { getActorAt, getActorById, getDoorAt, getDungeonById, getRoomAt } from "./dungeon";
import { PlayerClass, PlayerInfo } from "./player";
import { InputEventListener, TileSet, centerText, drawImage, drawRect, drawText, drawTile, fillCircle, fillRect, loadTileSet, popState, pushState, registerInputEventListener, rotate, scale, screenHeight, screenWidth, setAlpha, translate, updateGraphics } from "./renderer/graphics";
import { intersects } from "./renderer/util";
import { Sound, loadSound, playSound } from "./renderer/sound";

/**
 * Dungeons of Glee
 * 
 * A very simple dungeon crawler game to try out the Rune SDK (https://rune.ai). I wanted to give it 
 * a go so this is a very quick hack of a dungeon game to see what its all about.
 */

// tileset references to the different wall tops and sides to be displayed - the duplicated
// values are to increase the probability of that type of tile.
const WALL_TOPS = [92, 92, 92, 92, 92, 92, 93, 94, 95];
const WALL_FRONTS = [100, 100, 100, 100, 100, 100, 101, 102, 103];

// Definition of the type of character the player can choose
interface PlayerClassDef {
    sprite: number;
    name: string;
    type: PlayerClass;
}

interface Marker {
    x: number;
    y: number;
    value: number;
    created: number;
    source?: Actor;
    type: string;
}

// The actual game running ont he client
export class DungeonsOfGlee implements InputEventListener {
    // the main set of graphics we're using for everything
    tiles: TileSet;
    // the images loaded for the player's avatars
    playerAvatars: Record<string, HTMLImageElement> = {};

    // state maintained between clients
    game?: GameState;
    state?: GameUpdate;
    localPlayerId?: string;

    // an animation ticker
    anim = 0;

    // the offset for the camera view of the world
    offsetx = 0;
    offsety = 0;

    // the size we're rendering the dungeon tiles at
    tileSize = 48;
    // true if we're in the middle of completing a move
    moving = false;

    // the list of player characters that can be used
    classes: PlayerClassDef[] = [
        { sprite: 0, name: "Dwarf", type: "dwarf" },
        { sprite: 1, name: "Witch", type: "witch" },
        { sprite: 2, name: "Elf", type: "elf" },
        { sprite: 3, name: "Knight", type: "knight" },
    ];

    markers: Marker[] = [];

    // sound effect for door opening
    sfxDoor: Sound;
    // sound effect for taking a step
    sfxStep: Sound;
    // sound effect for taking a swishing sword
    sfxSwish: Sound;
    // sound effect hero taking damage
    sfxPain: Sound;
    // sound effect monster taking damage
    sfxMonster: Sound;
    // sound effect monster taking damage
    sfxTurn: Sound;
    // sound effect button click
    sfxClick: Sound;
    // sound effect for healing spell
    sfxHeal: Sound;
    // sound effect for magic attack
    sfxMagic: Sound;
    // sound effect ranged attack
    sfxRanged: Sound;

    logo: HTMLImageElement;
    cokeandcode: HTMLImageElement;

    constructor() {
        // register ourselves as the input listener so
        // we get nofified of mouse presses
        registerInputEventListener(this);

        // load all the resources. note that all of these
        // are async - so we may end up with empty images/sounds
        // for a while
        this.tiles = loadTileSet(tiles, 64, 64);
        this.sfxDoor = loadSound(sfxDoorUrl);
        this.sfxStep = loadSound(sfxStepUrl);
        this.sfxSwish = loadSound(sfxSwishUrl);
        this.sfxPain = loadSound(sfxPainUrl);
        this.sfxMonster = loadSound(sfxMonsterUrl);
        this.sfxTurn = loadSound(sfxYourTurnUrl);
        this.sfxClick = loadSound(sfxClickUrl);
        this.sfxHeal = loadSound(sfxHealUrl);
        this.sfxMagic = loadSound(sfxMagicUrl);
        this.sfxRanged = loadSound(sfxRangedUrl);

        this.logo = new Image();
        this.logo.src = logoUrl;
        this.cokeandcode = new Image();
        this.cokeandcode.src = cokeandcodeUrl;
    }

    // get the icon to use for a given player class
    iconForClass(type: PlayerClass): number {
        const def = this.classes.find(d => d.type === type);
        if (def) {
            return def.sprite;
        }

        return 0;
    }

    // get the local player's character class
    get localPlayerClass(): PlayerClass | undefined {
        return this.game?.playerInfo[this.localPlayerId ?? ""]?.type;
    }

    // get the local player's player information if its been set
    get myPlayerInfo(): PlayerInfo | undefined {
        return this.game?.playerInfo[this.localPlayerId ?? ""];
    }

    // check if it's this player's turn
    get myTurn(): boolean {
        return this.game?.whoseTurn === this.localPlayerId;
    }

    // get the actor that represents this player
    get myActor(): Actor | undefined {
        if (this.myPlayerInfo && this.game) {
            return getActorById(this.game, this.myPlayerInfo.dungeonId, this.myPlayerInfo.actorId);
        }

        return undefined;
    }

    get isDead(): boolean {
        if (!this.myActor) {
            return false;
        }

        return this.myActor.health <= 0;
    }

    // notification that the mouse has been pressed
    mouseDown(x: number, y: number): void {
        playSound(this.sfxClick);
        // if we haven't seleccted a class yet then using the y mouse position
        // determine which class the player selected
        if (!this.localPlayerClass) {
            const selected = Math.floor((y - 160) / 70);
            if (this.classes[selected]) {
                Rune.actions.setPlayerType({ type: this.classes[selected].type });
            }
        } else {
            if (this.isDead) {
                Rune.actions.clearType();
                return;
            }
            // otherwise we're in game. Work out which tile the player 
            // clicked based on the camera offset.
            const tx = Math.floor((x - this.offsetx) / this.tileSize);
            const ty = Math.floor((y - this.offsety) / this.tileSize);

            if ((y < screenHeight() - 100) && (y > 64)) {
                // if we're in game and theres a possible move at the location then
                // run the Rune action to play a move.
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
            }

            // if we're clicking on the end turn button apply that Rune action.
            if (intersects(x, y, screenWidth() - 112, screenHeight() - 109, 114, 47)) {
                // pressed end turn
                if (this.myTurn) {
                    Rune.actions.endTurn();
                }
            }
        }
    }

    // start the game. This is a simple boostrap to start Rune's client
    // and beging the rendering loop
    start(): void {
        Rune.initClient({
            onChange: (game) => {
                this.gameUpdate(game);
            },
        });

        requestAnimationFrame(() => { this.loop() });
    }

    // Callback from Rune when the game state has changed
    gameUpdate(state: GameUpdate) {
        // record our player ID
        this.localPlayerId = state.yourPlayerId;

        // update our game state
        this.game = state.game;
        this.state = state;

        // load any player avatars we don't already have
        for (const playerId in state.players) {
            if (!this.playerAvatars[playerId]) {
                this.playerAvatars[playerId] = new Image();
                this.playerAvatars[playerId].src = state.players[playerId].avatarUrl;
            }
        }

        // handle any events that were recorded this game frame
        for (const event of state.game.events) {
            this.processEvent(event);
        }
    }

    playSound(sound: Sound): void {
        if (this.myActor) {
            playSound(sound);
        }
    }

    // process game events presented by the game state
    processEvent(event: GameEvent) {
        if (event.type === "open") {
            this.playSound(this.sfxDoor);
        }
        if (event.type === "step") {
            // delayed so the sound plays when we reach our destination
            setTimeout(() => {
                this.playSound(this.sfxStep);
            }, STEP_TIME);
        }
        if (event.type === "melee") {
            this.playSound(this.sfxSwish);
        }
        if (event.type === "turnChange") {
            if (this.myTurn) {
                this.playSound(this.sfxTurn);
            }
        }
        if (event.type === "damage") {
            if (this.game && this.myActor) {
                const attacker = getActorById(this.game, this.myActor?.dungeonId, event.actorId);
                if (event.value > 0 && attacker) {
                    if (attacker.good) {
                        this.playSound(this.sfxMonster);
                    } else if (!attacker.good) {
                        this.playSound(this.sfxPain);
                    }
                }
                this.markers.push({
                    x: event.x, y: event.y, value: event.value, created: Date.now(),
                    source: attacker,
                    type: "damage"
                });
            }
        }
        if (event.type === "died") {
            if (this.game && this.myActor) {
                this.markers.push({
                    x: event.x, y: event.y, value: event.value, created: Date.now(),
                    source: getActorById(this.game, this.myActor?.dungeonId, event.actorId),
                    type: "died"
                });
            }
        }
    }

    // the main client side game rendering loop. 
    loop(): void {
        // let the graphics do whatever it wants to do
        updateGraphics();

        // clear the screen
        fillRect(0, 0, screenWidth(), screenHeight(), "rgb(20,20,20)");

        const cx = Math.floor(screenWidth() / 2);

        // filter any expired markers (they hang around for a second)
        this.markers = this.markers.filter(m => Date.now() - m.created < 1000);

        // if we have game state
        if (this.game) {
            this.anim++;
            // if we don't currently have a player class then show
            // the class selection screen
            if (!this.localPlayerClass) {
                drawImage(this.logo, Math.floor((screenWidth() / 2) - (this.logo.width / 2)), 0, this.logo.width, this.logo.height);
                drawImage(this.cokeandcode, Math.floor((screenWidth() / 2) - (this.cokeandcode.width / 2)), screenHeight() - this.cokeandcode.height - 20, this.cokeandcode.width, this.cokeandcode.height);
                centerText("Select Your Hero", 20, 140, "white");
                let p = 0;
                for (const clazz of this.classes) {
                    fillRect(cx - 90, 160 + (p * 70), 180, 64, "rgb(40,40,40)");
                    drawTile(this.tiles, cx - 80, 160 + (p * 70), clazz.sprite, 64, 64);
                    drawText(cx - 10, 200 + (p * 70), clazz.name, 24, "white");
                    p++;
                }
            } else {
                // otherwise render the dungeon area since we're in 
                // game
                pushState();
                this.renderDungeon();
                popState();
            }

            // render the bar of players at the top of the screen
            let p = 0;
            for (const playerId of this.game.playerOrder) {
                fillRect((p * 68), 0, 64, 64, "rgb(40,40,40)");
                if (this.game.playerInfo[playerId]) {
                    const actor = getActorById(this.game, this.game.playerInfo[playerId].dungeonId, this.game.playerInfo[playerId].actorId);
                    if (actor) {
                        const sprite = actor.health > 0 ? actor.sprite : 10;
                        drawTile(this.tiles, (p * 68) + 3, 0, sprite, 64, 64);
                        for (let i = 0; i < actor.health; i++) {
                            fillRect((p * 68) + 4, 52 - (i * 9), 8, 8, "#cc3a3a");
                            drawRect((p * 68) + 4, 52 - (i * 9), 8, 8, "black");
                        }
                    }
                } else {
                    drawText((p * 68) + 24, 43, "?", 32, "white");
                }
                drawImage(this.playerAvatars[playerId], (p * 68) + 40, 4, 20, 20);

                if (this.game.whoseTurn === playerId) {
                    drawRect((p * 68), 0, 64, 64, "yellow");
                }
                p++;
            }

            // render the status bar at the bottom
            if (this.localPlayerClass) {
                fillRect(0, screenHeight() - 100, screenWidth(), 100, "rgb(40,40,40)");
                fillRect(0, screenHeight() - 70, screenWidth(), 70, "rgb(60,60,60)");

                if (this.isDead) {
                    fillRect(0, 84, screenWidth(), 27, "#444");
                    centerText("YOU HAVE DIED", 20, 104, "white");
                }
                if (this.game.whoseTurn === this.localPlayerId) {
                    fillRect(0, screenHeight() - 100, screenWidth(), 27, "#8ac34d");
                    drawText(10, screenHeight() - 80, "YOUR TURN", 20, "white");

                    // end turn button
                    fillRect(screenWidth() - 122, screenHeight() - 109, 114, 47,  "rgb(40,40,40)");
                    fillRect(screenWidth() - 122, screenHeight() - 109, 114, 44,  "#8ac34d");
                    fillRect(screenWidth() - 119, screenHeight() - 106, 108, 38, "rgb(40,40,40)");
                    drawText(screenWidth() - 111, screenHeight() - 81, "END TURN", 18, "white");
                } else {
                    fillRect(0, screenHeight() - 100, screenWidth(), 27, "#cc3a3a");

                    const playerTurn = this.state?.players[this.game.whoseTurn];
                    if (playerTurn) {
                        centerText(playerTurn.displayName.toUpperCase() + "'S TURN", 20, screenHeight() - 80, "white");
                    } else {
                        centerText("MONSTER'S TURN", 20, screenHeight() - 80, "white");
                    }
                }

                if (this.myActor) {
                    drawTile(this.tiles, cx - 150, screenHeight() - 65, 70, 24, 24);
                    for (let i = 0; i < this.myActor?.health; i++) {
                        fillRect(cx - 150 + 30 + (i * 20), screenHeight() - 60, 15, 15, "#cc3a3a");
                        drawRect(cx - 150 + 30 + (i * 20), screenHeight() - 60, 15, 15, "black");
                    }

                    drawTile(this.tiles, cx - 155, screenHeight() - 40, 75, 32, 32);
                    for (let i = 0; i < this.myActor?.magic; i++) {
                        fillRect(cx - 150 + 30 + (i * 20), screenHeight() - 30, 15, 15, "#2d7de9");
                        drawRect(cx - 150 + 30 + (i * 20), screenHeight() - 30, 15, 15, "black");
                    }

                    drawTile(this.tiles, cx + 10, screenHeight() - 65, 77, 24, 24);
                    for (let i = 0; i < this.myActor?.moves; i++) {
                        fillRect(cx + 10 + 30 + (i * 20), screenHeight() - 60, 15, 15, "#436c15");
                        drawRect(cx + 10 + 30 + (i * 20), screenHeight() - 60, 15, 15, "black");
                    }
                    drawTile(this.tiles, cx + 20, screenHeight() - 38, 45, 28, 28);
                    drawText(cx + 50, screenHeight() - 16, "" + this.myActor.attack, 24, "white");
                    drawTile(this.tiles, cx + 90, screenHeight() - 38, 69, 28, 28);
                    drawText(cx + 120, screenHeight() - 16, "" + this.myActor.defense, 24, "white");
                }
            }
        }

        // request another loop from the
        requestAnimationFrame(() => { this.loop() });
    }

    // render the options/moves available to the player. These are shown 
    // as semi-transparent markers over the top fo the dungeon
    renderOptions(): void {
        if (this.game && this.myActor) {
            const dungeon = getDungeonById(this.game, this.myActor.dungeonId);
            if (!dungeon) {
                return;
            }
            setAlpha(0.5);
            for (const option of this.game.possibleMoves) {
                if (option.type === "move") {
                    if (!getActorAt(dungeon, option.x, option.y)) {
                        drawTile(this.tiles, (option.x * this.tileSize), (option.y * this.tileSize), 5, this.tileSize, this.tileSize);
                    }
                }
                if (option.type === "open") {
                    drawTile(this.tiles, (option.x * this.tileSize), (option.y * this.tileSize), 6, this.tileSize, this.tileSize);
                }
                if (option.type === "attack") {
                    drawTile(this.tiles, (option.x * this.tileSize), (option.y * this.tileSize), 7, this.tileSize, this.tileSize);
                }
            }
            setAlpha(1);
        }
    }

    // render the actual dungeon tiles. Theres not clipping here yet since dungeons aren't
    // that big. Should really only render what would be in view
    renderDungeon(): void {
        if (this.game && this.myActor) {
            const dungeon = getDungeonById(this.game, this.myActor.dungeonId);
            if (!dungeon) {
                return;
            }

            pushState();


            // work out the camera position based on the local actor
            let x = this.myActor.x;
            let y = this.myActor.y;
            const delta = Rune.gameTime() - this.myActor.lt;
            if (delta < STEP_TIME) {
                const lerp = delta / STEP_TIME;
                x = (this.myActor.x * lerp) + (this.myActor.lx * (1 - lerp));
                y = (this.myActor.y * lerp) + (this.myActor.ly * (1 - lerp));
            }

            if (this.myActor.health > 0) {
                this.offsetx = Math.floor((screenWidth() / 2) - (x * this.tileSize) - 32);
                this.offsety = Math.floor((screenHeight() / 2) - (y * this.tileSize) - 32);
            }
            translate(this.offsetx, this.offsety);

            // for each room render the tiles of the floor and walls and any doors that 
            // are part of the room
            for (const room of dungeon.rooms) {
                if (!room.discovered) {
                    continue;
                }

                for (let x = 0; x < room.width; x++) {
                    for (let y = 0; y < room.height; y++) {
                        const tx = room.x + x;
                        const ty = room.y + y;

                        drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, 89 + (Math.abs((tx * ty) % 2)) * 8, this.tileSize, this.tileSize);
                        const door = getDoorAt(dungeon, tx, ty);

                        if (door) {
                            if (door.open) {
                                drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, 98, this.tileSize, this.tileSize);
                            } else {
                                drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, 99, this.tileSize, this.tileSize);
                            }
                        } else {
                            // theres some randomness here to make the walls sides and top vary from a list of potential images. it's
                            // based on the x/y position so its deterministic 
                            if ((x === 0) || (x === room.width - 1)) {
                                drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, WALL_TOPS[Math.abs(((tx * ty) % WALL_TOPS.length))], this.tileSize, this.tileSize);
                            } else if (y === 0) {
                                drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, WALL_FRONTS[Math.abs(((tx * ty) % WALL_FRONTS.length))], this.tileSize, this.tileSize);
                            }
                            if (y === room.height - 1) {
                                const roomBelow = getRoomAt(dungeon, tx, ty + 1);
                                if (roomBelow && (roomBelow.y === ty + 1 || tx === roomBelow.x || tx === roomBelow.width - 1)) {
                                    drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, WALL_TOPS[Math.abs(((tx * ty) % WALL_TOPS.length))], this.tileSize, this.tileSize);
                                } else {
                                    drawTile(this.tiles, tx * this.tileSize, ty * this.tileSize, WALL_FRONTS[Math.abs((tx * ty) % WALL_FRONTS.length)], this.tileSize, this.tileSize);
                                }
                            }
                        }
                    }
                }

                // if we're in the start room, draw the stairs
                if (room.start) {
                    drawTile(this.tiles, (room.x + room.width - 2) * this.tileSize, (room.y + 1) * this.tileSize, 88, this.tileSize, this.tileSize);
                }
            }

            // draw the actors with their movements if required
            this.moving = false;
            for (const actor of dungeon.actors) {
                const room = getRoomAt(dungeon, actor.x, actor.y);
                if (room?.discovered) {
                    let yoffset = -5;
                    let frameOffset = 0;

                    // if the actor is who needs to move then animate them
                    if (actor.playerId === this.game.whoseTurn) {
                        if (Math.floor(this.anim / 15) % 2 === 0) {
                            frameOffset = 16;
                        }
                    }

                    // each move from tile to tile takes "STEP_TIME". We'll linearly 
                    // interpolate across that time frame to have the actor move smoothly 
                    // from one tile to another
                    let x = actor.x;
                    let y = actor.y;
                    const delta = Rune.gameTime() - actor.lt;
                    if (delta < STEP_TIME) {
                        const lerp = delta / STEP_TIME;
                        x = (actor.x * lerp) + (actor.lx * (1 - lerp));
                        y = (actor.y * lerp) + (actor.ly * (1 - lerp));
                        // add a little bounce to the moves
                        yoffset = -Math.sin(lerp * Math.PI) * 13;
                        this.moving = true;
                    }

                    const marker = this.markers.find(m => m.source?.id === actor.id);
                    if (marker) {
                        if (Date.now() - marker.created < 150) {
                            const delta = ((Date.now() - marker.created) / 150) * Math.PI;
                            const offset = (Math.sin(delta) / 2);
                            x = (x * (1 - offset) + (marker.x * offset));
                            y = (y * (1 - offset) + (marker.y * offset));
                        }
                    }
                    pushState();
                    translate(x * this.tileSize, (y * this.tileSize) + yoffset);
                    if (actor.facingRight) {
                        drawTile(this.tiles, 0, 0, actor.sprite + frameOffset, this.tileSize, this.tileSize);
                    } else {
                        scale(-1, 1);
                        drawTile(this.tiles, -this.tileSize, 0, actor.sprite + frameOffset, this.tileSize, this.tileSize);
                    }
                    popState();
                }
            }

            for (const marker of this.markers) {
                if (marker.type === "died") {
                    const delta = (Date.now() - marker.created) / 1000;
                    pushState();
                    setAlpha(1 - delta);
                    translate(marker.x * this.tileSize, (marker.y * this.tileSize) - 5);
                    translate(this.tileSize / 2, this.tileSize / 2);
                    rotate(delta * Math.PI * 2);
                    translate(-this.tileSize / 2, -this.tileSize / 2);
                    drawTile(this.tiles, 0, 0, marker.value, this.tileSize, this.tileSize);
                    popState();
                }
            }

            for (const marker of this.markers) {
                if (marker.type === "damage") {
                    const cx = (marker.x * this.tileSize) + (this.tileSize / 2)
                    const cy = (marker.y * this.tileSize) + (this.tileSize / 2) - 4;
                    let circleColor = "#cc3a3a";
                    let textColor = "white";
                    if (marker.value === 0) {
                        circleColor = "#eee";
                        textColor = "black";
                    }
                    const delta = (Date.now() - marker.created) / 1000;
                    fillCircle(cx, cy - (delta * 20), 8, circleColor);
                    drawText(cx - 3, cy + 3 - (delta * 20), marker.value + "", 12, textColor);
                }
            }

            // if this player is able to move and nothing else is happening then
            // display the options for movement
            if (this.myTurn && !this.game.currentActivity && !this.moving) {
                this.renderOptions();
            }

            // debug evil move options
            // if (this.game.whoseTurn === "evil") {
            //     this.renderOptions();
            // }

            popState();
        }
    }
}
