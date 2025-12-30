/**
 * YT Speed Control - Bilibili Content Script
 * Injects into Bilibili pages to control video playback speed
 */

// Constants
const MIN_SPEED = 0.25;
const MAX_SPEED = 3.0;
const SPEED_STEP = 0.25;
const INDICATOR_DURATION = 2000;

// Speed presets for keyboard shortcuts (Bilibili specific)
// Shift+2 -> 1.5x, Shift+3 -> 2.0x, Shift+4 -> 3x
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
    try {
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

        console.log('[YT Speed Control - Bilibili] Initialized with speed:', currentSpeed);
    } catch (e) {
        // Silently ignore errors (extension context may be invalidated)
    }
}

/**
 * Create the speed indicator element
 */
function createIndicator() {
    // Find the video element first
    const video = getVideoElement();

    // Try to find the player container relative to the video
    let playerContainer = null;
    if (video) {
        // Bilibili player container class
        playerContainer = video.closest('.bpx-player-video-wrap') ||
            video.closest('.bilibili-player-video-wrap') ||
            video.closest('.bpx-player-container') ||
            video.parentElement;
    }

    // Fallback to global query if video not found yet
    if (!playerContainer) {
        playerContainer = document.querySelector('.bpx-player-video-wrap') ||
            document.querySelector('.bilibili-player-video-wrap') ||
            document.querySelector('.bpx-player-container');
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
 * Get the Bilibili video element
 */
function getVideoElement() {
    // Bilibili video selectors
    return document.querySelector('.bpx-player-video-wrap video') ||
        document.querySelector('.bilibili-player-video-wrap video') ||
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
    try {
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

        console.log('[YT Speed Control - Bilibili] Speed set to:', speed);
    } catch (e) {
        // Silently ignore all errors (usually extension context invalidated)
    }
}

/**
 * Increment speed by step
 */
function incrementSpeed() {
    // Get actual speed from video element to handle menu-based speed changes
    const video = getVideoElement();
    const actualSpeed = video ? video.playbackRate : currentSpeed;

    if (actualSpeed >= MAX_SPEED) {
        showIndicator(actualSpeed, 'MAX');
        return;
    }
    setSpeed(actualSpeed + SPEED_STEP).catch(() => { });
}

/**
 * Decrement speed by step
 */
function decrementSpeed() {
    // Get actual speed from video element to handle menu-based speed changes
    const video = getVideoElement();
    const actualSpeed = video ? video.playbackRate : currentSpeed;

    if (actualSpeed <= MIN_SPEED) {
        showIndicator(actualSpeed, 'MIN');
        return;
    }
    setSpeed(actualSpeed - SPEED_STEP).catch(() => { });
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
                setSpeed(preset).catch(() => { });
                return;
            }
        }

        // + or = key to increase speed (0.25x step)
        if ((e.key === '+' || e.key === '=') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            incrementSpeed();
            return;
        }

        // - key to decrease speed (0.25x step)
        if (e.key === '-' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            decrementSpeed();
            return;
        }
    }, true); // Use capture phase to intercept before Bilibili
}

/**
 * Set up Bilibili SPA navigation listener
 */
function setupNavigationListener() {
    // Watch for URL changes (Bilibili uses history API)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('[YT Speed Control - Bilibili] Navigation detected, reapplying speed');
            setTimeout(applySpeedToVideo, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    // Track the last known video element to detect new videos
    let lastVideoElement = getVideoElement();

    // Also watch for video element changes - only apply speed when a NEW video is added
    const observer = new MutationObserver((mutations) => {
        const currentVideo = getVideoElement();

        // Only apply saved speed if a new video element was added
        // This allows users to change speed via site menus without being overridden
        if (currentVideo && currentVideo !== lastVideoElement) {
            console.log('[YT Speed Control - Bilibili] New video element detected, applying saved speed');
            lastVideoElement = currentVideo;
            applySpeedToVideo();
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
try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === 'setSpeed') {
                setSpeed(message.speed);
                sendResponse({ success: true });
            }
        } catch (e) {
            // Silently ignore
        }
        return true;
    });
} catch (e) {
    // Extension context invalidated
}

/**
 * Listen for storage changes (sync across tabs)
 */
try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
            if (namespace === 'sync' && changes.playbackSpeed) {
                const newSpeed = changes.playbackSpeed.newValue;
                if (newSpeed !== currentSpeed) {
                    currentSpeed = newSpeed;
                    applySpeedToVideo();
                }
            }
        } catch (e) {
            // Silently ignore
        }
    });
} catch (e) {
    // Extension context invalidated
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().catch(() => { }));
} else {
    init().catch(() => { });
}
