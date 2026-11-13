import { AudioSettings, MusicMood, RegionId } from '../../types/game';

export interface MusicMoodInputs {
  isMenu: boolean;
  activeCombatEvents: number;
  atWarCount: number;
  militaryUnitCount: number;
  queuedRecruits: number;
  activeConstructionCount: number;
  lowFoodAlert: boolean;
  recentlyWon?: boolean;
  recentlyLost?: boolean;
}

/**
 * Pure state-to-music-mood resolver so soundtrack intensity adapts organically
 * to genuine settlement, diplomatic, and battlefield conditions.
 */
export function resolveAdaptiveMusicMood(inputs: MusicMoodInputs): MusicMood {
  if (inputs.recentlyWon) return 'victory';
  if (inputs.recentlyLost) return 'defeat';
  if (inputs.isMenu) return 'menu';
  if (inputs.activeCombatEvents > 0) return 'combat';
  if (inputs.atWarCount > 0 || inputs.queuedRecruits > 0 || inputs.militaryUnitCount >= 6) {
    return 'military_prep';
  }
  if (inputs.activeConstructionCount >= 2) return 'expansion';
  if (inputs.lowFoodAlert) return 'military_prep';
  return 'peaceful';
}

interface MoodScoreProfile {
  stepMs: number;
  scaleHz: number[];
  melodyPattern: number[];
  bassPattern: number[];
  drumAccentMask: number[];
  shakerDensity: number;
  padRootHz: number;
}

const MOOD_PROFILES: Record<MusicMood, MoodScoreProfile> = {
  menu: {
    stepMs: 560,
    // Warm D-minor pentatonic (D3, F3, G3, A3, C4, D4, F4, G4, A4)
    scaleHz: [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0],
    melodyPattern: [0, 3, 5, 4, 2, 5, 7, 5, 1, 3, 6, 4, 0, 2, 5, 3],
    bassPattern: [0, -1, 0, -1, 2, -1, 1, -1, 0, -1, 3, -1, 2, -1, 0, -1],
    drumAccentMask: [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0, 0],
    shakerDensity: 0.25,
    padRootHz: 73.42,
  },
  peaceful: {
    stepMs: 540,
    scaleHz: [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0],
    melodyPattern: [2, 4, 5, 7, 6, 4, 3, 5, 0, 2, 4, 5, 3, 2, 1, 0],
    bassPattern: [0, -1, -1, 2, 0, -1, -1, 1, 0, -1, -1, 3, 2, -1, 1, -1],
    drumAccentMask: [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 1, 0, 0],
    shakerDensity: 0.35,
    padRootHz: 73.42,
  },
  expansion: {
    stepMs: 440,
    // Brighter G-major pentatonic (G3, A3, B3, D4, E4, G4, A4, B4, D5)
    scaleHz: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33],
    melodyPattern: [0, 2, 4, 5, 7, 5, 4, 2, 1, 3, 4, 6, 5, 3, 2, 0],
    bassPattern: [0, -1, 3, -1, 0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 3, -1],
    drumAccentMask: [1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 2, 0, 1, 1, 2, 0],
    shakerDensity: 0.6,
    padRootHz: 98.0,
  },
  diplomacy: {
    stepMs: 500,
    scaleHz: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88],
    melodyPattern: [0, 3, 4, 6, 5, 4, 2, 3, 1, 4, 5, 7, 6, 4, 3, 2],
    bassPattern: [0, -1, -1, 2, 0, -1, 3, -1, 0, -1, -1, 2, 1, -1, 0, -1],
    drumAccentMask: [1, 0, 0, 2, 1, 0, 2, 0, 1, 0, 0, 2, 0, 2, 1, 0],
    shakerDensity: 0.45,
    padRootHz: 82.41,
  },
  military_prep: {
    stepMs: 390,
    // Tense D suspended / Dorian flavor
    scaleHz: [146.83, 164.81, 174.61, 220.0, 246.94, 293.66, 329.63, 349.23, 440.0],
    melodyPattern: [0, 0, 3, 5, 3, 2, 0, 3, 0, 2, 4, 6, 5, 3, 2, 1],
    bassPattern: [0, -1, 0, 3, 0, -1, 0, 2, 0, -1, 0, 3, 2, -1, 1, -1],
    drumAccentMask: [1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 1, 2, 2],
    shakerDensity: 0.72,
    padRootHz: 73.42,
  },
  combat: {
    stepMs: 280,
    // Urgent percussive battle ostinato
    scaleHz: [146.83, 174.61, 196.0, 207.65, 220.0, 261.63, 293.66, 349.23, 440.0],
    melodyPattern: [0, 4, 3, 6, 4, 7, 6, 4, 0, 3, 4, 5, 3, 2, 4, 1],
    bassPattern: [0, 0, 3, 0, 0, 2, 4, 0, 0, 0, 3, 0, 2, 0, 1, 0],
    drumAccentMask: [1, 2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 2, 2],
    shakerDensity: 0.92,
    padRootHz: 73.42,
  },
  victory: {
    stepMs: 420,
    scaleHz: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33],
    melodyPattern: [0, 3, 5, 7, 8, 7, 5, 3, 4, 5, 7, 8, 7, 5, 4, 5],
    bassPattern: [0, -1, 3, -1, 5, -1, 3, -1, 0, -1, 3, -1, 5, -1, 0, -1],
    drumAccentMask: [1, 0, 2, 1, 1, 0, 2, 2, 1, 0, 2, 1, 1, 2, 1, 2],
    shakerDensity: 0.7,
    padRootHz: 98.0,
  },
  defeat: {
    stepMs: 680,
    scaleHz: [130.81, 155.56, 174.61, 196.0, 233.08, 261.63, 311.13, 349.23, 392.0],
    melodyPattern: [5, 3, 2, 0, 3, 2, 1, 0, 4, 2, 1, 0, 2, 1, 0, 0],
    bassPattern: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1],
    drumAccentMask: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    shakerDensity: 0.1,
    padRootHz: 65.41,
  },
};

