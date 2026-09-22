let audioContext: AudioContext | null = null;

export function playAddToCartSound() {
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  const play = () => {
    audioContext ??= new window.AudioContext();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.075);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  };

  try {
    if (audioContext?.state === "suspended") {
      void audioContext.resume().then(play).catch(() => undefined);
      return;
    }

    play();
  } catch {
    // Audio support is optional and must never block a successful cart update.
  }
}
