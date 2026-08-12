const SOUND_KEY = "wilderden-sound-v1";

let context = null;
let master = null;
let enabled = localStorage.getItem(SOUND_KEY) !== "off";

function audioContext() {
  if (!enabled) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.34;
    master.connect(context.destination);
  }
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

function tone(frequency, duration = 0.08, options = {}) {
  const ctx = audioContext();
  if (!ctx || !master) return;
  const now = ctx.currentTime + Number(options.delay || 0);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), now);
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.to), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(options.gain || 0.11)), now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function noise(duration = 0.07, gainValue = 0.07, delay = 0) {
  const ctx = audioContext();
  if (!ctx || !master) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.8;
  gain.gain.value = gainValue;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(ctx.currentTime + delay);
}

const patterns = {
  click() { tone(520, 0.035, { gain: 0.045, to: 650, type: "triangle" }); },
  nav() { tone(380, 0.055, { gain: 0.055, to: 510, type: "triangle" }); },
  attack() { noise(0.06, 0.07); tone(135, 0.07, { gain: 0.08, to: 80, type: "sawtooth" }); },
  enemyAttack() { noise(0.08, 0.075); tone(95, 0.09, { gain: 0.085, to: 55, type: "square" }); },
  ability() { tone(420, 0.15, { gain: 0.08, to: 880, type: "sine" }); tone(630, 0.13, { gain: 0.055, to: 1180, delay: 0.025 }); },
  critical() { noise(0.1, 0.1); tone(185, 0.11, { gain: 0.12, to: 65, type: "square" }); tone(910, 0.09, { gain: 0.06, to: 1480 }); },
  heal() { tone(440, 0.18, { gain: 0.065, to: 660 }); tone(660, 0.2, { gain: 0.055, to: 990, delay: 0.08 }); },
  loot() { tone(620, 0.09, { gain: 0.06, to: 760, type: "triangle" }); tone(900, 0.12, { gain: 0.06, to: 1120, delay: 0.07 }); },
  success() { tone(392, 0.13, { gain: 0.07, to: 523 }); tone(523, 0.15, { gain: 0.07, to: 659, delay: 0.1 }); tone(659, 0.23, { gain: 0.075, to: 784, delay: 0.2 }); },
  victory() { tone(330, 0.14, { gain: 0.08, to: 440 }); tone(440, 0.16, { gain: 0.075, to: 660, delay: 0.11 }); tone(660, 0.28, { gain: 0.09, to: 880, delay: 0.23 }); },
  defeat() { tone(260, 0.2, { gain: 0.08, to: 185, type: "triangle" }); tone(185, 0.35, { gain: 0.07, to: 110, delay: 0.15, type: "triangle" }); },
  error() { tone(145, 0.11, { gain: 0.075, to: 110, type: "square" }); tone(135, 0.12, { gain: 0.06, to: 95, delay: 0.12, type: "square" }); },
};

export function playSound(name) {
  if (!enabled) return;
  const pattern = patterns[name] || patterns.click;
  try { pattern(); } catch { /* Sound should never block gameplay. */ }
}

export function soundEnabled() {
  return enabled;
}

export function setSoundEnabled(next) {
  enabled = Boolean(next);
  localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  if (enabled) {
    audioContext();
    playSound("success");
  }
  return enabled;
}

export function toggleSound() {
  return setSoundEnabled(!enabled);
}
