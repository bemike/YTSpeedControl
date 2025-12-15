/**
 * YT Speed Control - Popup Script
 * Handles UI interactions and communicates with content script
 */

// Constants
const MIN_SPEED = 0.25;
const MAX_SPEED = 3.0;
const SPEED_STEP = 0.25;
const PRESET_SPEEDS = [1, 1.5, 2, 3];

// DOM Elements
const speedValue = document.getElementById('speedValue');
const speedSlider = document.getElementById('speedSlider');
const decrementBtn = document.getElementById('decrementBtn');
const incrementBtn = document.getElementById('incrementBtn');
const presetBtns = document.querySelectorAll('.preset-btn');

// State
let currentSpeed = 1.0;

/**
 * Initialize popup
 */
async function init() {
  // Load saved speed from storage
  const result = await chrome.storage.sync.get(['playbackSpeed']);
  currentSpeed = result.playbackSpeed || 1.0;
  updateUI(currentSpeed);
}

/**
 * Update UI to reflect current speed
 */
function updateUI(speed) {
  // Update display
  speedValue.textContent = speed.toFixed(2).replace(/\.?0+$/, '');
  speedValue.classList.add('updating');
  setTimeout(() => speedValue.classList.remove('updating'), 300);
  
  // Update slider
  speedSlider.value = speed;
  
  // Update preset buttons
  presetBtns.forEach(btn => {
    const btnSpeed = parseFloat(btn.dataset.speed);
    btn.classList.toggle('active', Math.abs(btnSpeed - speed) < 0.01);
  });
}

/**
 * Set playback speed and save to storage
 */
async function setSpeed(speed) {
  // Clamp speed to valid range
  speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
  // Round to nearest step
  speed = Math.round(speed / SPEED_STEP) * SPEED_STEP;
  
  currentSpeed = speed;
  
  // Save to storage
  await chrome.storage.sync.set({ playbackSpeed: speed });
  
  // Update UI
  updateUI(speed);
  
  // Send message to content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.includes('youtube.com')) {
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'setSpeed', 
        speed: speed 
      });
    }
  } catch (error) {
    console.log('Could not send message to content script:', error);
  }
}

/**
 * Increment speed by step
 */
function incrementSpeed() {
  setSpeed(currentSpeed + SPEED_STEP);
}

/**
 * Decrement speed by step
 */
function decrementSpeed() {
  setSpeed(currentSpeed - SPEED_STEP);
}

// Event Listeners

speedSlider.addEventListener('input', (e) => {
  setSpeed(parseFloat(e.target.value));
});

decrementBtn.addEventListener('click', decrementSpeed);
incrementBtn.addEventListener('click', incrementSpeed);

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const speed = parseFloat(btn.dataset.speed);
    setSpeed(speed);
  });
});

// Listen for speed updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'speedUpdated') {
    currentSpeed = message.speed;
    updateUI(message.speed);
  }
});

// Initialize
init();
