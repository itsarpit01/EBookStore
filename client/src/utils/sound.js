// client/src/utils/sound.js

export const playNotificationSound = () => {
  const audio = new Audio("/sounds/notification.mp3");
  audio.play().catch((err) => console.log("Sound play error:", err));
};