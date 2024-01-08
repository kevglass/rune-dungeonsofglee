import type { OnChangeAction, OnChangeEvent, PlayerId, Players, RuneClient } from "rune-games-sdk/multiplayer"
import { PLAYER_CLASS_DEFS, PlayerClass, PlayerInfo } from "./player";
import { Actor, createActor } from "./actor";
import { calcMoves, Dungeon, findNextStep, generateDungeon, getActorAt, getActorById, getAllRoomsAt, getDungeonById, Point } from "./dungeon";
import { distanceToHero, findActiveMonsters, getAdjacentHero, standingNextToHero } from "./monsters";
import { errorLog } from "./log";

export const STEP_TIME = 1000 / 3;

export type GameEventType = "damage" | "open" | "step" | "died" | "melee" | "ranged" | "magic" | "heal" | "turnChange";

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  value: number;
  actorId: number;
}

export interface GameState {
  nextId: number;
  playerOrder: string[];
  deadHeroes: Actor[];
  playerInfo: Record<string, PlayerInfo>;
  whoseTurn: string;
  dungeons: Dungeon[];
  possibleMoves: GameMove[];
  currentActivity?: Activity;
  lastUpdate: number;
  events: GameEvent[];
}

export interface Activity {
  dungeonId: number;
  actorId: number;
  startTime: number;
  tx: number;
  ty: number;
}

export interface GameMove {
  x: number;
  y: number;
  type: "move" | "attack" | "open" | "heal"
  depth: number;
}

// The collection of actions the players can take to effect the game
type GameActions = {
  // The player selected a character type to play. We then add them to the 
  // world
  setPlayerType: (params: { type: PlayerClass }) => void;
  // The player selected an action/move on a particular tile. Apply
  // it and make it tick over
  makeMove: (params: { x: number, y: number }) => void;
  // The player has chosen to end their turn (it's automatic if they run out of moves).
  // Move to the next person (or monsters) turn
  endTurn: () => void;
  // clear the selected type so it can be reselected
  clearType(): () => void;
}

declare global {
  const Rune: RuneClient<GameState, GameActions>;
}

// Quick type so I can pass the complex object that is the 
// Rune onChange blob around without ugliness. 
export type GameUpdate = {
  game: GameState;
  action?: OnChangeAction<GameActions>;
  event?: OnChangeEvent;
  yourPlayerId: PlayerId | undefined;
  players: Players;
  rollbacks: OnChangeAction<GameActions>[];
  previousGame: GameState;
  futureGame?: GameState;
};

// Move to the next player's or the monster's turn. This includes
// calculating the new moves available for the turn.
export function nextTurn(game: GameState): void {
  let index = game.playerOrder.indexOf(game.whoseTurn);
  if (index === -1) {
    // it was evils turns, start a zero again
    index = 0;
  } else {
    index++;
  }
  if (index >= game.playerOrder.length) {
    // its now evils turn 
    game.whoseTurn = "evil";
  } else {
    game.whoseTurn = game.playerOrder[index];
  }

  if (game.whoseTurn !== "evil") {
    const newActor = getActorById(game, game.playerInfo[game.whoseTurn].dungeonId, game.playerInfo[game.whoseTurn].actorId);
    if (newActor) {
      // dead players don't get to play (so are they really players? deep.)
      if (newActor.health <= 0) {
        nextTurn(game);
        return;
      }

      newActor.moves = newActor.maxMoves;
      newActor.attacks = 1;
      if (newActor.magic < newActor.maxMagic) {
        newActor.magic++;
      }
      // calculate all the possible moves from this position
      calcMoves(game, newActor);
    }
  } else {
    for (const dungeon of game.dungeons) {
      dungeon.actors.filter(a => !a.good).forEach(actor => {
        actor.moves = actor.maxMoves;
        actor.attacks = 1;
      });
    }
  }

  addGameEvent(game, 0, "turnChange");
}

