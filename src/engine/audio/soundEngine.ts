import { AudioSettings } from '../../types/game';

/**
 * Zero-dependency Web Audio API procedural sound effects and African-inspired
 * marimba/kora pentatonic ambient score generator.
 */
export class AkanuSoundEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = {
    masterVolume: 0.75,
    musicVolume: 0.55,
    sfxVolume: 0.8,
    muted: false,
  };
  private musicTimer: number | null = null;
  private noteStep = 0;

  // Warm African-inspired pentatonic frequencies (D3, F3, G3, A3, C4, D4, F4, G4, A4)
  private readonly scaleHz = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0];
  private readonly pattern = [0, 3, 5, 4, 2, 5, 7, 5, 1, 3, 6, 4, 0, 2, 5, 3];

  public updateSettings(next: AudioSettings): void {
    this.settings = { ...next };
    if (this.settings.muted && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    } else if (!this.settings.muted && this.ctx && this.musicTimer === null) {
      this.startAmbientLoop();
    }
  }

  public unlockAndStartMusic(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.settings.muted && this.musicTimer === null) {
      this.startAmbientLoop();
    }
  }

  private getEffectiveSfxGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.sfxVolume));
  }

  private getEffectiveMusicGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.musicVolume));
  }

  private startAmbientLoop(): void {
    if (this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const gainLevel = this.getEffectiveMusicGain();
      if (gainLevel <= 0.01) return;

      const now = this.ctx.currentTime;
      const idx = this.pattern[this.noteStep % this.pattern.length];
      const freq = this.scaleHz[idx];

      // Wooden marimba / kalimba warm harmonic pluck
      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, now);

      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.18, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(gainLevel * 0.09, now + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 1.25);

      osc.connect(env);
      overtone.connect(overtoneGain);
      overtoneGain.connect(env);
      env.connect(this.ctx.destination);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 1.3);
      overtone.stop(now + 0.3);

      // Every 4th beat, soft warm gourd/djembe bass pulse
      if (this.noteStep % 4 === 0) {
        const drumOsc = this.ctx.createOscillator();
        const drumEnv = this.ctx.createGain();
        drumOsc.type = 'sine';
        drumOsc.frequency.setValueAtTime(98, now);
        drumOsc.frequency.exponentialRampToValueAtTime(52, now + 0.22);

        drumEnv.gain.setValueAtTime(gainLevel * 0.11, now);
        drumEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.32);

        drumOsc.connect(drumEnv);
        drumEnv.connect(this.ctx.destination);
        drumOsc.start(now);
        drumOsc.stop(now + 0.35);
      }

      this.noteStep++;
    }, 620);
  }

  public playUiClick(pitchMultiplier = 1.0): void {
    this.unlockAndStartMusic();
    if (!this.ctx) return;
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
    env.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playSelectEntity(category: 'character' | 'building' | 'resource_node'): void {
    this.unlockAndStartMusic();
    if (!this.ctx) return;
    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const baseFreq = category === 'character' ? 392 : category === 'building' ? 261.63 : 329.63;

    [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(vol * 0.12, start);
      env.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);
      osc.connect(env);
      env.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playKingdomFounded(): void {
    this.unlockAndStartMusic();
    if (!this.ctx) return;
    const vol = this.getEffectiveSfxGain();
    if (vol <= 0.01) return;

    const now = this.ctx.currentTime;
    const chord = [146.83, 220.0, 293.66, 440.0];
    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      const t0 = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t0);
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(vol * (idx === 0 ? 0.08 : 0.12), t0 + 0.08);
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.35);
      osc.connect(env);
      env.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.4);
    });
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new AkanuSoundEngine();
