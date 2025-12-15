/**
 * YT Speed Control - Content Script
 * Injects into YouTube pages to control video playback speed
 */

// Constants
const MIN_SPEED = 0.25;
const MAX_SPEED = 3.0;
const SPEED_STEP = 0.25;
const INDICATOR_DURATION = 2000;

// Speed presets for keyboard shortcuts
// Key codes are used instead of keys to handle Shift modifier correctly
// and to support Numpad
const KEY_CODE_MAP = {
    'Digit1': 1.0,
    'Digit2': 1.5,
    'Digit3': 2.0,
    'Digit4': 3.0,
    'Numpad1': 1.0,
    'Numpad2': 1.5,
    'Numpad3': 2.0,
    'Numpad4': 3.0
};

// State
let currentSpeed = 1.0;
let indicatorTimeout = null;
let indicator = null;

/**
 * Initialize the content script
 */
async function init() {
    // Load saved speed
    const result = await chrome.storage.sync.get(['playbackSpeed']);
    currentSpeed = result.playbackSpeed || 1.0;

    // Create speed indicator
    createIndicator();

    // Apply speed to video
    applySpeedToVideo();

    // Set up event listeners
    setupKeyboardShortcuts();
    setupNavigationListener();

    console.log('[YT Speed Control] Initialized with speed:', currentSpeed);
}

/**
 * Create the speed indicator element
 */
function createIndicator() {
    // Find the video element first
    const video = getVideoElement();

    // Try to find the player container relative to the video
    // This is more robust than global querySelector
    let playerContainer = null;
    if (video) {
        playerContainer = video.closest('.html5-video-player') || video.parentElement;
    }

    // Fallback to global query if video not found yet
    if (!playerContainer) {
        playerContainer = document.querySelector('.html5-video-player');
    }

    const target = playerContainer || document.body;

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'yt-speed-indicator';
        indicator.className = 'yt-speed-indicator';
    }

    // Always ensure it's appended to the current target
    if (indicator.parentNode !== target) {
        target.appendChild(indicator);
        // Ensure the target is positioned so absolute positioning works
        const computedStyle = window.getComputedStyle(target);
        if (computedStyle.position === 'static' && target !== document.body) {
            // We avoid modifying body position
            // But for player container, it should be relative/absolute
            // If it's not, we might need to force it, but that's risky.
            // Usually .html5-video-player is relative.
        }
    }
}

/**
 * Show the speed indicator with current speed
 */
function showIndicator(speed, message = null) {
    // Ensure indicator exists and is attached to DOM
    if (!indicator || !indicator.isConnected) {
        createIndicator();
    }

    // Set content
    const displayText = message || `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
    indicator.innerHTML = `<span class="indicator-speed">${displayText}</span>`;

    // Show indicator
    indicator.classList.add('visible');

    // Clear existing timeout
    if (indicatorTimeout) {
        clearTimeout(indicatorTimeout);
    }

    // Hide after duration
    indicatorTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, INDICATOR_DURATION);
}

/**
 * Get the YouTube video element
 */
function getVideoElement() {
    return document.querySelector('video.html5-main-video') ||
        document.querySelector('video');
}

/**
 * Apply current speed to the video element
 */
function applySpeedToVideo() {
    const video = getVideoElement();
    if (video) {
        video.playbackRate = currentSpeed;
    }
}

/**
 * Set the playback speed
 */
async function setSpeed(speed, showMessage = null) {
    // Clamp speed to valid range
    speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    // Round to nearest step
    speed = Math.round(speed / SPEED_STEP) * SPEED_STEP;

    currentSpeed = speed;

    // Apply to video
    applySpeedToVideo();

    // Save to storage
    await chrome.storage.sync.set({ playbackSpeed: speed });

    // Show indicator
    showIndicator(speed, showMessage);

    // Notify popup if open
    try {
        chrome.runtime.sendMessage({
            action: 'speedUpdated',
            speed: speed
        });
    } catch (e) {
        // Popup might not be open
    }

    console.log('[YT Speed Control] Speed set to:', speed);
}

/**
 * Increment speed by step
 */
function incrementSpeed() {
    if (currentSpeed >= MAX_SPEED) {
        showIndicator(currentSpeed, 'MAX');
        return;
    }
    setSpeed(currentSpeed + SPEED_STEP);
}

/**
 * Decrement speed by step
 */
function decrementSpeed() {
    if (currentSpeed <= MIN_SPEED) {
        showIndicator(currentSpeed, 'MIN');
        return;
    }
    setSpeed(currentSpeed - SPEED_STEP);
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in input/textarea
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) {
            return;
        }

        // Shift + Number for preset speeds
        if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const preset = KEY_CODE_MAP[e.code];
            if (preset !== undefined) {
                e.preventDefault();
                e.stopPropagation();
                setSpeed(preset);
                return;
            }
        }

        // + or = key to increase speed
        if ((e.key === '+' || e.key === '=') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            incrementSpeed();
            return;
        }

        // - key to decrease speed
        if (e.key === '-' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            decrementSpeed();
            return;
        }
    }, true); // Use capture phase to intercept before YouTube
}

/**
 * Set up YouTube SPA navigation listener
 */
function setupNavigationListener() {
    // YouTube uses custom navigation events
    document.addEventListener('yt-navigate-finish', () => {
        console.log('[YT Speed Control] Navigation detected, reapplying speed');
        setTimeout(applySpeedToVideo, 500);
    });

    // Also watch for video element changes
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const video = getVideoElement();
                if (video && video.playbackRate !== currentSpeed) {
                    applySpeedToVideo();
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setSpeed') {
        setSpeed(message.speed);
        sendResponse({ success: true });
    }
    return true;
});

/**
 * Listen for storage changes (sync across tabs)
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.playbackSpeed) {
        const newSpeed = changes.playbackSpeed.newValue;
        if (newSpeed !== currentSpeed) {
            currentSpeed = newSpeed;
            applySpeedToVideo();
            // Don't show indicator for cross-tab sync
        }
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