// Semantic wrapper to help with readability 
function addGameEvent(game: GameState, actorId: number, event: GameEventType, x: number = 0, y: number = 0, value: number = 0) {
  game.events.push({
    type: event,
    actorId, 
    x, y, value
  });
}

function rollCombat(attacker: Actor, target?: Actor): number {
  if (!target) {
    return 0;
  }

  let skulls = 0;
  for (let i = 0; i < attacker.attack; i++) {
    if ((Math.random() * 6) < 3) {
      skulls++;
    }
  }
  let shields = 0;
  for (let i = 0; i < target.defense; i++) {
    if ((Math.random() * 6) < 2 && target.good) {
      shields++;
    }
    if ((Math.random() * 6) < 1 && !target.good) {
      shields++;
    }
  }

  return Math.max(0, skulls - shields);
}

// Run the currently move - this is called one per logic tick (MOVE_TIME). Apply
// the next step in the path or the actual action at the end
function applyCurrentActivity(game: GameState): boolean {
  if (game.currentActivity) {
    game.lastUpdate = Rune.gameTime();

    const dungeon = getDungeonById(game, game.currentActivity.dungeonId);
    if (dungeon) {
      // find the actor that's taking the action
      const actor = dungeon.actors.find(a => a.id === game.currentActivity?.actorId);
      if (actor) {
        // find the next step in the path/action based on the path find we did earlier
        const nextStep = findNextStep(game, actor, game.currentActivity.tx, game.currentActivity.ty);

        // if it's a move then move the actor to the new position and record the last
        // position they were at some we can lerp between the last and the new for 
        // smooth movement
        if (nextStep && nextStep.type === "move") {
          actor.lx = actor.x;
          actor.ly = actor.y;
          actor.lt = Rune.gameTime();
          actor.x = nextStep.x;
          actor.y = nextStep.y;
          actor.moves--;
          addGameEvent(game, actor.id, "step");
          if (actor.x > actor.lx) {
            actor.facingRight = true;
          }
          if (actor.x < actor.lx) {
            actor.facingRight = false;
          }
        }

        // If its an open then open the door and discover any rooms connected to 
        // make them visible and activate any monsters inside
        if (nextStep && nextStep.type === "open") {
          dungeon.doors.filter(d => d.x === nextStep.x && d.y === nextStep.y).forEach(d => d.open = true);
          getAllRoomsAt(dungeon, nextStep.x, nextStep.y).forEach(r => r.discovered = true);
          addGameEvent(game, actor.id, "open");
        }

        if (nextStep && nextStep.type === "attack") {
          actor.attacks--;

          const target = getActorAt(dungeon, nextStep.x, nextStep.y);
          if (target) {
            const damage = rollCombat(actor, target);
            addGameEvent(game, actor.id, "melee");
            addGameEvent(game, actor.id, "damage", nextStep.x, nextStep.y, damage);

            target.health -= damage;
            if (target.health <= 0) {
              target.health = 0;
              dungeon.actors.splice(dungeon.actors.indexOf(target), 1);
              addGameEvent(game, -1, "died", nextStep.x, nextStep.y, target.sprite);

              if (target.good) {
                game.deadHeroes.push(target);
              }
            }
          }
          // if we've already moved then engaging in combat
          // uses up the rest
          if (actor.moves < actor.maxMoves) {
            actor.moves = 0;
          }
          calcMoves(game, actor);
        }

        // if this was the last step then recalculate the available moves
        // for the current turn holder.
        if (nextStep && nextStep.x === game.currentActivity.tx && nextStep.y === game.currentActivity.ty) {
          game.currentActivity = undefined;
          calcMoves(game, actor);
        }
      }
      return true;
    }
  }

  return false;
}

