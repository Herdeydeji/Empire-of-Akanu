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

export interface SpatialListenerPose {
  targetX: number;
  targetZ: number;
  yaw: number;
  distance: number;
}

export interface AmbienceTelemetry {
  windIntensity: number; // 0..1
  riverProximity: number; // 0..1
  riverPan: number; // -1..1
  villageBustle: number; // 0..1
  elevationRatio?: number; // 0..1
}

export type FootstepSurface = 'grass' | 'soil' | 'wet_bank';
export type VillagerVoiceKind = 'chatter' | 'greeting' | 'work_call' | 'command';
export type WorkFoleyKind = 'chop' | 'mine' | 'build' | 'harvest' | 'craft' | 'trade';
export type HydroFoleyKind = 'draw_water' | 'pour_water';
export type LivestockSpeciesKind = 'cattle' | 'goat' | 'chicken';
export type AlertToneKind = 'war' | 'peace' | 'complete' | 'warning' | 'research' | 'recruit';

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
  flutePattern: number[];
  bassPattern: number[];
  drumAccentMask: number[];
  talkingDrumMask: number[];
  shakerDensity: number;
  padRootHz: number;
  padFifthHz: number;
}

const MOOD_PROFILES: Record<MusicMood, MoodScoreProfile> = {
  menu: {
    stepMs: 550,
    // Warm D-minor pentatonic (D3, F3, G3, A3, C4, D4, F4, G4, A4)
    scaleHz: [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0],
    melodyPattern: [0, 3, 5, 4, 2, 5, 7, 5, 1, 3, 6, 4, 0, 2, 5, 3],
    flutePattern: [5, -1, -1, -1, 7, -1, 6, -1, 5, -1, -1, -1, 4, -1, 3, -1],
    bassPattern: [0, -1, 0, -1, 2, -1, 1, -1, 0, -1, 3, -1, 2, -1, 0, -1],
    drumAccentMask: [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0, 0],
    talkingDrumMask: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
    shakerDensity: 0.25,
    padRootHz: 73.42,
    padFifthHz: 110.0,
  },
  peaceful: {
    stepMs: 530,
    scaleHz: [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0],
    melodyPattern: [2, 4, 5, 7, 6, 4, 3, 5, 0, 2, 4, 5, 3, 2, 1, 0],
    flutePattern: [-1, 5, -1, -1, 7, 8, -1, -1, -1, 6, -1, 5, -1, 3, -1, -1],
    bassPattern: [0, -1, -1, 2, 0, -1, -1, 1, 0, -1, -1, 3, 2, -1, 1, -1],
    drumAccentMask: [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 1, 0, 0],
    talkingDrumMask: [0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0],
    shakerDensity: 0.36,
    padRootHz: 73.42,
    padFifthHz: 110.0,
  },
  expansion: {
    stepMs: 435,
    // Uplifting G-major pentatonic (G3, A3, B3, D4, E4, G4, A4, B4, D5)
    scaleHz: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33],
    melodyPattern: [0, 2, 4, 5, 7, 5, 4, 2, 1, 3, 4, 6, 5, 3, 2, 0],
    flutePattern: [5, -1, 7, -1, 8, -1, -1, 7, 5, -1, 6, -1, 5, -1, 4, -1],
    bassPattern: [0, -1, 3, -1, 0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 3, -1],
    drumAccentMask: [1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 2, 0, 1, 1, 2, 0],
    talkingDrumMask: [0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 0, 0],
    shakerDensity: 0.62,
    padRootHz: 98.0,
    padFifthHz: 146.83,
  },
  diplomacy: {
    stepMs: 495,
    scaleHz: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88],
    melodyPattern: [0, 3, 4, 6, 5, 4, 2, 3, 1, 4, 5, 7, 6, 4, 3, 2],
    flutePattern: [4, -1, 6, -1, 7, -1, 5, -1, 4, -1, 5, -1, 6, -1, 4, -1],
    bassPattern: [0, -1, -1, 2, 0, -1, 3, -1, 0, -1, -1, 2, 1, -1, 0, -1],
    drumAccentMask: [1, 0, 0, 2, 1, 0, 2, 0, 1, 0, 0, 2, 0, 2, 1, 0],
    talkingDrumMask: [0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0],
    shakerDensity: 0.45,
    padRootHz: 82.41,
    padFifthHz: 123.47,
  },
  military_prep: {
    stepMs: 385,
    // Tense D Dorian
    scaleHz: [146.83, 164.81, 174.61, 220.0, 246.94, 293.66, 329.63, 349.23, 440.0],
    melodyPattern: [0, 0, 3, 5, 3, 2, 0, 3, 0, 2, 4, 6, 5, 3, 2, 1],
    flutePattern: [-1, -1, -1, -1, 5, -1, 3, -1, -1, -1, -1, -1, 6, -1, 5, -1],
    bassPattern: [0, -1, 0, 3, 0, -1, 0, 2, 0, -1, 0, 3, 2, -1, 1, -1],
    drumAccentMask: [1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 1, 2, 2],
    talkingDrumMask: [1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 1, 2],
    shakerDensity: 0.72,
    padRootHz: 73.42,
    padFifthHz: 110.0,
  },
  combat: {
    stepMs: 275,
    // Urgent battle ostinato
    scaleHz: [146.83, 174.61, 196.0, 207.65, 220.0, 261.63, 293.66, 349.23, 440.0],
    melodyPattern: [0, 4, 3, 6, 4, 7, 6, 4, 0, 3, 4, 5, 3, 2, 4, 1],
    flutePattern: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    bassPattern: [0, 0, 3, 0, 0, 2, 4, 0, 0, 0, 3, 0, 2, 0, 1, 0],
    drumAccentMask: [1, 2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 2, 2],
    talkingDrumMask: [1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 2, 1, 0],
    shakerDensity: 0.92,
    padRootHz: 73.42,
    padFifthHz: 109.8,
  },
  victory: {
    stepMs: 410,
    scaleHz: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33],
    melodyPattern: [0, 3, 5, 7, 8, 7, 5, 3, 4, 5, 7, 8, 7, 5, 4, 5],
    flutePattern: [5, -1, 7, 8, -1, 7, 5, -1, 6, -1, 7, 8, -1, 7, 5, -1],
    bassPattern: [0, -1, 3, -1, 5, -1, 3, -1, 0, -1, 3, -1, 5, -1, 0, -1],
    drumAccentMask: [1, 0, 2, 1, 1, 0, 2, 2, 1, 0, 2, 1, 1, 2, 1, 2],
    talkingDrumMask: [0, 1, 0, 2, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 2, 0],
    shakerDensity: 0.72,
    padRootHz: 98.0,
    padFifthHz: 146.83,
  },
  defeat: {
    stepMs: 680,
    scaleHz: [130.81, 155.56, 174.61, 196.0, 233.08, 261.63, 311.13, 349.23, 392.0],
    melodyPattern: [5, 3, 2, 0, 3, 2, 1, 0, 4, 2, 1, 0, 2, 1, 0, 0],
    flutePattern: [5, -1, -1, -1, 3, -1, -1, -1, 2, -1, -1, -1, 0, -1, -1, -1],
    bassPattern: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1],
    drumAccentMask: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    talkingDrumMask: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    shakerDensity: 0.1,
    padRootHz: 65.41,
    padFifthHz: 98.0,
  },
};

