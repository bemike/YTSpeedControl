/**
 * YT Speed Control - X.com (Twitter) Content Script
 * Injects into X.com pages to control video playback speed
 */

// Constants
const MIN_SPEED = 0.25;
const MAX_SPEED = 3.0;
const SPEED_STEP = 0.25;
const INDICATOR_DURATION = 2000;

// Speed presets for keyboard shortcuts
// Shift+1 -> 1x, Shift+2 -> 1.5x, Shift+3 -> 2.0x, Shift+4 -> 3x
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

        // Apply speed to video
        applySpeedToVideo();

        // Set up event listeners
        setupKeyboardShortcuts();
        setupNavigationListener();

        console.log('[YT Speed Control - X.com] Initialized with speed:', currentSpeed);
    } catch (e) {
        // Silently ignore errors (extension context may be invalidated)
    }
}

/**
 * Get the VISIBLE and ACTIVE video element
 * X.com often has multiple video elements (preloaded, background, etc.)
 */
function getVideoElement() {
    // Get all video elements
    const videos = Array.from(document.querySelectorAll('video'));

    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Find the largest visible video (most likely the main player)
    let bestVideo = null;
    let maxArea = 0;

    for (const video of videos) {
        const rect = video.getBoundingClientRect();
        // Check if video is visible
        if (rect.width > 0 && rect.height > 0) {
            const area = rect.width * rect.height;
            // Also check if it's in the viewport
            if (rect.top < window.innerHeight && rect.bottom > 0 &&
                rect.left < window.innerWidth && rect.right > 0) {
                if (area > maxArea) {
                    maxArea = area;
                    bestVideo = video;
                }
            }
        }
    }

    // Fallback to first video
    return bestVideo || videos[0];
}

/**
 * Get the video player container
 */
function getPlayerContainer() {
    // Check for fullscreen element first
    if (document.fullscreenElement) {
        return document.fullscreenElement;
    }

    // Try to find the specific X.com player container
    const video = getVideoElement();
    if (video) {
        // [data-testid="videoPlayer"] is the reliable container for X.com
        const player = video.closest('[data-testid="videoPlayer"]');
        if (player) return player;

        // Mobile/other views might use different structure, fallback to parent
        return video.parentNode;
    }

    return document.body;
}

/**
 * Create or update the speed indicator element
 * Attaches to the video container for correct centering
 */
function ensureIndicator() {
    // Create indicator if it doesn't exist
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'yt-speed-indicator';
        indicator.className = 'yt-speed-indicator container-centered';
    }

    const container = getPlayerContainer();

    // If indicator is not connected or attached to wrong parent
    if (!indicator.isConnected || indicator.parentNode !== container) {
        // Ensure container has relative positioning if it's not body
        if (container !== document.body) {
            const style = window.getComputedStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }
        }

        container.appendChild(indicator);
    }

    return indicator;
}

/**
 * Show the speed indicator with current speed
 */
function showIndicator(speed, message = null) {
    const ind = ensureIndicator();

    if (!ind) return;

    // Set content
    const displayText = message || `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
    ind.innerHTML = `<span class="indicator-speed">${displayText}</span>`;

    // Remove inline styles that might conflict with our class
    // Only keep transition which might be useful, or just clear it all to rely on CSS
    ind.style.cssText = '';

    // Ensure the class is present (in case it was removed)
    ind.classList.add('container-centered');

    // Show indicator via class too
    ind.classList.add('visible');

    // Clear existing timeout
    if (indicatorTimeout) {
        clearTimeout(indicatorTimeout);
    }

    // Hide after duration
    indicatorTimeout = setTimeout(() => {
        ind.style.opacity = '0';
        ind.style.visibility = 'hidden';
        ind.style.transform = 'translate(-50%, -50%) scale(0.8)';
        ind.classList.remove('visible');
    }, INDICATOR_DURATION);
}

/**
 * Apply current speed to the video element
 */
function applySpeedToVideo() {
    const video = getVideoElement();
    if (video) {
        video.playbackRate = currentSpeed;
        console.log('[YT Speed Control - X.com] Applied speed to video:', currentSpeed);
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

        console.log('[YT Speed Control - X.com] Speed set to:', speed);
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
 * Note: X.com may intercept some keys, so we add [ and ] as alternatives
 */
function setupKeyboardShortcuts() {
    // Use window and document with capture phase to get events before X.com's handlers
    const handler = (e) => {
        // Debug logging
        console.log(`[YT Speed Control - X.com] Key: "${e.key}" Code: "${e.code}" Target: ${e.target.tagName}`);

        // Ignore if user is typing in input/textarea
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) {
            console.log('[YT Speed Control - X.com] Ignoring - focus is on input field');
            return;
        }

        // Shift + Number for preset speeds
        if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const preset = KEY_CODE_MAP[e.code];
            if (preset !== undefined) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setSpeed(preset).catch(() => { });
                return;
            }
        }

        // + or = or ] key to increase speed (0.25x step)
        // Added ] (BracketRight) as alternative in case + is blocked
        if ((e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+' || e.key === '=' ||
            e.code === 'BracketRight' || e.key === ']') &&
            !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            console.log('[YT Speed Control - X.com] Plus/] key matched, incrementing speed');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            incrementSpeed();
            return;
        }

        // - or [ key to decrease speed (0.25x step)
        // Added [ (BracketLeft) as alternative in case - is blocked
        if ((e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-' ||
            e.code === 'BracketLeft' || e.key === '[') &&
            !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            console.log('[YT Speed Control - X.com] Minus/[ key matched, decrementing speed');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            decrementSpeed();
            return;
        }

        console.log('[YT Speed Control - X.com] Key not matched for speed control');
    };

    // Try both window and document with capture phase
    window.addEventListener('keydown', handler, true);
    document.addEventListener('keydown', handler, true);

    console.log('[YT Speed Control - X.com] Keyboard shortcuts registered on window and document');
}

/**
 * Set up X.com SPA navigation listener
 */
function setupNavigationListener() {
    // Watch for URL changes (X.com uses history API)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('[YT Speed Control - X.com] Navigation detected, reapplying speed');
            setTimeout(() => {
                applySpeedToVideo();
                // Reset indicator so it attaches to the new video
                indicator = null;
            }, 500);
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
            console.log('[YT Speed Control - X.com] New video element detected, applying saved speed');
            lastVideoElement = currentVideo;
            applySpeedToVideo();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Note: fullscreenchange listener removed - with fixed positioning,
    // the indicator is always attached to document.body and works in all modes
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
