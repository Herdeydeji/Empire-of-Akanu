import React from 'react';
import { GameSettings, GraphicsQuality } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  isSoftwareGl?: boolean;
  onChangeSettings: (next: GameSettings) => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string; detail: string }[] = [
  {
    id: 'low',
    label: 'Low',
    detail: 'Optimised for mobile devices · Flora simplified & shadows off',
  },
  {
    id: 'medium',
    label: 'Medium',
    detail: 'Balanced terrain resolution, instanced vegetation & soft shadows',
  },
  {
    id: 'high',
    label: 'High',
    detail: 'High vegetation density, crisp 1536x1536 shadows & full PBR materials',
  },
  {
    id: 'ultra',
    label: 'Ultra',
    detail: 'Cinematic 2048x2048 PCF soft shadows, maximum vegetation LOD & detail',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChangeSettings,
  onClose,
}) => {
  const setQuality = (q: GraphicsQuality) => {
    onChangeSettings({ ...settings, graphicsQuality: q });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-[#090705]/82 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-[#18120c] border border-[#c98f32]/45 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#8f6c38]/30">
          <div>
            <p className="text-xs text-[#d6a34b]">System Configuration</p>
            <h2 id="settings-modal-title" className="font-display text-xl font-bold text-[#fbf3e4]">
              Game Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#281e14] hover:bg-[#36281b] border border-[#8f6c38]/35 text-xs font-medium text-[#e5d8c0] cursor-pointer whitespace-nowrap"
          >
            Done
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto akanu-scroll">
          {/* Adaptive Graphics Quality */}
          <div>
            <div className="text-xs font-semibold text-[#e2b55f] mb-2">
              3D Graphics Scalability
            </div>
            <div className="grid grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = settings.graphicsQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setQuality(opt.id)}
                    className={`px-3 py-2.5 rounded border text-center text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#c98f32] border-[#e8bc66] text-[#171008]'
                        : 'bg-[#120d09] hover:bg-[#221912] border-[#6e5332]/40 text-[#dfd1b8]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#b5a385] mt-2">
              {QUALITY_OPTIONS.find((q) => q.id === settings.graphicsQuality)?.detail}
            </p>
          </div>

          {/* Camera Movement Speed */}
          <div className="pt-3 border-t border-[#8f6c38]/20">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="camera-speed-range" className="text-xs font-semibold text-[#e2b55f]">
                RTS Camera Pan Speed
              </label>
              <span className="text-xs font-mono-num text-[#dfd1b8]">
                {Math.round(settings.cameraPanSpeed * 100)}%
              </span>
            </div>
            <input
              id="camera-speed-range"
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.cameraPanSpeed}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  cameraPanSpeed: parseFloat(e.target.value),
                })
              }
              className="w-full accent-[#c98f32]"
            />
          </div>

          {/* Audio Controls */}
          <div className="pt-3 border-t border-[#8f6c38]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#e2b55f]">Audio & Soundtrack</span>
              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    audio: { ...settings.audio, muted: !settings.audio.muted },
                  })
                }
                className={`px-3 py-1 rounded border text-xs font-medium cursor-pointer whitespace-nowrap ${
                  settings.audio.muted
                    ? 'bg-[#4a221c] border-[#c45a47] text-[#ffd4cc]'
                    : 'bg-[#231a12] border-[#8f6c38]/40 text-[#e5d8c0]'
                }`}
              >
                {settings.audio.muted ? 'Audio Muted' : 'Mute Audio'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#cbb99c] mb-1">
                <label htmlFor="master-vol-range">Master Volume</label>
                <span className="font-mono-num">{Math.round(settings.audio.masterVolume * 100)}%</span>
              </div>
              <input
                id="master-vol-range"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.masterVolume}
                onChange={(e) =>
                  onChangeSettings({
                    ...settings,
                    audio: { ...settings.audio, masterVolume: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-[#c98f32]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-[#cbb99c] mb-1">
                  <label htmlFor="music-vol-range">Music Volume</label>
                  <span className="font-mono-num">{Math.round(settings.audio.musicVolume * 100)}%</span>
                </div>
                <input
                  id="music-vol-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.audio.musicVolume}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      audio: { ...settings.audio, musicVolume: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full accent-[#c98f32]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#cbb99c] mb-1">
                  <label htmlFor="sfx-vol-range">Sound Effects</label>
                  <span className="font-mono-num">{Math.round(settings.audio.sfxVolume * 100)}%</span>
                </div>
                <input
                  id="sfx-vol-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.audio.sfxVolume}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      audio: { ...settings.audio, sfxVolume: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full accent-[#c98f32]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-3.5 bg-[#130e0a] border-t border-[#8f6c38]/25">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-[#c98f32] hover:bg-[#dba03f] text-sm font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
