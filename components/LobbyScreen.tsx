'use client';

interface LobbyPlayer {
  name: string;
  isHost: boolean;
  online: boolean;
}

interface Props {
  roomCode: string;
  players: LobbyPlayer[];
  isHost: boolean;
  onStart: () => void;
}

export default function LobbyScreen({ roomCode, players, isHost, onStart }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <p className="text-gray-500 text-xs tracking-widest mb-2 uppercase">Room Code</p>
        <h2 className="text-6xl font-bold text-cyan-400 tracking-[0.3em] glow-cyan">{roomCode}</h2>
        <p className="text-gray-500 text-sm mt-3">このコードを友達に送ってください</p>
      </div>

      <div className="w-full max-w-sm bg-gray-900/60 border border-gray-700/60 rounded-2xl p-4">
        <p className="text-gray-600 text-xs mb-3">参加中 {players.length}/4</p>
        <div className="flex flex-col gap-2">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 rounded-xl">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.online ? 'bg-green-400' : 'bg-gray-600'}`} />
              <p className="text-white text-sm font-medium flex-1">{p.name}</p>
              {p.isHost && <span className="text-yellow-400 text-[10px] font-bold tracking-wider">HOST</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-gray-800 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-gray-800 flex-shrink-0" />
              <p className="text-gray-700 text-sm">待機中...</p>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={onStart}
            disabled={players.length < 2}
            className="w-full py-4 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg glow-cyan transition-all"
          >
            {players.length < 2 ? 'あと1人以上待っています...' : `${players.length}人でゲーム開始`}
          </button>
          <p className="text-gray-700 text-xs text-center">2〜4人で開始できます</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-400 animate-pulse">ホストがゲームを開始するまでお待ちください...</p>
        </div>
      )}
    </div>
  );
}
