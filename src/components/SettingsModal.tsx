import React from 'react';
import {
  Camera,
  Check,
  Monitor,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
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
    detail: 'Mobile & battery profile · Simplified flora, shadows disabled',
  },
  {
    id: 'medium',
    label: 'Medium',
    detail: 'Balanced terrain resolution, instanced vegetation & soft shadows',
  },
  {
    id: 'high',
    label: 'High',
    detail: 'Dense savannah & highland flora, 1536px shadows & full PBR',
  },
  {
    id: 'ultra',
    label: 'Ultra',
    detail: '2048px PCF soft shadows, sky clouds, wildlife & maximum detail',
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

  const ambienceVol = settings.audio.ambienceVolume ?? 0.65;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-[#0d0b09]/85 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-[#171512] border border-[#A77A32]/60 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#292017] border-b border-[#76513A]/60">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-[#D4A64A] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-[#B8AA96]">System Configuration</p>
              <h2 id="settings-modal-title" className="font-display text-xl font-bold text-[#F2E8D5]">
                Game Settings
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#171512] hover:bg-[#362a1e] border border-[#76513A] text-xs font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Done</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto akanu-scroll">
          {/* Adaptive Graphics Quality */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D4A64A] mb-2.5">
              <Monitor className="w-4 h-4" aria-hidden="true" />
              <span>3D Graphics Scalability</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = settings.graphicsQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setQuality(opt.id)}
                    className={`px-3 py-2.5 rounded border text-center text-sm font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0 ${
                      active
                        ? 'bg-[#D4A64A] border-[#F2E8D5]/60 text-[#171512]'
                        : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A]/70 text-[#F2E8D5]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#B8AA96] mt-2 leading-relaxed">
              {QUALITY_OPTIONS.find((q) => q.id === settings.graphicsQuality)?.detail}
            </p>
          </div>

          {/* Camera Movement Speed */}
          <div className="pt-4 border-t border-[#76513A]/45">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="camera-speed-range"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4A64A]"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>RTS Camera Pan Speed</span>
              </label>
              <span className="text-xs font-mono-num text-[#F2E8D5]">
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
              className="w-full accent-[#D4A64A] cursor-pointer"
            />
          </div>

          {/* Audio Controls (4 Sliders: Master, Music, Ambience, SFX) */}
          <div className="pt-4 border-t border-[#76513A]/45 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4A64A]">
                {settings.audio.muted ? (
                  <VolumeX className="w-4 h-4 text-[#f87171]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Audio, Soundtrack & Biome Ambience</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    audio: { ...settings.audio, muted: !settings.audio.muted },
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  settings.audio.muted
                    ? 'bg-[#3d1c18] border-[#c45a47] text-[#ffd4cc]'
                    : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A] text-[#F2E8D5]'
                }`}
              >
                {settings.audio.muted ? (
                  <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{settings.audio.muted ? 'Audio Muted' : 'Mute All'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-[#B8AA96] mb-1">
                  <label htmlFor="master-vol-range">Master Volume</label>
                  <span className="font-mono-num text-[#F2E8D5]">
                    {Math.round(settings.audio.masterVolume * 100)}%
                  </span>
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
                  className="w-full accent-[#D4A64A] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#B8AA96] mb-1">
                  <label htmlFor="music-vol-range">Music Volume</label>
                  <span className="font-mono-num text-[#F2E8D5]">
                    {Math.round(settings.audio.musicVolume * 100)}%
                  </span>
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
                  className="w-full accent-[#D4A64A] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#B8AA96] mb-1">
                  <label htmlFor="ambience-vol-range">Ambience Volume</label>
                  <span className="font-mono-num text-[#F2E8D5]">
                    {Math.round(ambienceVol * 100)}%
                  </span>
                </div>
                <input
                  id="ambience-vol-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambienceVol}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      audio: { ...settings.audio, ambienceVolume: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full accent-[#D4A64A] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#B8AA96] mb-1">
                  <label htmlFor="sfx-vol-range">Sound Effects</label>
                  <span className="font-mono-num text-[#F2E8D5]">
                    {Math.round(settings.audio.sfxVolume * 100)}%
                  </span>
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
                  className="w-full accent-[#D4A64A] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-3.5 bg-[#292017] border-t border-[#76513A]/60">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-[#D4A64A] hover:bg-[#e0b55c] text-sm font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