/**
 * Zero-dependency Web Audio API adaptive African-inspired score,
 * biome ambient soundscape, and procedural gameplay SFX synthesizer.
 */
export class AkanuSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private ambienceGainNode: GainNode | null = null;

  private settings: AudioSettings = {
    masterVolume: 0.75,
    musicVolume: 0.55,
    ambienceVolume: 0.65,
    sfxVolume: 0.8,
    muted: false,
  };

  private mood: MusicMood = 'menu';
  private biome: RegionId = 'golden_savannah';
  private musicTimer: number | null = null;
  private currentTimerIntervalMs = 560;
  private noteStep = 0;

  // Cooldown timestamps (ms) so overlapping actions stay warm and clean
  private lastWorkSfxMs = 0;
  private lastCombatSfxMs = 0;
  private lastAlertSfxMs = 0;

  public updateSettings(next: AudioSettings): void {
    this.settings = {
      ...next,
      ambienceVolume: next.ambienceVolume ?? this.settings.ambienceVolume ?? 0.65,
    };
    this.syncMixerGains();

    if (this.settings.muted && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    } else if (!this.settings.muted && this.ctx && this.musicTimer === null) {
      this.startAdaptiveMusicLoop();
    }
  }

  public setMusicMood(mood: MusicMood, biome?: RegionId): void {
    const moodChanged = this.mood !== mood;
    const biomeChanged = biome !== undefined && this.biome !== biome;
    this.mood = mood;
    if (biome !== undefined) {
      this.biome = biome;
    }

    if (biomeChanged) {
      this.tuneBiomeAmbienceFilter();
    }

    if (moodChanged && this.musicTimer !== null && !this.settings.muted) {
      const targetMs = MOOD_PROFILES[mood].stepMs;
      if (Math.abs(targetMs - this.currentTimerIntervalMs) > 25) {
        window.clearInterval(this.musicTimer);
        this.musicTimer = null;
        this.startAdaptiveMusicLoop();
      }
    }
  }

  public unlockAndStartMusic(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.connect(this.ctx.destination);
      this.noiseBuffer = this.buildPinkNoiseBuffer(this.ctx);
      this.initBiomeAmbienceNodes();
      this.syncMixerGains();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.settings.muted && this.musicTimer === null) {
      this.startAdaptiveMusicLoop();
    }
  }

  private buildPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-0.9, Math.min(0.9, (b0 + b1 + b2 + white * 0.015) * 1.4));
    }
    return buffer;
  }

  private initBiomeAmbienceNodes(): void {
    if (!this.ctx || !this.masterGainNode || !this.noiseBuffer || this.ambienceSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGainNode);
    src.start();

    this.ambienceSource = src;
    this.ambienceFilter = filter;
    this.ambienceGainNode = gain;
    this.tuneBiomeAmbienceFilter();
  }

  private tuneBiomeAmbienceFilter(): void {
    if (!this.ctx || !this.ambienceFilter) return;
    const now = this.ctx.currentTime;
    switch (this.biome) {
      case 'great_forests':
        this.ambienceFilter.type = 'bandpass';
        this.ambienceFilter.frequency.setTargetAtTime(620, now, 0.4);
        this.ambienceFilter.Q.setTargetAtTime(0.85, now, 0.4);
        break;
      case 'northern_highlands':
        this.ambienceFilter.type = 'bandpass';
        this.ambienceFilter.frequency.setTargetAtTime(840, now, 0.4);
        this.ambienceFilter.Q.setTargetAtTime(1.15, now, 0.4);
        break;
      case 'riverlands':
      case 'coastal_territories':
        this.ambienceFilter.type = 'lowpass';
        this.ambienceFilter.frequency.setTargetAtTime(520, now, 0.4);
        this.ambienceFilter.Q.setTargetAtTime(0.65, now, 0.4);
        break;
      default:
        // Golden Savannah warm breeze
        this.ambienceFilter.type = 'lowpass';
        this.ambienceFilter.frequency.setTargetAtTime(410, now, 0.4);
        this.ambienceFilter.Q.setTargetAtTime(0.55, now, 0.4);
        break;
    }
  }

  private syncMixerGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGainNode) {
      const m = this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.masterVolume));
      this.masterGainNode.gain.setTargetAtTime(m, now, 0.04);
    }
    if (this.ambienceGainNode) {
      const amb = this.settings.muted
        ? 0
        : Math.max(0, Math.min(1, (this.settings.ambienceVolume ?? 0.65) * 0.065));
      this.ambienceGainNode.gain.setTargetAtTime(amb, now, 0.15);
    }
  }

  private getEffectiveSfxGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.sfxVolume));
  }

  private getEffectiveMusicGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.musicVolume));
  }

  private getEffectiveAmbienceGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.ambienceVolume ?? 0.65));
  }

  private startAdaptiveMusicLoop(): void {
    if (this.musicTimer !== null) return;
    const profile = MOOD_PROFILES[this.mood];
    this.currentTimerIntervalMs = profile.stepMs;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGainNode || this.ctx.state !== 'running') return;

      const curProfile = MOOD_PROFILES[this.mood];
      const musicVol = this.getEffectiveMusicGain();
      const ambVol = this.getEffectiveAmbienceGain();
      const now = this.ctx.currentTime;
      const step = this.noteStep % 16;

      // Occasional subtle forest birdsong / coastal wave swell on ambience channel
      if (ambVol > 0.05 && this.biome === 'great_forests' && step === 6 && Math.random() < 0.45) {
        this.playForestBirdChirp(now, ambVol * 0.035);
      }

      if (musicVol > 0.01) {
        // 1. Kora / Kalimba Plucked Pentatonic Melody
        const melIdx = curProfile.melodyPattern[step];
        if (melIdx >= 0) {
          const freq = curProfile.scaleHz[melIdx % curProfile.scaleHz.length];
          this.playKoraNote(freq, now, musicVol * (this.mood === 'combat' ? 0.085 : 0.075));
        }

        // 2. Warm Wooden Balafon / Gourd Bass Harmony
        const bassIdx = curProfile.bassPattern[step];
        if (bassIdx >= 0) {
          const bassFreq = curProfile.scaleHz[bassIdx % curProfile.scaleHz.length] * 0.5;
          this.playBalafonBass(bassFreq, now, musicVol * 0.08);
        }

        // 3. Talking Drum & Djembe Percussion (1 = low open bass, 2 = muted mid-slap)
        const drumHit = curProfile.drumAccentMask[step];
        if (drumHit === 1) {
          this.playDjembeHit(now, musicVol * (this.mood === 'combat' ? 0.14 : 0.1), true);
        } else if (drumHit === 2) {
          this.playDjembeHit(now, musicVol * (this.mood === 'combat' ? 0.095 : 0.065), false);
        }

        // 4. Shekere Gourd Shaker Rhythm
        if (Math.random() < curProfile.shakerDensity) {
          this.playShekereTap(now, musicVol * 0.032);
        }

        // 5. Warm Resonant Horn / Pad Drone on Bar Downbeat
        if (step === 0) {
          this.playWarmPad(curProfile.padRootHz, now, musicVol * 0.042, curProfile.stepMs * 0.008);
        }
      }

      this.noteStep++;
    }, this.currentTimerIntervalMs);
  }

  private playKoraNote(freq: number, startTime: number, amp: number): void {
    if (!this.ctx || !this.masterGainNode) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const overtoneGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, startTime);
    overtoneGain.gain.setValueAtTime(0.22, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0006, startTime + 1.15);

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(this.masterGainNode);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + 1.2);
    overtone.stop(startTime + 0.28);
  }

  private playBalafonBass(freq: number, startTime: number, amp: number): void {
    if (!this.ctx || !this.masterGainNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0006, startTime + 0.85);
    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(startTime);
    osc.stop(startTime + 0.9);
  }

  private playDjembeHit(startTime: number, amp: number, isBass: boolean): void {
    if (!this.ctx || !this.masterGainNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    if (isBass) {
      osc.frequency.setValueAtTime(112, startTime);
      osc.frequency.exponentialRampToValueAtTime(52, startTime + 0.22);
    } else {
      osc.frequency.setValueAtTime(215, startTime);
      osc.frequency.exponentialRampToValueAtTime(128, startTime + 0.11);
    }
    env.gain.setValueAtTime(amp, startTime);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + (isBass ? 0.3 : 0.14));
    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(startTime);
    osc.stop(startTime + (isBass ? 0.32 : 0.16));
  }

  private playShekereTap(startTime: number, amp: number): void {
    if (!this.ctx || !this.masterGainNode || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3400, startTime);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(amp, startTime);
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + 0.055);
    src.connect(hp);
    hp.connect(env);
    env.connect(this.masterGainNode);
    src.start(startTime, Math.random() * 1.5, 0.06);
  }

  private playWarmPad(freq: number, startTime: number, amp: number, dur: number): void {
    if (!this.ctx || !this.masterGainNode) return;
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, startTime);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.45);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + Math.max(1.8, dur));
    osc.connect(lp);
    lp.connect(env);
    env.connect(this.masterGainNode);
    osc.start(startTime);
    osc.stop(startTime + Math.max(1.9, dur + 0.1));
  }

  private playForestBirdChirp(startTime: number, amp: number): void {
    if (!this.ctx || !this.masterGainNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1650 + Math.random() * 400, startTime);
    osc.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 450, startTime + 0.07);
    osc.frequency.exponentialRampToValueAtTime(1800, startTime + 0.14);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0003, startTime + 0.16);
    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(startTime);
    osc.stop(startTime + 0.18);
  }

  public playUiClick(pitchMultiplier = 1.0): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.masterGainNode) return;
    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(190 * pitchMultiplier, now + 0.065);

    env.gain.setValueAtTime(vol * 0.14, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playSelectEntity(category: 'character' | 'building' | 'resource_node'): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.masterGainNode) return;
    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const baseFreq = category === 'character' ? 392 : category === 'building' ? 261.63 : 329.63;

    [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
      if (!this.ctx || !this.masterGainNode) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(vol * 0.12, start);
      env.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);
      osc.connect(env);
      env.connect(this.masterGainNode);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playKingdomFounded(): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.masterGainNode) return;
    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const chord = [146.83, 220.0, 293.66, 440.0];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGainNode) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      const t0 = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t0);
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(vol * (idx === 0 ? 0.08 : 0.12), t0 + 0.08);
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.35);
      osc.connect(env);
      env.connect(this.masterGainNode);
      osc.start(t0);
      osc.stop(t0 + 1.4);
    });
  }

  public playWorkAction(kind: 'chop' | 'mine' | 'build'): void {
    if (!this.ctx || !this.masterGainNode || this.ctx.state !== 'running') return;
    const nowMs = performance.now();
    if (nowMs - this.lastWorkSfxMs < 550) return;
    this.lastWorkSfxMs = nowMs;

    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    if (kind === 'mine') {
      // Metallic pick clink
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1280, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.09);
      env.gain.setValueAtTime(vol * 0.075, now);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.11);
    } else if (kind === 'chop') {
      // Hollow timber axe thud
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.1);
      env.gain.setValueAtTime(vol * 0.095, now);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.12);
    } else {
      // Timber mallet strike
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.085);
      env.gain.setValueAtTime(vol * 0.08, now);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.1);
    }

    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playCombatHit(kind: 'sword' | 'bow' | 'siege'): void {
    if (!this.ctx || !this.masterGainNode || this.ctx.state !== 'running') return;
    const nowMs = performance.now();
    if (nowMs - this.lastCombatSfxMs < 240) return;
    this.lastCombatSfxMs = nowMs;

    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    if (kind === 'bow') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);
      env.gain.setValueAtTime(vol * 0.09, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
    } else if (kind === 'siege') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(44, now + 0.28);
      env.gain.setValueAtTime(vol * 0.16, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.32);
    } else {
      // Bronze blade / shield clash
      osc.type = 'square';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(310, now + 0.08);
      env.gain.setValueAtTime(vol * 0.065, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);
    }

    osc.connect(env);
    env.connect(this.masterGainNode);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playAlert(kind: 'war' | 'peace' | 'complete' | 'warning'): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.masterGainNode) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAlertSfxMs < 900) return;
    this.lastAlertSfxMs = nowMs;

    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const notes =
      kind === 'war'
        ? [196.0, 146.83]
        : kind === 'peace'
          ? [293.66, 392.0, 440.0]
          : kind === 'complete'
            ? [293.66, 440.0]
            : [220.0, 207.65];

    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGainNode) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = kind === 'war' ? 'sawtooth' : 'triangle';
      const t0 = now + idx * 0.11;
      osc.frequency.setValueAtTime(f, t0);
      env.gain.setValueAtTime(vol * 0.1, t0);
      env.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.45);
      osc.connect(env);
      env.connect(this.masterGainNode);
      osc.start(t0);
      osc.stop(t0 + 0.48);
    });
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
      } catch {
        // already stopped
      }
      this.ambienceSource.disconnect();
      this.ambienceSource = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new AkanuSoundEngine();
