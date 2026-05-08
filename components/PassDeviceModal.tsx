'use client';

interface Props {
  playerName: string;
  reason: string;
  onConfirm: () => void;
}

export default function PassDeviceModal({ playerName, reason, onConfirm }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-950 gap-8">
      <div className="text-center">
        <div className="text-5xl mb-6">📱</div>
        <p className="text-gray-400 text-sm mb-2">端末を渡してください</p>
        <h2 className="text-4xl font-bold text-white">{playerName}</h2>
        <p className="text-gray-300 mt-4 text-base max-w-xs mx-auto">{reason}</p>
      </div>

      <button
        onClick={onConfirm}
        className="w-full max-w-xs py-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-2xl font-bold text-white text-xl transition-colors"
      >
        受け取った ✓
      </button>

      <p className="text-gray-600 text-xs">他のプレイヤーは画面を見ないでください</p>
    </div>
  );
}
