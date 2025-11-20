
class SoundManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  play(type: 'play' | 'draw' | 'uno' | 'win' | 'turn' | 'error' | 'shuffle') {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      switch (type) {
        case 'play':
          // "Thwip" sound
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, t);
          osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        case 'draw':
          // "Zip" sound
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.linearRampToValueAtTime(600, t + 0.1);
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        case 'turn':
          // Soft bell
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, t);
          gain.gain.setValueAtTime(0.1, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          osc.start(t);
          osc.stop(t + 0.5);
          break;
        case 'uno':
          // Alert Arpeggio
          [440, 554, 659].forEach((freq, i) => {
              const o = this.ctx!.createOscillator();
              const g = this.ctx!.createGain();
              o.connect(g);
              g.connect(this.ctx!.destination);
              o.type = 'square';
              o.frequency.setValueAtTime(freq, t + i * 0.08);
              g.gain.setValueAtTime(0.05, t + i * 0.08);
              g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);
              o.start(t + i * 0.08);
              o.stop(t + i * 0.08 + 0.3);
          });
          break;
        case 'win':
          // Victory Major Chord
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
              const o = this.ctx!.createOscillator();
              const g = this.ctx!.createGain();
              o.connect(g);
              g.connect(this.ctx!.destination);
              o.type = 'sawtooth';
              o.frequency.setValueAtTime(freq, t);
              g.gain.setValueAtTime(0.05, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
              o.start(t);
              o.stop(t + 1.5);
          });
          break;
         case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.linearRampToValueAtTime(100, t + 0.15);
          gain.gain.setValueAtTime(0.1, t);
          gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
          break;
         case 'shuffle':
          // Noise burst
          const bufferSize = this.ctx.sampleRate * 0.2;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const noiseGain = this.ctx.createGain();
          noiseGain.gain.setValueAtTime(0.2, t);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          noise.connect(noiseGain);
          noiseGain.connect(this.ctx.destination);
          noise.start(t);
          break;
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  }
}

export const soundManager = new SoundManager();