// play the evil characters
function takeEvilTurn(game: GameState): void {
  const heroes: Actor[] = [];
  game.dungeons.forEach(d => heroes.push(...d.actors.filter(a => a.good)));
  if (heroes.length === 0) {
    return;
  }

  const allPossible = findActiveMonsters(game).filter(a => {
    const nextToHero = standingNextToHero(game, a);

    return (a.moves > 0 && !nextToHero) ||
      (a.attacks > 0 && nextToHero);
  });

  allPossible.sort((a, b) => distanceToHero(game, a.dungeonId, a) - distanceToHero(game, b.dungeonId, b));
  if (allPossible.length > 0) {
    const monster = allPossible[0];
    calcMoves(game, monster);
    if (game.possibleMoves.length > 0) {
      const hero = getAdjacentHero(game, monster.dungeonId, monster);
      if (hero) {
        // close enough for attack
        const attackMove = game.possibleMoves.find(m => m.x === hero.x && m.y === hero.y);
        if (attackMove) {
          game.currentActivity = {
            dungeonId: monster.dungeonId,
            actorId: monster.id,
            tx: attackMove.x,
            ty: attackMove.y,
            startTime: Rune.gameTime()
          }
        }

        monster.attacks--;
      } else {
        const bestMove = game.possibleMoves.sort((a, b) => distanceToHero(game, monster.dungeonId, a) - distanceToHero(game, monster.dungeonId, b))[0];

        game.currentActivity = {
          dungeonId: monster.dungeonId,
          actorId: monster.id,
          tx: bestMove.x,
          ty: bestMove.y,
          startTime: Rune.gameTime()
        }
      }
    } else {
      // no moves possible, clear state
      monster.moves = 0;
      monster.attacks = 0;
    }
  } else {
    nextTurn(game);
  }
}

