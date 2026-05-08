import type * as Party from "partykit/server";
import { GameState, CardInstance } from "../lib/types";
import { gameReducer, startGame } from "../lib/gameEngine";
import type { GameAction } from "../lib/gameEngine";

// ── Types ──

type LobbyPlayer = { playerId: string; name: string; connectionId: string };

type RoomState =
  | { phase: "lobby"; players: LobbyPlayer[]; hostPlayerId: string }
  | { phase: "playing"; game: GameState; players: LobbyPlayer[] };

// ── State filtering ──

function hiddenCard(instanceId: string): CardInstance {
  return {
    instanceId,
    def: { id: "hidden", name: "?", type: "special", effectText: "", effectKey: "hidden", count: 0 },
  };
}

function filterGameForPlayer(game: GameState, playerIdx: number): GameState {
  const cur = game.currentPlayerIndex;
  const pending = game.pending;

  const filteredPlayers = game.players.map((p, i) => {
    if (i === playerIdx) return p;
    return { ...p, hand: p.hand.map(c => hiddenCard(c.instanceId)) };
  });

  let filteredPending = pending;
  if (pending) {
    switch (pending.type) {
      case "VIEW_SELECT":
      case "VIEW_SELECT_SPECIALS":
      case "UTSU_NOVEL_CHOICE":
      case "SELECT_TARGET":
      case "PEEK_STEAL":
      case "PEEK_TRASH":
        if (playerIdx !== cur) filteredPending = null;
        break;
      case "DISCARD": {
        const target = game.pendingTargetIdx ?? cur;
        if (playerIdx !== target) filteredPending = null;
        break;
      }
      case "DEFENSE_REACTION":
        if (playerIdx !== pending.targetIdx) filteredPending = null;
        break;
      case "PASS_DEVICE":
        filteredPending = null;
        break;
    }
  }

  return { ...game, players: filteredPlayers, pending: filteredPending };
}

// ── Action validation ──

function isActionAllowed(game: GameState, action: GameAction, playerIdx: number): boolean {
  if (playerIdx < 0) return false;
  const cur = game.currentPlayerIndex;

  switch (action.type) {
    case "SKIP_PLAY":
    case "PLAY_CARD":
    case "SKIP_SKILL":
    case "USE_SKILL":
    case "SELECT_TARGET":
    case "RESOLVE_VIEW_SELECT":
    case "RESOLVE_VIEW_SELECT_SPECIALS":
    case "RESOLVE_PEEK_STEAL":
    case "RESOLVE_PEEK_TRASH":
    case "RESOLVE_UTSU_NOVEL":
      return playerIdx === cur;
    case "DEFEND":
    case "SKIP_DEFENSE":
      return game.phase === "defense" &&
        game.pending?.type === "DEFENSE_REACTION" &&
        playerIdx === game.pending.targetIdx;
    case "RESOLVE_DISCARD":
      return playerIdx === (game.pendingTargetIdx ?? cur);
    default:
      return false;
  }
}

// ── Server ──

export default class GameRoom implements Party.Server {
  private roomState: RoomState | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "CONNECTED" }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as
      | { type: "JOIN"; playerId: string; name: string }
      | { type: "START_GAME"; playerId: string }
      | { type: "ACTION"; playerId: string; action: GameAction };

    switch (msg.type) {
      case "JOIN": {
        const { playerId, name } = msg;
        if (!this.roomState) {
          this.roomState = { phase: "lobby", players: [{ playerId, name, connectionId: sender.id }], hostPlayerId: playerId };
        } else if (this.roomState.phase === "lobby") {
          const idx = this.roomState.players.findIndex(p => p.playerId === playerId);
          const updated = idx >= 0
            ? this.roomState.players.map((p, i) => i === idx ? { ...p, connectionId: sender.id } : p)
            : [...this.roomState.players, { playerId, name, connectionId: sender.id }];
          this.roomState = { ...this.roomState, players: updated };
        } else {
          // Reconnect to in-progress game
          const updated = this.roomState.players.map(p => p.playerId === playerId ? { ...p, connectionId: sender.id } : p);
          this.roomState = { ...this.roomState, players: updated };
        }
        this.broadcastState();
        break;
      }

      case "START_GAME": {
        if (!this.roomState || this.roomState.phase !== "lobby") break;
        if (msg.playerId !== this.roomState.hostPlayerId) break;
        if (this.roomState.players.length < 2) break;
        const game = startGame(this.roomState.players.map(p => p.name));
        this.roomState = { phase: "playing", game, players: this.roomState.players };
        this.broadcastState();
        this.scheduleAutoPhase();
        break;
      }

      case "ACTION": {
        if (!this.roomState || this.roomState.phase !== "playing") break;
        const playerIdx = this.roomState.players.findIndex(p => p.playerId === msg.playerId);
        if (!isActionAllowed(this.roomState.game, msg.action, playerIdx)) break;
        const newGame = gameReducer(this.roomState.game, msg.action);
        this.roomState = { ...this.roomState, game: newGame };
        this.broadcastState();
        this.scheduleAutoPhase();
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    if (!this.roomState) return;
    const updated = this.roomState.players.map(p => p.connectionId === conn.id ? { ...p, connectionId: "" } : p);
    this.roomState = { ...this.roomState, players: updated };
    this.broadcastState();
  }

  private scheduleAutoPhase() {
    if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = null; }
    if (!this.roomState || this.roomState.phase !== "playing") return;

    // Skip pass_device immediately (loop in case of chain)
    let game = this.roomState.game;
    let i = 0;
    while (game.phase === "pass_device" && i++ < 10) {
      game = gameReducer(game, { type: "CONFIRM_DEVICE_PASSED" });
    }
    if (game !== this.roomState.game) {
      this.roomState = { ...this.roomState, game };
      this.broadcastState();
    }

    if (game.phase === "draw") {
      this.autoTimer = setTimeout(() => {
        if (this.roomState?.phase === "playing" && this.roomState.game.phase === "draw") {
          const next = gameReducer(this.roomState.game, { type: "DRAW_PHASE_DONE" });
          this.roomState = { ...this.roomState, game: next };
          this.broadcastState();
          this.scheduleAutoPhase();
        }
      }, 600);
    } else if (game.phase === "end_turn") {
      this.autoTimer = setTimeout(() => {
        if (this.roomState?.phase === "playing" && this.roomState.game.phase === "end_turn") {
          const next = gameReducer(this.roomState.game, { type: "END_TURN" });
          this.roomState = { ...this.roomState, game: next };
          this.broadcastState();
          this.scheduleAutoPhase();
        }
      }, 700);
    }
  }

  private broadcastState() {
    if (!this.roomState) return;
    for (const conn of this.room.getConnections()) {
      const player = this.roomState.players.find(p => p.connectionId === conn.id);
      if (!player) continue;

      if (this.roomState.phase === "lobby") {
        const rs = this.roomState;
        conn.send(JSON.stringify({
          type: "SYNC",
          phase: "lobby",
          players: rs.players.map(p => ({ name: p.name, isHost: p.playerId === rs.hostPlayerId, online: p.connectionId !== "" })),
          isHost: player.playerId === rs.hostPlayerId,
        }));
      } else {
        const rs = this.roomState;
        const playerIdx = rs.players.findIndex(p => p.playerId === player.playerId);
        conn.send(JSON.stringify({
          type: "SYNC",
          phase: "playing",
          game: filterGameForPlayer(rs.game, playerIdx),
          yourPlayerIdx: playerIdx,
        }));
      }
    }
  }
}
