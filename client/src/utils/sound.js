// client/src/utils/sound.js

let audioInstance = null;

// Initialize & pre-cache audio
const getAudio = () => {
  if (!audioInstance && typeof window !== "undefined") {
    audioInstance = new Audio("/sounds/notification.mp3");
    audioInstance.preload = "auto";
  }
  return audioInstance;
};

// User ke pehle click par audio unlock karne ke liye
export const unlockAudio = () => {
  const audio = getAudio();
  if (audio) {
    audio.load();
  }
};

// Play alert sound function
export const playNotificationSound = () => {
  try {
    const audio = getAudio();
    if (!audio) return;

    // Reset playback position so back-to-back alerts play from the start
    audio.currentTime = 0;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Log silently if browser autoplay policy blocks un-interacted tabs
        console.warn("Audio autoplay blocked until user interacts with the page:", err.message);
      });
    }
  } catch (err) {
    console.error("Failed to play notification sound:", err);
  }
};