// Vowel formant targets [F1 Hz, F2 Hz] for realistic expressive voice synthesis
const VOWEL_FORMANTS: [number, number][] = [
  [730, 1090], // /a/ "ah"
  [520, 1840], // /e/ "eh"
  [560, 860],  // /o/ "oh"
  [360, 780],  // /u/ "oo"
  [330, 2120], // /i/ "ee"
];

/**
 * Zero-dependency Web Audio API 3D-spatialized village foley engine,
 * expressive formant villager speech, acoustic West African score,
 * live bird/livestock/river/wind soundscape, and celebratory occasion tones.
 */
export class AkanuSoundEngine {
  private ctx: AudioContext | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;

  // Continuous Ambient Layers
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private foliageSource: AudioBufferSourceNode | null = null;
  private foliageFilter: BiquadFilterNode | null = null;
  private foliageGain: GainNode | null = null;

  private riverLowSource: AudioBufferSourceNode | null = null;
  private riverLowFilter: BiquadFilterNode | null = null;
  private riverHighSource: AudioBufferSourceNode | null = null;
  private riverHighFilter: BiquadFilterNode | null = null;
  private riverPanner: StereoPannerNode | null = null;
  private riverGain: GainNode | null = null;

  private villageHumSource: AudioBufferSourceNode | null = null;
  private villageHumFilter: BiquadFilterNode | null = null;
  private villageHumGain: GainNode | null = null;

  private settings: AudioSettings = {
    masterVolume: 0.75,
    musicVolume: 0.55,
    ambienceVolume: 0.65,
    sfxVolume: 0.8,
    muted: false,
  };

  private listener: SpatialListenerPose = {
    targetX: 0,
    targetZ: 4.5,
    yaw: 0.52,
    distance: 44,
  };

  private mood: MusicMood = 'menu';
  private biome: RegionId = 'golden_savannah';
  private musicTimer: number | null = null;
  private currentTimerIntervalMs = 550;
  private noteStep = 0;

  // Cooldown & polyphony guard timestamps (ms) so bustling villages stay crisp & warm
  private lastWorkSfxMs = 0;
  private lastHydroSfxMs = 0;
  private lastFootstepMs = 0;
  private lastVoiceMs = 0;
  private lastCommandVoiceMs = 0;
  private lastBirdMs = 0;
  private lastLivestockMs = 0;
  private lastCombatSfxMs = 0;
  private lastAlertSfxMs = 0;
  private lastAmbienceUpdateMs = 0;

  private activeFootsteps = 0;
  private activeVoices = 0;

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