// This is the Rune boostrap - its how the server and the client are synchronized by running
// the same game simulation in all places.
Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 4,
  setup: (allPlayerIds): GameState => {
    // this is the initial game state. In our case we'll just generate a dungeon 
    // and move on
    const initialState: GameState = {
      nextId: 1,
      playerOrder: [],
      deadHeroes: [],
      whoseTurn: allPlayerIds[0],
      playerInfo: {},
      dungeons: [],
      possibleMoves: [],
      lastUpdate: 0,
      events: []
    }

    initialState.dungeons.push(generateDungeon(initialState));
    return initialState;
  },
  actions: {
    // The player has selected which class of player they want to play. We need
    // to create an actor in the world of the right type of them at one of the possible
    // start locations for the level. Now it might be better to place them near existing heroes
    // so they don't have to walk all the way to them?
    setPlayerType: ({ type }, context) => {
      // For some reason I'm getting this action multiple times when I'm not expecting it - possibly
      // because its fired off a Javascript event listener and someone is tapping twice quickly. This
      // guard prevents us adding people more than once
      if (context.game.playerOrder.includes(context.playerId)) {
        errorLog("Already in: " + context.playerId);
        return;
      }

      // find a start poisiton for our player based on the start rooms
      const dungeon = context.game.dungeons[context.game.dungeons.length - 1];
      const startRoom = dungeon.rooms.find(r => r.start);
      if (startRoom) {
        // consider all the spaces in the start room and if they are
        // free add them to a potential list of starts
        const possibleStarts: Point[] = [];
        for (let x = 1; x < startRoom.width - 1; x++) {
          for (let y = 1; y < startRoom.height - 1; y++) {
            if (x === startRoom.width - 2 && y === 1) {
              continue;
            }
            if (!getActorAt(dungeon, startRoom.x + x, startRoom.y + y)) {
              possibleStarts.push({ x: x + startRoom.x, y: y + startRoom.y });
            }
          }
        }

        // if we've found somewhere the player can start create their actor based on the
        // character class they chose and add it to the world. 
        if (possibleStarts.length > 0) {
          const start: Point = possibleStarts[Math.floor(Math.random() * possibleStarts.length)];
          const actor: Actor = createActor(context.game, PLAYER_CLASS_DEFS[type], dungeon.id, start.x, start.y);
          context.game.playerInfo[context.playerId] = {
            dungeonId: dungeon.id,
            type,
            actorId: actor.id
          };
          dungeon.actors.push(actor);
        } else {
          errorLog("No Start Positions!");
        }
      }
      // add the player to the player order so they can take a turn
      context.game.playerOrder.push(context.playerId);

      // evaluate whose turn it is, because when we add a new player
      // it might immediately be their turn or it might change
      // the moves available 
      const whoseMove = context.game.playerInfo[context.game.whoseTurn];
      if (whoseMove && whoseMove.actorId) {
        const actor = getActorById(context.game, dungeon.id, whoseMove.actorId);
        if (actor) {
          // calculate all the possible moves from this position
          calcMoves(context.game, actor);
        }
      }
    },
    // The player has selected a move to make from the calculated moves. Set up
    // the current activity to be played out for that move
    makeMove: ({ x, y }, context) => {
      if (context.game.whoseTurn === context.playerId) {
        const move = context.game.possibleMoves.find(m => m.x === x && m.y === y);
        const time = Rune.gameTime();
        if (move) {
          context.game.currentActivity = {
            dungeonId: context.game.playerInfo[context.playerId].dungeonId,
            actorId: context.game.playerInfo[context.playerId].actorId,
            tx: x,
            ty: y,
            startTime: time
          }
        }
      }
    },
    // Indication that a player would like to end their turn - just move to the next player
    // or the monsters
    endTurn: (params, context) => {
      nextTurn(context.game);
    },
    clearType: (params, context) => {
      context.game.playerOrder.splice(context.game.playerOrder.indexOf(context.playerId), 1);
      delete context.game.playerInfo[context.playerId];

    }
  },
  update: (context) => {
    // clear the events list for this frame. It'd be nice if there was a way to fire
    // events directly from Rune to the client but for now we'll just add events from this
    // frame to a list that the client will process since it's all guaranteed delivery of
    // state changes this will work
    context.game.events = [];

    // we're running the game at 15 FPS because we want the smooth gameTime() tick, however
    // the logic itself doesn't need to run that quickly (we're only taking a logic step)
    if (Rune.gameTime() - context.game.lastUpdate > STEP_TIME) {
      if (!applyCurrentActivity(context.game)) {
        if (context.game.whoseTurn === "evil") {
          // run evil game updates
          takeEvilTurn(context.game);
        } else {
          // no current activity to apply on a player turn, consider moving the turn
          // over automatically if no moves remaining - this is to stream line play
          if (context.game.possibleMoves.length === 0) {
            if (context.game.playerOrder.length > 0) {
              nextTurn(context.game);
            }
          }
        }
      }
    }
  },
  // the number of updates to run a second. I'd like to have this much lower but 
  // Rune.gameTime() runs in these intervals - so if you want to drive your movement
  // for instance from Rune.gameTime() to synchronize movements you need to have
  // this reasonable high to get a smooth tick.
  updatesPerSecond: 15,
  events: {
    // called when a new player joins the game - this is part of the Rune 
    // framework. Gotcha here - this isn't called for players that are part
    // of the game when it starts. Initial players are presented in the 
    // allPlayerIds list in setup()
    playerJoined: (playerId, context) => {
    },
    // called when a player leaves the game session - this is part of the
    // Rune framework
    playerLeft: (playerId, context) => {
      // when a player leaves we need to check if it was their turn. If it was
      // we need to move the turn on so we don't get stuck in a place where the game
      // can't progress.
      const playerInfo = context.game.playerInfo[playerId];
      if (playerInfo) {
        if (context.game.whoseTurn === playerId) {
          nextTurn(context.game);
        }
        const dungeon = getDungeonById(context.game, playerInfo.dungeonId);
        if (dungeon) {
          // also need to clear up their state and actor from the game 
          context.game.playerOrder.splice(context.game.playerOrder.indexOf(playerId), 1);
          dungeon.actors = dungeon.actors.filter(a => a.id !== playerInfo.actorId);
        }
        delete context.game.playerInfo[playerId];
      }
    },

  }
})
