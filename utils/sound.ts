
class SoundManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  play(type: 'play' | 'draw' | 'uno' | 'win' | 'turn' | 'error' | 'shuffle' | 'whoosh' | 'land') {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;
      
      // Common gain node for master volume if needed
      const masterGain = this.ctx.createGain();
      masterGain.connect(this.ctx.destination);
      masterGain.gain.value = 0.8;

      switch (type) {
        case 'whoosh':
            // Card flying through air - White noise filter sweep
            const wOsc = this.ctx.createOscillator();
            const wGain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            // Create noise buffer
            const bSize = this.ctx.sampleRate * 0.5;
            const buffer = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bSize; i++) data[i] = Math.random() * 2 - 1;
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, t);
            filter.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
            
            wGain.gain.setValueAtTime(0.3, t);
            wGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            
            noise.connect(filter);
            filter.connect(wGain);
            wGain.connect(masterGain);
            
            noise.start(t);
            break;

        case 'land':
            // Card hitting the pile - Crisp snap
            const lOsc = this.ctx.createOscillator();
            const lGain = this.ctx.createGain();
            
            lOsc.frequency.setValueAtTime(150, t);
            lOsc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            
            lGain.gain.setValueAtTime(0.5, t);
            lGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            
            lOsc.connect(lGain);
            lGain.connect(masterGain);
            lOsc.start(t);
            lOsc.stop(t + 0.1);
            
            // High frequency snap
            const snap = this.ctx.createOscillator();
            const snapGain = this.ctx.createGain();
            snap.type = 'triangle';
            snap.frequency.setValueAtTime(3000, t);
            snap.frequency.exponentialRampToValueAtTime(500, t + 0.05);
            snapGain.gain.setValueAtTime(0.1, t);
            snapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            snap.connect(snapGain);
            snapGain.connect(masterGain);
            snap.start(t);
            snap.stop(t + 0.05);
            break;

        case 'play':
          // Keeping generic play for other interactions if needed
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(masterGain);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, t);
          osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
          break;

        case 'draw':
          const dOsc = this.ctx.createOscillator();
          const dGain = this.ctx.createGain();
          dOsc.connect(dGain);
          dGain.connect(masterGain);
          dOsc.type = 'triangle';
          dOsc.frequency.setValueAtTime(400, t);
          dOsc.frequency.linearRampToValueAtTime(600, t + 0.1);
          dGain.gain.setValueAtTime(0.15, t);
          dGain.gain.linearRampToValueAtTime(0.01, t + 0.1);
          dOsc.start(t);
          dOsc.stop(t + 0.1);
          break;

        case 'turn':
          const tOsc = this.ctx.createOscillator();
          const tGain = this.ctx.createGain();
          tOsc.connect(tGain);
          tGain.connect(masterGain);
          tOsc.type = 'sine';
          tOsc.frequency.setValueAtTime(880, t);
          tGain.gain.setValueAtTime(0.1, t);
          tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          tOsc.start(t);
          tOsc.stop(t + 0.5);
          break;

        case 'uno':
          [440, 554, 659].forEach((freq, i) => {
              const o = this.ctx!.createOscillator();
              const g = this.ctx!.createGain();
              o.connect(g);
              g.connect(masterGain);
              o.type = 'square';
              o.frequency.setValueAtTime(freq, t + i * 0.08);
              g.gain.setValueAtTime(0.05, t + i * 0.08);
              g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.3);
              o.start(t + i * 0.08);
              o.stop(t + i * 0.08 + 0.3);
          });
          break;

        case 'win':
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
              const o = this.ctx!.createOscillator();
              const g = this.ctx!.createGain();
              o.connect(g);
              g.connect(masterGain);
              o.type = 'sawtooth';
              o.frequency.setValueAtTime(freq, t);
              g.gain.setValueAtTime(0.05, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
              o.start(t);
              o.stop(t + 1.5);
          });
          break;

         case 'error':
          const eOsc = this.ctx.createOscillator();
          const eGain = this.ctx.createGain();
          eOsc.connect(eGain);
          eGain.connect(masterGain);
          eOsc.type = 'sawtooth';
          eOsc.frequency.setValueAtTime(150, t);
          eOsc.frequency.linearRampToValueAtTime(100, t + 0.15);
          eGain.gain.setValueAtTime(0.1, t);
          eGain.gain.linearRampToValueAtTime(0.01, t + 0.15);
          eOsc.start(t);
          eOsc.stop(t + 0.15);
          break;

         case 'shuffle':
          const buffSize = this.ctx.sampleRate * 0.2;
          const buff = this.ctx.createBuffer(1, buffSize, this.ctx.sampleRate);
          const dat = buff.getChannelData(0);
          for (let i = 0; i < buffSize; i++) dat[i] = Math.random() * 2 - 1;
          const n = this.ctx.createBufferSource();
          n.buffer = buff;
          const nGain = this.ctx.createGain();
          nGain.gain.setValueAtTime(0.2, t);
          nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          n.connect(nGain);
          nGain.connect(masterGain);
          n.start(t);
          break;
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  }
}

export const soundManager = new SoundManager();
