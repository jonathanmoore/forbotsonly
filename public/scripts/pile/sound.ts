/**
 * Very minimal sound design for the bot pile: soft synthesized thuds with a
 * hint of squish. No samples, no loops — quiet, low-passed, throttled.
 */
export class PileSound {
  muted = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlay = 0;

  /** Must be called from a user gesture at least once to unlock audio. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.05; // dialed way down for barely-there texture (#164)
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.buildNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Soft impact thud.
   * @param intensity 0..1 impact strength
   * @param size 0..1 normalized bot size (bigger = deeper)
   */
  thud(intensity: number, size: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    // Throttle so a settling pile stays quiet, not noisy.
    if (now - this.lastPlay < 0.05) return;
    this.lastPlay = now;

    const clampedIntensity = Math.min(1, Math.max(0, intensity));
    const level = 0.008 + 0.055 * Math.pow(clampedIntensity, 1.8); // barely-there texture (#164)

    // Body: a low sine with a quick pitch drop. Harder hits = slightly higher pitch.
    const baseFreq = 150 - 70 * Math.min(1, Math.max(0, size));
    const freq = baseFreq * (1 + clampedIntensity * 0.15);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.09);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(level, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(oscGain).connect(master);
    osc.start(now);
    osc.stop(now + 0.16);

    // Squish texture: a whisper of low-passed noise.
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340 + 260 * intensity;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(level * 0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      noise.connect(filter).connect(noiseGain).connect(master);
      noise.start(now);
      noise.stop(now + 0.1);
    }
  }

  private buildNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }
}
