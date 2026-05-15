document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-music-toggle]');
  if (!btn) return;
  const audio = document.getElementById('pageAudio');
  if (!audio) return;

  if (audio.paused) {
    try {
      await audio.play();
      btn.textContent = 'pause music';
    } catch (err) {
      btn.textContent = 'tap again';
    }
  } else {
    audio.pause();
    btn.textContent = 'play music';
  }
});
