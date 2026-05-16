document.querySelectorAll('.colorPick input[type="color"]').forEach((input) => {
  const label = input.closest('.colorPick')?.querySelector('span');
  const update = () => {
    if (!label) return;
    label.textContent = input.value;
    label.style.setProperty('--picked', input.value);
  };
  input.addEventListener('input', update);
  update();
});

const audio = document.getElementById('pageAudio');
const audioControl = document.querySelector('[data-audio-control]');
const volumeSlider = document.querySelector('[data-volume-slider]');
const volumeLabel = document.querySelector('[data-volume-label]');
const musicButton = document.querySelector('[data-music-toggle]');
const musicHint = document.querySelector('[data-music-hint]');
let visitorPausedMusic = false;

function setAudioVolume(value) {
  if (!audio) return;
  const amount = Math.max(0, Math.min(100, Number(value || 0)));
  audio.volume = amount / 100;
  if (volumeLabel) volumeLabel.textContent = amount;
  try { localStorage.setItem('worries_volume', String(amount)); } catch (err) {}
}

function setMusicState(isPlaying, blocked = false) {
  if (musicButton) musicButton.classList.toggle('playing', Boolean(isPlaying));
  if (audioControl) audioControl.dataset.needsStart = blocked ? 'true' : 'false';
  if (musicHint) musicHint.textContent = blocked ? 'tap to play' : (isPlaying ? 'playing' : 'paused');
}

async function startProfileSong({ fromUserGesture = false } = {}) {
  if (!audio || visitorPausedMusic) return false;

  try {
    await audio.play();
    setMusicState(true, false);
    return true;
  } catch (err) {
    // Most browsers block autoplay with sound until the visitor interacts.
    // After the first click/touch/key press, this function is called again and the song starts.
    if (!fromUserGesture) setMusicState(false, true);
    return false;
  }
}

if (audio) {
  const savedVolume = (() => {
    try { return localStorage.getItem('worries_volume'); } catch (err) { return null; }
  })();

  if (volumeSlider && savedVolume !== null) volumeSlider.value = savedVolume;
  setAudioVolume(volumeSlider ? volumeSlider.value : 45);

  audio.addEventListener('play', () => setMusicState(true, false));
  audio.addEventListener('pause', () => setMusicState(false, false));

  // Try immediately for browsers that allow autoplay.
  startProfileSong();

  // If autoplay is blocked, start on the visitor's first page interaction.
  const unlockSong = () => startProfileSong({ fromUserGesture: true });
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((eventName) => {
    document.addEventListener(eventName, unlockSong, { once: true, passive: true });
  });
}

if (audio && volumeSlider) {
  volumeSlider.addEventListener('input', () => {
    setAudioVolume(volumeSlider.value);
    if (audio.paused && !visitorPausedMusic) startProfileSong({ fromUserGesture: true });
  });
}

document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-music-toggle]');
  if (!btn || !audio) return;

  event.preventDefault();

  if (audio.paused) {
    visitorPausedMusic = false;
    await startProfileSong({ fromUserGesture: true });
  } else {
    visitorPausedMusic = true;
    audio.pause();
    setMusicState(false, false);
  }
});

document.querySelectorAll('.uploadButtonLabel input[type="file"]').forEach((input) => {
  const label = input.closest('.uploadButtonLabel');
  const fileName = label?.querySelector('[data-file-name]');
  input.addEventListener('change', () => {
    if (!fileName) return;
    fileName.textContent = input.files && input.files.length ? input.files[0].name : 'No file selected';
  });
});
