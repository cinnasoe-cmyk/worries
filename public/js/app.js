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
const volumeSlider = document.querySelector('[data-volume-slider]');
const volumeLabel = document.querySelector('[data-volume-label]');
const musicButton = document.querySelector('[data-music-toggle]');

function setAudioVolume(value) {
  if (!audio) return;
  const amount = Math.max(0, Math.min(100, Number(value || 0)));
  audio.volume = amount / 100;
  if (volumeLabel) volumeLabel.textContent = amount;
}

if (audio && volumeSlider) {
  setAudioVolume(volumeSlider.value);
  volumeSlider.addEventListener('input', () => setAudioVolume(volumeSlider.value));

  // Browsers often block autoplay with sound. This tries, then falls back to the visitor tapping the music button.
  audio.play().then(() => {
    if (musicButton) musicButton.classList.add('playing');
  }).catch(() => {
    if (musicButton) musicButton.classList.remove('playing');
  });
}

document.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-music-toggle]');
  if (!btn || !audio) return;

  if (audio.paused) {
    try {
      await audio.play();
      btn.classList.add('playing');
    } catch (err) {
      btn.classList.remove('playing');
    }
  } else {
    audio.pause();
    btn.classList.remove('playing');
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
