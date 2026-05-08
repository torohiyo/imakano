'use client';

interface Props {
  playerName: string;
  imakanoId?: string;
  reason: string;
  onConfirm: () => void;
}

export default function PassDeviceModal({ playerName, imakanoId, reason, onConfirm }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 bg-gray-950/95 backdrop-blur-md">
      {/* Imakano portrait */}
      {imakanoId && (
        <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-cyan-500 glow-cyan-strong">
          <img
            src={`/imakano/${imakanoId}.png`}
            alt=""
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      <div className="text-center">
        <p className="text-cyan-400 text-sm mb-1 tracking-widest uppercase">Pass Device</p>
        <h2 className="text-4xl font-bold text-white">{playerName}</h2>
        <p className="text-gray-400 mt-3 text-sm max-w-xs mx-auto leading-relaxed">{reason}</p>
      </div>

      <button
        onClick={onConfirm}
        className="w-full max-w-xs py-5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 rounded-2xl font-bold text-white text-xl transition-all glow-cyan"
      >
        受け取った ✓
      </button>

      <p className="text-gray-700 text-xs">他のプレイヤーは画面を見ないでください</p>
    </div>
  );
}
