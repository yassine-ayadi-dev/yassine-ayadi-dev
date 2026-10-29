/**
 * Procedural Calm Music Synthesizer (Web Audio API)
 * Lush ambient chords, gentle pentatonic bell chimes, warm sub-bass, and soft tape warmth.
 * 100% Procedural — zero external audio files.
 */

export type MusicTheme = 'twilight' | 'cozy' | 'rainy';

class CalmAudioManager {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private intervalId: number | null = null;
  private chimeIntervalId: number | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private currentChordIndex = 0;
  private volume = 0.65;
  private currentTheme: MusicTheme = 'twilight';

  public onBeat?: (intensity: number) => void;
  public onPlayStateChange?: (playing: boolean) => void;

  // Soothing chord progressions (warm jazz/ambient 7th & 9th chords in Hz)
  private themes: Record<MusicTheme, { name: string; chords: number[][]; filterFreq: number }> = {
    twilight: {
      name: 'Calm Twilight (Ambient Synth & Bells)',
      filterFreq: 680,
      chords: [
        // Cmaj9 (C3, E3, G3, B3, D4)
        [130.81, 164.81, 196.0, 246.94, 293.66],
        // Am9 (A2, C3, E3, G3, B3)
        [110.0, 130.81, 164.81, 196.0, 246.94],
        // Fmaj7#11 (F2, A2, C3, E3, B3)
        [87.31, 110.0, 130.81, 164.81, 246.94],
        // Gsus4 / D (G2, D3, G3, C4, D4)
        [98.0, 146.83, 196.0, 261.63, 293.66],
      ],
    },
    cozy: {
      name: 'Cozy Room (Warm Lofi Piano)',
      filterFreq: 520,
      chords: [
        // Dmaj7 (D3, F#3, A3, C#4)
        [146.83, 185.0, 220.0, 277.18],
        // Bm7 (B2, D3, F#3, A3)
        [123.47, 146.83, 185.0, 220.0],
        // Gmaj7 (G2, B2, D3, F#3)
        [98.0, 123.47, 146.83, 185.0],
        // Asus4 (A2, D3, E3, A3)
        [110.0, 146.83, 164.81, 220.0],
      ],
    },
    rainy: {
      name: 'Night Rain (Deep Calm & Chimes)',
      filterFreq: 420,
      chords: [
        // Ebmaj9
        [155.56, 196.0, 233.08, 293.66, 349.23],
        // Cm9
        [130.81, 155.56, 196.0, 233.08, 293.66],
        // Abmaj7
        [103.83, 130.81, 155.56, 207.65],
        // Bb7sus4
        [116.54, 155.56, 174.61, 233.08],
      ],
    },
  };

  // Pentatonic chime scale frequencies (Hz) for gentle organic melodic drops
  private chimeFrequencies = [
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.0,  // A5
    1046.5, // C6
    1174.66 // D6
  ];

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(this.themes[this.currentTheme].filterFreq, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.musicGain.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.setupTapeWarmth();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Generates gentle subtle analog tape warmth / vinyl hiss texture
   */
  private setupTapeWarmth(): void {
    if (!this.ctx || !this.masterGain) return;

    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
        b6 = white * 0.115926;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(900, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.008, this.ctx.currentTime);

      this.noiseNode.connect(noiseFilter);
      noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);

      this.noiseNode.start();
    } catch {
      // Audio texture fallback
    }
  }

  public playClick(pitch = 560): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, this.ctx.currentTime + 0.07);

      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Plays a calm, gentle harmonic chord with rich overtones and deep sub-bass
   */
  private playChord(): void {
    if (!this.ctx || !this.musicGain || !this.isPlaying) return;

    const themeData = this.themes[this.currentTheme];
    const chords = themeData.chords;
    const chord = chords[this.currentChordIndex];
    this.currentChordIndex = (this.currentChordIndex + 1) % chords.length;

    const now = this.ctx.currentTime;
    const duration = 5.2;

    if (this.onBeat) {
      this.onBeat(0.9);
    }

    // Sub-bass root note (octave below)
    const rootFreq = chord[0] * 0.5;
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(rootFreq, now);

    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.linearRampToValueAtTime(0.08, now + 0.8);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    bassOsc.connect(bassGain);
    bassGain.connect(this.musicGain);

    bassOsc.start(now);
    bassOsc.stop(now + duration);

    // Warm chord notes
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.musicGain) return;

      // Primary oscillator (warm sine)
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      const detune = (idx - 2) * 4.5;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detune, now);

      // Secondary layered oscillator (warm triangle for body)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(-detune * 0.7, now);

      const targetGain = 0.055 / chord.length;

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(targetGain, now + 0.7 + idx * 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(targetGain * 0.4, now + 0.9);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(noteGain);
      noteGain.connect(this.musicGain);

      osc2.connect(gain2);
      gain2.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + duration);

      osc2.start(now);
      osc2.stop(now + duration);
    });
  }

  /**
   * Spawns gentle, sporadic pentatonic bell chimes
   */
  private triggerGentleChime(): void {
    if (!this.ctx || !this.musicGain || !this.isPlaying) return;

    const randomIndex = Math.floor(Math.random() * this.chimeFrequencies.length);
    const freq = this.chimeFrequencies[randomIndex];
    const now = this.ctx.currentTime;
    const duration = 2.4;

    const chimeOsc = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();

    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(freq, now);

    chimeGain.gain.setValueAtTime(0.001, now);
    chimeGain.gain.linearRampToValueAtTime(0.025, now + 0.06);
    chimeGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(this.musicGain);

    chimeOsc.start(now);
    chimeOsc.stop(now + duration);

    if (this.onBeat && Math.random() > 0.4) {
      this.onBeat(0.4);
    }
  }

  public toggle(): boolean {
    this.initContext();
    if (!this.ctx || !this.musicGain) return false;

    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      this.play();
      return true;
    }
  }

  public play(): void {
    this.initContext();
    if (!this.ctx || !this.musicGain || this.isPlaying) return;

    this.isPlaying = true;

    // Smooth volume fade-in
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.001, now);
    this.musicGain.gain.linearRampToValueAtTime(1.0, now + 1.2);

    this.playChord();
    this.intervalId = window.setInterval(() => {
      this.playChord();
    }, 5400);

    // Staggered chime notes
    this.chimeIntervalId = window.setInterval(() => {
      if (Math.random() > 0.3) {
        this.triggerGentleChime();
      }
    }, 1800);

    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.linearRampToValueAtTime(0.001, now + 0.8);
    }

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.chimeIntervalId !== null) {
      window.clearInterval(this.chimeIntervalId);
      this.chimeIntervalId = null;
    }

    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setTheme(theme: MusicTheme): void {
    this.currentTheme = theme;
    if (this.ctx && this.filterNode) {
      const freq = this.themes[theme].filterFreq;
      this.filterNode.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 1.0);
    }
    this.currentChordIndex = 0;
    if (this.isPlaying) {
      this.playChord();
    }
  }

  public getCurrentTheme(): MusicTheme {
    return this.currentTheme;
  }

  public getCurrentThemeName(): string {
    return this.themes[this.currentTheme].name;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioManager = new CalmAudioManager();