  public updateSpatialListener(pose: SpatialListenerPose): void {
    this.listener = pose;
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
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -14;
      this.masterCompressor.knee.value = 12;
      this.masterCompressor.ratio.value = 3.5;
      this.masterCompressor.attack.value = 0.008;
      this.masterCompressor.release.value = 0.16;

      this.masterGainNode = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.ambienceBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();

      this.musicBus.connect(this.masterCompressor);
      this.ambienceBus.connect(this.masterCompressor);
      this.sfxBus.connect(this.masterCompressor);
      this.masterCompressor.connect(this.masterGainNode);
      this.masterGainNode.connect(this.ctx.destination);

      this.pinkNoiseBuffer = this.buildPinkNoiseBuffer(this.ctx);
      this.whiteNoiseBuffer = this.buildWhiteNoiseBuffer(this.ctx);
      this.initContinuousAmbience();
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
    let b3 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      data[i] = Math.max(-0.92, Math.min(0.92, (b0 + b1 + b2 + b3 + white * 0.04) * 0.16));
    }
    return buffer;
  }

  private buildWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private initContinuousAmbience(): void {
    if (!this.ctx || !this.ambienceBus || !this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    if (this.windSource) return;

    // 1. Continuous Gusting Wind Bed
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.pinkNoiseBuffer;
    windSrc.loop = true;
    const windFilt = this.ctx.createBiquadFilter();
    windFilt.type = 'bandpass';
    windFilt.frequency.value = 380;
    windFilt.Q.value = 0.65;
    const windG = this.ctx.createGain();
    windG.gain.value = 0;
    windSrc.connect(windFilt);
    windFilt.connect(windG);
    windG.connect(this.ambienceBus);
    windSrc.start();
    this.windSource = windSrc;
    this.windFilter = windFilt;
    this.windGain = windG;

    // 2. High Canopy & Dry Grass Wind Rustle
    const folSrc = this.ctx.createBufferSource();
    folSrc.buffer = this.whiteNoiseBuffer;
    folSrc.loop = true;
    const folFilt = this.ctx.createBiquadFilter();
    folFilt.type = 'bandpass';
    folFilt.frequency.value = 2350;
    folFilt.Q.value = 1.1;
    const folG = this.ctx.createGain();
    folG.gain.value = 0;
    folSrc.connect(folFilt);
    folFilt.connect(folG);
    folG.connect(this.ambienceBus);
    folSrc.start(0, 0.37);
    this.foliageSource = folSrc;
    this.foliageFilter = folFilt;
    this.foliageGain = folG;

    // 3. Flowing River & Shoreline Wave Stream (dual low current + bright babble)
    const rivLow = this.ctx.createBufferSource();
    rivLow.buffer = this.pinkNoiseBuffer;
    rivLow.loop = true;
    const rivLowFilt = this.ctx.createBiquadFilter();
    rivLowFilt.type = 'bandpass';
    rivLowFilt.frequency.value = 340;
    rivLowFilt.Q.value = 0.72;

    const rivHigh = this.ctx.createBufferSource();
    rivHigh.buffer = this.whiteNoiseBuffer;
    rivHigh.loop = true;
    const rivHighFilt = this.ctx.createBiquadFilter();
    rivHighFilt.type = 'bandpass';
    rivHighFilt.frequency.value = 1850;
    rivHighFilt.Q.value = 1.65;
    const rivHighTrim = this.ctx.createGain();
    rivHighTrim.gain.value = 0.24;

    const rivGain = this.ctx.createGain();
    rivGain.gain.value = 0;

    rivLow.connect(rivLowFilt);
    rivLowFilt.connect(rivGain);
    rivHigh.connect(rivHighFilt);
    rivHighFilt.connect(rivHighTrim);
    rivHighTrim.connect(rivGain);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;
      rivGain.connect(panner);
      panner.connect(this.ambienceBus);
      this.riverPanner = panner;
    } else {
      rivGain.connect(this.ambienceBus);
    }

    rivLow.start(0, 0.8);
    rivHigh.start(0, 0.2);
    this.riverLowSource = rivLow;
    this.riverLowFilter = rivLowFilt;
    this.riverHighSource = rivHigh;
    this.riverHighFilter = rivHighFilt;
    this.riverGain = rivGain;

    // 4. Warm Distant Village Murmur Resonance
    const humSrc = this.ctx.createBufferSource();
    humSrc.buffer = this.pinkNoiseBuffer;
    humSrc.loop = true;
    const humFilt = this.ctx.createBiquadFilter();
    humFilt.type = 'bandpass';
    humFilt.frequency.value = 540;
    humFilt.Q.value = 1.4;
    const humG = this.ctx.createGain();
    humG.gain.value = 0;
    humSrc.connect(humFilt);
    humFilt.connect(humG);
    humG.connect(this.ambienceBus);
    humSrc.start(0, 1.45);
    this.villageHumSource = humSrc;
    this.villageHumFilter = humFilt;
    this.villageHumGain = humG;

    this.tuneBiomeAmbienceFilter();
  }

  private tuneBiomeAmbienceFilter(): void {
    if (!this.ctx || !this.windFilter || !this.foliageFilter) return;
    const now = this.ctx.currentTime;
    switch (this.biome) {
      case 'great_forests':
        this.windFilter.frequency.setTargetAtTime(460, now, 0.45);
        this.foliageFilter.frequency.setTargetAtTime(2100, now, 0.45);
        break;
      case 'northern_highlands':
        this.windFilter.frequency.setTargetAtTime(660, now, 0.45);
        this.windFilter.Q.setTargetAtTime(1.15, now, 0.45);
        this.foliageFilter.frequency.setTargetAtTime(2750, now, 0.45);
        break;
      case 'coastal_territories':
        this.windFilter.frequency.setTargetAtTime(510, now, 0.45);
        this.foliageFilter.frequency.setTargetAtTime(2450, now, 0.45);
        break;
      case 'riverlands':
        this.windFilter.frequency.setTargetAtTime(420, now, 0.45);
        this.foliageFilter.frequency.setTargetAtTime(2200, now, 0.45);
        break;
      default:
        // Golden Savannah warm breeze
        this.windFilter.frequency.setTargetAtTime(360, now, 0.45);
        this.windFilter.Q.setTargetAtTime(0.65, now, 0.45);
        this.foliageFilter.frequency.setTargetAtTime(2550, now, 0.45);
        break;
    }
  }

  /**
   * Modulates real-time continuous wind gusts, foliage rustle, flowing river/surf stream,
   * and subtle village hum based on live camera target, altitude, and river distance.
   */
  public updateAmbienceTelemetry(telemetry: AmbienceTelemetry, elapsedSeconds: number): void {
    if (!this.ctx || this.ctx.state !== 'running') return;

    const nowMs = performance.now();
    if (nowMs - this.lastAmbienceUpdateMs < 75) return;
    this.lastAmbienceUpdateMs = nowMs;

    const now = this.ctx.currentTime;
    const muted = this.settings.muted;
    const elev = telemetry.elevationRatio ?? 0.2;

    // Gust cycle combines two slow inharmonic waves so wind swells naturally
    const gustWave =
      0.5 +
      0.32 * Math.sin(elapsedSeconds * 0.37) +
      0.18 * Math.sin(elapsedSeconds * 0.83 + 1.4);
    const windAmt = muted ? 0 : Math.max(0.06, Math.min(1, telemetry.windIntensity * (0.65 + gustWave * 0.55)));

    if (this.windGain && this.windFilter) {
      const biomeWindBoost =
        this.biome === 'northern_highlands' ? 1.35 : this.biome === 'coastal_territories' ? 1.18 : 1.0;
      this.windGain.gain.setTargetAtTime(windAmt * 0.085 * biomeWindBoost, now, 0.22);
      const baseWindHz =
        this.biome === 'northern_highlands' ? 560 : this.biome === 'great_forests' ? 420 : 340;
      this.windFilter.frequency.setTargetAtTime(baseWindHz + gustWave * 290 + elev * 160, now, 0.28);
    }

    if (this.foliageGain) {
      const rustleBoost = this.biome === 'great_forests' ? 1.45 : 0.95;
      this.foliageGain.gain.setTargetAtTime(
        muted ? 0 : Math.max(0, gustWave - 0.35) * telemetry.windIntensity * 0.022 * rustleBoost,
        now,
        0.24,
      );
    }

    if (this.riverGain && this.riverLowFilter && this.riverHighFilter) {
      const riverProx = Math.max(0, Math.min(1, telemetry.riverProximity));
      const coastalSurf =
        this.biome === 'coastal_territories'
          ? 0.65 + 0.35 * Math.sin(elapsedSeconds * 0.95)
          : 0.9 + 0.1 * Math.sin(elapsedSeconds * 1.7);
      const riverAmp = muted ? 0 : (0.008 + riverProx * 0.145) * coastalSurf;
      this.riverGain.gain.setTargetAtTime(riverAmp, now, 0.18);
      this.riverLowFilter.frequency.setTargetAtTime(
        240 + riverProx * 230 + (this.biome === 'coastal_territories' ? 80 * coastalSurf : 0),
        now,
        0.2,
      );
      this.riverHighFilter.frequency.setTargetAtTime(1450 + riverProx * 850, now, 0.2);

      if (this.riverPanner) {
        this.riverPanner.pan.setTargetAtTime(
          Math.max(-0.85, Math.min(0.85, telemetry.riverPan)),
          now,
          0.16,
        );
      }
    }

    if (this.villageHumGain) {
      const bustle = muted ? 0 : Math.max(0, Math.min(1, telemetry.villageBustle));
      this.villageHumGain.gain.setTargetAtTime(bustle * 0.014, now, 0.3);
    }
  }

  private syncMixerGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const muted = this.settings.muted;

    if (this.masterGainNode) {
      const m = muted ? 0 : Math.max(0, Math.min(1, this.settings.masterVolume));
      this.masterGainNode.gain.setTargetAtTime(m, now, 0.04);
    }
    if (this.musicBus) {
      const mus = muted ? 0 : Math.max(0, Math.min(1, this.settings.musicVolume));
      this.musicBus.gain.setTargetAtTime(mus, now, 0.06);
    }
    if (this.ambienceBus) {
      const amb = muted ? 0 : Math.max(0, Math.min(1, this.settings.ambienceVolume ?? 0.65));
      this.ambienceBus.gain.setTargetAtTime(amb, now, 0.1);
    }
    if (this.sfxBus) {
      const sfx = muted ? 0 : Math.max(0, Math.min(1, this.settings.sfxVolume));
      this.sfxBus.gain.setTargetAtTime(sfx, now, 0.04);
    }
  }

  private computeSpatialParams(
    worldX?: number,
    worldZ?: number,
    maxAudibleDist = 48,
  ): { pan: number; gain: number } {
    if (typeof worldX !== 'number' || typeof worldZ !== 'number') {
      return { pan: 0, gain: 1 };
    }
    const dx = worldX - this.listener.targetX;
    const dz = worldZ - this.listener.targetZ;
    const planarDist = Math.hypot(dx, dz);

    // Project onto camera right vector: (cos(yaw), -sin(yaw))
    const rx = Math.cos(this.listener.yaw);
    const rz = -Math.sin(this.listener.yaw);
    const rightDot = dx * rx + dz * rz;
    const pan = Math.max(-0.85, Math.min(0.85, rightDot / (15 + this.listener.distance * 0.35)));

    const distRatio = Math.max(0, 1 - planarDist / maxAudibleDist);
    const zoomScale = Math.max(0.28, Math.min(1.28, 30 / Math.max(15, this.listener.distance)));
    const gain = Math.pow(distRatio, 1.55) * zoomScale;
    return { pan, gain };
  }

  private routeNodeToBus(node: AudioNode, bus: AudioNode, pan = 0): void {
    if (!this.ctx) return;
    if (Math.abs(pan) > 0.02 && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
      node.connect(panner);
      panner.connect(bus);
    } else {
      node.connect(bus);
    }
  }

  private isAudioReady(): boolean {
    return Boolean(
      this.ctx &&
        this.sfxBus &&
        this.musicBus &&
        this.ambienceBus &&
        this.ctx.state === 'running' &&
        !this.settings.muted,
    );
  }

  // ==========================================================================
  // ADAPTIVE LAYERED ACOUSTIC SCORE (Kora, Balafon, Flute, Talking Drum, Pad)
  // ==========================================================================

  private startAdaptiveMusicLoop(): void {
    if (this.musicTimer !== null) return;
    const profile = MOOD_PROFILES[this.mood];
    this.currentTimerIntervalMs = profile.stepMs;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || this.ctx.state !== 'running') return;

      const curProfile = MOOD_PROFILES[this.mood];
      const musicVol = this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.musicVolume));
      const ambVol = this.settings.muted
        ? 0
        : Math.max(0, Math.min(1, this.settings.ambienceVolume ?? 0.65));
      const now = this.ctx.currentTime;
      const step = this.noteStep % 16;

      // Subtle distant nature chirps inside ambience bus
      if (ambVol > 0.05 && step === 6 && Math.random() < (this.biome === 'great_forests' ? 0.42 : 0.16)) {
        this.playBirdFlight(this.biome, undefined, undefined, true, true);
      }

      if (musicVol > 0.01) {
        // 1. Acoustic Kora Plucked Strings (subtle stereo alternating left/right harp banks)
        const melIdx = curProfile.melodyPattern[step];
        if (melIdx >= 0) {
          const freq = curProfile.scaleHz[melIdx % curProfile.scaleHz.length];
          const harpPan = step % 2 === 0 ? -0.18 : 0.18;
          this.playKoraNote(freq, now, this.mood === 'combat' ? 0.095 : 0.085, harpPan);
        }

        // 2. Breathy Bamboo / Fula Flute Melody Swells
        const fluteIdx = curProfile.flutePattern[step];
        if (fluteIdx >= 0 && Math.floor(this.noteStep / 16) % 2 === 0) {
          const fluteFreq = curProfile.scaleHz[fluteIdx % curProfile.scaleHz.length] * 1.0;
          this.playBambooFlute(
            fluteFreq,
            now,
            0.058,
            curProfile.stepMs * 0.0022,
            0.14,
          );
        }

        // 3. Resonant Wooden Balafon / Marimba Bass
        const bassIdx = curProfile.bassPattern[step];
        if (bassIdx >= 0) {
          const bassFreq = curProfile.scaleHz[bassIdx % curProfile.scaleHz.length] * 0.5;
          this.playBalafonBass(bassFreq, now, 0.088);
        }

        // 4. Djembe Hand Drums (1 = deep palm bass, 2 = crisp rim slap)
        const drumHit = curProfile.drumAccentMask[step];
        if (drumHit === 1) {
          this.playDjembeHit(now, this.mood === 'combat' ? 0.14 : 0.095, true);
        } else if (drumHit === 2) {
          this.playDjembeHit(now, this.mood === 'combat' ? 0.098 : 0.062, false);
        }

        // 5. Talking Drum Expressive Tonal Phrases
        const talkHit = curProfile.talkingDrumMask[step];
        if (talkHit > 0) {
          this.playTalkingDrum(now, this.mood === 'combat' ? 0.095 : 0.068, talkHit === 1);
        }

        // 6. Shekere Gourd Shaker Rhythm
        if (Math.random() < curProfile.shakerDensity) {
          this.playShekereTap(now, 0.032, step % 2 === 0 ? -0.22 : 0.22);
        }

        // 7. Warm Atmospheric Choral/Horn Fifth Swells on Bar Boundaries
        if (step === 0 || step === 8) {
          const padDur = curProfile.stepMs * 0.0075;
          this.playWarmPad(curProfile.padRootHz, now, 0.042, padDur);
          if (step === 8 && this.mood !== 'combat') {
            this.playWarmPad(curProfile.padFifthHz, now, 0.026, padDur * 0.85);
          }
        }
      }

      this.noteStep++;
    }, this.currentTimerIntervalMs);
  }

  private playKoraNote(freq: number, startTime: number, amp: number, pan = 0): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const shimmer = this.ctx.createOscillator();
    const overtoneGain = this.ctx.createGain();
    const shimmerGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, startTime);
    overtoneGain.gain.setValueAtTime(0.28, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.34);

    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(freq * 3, startTime);
    shimmerGain.gain.setValueAtTime(0.08, startTime);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.14);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + 1.32);

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(env);
    this.routeNodeToBus(env, this.musicBus, pan);

    osc.start(startTime);
    overtone.start(startTime);
    shimmer.start(startTime);
    osc.stop(startTime + 1.35);
    overtone.stop(startTime + 0.36);
    shimmer.stop(startTime + 0.16);
  }

  private playBalafonBass(freq: number, startTime: number, amp: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const woodTap = this.ctx.createOscillator();
    const tapGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    woodTap.type = 'sine';
    woodTap.frequency.setValueAtTime(freq * 3.98, startTime);
    tapGain.gain.setValueAtTime(0.18, startTime);
    tapGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0006, startTime + 0.92);

    osc.connect(env);
    woodTap.connect(tapGain);
    tapGain.connect(env);
    this.routeNodeToBus(env, this.musicBus, -0.1);

    osc.start(startTime);
    woodTap.start(startTime);
    osc.stop(startTime + 0.95);
    woodTap.stop(startTime + 0.11);
  }

  private playBambooFlute(
    freq: number,
    startTime: number,
    amp: number,
    dur: number,
    pan = 0.15,
  ): void {
    if (!this.ctx || !this.musicBus || !this.whiteNoiseBuffer) return;
    const fluteOsc = this.ctx.createOscillator();
    const harmonicOsc = this.ctx.createOscillator();
    const harmonicGain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    // Subtle pitch scoop at breath onset
    fluteOsc.type = 'sine';
    fluteOsc.frequency.setValueAtTime(freq * 0.96, startTime);
    fluteOsc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.075);

    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.setValueAtTime(freq * 2, startTime);
    harmonicGain.gain.value = 0.12;

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.1, startTime);
    lfoGain.gain.setValueAtTime(0.5, startTime);
    lfoGain.gain.linearRampToValueAtTime(4.8, startTime + 0.28);
    lfo.connect(lfoGain);
    lfoGain.connect(fluteOsc.frequency);

    // Breathy air chiff
    const breathSrc = this.ctx.createBufferSource();
    breathSrc.buffer = this.whiteNoiseBuffer;
    const breathFilt = this.ctx.createBiquadFilter();
    breathFilt.type = 'bandpass';
    breathFilt.frequency.setValueAtTime(freq * 2.4, startTime);
    breathFilt.Q.value = 2.8;
    const breathGain = this.ctx.createGain();
    breathGain.gain.setValueAtTime(amp * 0.22, startTime);
    breathGain.gain.exponentialRampToValueAtTime(0.0005, startTime + dur);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.09);
    env.gain.setValueAtTime(amp * 0.86, startTime + Math.max(0.14, dur * 0.65));
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + Math.max(0.45, dur));

    fluteOsc.connect(env);
    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(env);
    breathSrc.connect(breathFilt);
    breathFilt.connect(breathGain);
    breathGain.connect(env);

    this.routeNodeToBus(env, this.musicBus, pan);

    const stopAt = startTime + Math.max(0.5, dur + 0.08);
    fluteOsc.start(startTime);
    harmonicOsc.start(startTime);
    lfo.start(startTime);
    breathSrc.start(startTime, Math.random() * 0.9, Math.max(0.5, dur));
    fluteOsc.stop(stopAt);
    harmonicOsc.stop(stopAt);
    lfo.stop(stopAt);
  }

  private playDjembeHit(startTime: number, amp: number, isBass: boolean): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    if (isBass) {
      osc.frequency.setValueAtTime(118, startTime);
      osc.frequency.exponentialRampToValueAtTime(50, startTime + 0.22);
    } else {
      osc.frequency.setValueAtTime(225, startTime);
      osc.frequency.exponentialRampToValueAtTime(132, startTime + 0.11);
      // Skin slap transient
      if (this.whiteNoiseBuffer) {
        const slap = this.ctx.createBufferSource();
        slap.buffer = this.whiteNoiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1450;
        bp.Q.value = 1.8;
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(amp * 0.45, startTime);
        sg.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.045);
        slap.connect(bp);
        bp.connect(sg);
        this.routeNodeToBus(sg, this.musicBus, 0.16);
        slap.start(startTime, Math.random() * 0.8, 0.05);
      }
    }
    env.gain.setValueAtTime(amp, startTime);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + (isBass ? 0.32 : 0.15));
    osc.connect(env);
    this.routeNodeToBus(env, this.musicBus, isBass ? -0.08 : 0.14);
    osc.start(startTime);
    osc.stop(startTime + (isBass ? 0.34 : 0.17));
  }

  private playTalkingDrum(startTime: number, amp: number, rising: boolean): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    if (rising) {
      osc.frequency.setValueAtTime(148, startTime);
      osc.frequency.exponentialRampToValueAtTime(228, startTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(186, startTime + 0.24);
    } else {
      osc.frequency.setValueAtTime(224, startTime);
      osc.frequency.exponentialRampToValueAtTime(142, startTime + 0.16);
    }
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.27);
    osc.connect(env);
    this.routeNodeToBus(env, this.musicBus, -0.2);
    osc.start(startTime);
    osc.stop(startTime + 0.29);
  }

  private playShekereTap(startTime: number, amp: number, pan = 0): void {
    if (!this.ctx || !this.musicBus || !this.whiteNoiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(4200, startTime);
    hp.Q.value = 1.2;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(amp, startTime);
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + 0.055);
    src.connect(hp);
    hp.connect(env);
    this.routeNodeToBus(env, this.musicBus, pan);
    src.start(startTime, Math.random() * 1.2, 0.06);
  }

  private playWarmPad(freq: number, startTime: number, amp: number, dur: number): void {
    if (!this.ctx || !this.musicBus) return;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq, startTime);
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(freq * 1.003, startTime);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, startTime);
    lp.frequency.linearRampToValueAtTime(420, startTime + dur * 0.4);
    lp.frequency.linearRampToValueAtTime(240, startTime + Math.max(1.8, dur));

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.55);
    env.gain.exponentialRampToValueAtTime(0.0005, startTime + Math.max(1.8, dur));

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(env);
    env.connect(this.musicBus);
    oscA.start(startTime);
    oscB.start(startTime);
    const stopAt = startTime + Math.max(1.9, dur + 0.12);
    oscA.stop(stopAt);
    oscB.stop(stopAt);
  }

  // ==========================================================================
  // VILLAGER VOICES (FORMANT CHATTER, GREETINGS, WORK CALLS, COMMANDS)
  // ==========================================================================

  public playVillagerVoice(
    kind: VillagerVoiceKind,
    worldX?: number,
    worldZ?: number,
    voiceSeed = 1,
  ): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (kind === 'command') {
      if (nowMs - this.lastCommandVoiceMs < 240) return;
      this.lastCommandVoiceMs = nowMs;
    } else {
      if (nowMs - this.lastVoiceMs < 950 || this.activeVoices >= 2) return;
      this.lastVoiceMs = nowMs;
    }

    const spatial = this.computeSpatialParams(worldX, worldZ, 36);
    if (spatial.gain < 0.08 && kind !== 'command') return;

    const isFemale = voiceSeed % 2 === 1;
    const baseF0 = isFemale
      ? 198 + (voiceSeed % 7) * 7
      : 112 + (voiceSeed % 7) * 5;

    const syllables =
      kind === 'command'
        ? 2
        : kind === 'work_call'
          ? 2
          : kind === 'greeting'
            ? 3
            : 2 + (voiceSeed % 3);

    const now = this.ctx.currentTime;
    const masterAmp =
      kind === 'command'
        ? Math.max(0.45, spatial.gain) * 0.16
        : spatial.gain * (kind === 'work_call' ? 0.12 : 0.105);

    this.activeVoices++;
    let cursor = now;

    for (let s = 0; s < syllables; s++) {
      const sylDur =
        kind === 'work_call' && s === syllables - 1
          ? 0.21
          : 0.085 + ((voiceSeed + s * 3) % 5) * 0.018;
      const gap = 0.032 + ((voiceSeed + s) % 3) * 0.014;
      const vowel = VOWEL_FORMANTS[(voiceSeed + s * 2) % VOWEL_FORMANTS.length];
      const nextVowel = VOWEL_FORMANTS[(voiceSeed + s * 2 + 1) % VOWEL_FORMANTS.length];

      // Natural tonal inflection across syllables
      const toneMult =
        kind === 'greeting'
          ? s === syllables - 1
            ? 1.18
            : 0.96 + s * 0.08
          : kind === 'work_call'
            ? s === 0
              ? 1.05
              : 1.24
            : kind === 'command'
              ? s === 0
                ? 1.08
                : 0.94
              : 0.92 + ((voiceSeed + s) % 4) * 0.08;

      this.triggerVocalSyllable(
        cursor,
        sylDur,
        baseF0 * toneMult,
        vowel,
        nextVowel,
        masterAmp,
        spatial.pan,
        s === 0 || Math.random() < 0.55,
      );

      cursor += sylDur + gap;
    }

    const releaseDelay = Math.max(200, Math.round((cursor - now + 0.08) * 1000));
    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, releaseDelay);
  }

  private triggerVocalSyllable(
    startTime: number,
    dur: number,
    f0: number,
    vStart: [number, number],
    vEnd: [number, number],
    amp: number,
    pan: number,
    withConsonant: boolean,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const glottal = this.ctx.createOscillator();
    glottal.type = 'sawtooth';
    glottal.frequency.setValueAtTime(f0, startTime);
    glottal.frequency.linearRampToValueAtTime(f0 * (0.94 + Math.random() * 0.14), startTime + dur);

    // Parallel Formant F1 (chest/mouth) + F2 (vowel articulation)
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(vStart[0], startTime);
    f1.frequency.linearRampToValueAtTime(vEnd[0], startTime + dur);
    f1.Q.value = 5.5;

    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(vStart[1], startTime);
    f2.frequency.linearRampToValueAtTime(vEnd[1], startTime + dur);
    f2.Q.value = 7.5;

    const f2Trim = this.ctx.createGain();
    f2Trim.gain.value = 0.55;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.018);
    env.gain.setValueAtTime(amp * 0.88, startTime + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + dur);

    glottal.connect(f1);
    glottal.connect(f2);
    f1.connect(env);
    f2.connect(f2Trim);
    f2Trim.connect(env);
    this.routeNodeToBus(env, this.sfxBus, pan);

    glottal.start(startTime);
    glottal.stop(startTime + dur + 0.02);

    // Soft unvoiced consonant puff (/t/, /k/, /h/) at syllable onset
    if (withConsonant && this.whiteNoiseBuffer) {
      const cons = this.ctx.createBufferSource();
      cons.buffer = this.whiteNoiseBuffer;
      const cFilt = this.ctx.createBiquadFilter();
      cFilt.type = 'bandpass';
      cFilt.frequency.setValueAtTime(2200 + Math.random() * 1400, startTime);
      cFilt.Q.value = 2.0;
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(amp * 0.24, startTime);
      cGain.gain.exponentialRampToValueAtTime(0.0004, startTime + 0.026);
      cons.connect(cFilt);
      cFilt.connect(cGain);
      this.routeNodeToBus(cGain, this.sfxBus, pan);
      cons.start(startTime, Math.random() * 0.9, 0.03);
    }
  }

  // ==========================================================================
  // GAIT-SYNCED FOOTSTEPS (GRASS / PACKED SOIL / WET RIVERBANK)
  // ==========================================================================

  public playFootstep(
    surface: FootstepSurface,
    worldX?: number,
    worldZ?: number,
    running = false,
  ): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus || !this.whiteNoiseBuffer) return;
    const nowMs = performance.now();
    if (nowMs - this.lastFootstepMs < 70 || this.activeFootsteps >= 5) return;
    this.lastFootstepMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 32);
    if (spatial.gain < 0.1) return;

    this.activeFootsteps++;
    const now = this.ctx.currentTime;
    const amp = spatial.gain * (running ? 0.095 : 0.068);

    // Low heel thump
    const thump = this.ctx.createOscillator();
    const thumpEnv = this.ctx.createGain();
    thump.type = 'sine';
    const startHz = surface === 'soil' ? 112 : surface === 'wet_bank' ? 92 : 84;
    thump.frequency.setValueAtTime(startHz + Math.random() * 14, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.055);
    thumpEnv.gain.setValueAtTime(amp * (surface === 'grass' ? 0.55 : 0.9), now);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0004, now + 0.065);
    thump.connect(thumpEnv);
    this.routeNodeToBus(thumpEnv, this.sfxBus, spatial.pan);
    thump.start(now);
    thump.stop(now + 0.07);

    // Surface texture noise (grass brush / gravel grit / wet squish)
    const texSrc = this.ctx.createBufferSource();
    texSrc.buffer = this.whiteNoiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    const texEnv = this.ctx.createGain();

    if (surface === 'grass') {
      filt.frequency.setValueAtTime(2800 + Math.random() * 650, now);
      filt.Q.value = 1.25;
      texEnv.gain.setValueAtTime(amp * 0.52, now);
      texEnv.gain.exponentialRampToValueAtTime(0.0004, now + 0.075);
    } else if (surface === 'wet_bank') {
      filt.frequency.setValueAtTime(880, now);
      filt.frequency.exponentialRampToValueAtTime(1780, now + 0.06);
      filt.Q.value = 2.6;
      texEnv.gain.setValueAtTime(amp * 0.78, now);
      texEnv.gain.exponentialRampToValueAtTime(0.0004, now + 0.085);
    } else {
      // Compacted soil & gravel grit
      filt.frequency.setValueAtTime(2150 + Math.random() * 500, now);
      filt.Q.value = 1.6;
      texEnv.gain.setValueAtTime(amp * 0.68, now);
      texEnv.gain.exponentialRampToValueAtTime(0.0004, now + 0.052);
    }

    texSrc.connect(filt);
    filt.connect(texEnv);
    this.routeNodeToBus(texEnv, this.sfxBus, spatial.pan);
    texSrc.start(now, Math.random() * 1.1, 0.09);

    window.setTimeout(() => {
      this.activeFootsteps = Math.max(0, this.activeFootsteps - 1);
    }, 90);
  }

  // ==========================================================================
  // REALISTIC ACTIVITY FOLEY & HYDRO-FARMING WATER SOUNDS
  // ==========================================================================

  public playWorkAction(kind: WorkFoleyKind, worldX?: number, worldZ?: number): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastWorkSfxMs < 380) return;
    this.lastWorkSfxMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 44);
    if (spatial.gain < 0.06) return;

    const now = this.ctx.currentTime;
    const amp = spatial.gain;

    if (kind === 'mine') {
      // Sharp iron pickaxe clang + inharmonic rock ring + falling gravel chips
      const ringA = this.ctx.createOscillator();
      const ringB = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      ringA.type = 'triangle';
      ringB.type = 'sine';
      const pitchVar = 0.92 + Math.random() * 0.16;
      ringA.frequency.setValueAtTime(1580 * pitchVar, now);
      ringA.frequency.exponentialRampToValueAtTime(740 * pitchVar, now + 0.14);
      ringB.frequency.setValueAtTime(2460 * pitchVar, now);
      ringB.frequency.exponentialRampToValueAtTime(1620 * pitchVar, now + 0.11);
      env.gain.setValueAtTime(amp * 0.095, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.17);
      ringA.connect(env);
      ringB.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      ringA.start(now);
      ringB.start(now);
      ringA.stop(now + 0.18);
      ringB.stop(now + 0.15);

      this.triggerFilteredNoiseBurst(now + 0.025, 0.09, 2600, 1.4, amp * 0.06, spatial.pan);
    } else if (kind === 'chop') {
      // Deep hollow trunk axe strike + sharp wood splinter crack
      const thud = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      thud.type = 'sine';
      const varP = 0.9 + Math.random() * 0.2;
      thud.frequency.setValueAtTime(235 * varP, now);
      thud.frequency.exponentialRampToValueAtTime(68 * varP, now + 0.11);
      env.gain.setValueAtTime(amp * 0.14, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.14);
      thud.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      thud.start(now);
      thud.stop(now + 0.15);

      this.triggerFilteredNoiseBurst(now, 0.055, 1180 * varP, 2.2, amp * 0.11, spatial.pan);
    } else if (kind === 'build') {
      // Alternating heavy timber mallet knock, crisp chisel tap, and structural plank thump
      const mode = Math.floor(Math.random() * 3);
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      if (mode === 0) {
        // Heavy wooden mallet knock
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(310 + Math.random() * 50, now);
        osc.frequency.exponentialRampToValueAtTime(118, now + 0.09);
        env.gain.setValueAtTime(amp * 0.125, now);
        env.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
      } else if (mode === 1) {
        // Masonry / nail hammer tap
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(980 + Math.random() * 140, now);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.075);
        env.gain.setValueAtTime(amp * 0.085, now);
        env.gain.exponentialRampToValueAtTime(0.0005, now + 0.095);
      } else {
        // Beam/timber seat thud + scaffold creak
        osc.type = 'sine';
        osc.frequency.setValueAtTime(175, now);
        osc.frequency.exponentialRampToValueAtTime(76, now + 0.13);
        env.gain.setValueAtTime(amp * 0.13, now);
        env.gain.exponentialRampToValueAtTime(0.0005, now + 0.15);
      }
      osc.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      osc.stop(now + 0.16);
      this.triggerFilteredNoiseBurst(now, 0.04, 1550, 1.8, amp * 0.065, spatial.pan);
    } else if (kind === 'harvest') {
      // Sickle blade swish & rustling grain stalks
      this.triggerFilteredNoiseBurst(now, 0.14, 3100, 1.3, amp * 0.075, spatial.pan);
    } else {
      // Craft / Trade workshop tap & clay/coin clink
      const clink = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      clink.type = 'sine';
      clink.frequency.setValueAtTime(1120 + Math.random() * 220, now);
      clink.frequency.exponentialRampToValueAtTime(840, now + 0.09);
      env.gain.setValueAtTime(amp * 0.065, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);
      clink.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      clink.start(now);
      clink.stop(now + 0.12);
    }
  }

  public playHydroAction(kind: HydroFoleyKind, worldX?: number, worldZ?: number): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHydroSfxMs < 460) return;
    this.lastHydroSfxMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 42);
    if (spatial.gain < 0.08) return;

    const now = this.ctx.currentTime;
    const amp = spatial.gain;

    if (kind === 'draw_water') {
      // Clay jar submerging in river + bubbly rising glug + water splash
      this.triggerFilteredNoiseBurst(now, 0.24, 1150, 1.1, amp * 0.1, spatial.pan);
      for (let g = 0; g < 3; g++) {
        const glug = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        const t = now + g * 0.07;
        glug.type = 'sine';
        glug.frequency.setValueAtTime(250 + g * 55, t);
        glug.frequency.exponentialRampToValueAtTime(490 + g * 80, t + 0.065);
        env.gain.setValueAtTime(amp * 0.065, t);
        env.gain.exponentialRampToValueAtTime(0.0004, t + 0.08);
        glug.connect(env);
        this.routeNodeToBus(env, this.sfxBus, spatial.pan);
        glug.start(t);
        glug.stop(t + 0.09);
      }
    } else {
      // Cascading water pour onto thirsty farmland + crisp pattering droplets
      this.triggerFilteredNoiseBurst(now, 0.34, 1650, 0.9, amp * 0.095, spatial.pan);
      for (let d = 0; d < 4; d++) {
        const drop = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        const t = now + d * 0.065 + Math.random() * 0.03;
        drop.type = 'sine';
        const f = 680 + Math.random() * 520;
        drop.frequency.setValueAtTime(f, t);
        drop.frequency.exponentialRampToValueAtTime(f * 1.48, t + 0.04);
        env.gain.setValueAtTime(amp * 0.048, t);
        env.gain.exponentialRampToValueAtTime(0.0004, t + 0.055);
        drop.connect(env);
        this.routeNodeToBus(env, this.sfxBus, spatial.pan);
        drop.start(t);
        drop.stop(t + 0.06);
      }
    }
  }

  private triggerFilteredNoiseBurst(
    startTime: number,
    dur: number,
    freqHz: number,
    q: number,
    amp: number,
    pan: number,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.whiteNoiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(freqHz, startTime);
    filt.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + Math.min(0.015, dur * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + dur);
    src.connect(filt);
    filt.connect(env);
    this.routeNodeToBus(env, this.sfxBus, pan);
    src.start(startTime, Math.random() * 1.0, dur + 0.02);
  }

  // ==========================================================================
  // FLYING BIRD WINGBEATS & SOARING CALLS + PASTURE LIVESTOCK
  // ==========================================================================

  public playBirdFlight(
    biome: RegionId,
    worldX?: number,
    worldZ?: number,
    includeCall = true,
    onAmbienceBus = false,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.ambienceBus || this.ctx.state !== 'running' || this.settings.muted) {
      return;
    }
    const nowMs = performance.now();
    if (!onAmbienceBus && nowMs - this.lastBirdMs < 2400) return;
    if (!onAmbienceBus) this.lastBirdMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 58);
    if (!onAmbienceBus && spatial.gain < 0.09) return;

    const targetBus = onAmbienceBus ? this.ambienceBus : this.sfxBus;
    const now = this.ctx.currentTime;
    const amp = onAmbienceBus ? 0.032 : Math.min(0.11, spatial.gain * 0.11);

    // 1. Feathered Wingbeat Whooshes (2-3 rhythmic strokes)
    if (this.pinkNoiseBuffer && !onAmbienceBus) {
      const flaps = 2 + Math.floor(Math.random() * 2);
      for (let f = 0; f < flaps; f++) {
        const t = now + f * 0.16;
        const src = this.ctx.createBufferSource();
        src.buffer = this.pinkNoiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(320 + f * 35, t);
        bp.frequency.exponentialRampToValueAtTime(560, t + 0.09);
        bp.Q.value = 1.4;
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(amp * 0.72, t + 0.035);
        env.gain.exponentialRampToValueAtTime(0.0004, t + 0.13);
        src.connect(bp);
        bp.connect(env);
        this.routeNodeToBus(env, targetBus, spatial.pan);
        src.start(t, Math.random() * 1.4, 0.14);
      }
    }

    // 2. Melodic Regional Bird Call
    if (includeCall) {
      const callStart = now + (onAmbienceBus ? 0 : 0.08);
      if (biome === 'great_forests') {
        // Rainforest weaver / hornbill 3-note warble
        const notes = [1850, 2420, 2120];
        notes.forEach((f, idx) => {
          this.triggerBirdTone(callStart + idx * 0.085, 0.075, f, f * 1.15, amp * 0.65, spatial.pan, targetBus);
        });
      } else if (biome === 'coastal_territories' || biome === 'riverlands') {
        // Coastal gull / river kingfisher soaring cry
        this.triggerBirdTone(callStart, 0.24, 1520, 1180, amp * 0.7, spatial.pan, targetBus);
        this.triggerBirdTone(callStart + 0.28, 0.18, 1640, 1280, amp * 0.55, spatial.pan, targetBus);
      } else {
        // Golden Savannah / Highland soaring hawk or crowned crane cry
        this.triggerBirdTone(callStart, 0.28, 2240, 1540, amp * 0.68, spatial.pan, targetBus);
      }
    }
  }

  private triggerBirdTone(
    startTime: number,
    dur: number,
    startHz: number,
    endHz: number,
    amp: number,
    pan: number,
    bus: AudioNode,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, startTime);
    osc.frequency.exponentialRampToValueAtTime(endHz, startTime + dur);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(amp, startTime + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0004, startTime + dur);
    osc.connect(env);
    this.routeNodeToBus(env, bus, pan);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  public playLivestockSound(
    species: LivestockSpeciesKind,
    worldX?: number,
    worldZ?: number,
  ): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastLivestockMs < 3200) return;
    this.lastLivestockMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 34);
    if (spatial.gain < 0.12) return;

    const now = this.ctx.currentTime;
    const amp = spatial.gain * 0.085;

    if (species === 'cattle') {
      // Warm deep bovine moo through vowel formant
      const osc = this.ctx.createOscillator();
      const form = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(98, now);
      osc.frequency.linearRampToValueAtTime(124, now + 0.25);
      osc.frequency.linearRampToValueAtTime(86, now + 0.72);
      form.type = 'bandpass';
      form.frequency.setValueAtTime(420, now);
      form.Q.value = 3.2;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + 0.12);
      env.gain.exponentialRampToValueAtTime(0.0004, now + 0.75);
      osc.connect(form);
      form.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      osc.stop(now + 0.78);
    } else if (species === 'goat') {
      // Tremolo nasal goat bleat
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      const form = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(248, now);
      osc.frequency.linearRampToValueAtTime(215, now + 0.42);
      lfo.frequency.setValueAtTime(15, now);
      lfoG.gain.value = 16;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      form.type = 'bandpass';
      form.frequency.setValueAtTime(1240, now);
      form.Q.value = 3.8;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp * 0.72, now + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0004, now + 0.44);
      osc.connect(form);
      form.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.46);
      lfo.stop(now + 0.46);
    } else {
      // Staccato chicken clucks
      for (let c = 0; c < 3; c++) {
        const t = now + c * 0.11;
        const osc = this.ctx.createOscillator();
        const form = this.ctx.createBiquadFilter();
        const env = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(410 + c * 35, t);
        osc.frequency.exponentialRampToValueAtTime(640, t + 0.045);
        form.type = 'bandpass';
        form.frequency.setValueAtTime(1380, t);
        form.Q.value = 3.5;
        env.gain.setValueAtTime(amp * 0.65, t);
        env.gain.exponentialRampToValueAtTime(0.0004, t + 0.065);
        osc.connect(form);
        form.connect(env);
        this.routeNodeToBus(env, this.sfxBus, spatial.pan);
        osc.start(t);
        osc.stop(t + 0.07);
      }
    }
  }

  // ==========================================================================
  // UI, SELECTION, COMBAT, BUILDING COMPLETION & OCCASION TONES
  // ==========================================================================

  public playUiClick(pitchMultiplier = 1.0): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(205 * pitchMultiplier, now + 0.06);
    env.gain.setValueAtTime(0.13, now);
    env.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
    osc.connect(env);
    env.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playSelectEntity(
    category: 'character' | 'building' | 'resource_node',
    worldX?: number,
    worldZ?: number,
    voiceSeed?: number,
  ): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;

    const now = this.ctx.currentTime;
    const baseFreq = category === 'character' ? 392 : category === 'building' ? 261.63 : 329.63;

    [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.042;
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(0.1, start);
      env.gain.exponentialRampToValueAtTime(0.0008, start + 0.21);
      osc.connect(env);
      env.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.23);
    });

    if (category === 'character') {
      this.playVillagerVoice('command', worldX, worldZ, voiceSeed ?? 3);
    }
  }

  public playKingdomFounded(): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;

    const now = this.ctx.currentTime;
    // Ceremonial brass/horn chord + uplifting kora arpeggio + deep royal drum
    const chord = [146.83, 220.0, 293.66, 369.99, 440.0, 587.33];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      lp.type = 'lowpass';
      lp.frequency.value = idx < 2 ? 950 : 2800;
      const t0 = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t0);
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.11, t0 + 0.07);
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.55);
      osc.connect(lp);
      lp.connect(env);
      env.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 1.6);
    });
    this.playDjembeHit(now, 0.16, true);
    this.playDjembeHit(now + 0.18, 0.12, false);
  }

  /**
   * Triumphant golden chord chime + joyful village cheers & rhythmic hand-claps
   * triggered when a building finishes construction.
   */
  public playBuildingCompleted(worldX?: number, worldZ?: number): void {
    this.unlockAndStartMusic();
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;

    const spatial = this.computeSpatialParams(worldX, worldZ, 64);
    const gainScale = Math.max(0.55, spatial.gain);
    const now = this.ctx.currentTime;

    // 1. Uplifting Golden Harmonic Bell & Kora Fanfare (D4 - F#4 - A4 - D5 - A5)
    const notes = [293.66, 369.99, 440.0, 587.33, 880.0];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxBus) return;
      const t0 = now + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const chime = this.ctx.createOscillator();
      const chimeG = this.ctx.createGain();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      chime.type = 'sine';
      chime.frequency.setValueAtTime(freq * 2, t0);
      chimeG.gain.setValueAtTime(0.32, t0);
      chimeG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(0.11 * gainScale, t0 + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.45);

      osc.connect(env);
      chime.connect(chimeG);
      chimeG.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan * 0.6);

      osc.start(t0);
      chime.start(t0);
      osc.stop(t0 + 1.5);
      chime.stop(t0 + 0.7);
    });

    // 2. Joyous Brief Village Cheers (overlapping warm vocal celebrations)
    const cheerStarts = [0.16, 0.24, 0.34];
    cheerStarts.forEach((offset, idx) => {
      const f0 = idx === 1 ? 235 : idx === 2 ? 205 : 142;
      this.triggerVocalSyllable(
        now + offset,
        0.26,
        f0,
        [730, 1090], // "Ah!"
        [540, 1820], // upward cheer inflection
        0.085 * gainScale,
        spatial.pan + (idx - 1) * 0.25,
        true,
      );
    });

    // 3. Staggered Festive Hand-Claps
    for (let c = 0; c < 5; c++) {
      const clapT = now + 0.22 + c * 0.115 + Math.random() * 0.025;
      this.triggerFilteredNoiseBurst(
        clapT,
        0.065,
        1550 + c * 140,
        1.1,
        0.075 * gainScale,
        Math.max(-0.8, Math.min(0.8, spatial.pan + (c - 2) * 0.22)),
      );
    }
  }

  public playCombatHit(kind: 'sword' | 'bow' | 'siege', worldX?: number, worldZ?: number): void {
    if (!this.isAudioReady() || !this.ctx || !this.sfxBus) return;
    const nowMs = performance.now();
    if (nowMs - this.lastCombatSfxMs < 220) return;
    this.lastCombatSfxMs = nowMs;

    const spatial = this.computeSpatialParams(worldX, worldZ, 52);
    if (spatial.gain < 0.08) return;

    const now = this.ctx.currentTime;
    const amp = spatial.gain;

    if (kind === 'bow') {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(510, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.12);
      env.gain.setValueAtTime(amp * 0.095, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.13);
      osc.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      osc.stop(now + 0.14);
      this.triggerFilteredNoiseBurst(now, 0.08, 3600, 1.5, amp * 0.055, spatial.pan);
    } else if (kind === 'siege') {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.34);
      env.gain.setValueAtTime(amp * 0.18, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);
      osc.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      osc.stop(now + 0.38);
      this.triggerFilteredNoiseBurst(now, 0.25, 420, 0.7, amp * 0.12, spatial.pan);
    } else {
      // Bronze blade / wooden shield clash
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980 + Math.random() * 180, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.085);
      env.gain.setValueAtTime(amp * 0.068, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);
      osc.connect(env);
      this.routeNodeToBus(env, this.sfxBus, spatial.pan);
      osc.start(now);
      osc.stop(now + 0.12);
      this.triggerFilteredNoiseBurst(now, 0.05, 2900, 2.0, amp * 0.06, spatial.pan);
    }
  }

  public playAlert(kind: AlertToneKind, worldX?: number, worldZ?: number): void {
    if (kind === 'complete') {
      this.playBuildingCompleted(worldX, worldZ);
      return;
    }

    this.unlockAndStartMusic();
    if (!this.ctx || !this.sfxBus || this.settings.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastAlertSfxMs < 820) return;
    this.lastAlertSfxMs = nowMs;

    const now = this.ctx.currentTime;

    if (kind === 'war') {
      // Deep ivory/bronze war horn + urgent twin djembe
      const horn = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      horn.type = 'sawtooth';
      horn.frequency.setValueAtTime(138.59, now);
      horn.frequency.linearRampToValueAtTime(146.83, now + 0.18);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(720, now);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.14, now + 0.1);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.95);
      horn.connect(lp);
      lp.connect(env);
      env.connect(this.sfxBus);
      horn.start(now);
      horn.stop(now + 1.0);
      this.playDjembeHit(now, 0.16, true);
      this.playDjembeHit(now + 0.22, 0.14, true);
      return;
    }

    const notes =
      kind === 'peace'
        ? [293.66, 392.0, 440.0, 587.33]
        : kind === 'research'
          ? [329.63, 440.0, 554.37, 659.25]
          : kind === 'recruit'
            ? [220.0, 293.66, 392.0]
            : [220.0, 196.0];

    notes.forEach((f, idx) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.095;
      osc.frequency.setValueAtTime(f, t0);
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(0.11, t0 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.52);
      osc.connect(env);
      env.connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const stopSrc = (src: AudioBufferSourceNode | null) => {
      if (!src) return;
      try {
        src.stop();
      } catch {
        // already stopped
      }
      src.disconnect();
    };
    stopSrc(this.windSource);
    stopSrc(this.foliageSource);
    stopSrc(this.riverLowSource);
    stopSrc(this.riverHighSource);
    stopSrc(this.villageHumSource);
    this.windSource = null;
    this.foliageSource = null;
    this.riverLowSource = null;
    this.riverHighSource = null;
    this.villageHumSource = null;

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new AkanuSoundEngine();
