// Sound effects synthesised with the Web Audio API. No external files.
export const sound = {
  ctx: null,
  enabled: true,
  waka: false,
  init() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(from, to, duration, type = 'square', volume = 0.06) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  },
  pellet() {
    this.waka = !this.waka;
    this.tone(this.waka ? 440 : 330, this.waka ? 330 : 440, 0.08);
  },
  power() {
    this.tone(200, 400, 0.3, 'sawtooth');
  },
  ghost() {
    this.tone(400, 1200, 0.4, 'triangle');
  },
  death() {
    this.tone(600, 80, 1.2, 'sawtooth', 0.08);
  },
};
