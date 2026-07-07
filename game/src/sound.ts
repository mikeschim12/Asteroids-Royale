let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, duration: number, type: OscillatorType, gain: number) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function noiseBurst(duration: number, gain: number) {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(c.destination);
  src.start();
}

export function resumeAudio(): void {
  const c = getCtx();
  if (c.state === "suspended") c.resume();
}

export function playFire(): void {
  beep(880, 0.05, "square", 0.05);
}

export function playExplosion(size: 1 | 2 | 3 = 2): void {
  noiseBurst(0.15 + size * 0.05, 0.15);
}

export function playHit(): void {
  beep(120, 0.15, "sawtooth", 0.1);
}

export function playThrust(): void {
  noiseBurst(0.05, 0.02);
}

export function playPickup(): void {
  beep(660, 0.08, "sine", 0.08);
  const c = getCtx();
  setTimeout(() => {
    if (c.state !== "closed") beep(990, 0.1, "sine", 0.08);
  }, 60);
}
