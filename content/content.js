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

        console.log('[YT Speed Control] Initialized with speed:', currentSpeed);
    } catch (e) {
        // Silently ignore errors (extension context may be invalidated)
    }
}

/**
 * Check if currently in fullscreen mode
 */
function isFullscreen() {
    return !!document.fullscreenElement;
}

/**
 * Get the video player container
 * Handles both regular YouTube videos and YouTube Shorts
 * Note: In fullscreen mode, we use document.body + fixed positioning
 */
function getPlayerContainer() {
    // In fullscreen mode, use document.body (indicator will use fixed positioning)
    if (isFullscreen()) {
        return document.body;
    }

    // Check if we're on a Shorts page
    const isShortsPage = window.location.pathname.startsWith('/shorts');

    if (isShortsPage) {
        // YouTube Shorts uses ytd-reel-video-renderer
        const activeReelRenderer = document.querySelector('ytd-reel-video-renderer[is-active]');
        if (activeReelRenderer) {
            return activeReelRenderer;
        }
    }

    // Regular YouTube video - try to find the player container
    return document.querySelector('.html5-video-player') ||
        document.querySelector('#movie_player') ||
        document.body; // Ultimate fallback
}

/**
 * Create the speed indicator element
 * Attaches to the video container for correct centering
 * In fullscreen mode, uses fixed positioning for reliable centering
 */
function createIndicator() {
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'yt-speed-indicator';
        indicator.className = 'yt-speed-indicator';
        // Create the speed text span element
        // Using DOM API instead of innerHTML to comply with Trusted Types CSP
        const speedSpan = document.createElement('span');
        speedSpan.className = 'indicator-speed';
        indicator.appendChild(speedSpan);
    }

    // Get the player container
    const container = getPlayerContainer();
    const fullscreen = isFullscreen();

    // Update positioning class based on mode
    // In fullscreen: use fixed positioning (no container-centered class)
    // In normal mode: use absolute positioning within container (container-centered class)
    if (fullscreen) {
        indicator.classList.remove('container-centered');
    } else if (container !== document.body) {
        indicator.classList.add('container-centered');
    } else {
        indicator.classList.remove('container-centered');
    }

    // If indicator is not connected or attached to wrong parent
    if (!indicator.isConnected || indicator.parentNode !== container) {
        // Ensure container has relative positioning if it's not body and not fullscreen
        if (container !== document.body && !fullscreen) {
            const style = window.getComputedStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }
        }

        container.appendChild(indicator);
    }
}

/**
 * Show the speed indicator with current speed
 */
function showIndicator(speed, message = null) {
    // Ensure indicator exists
    if (!indicator) {
        createIndicator();
    }

    // Check if we need to re-attach (e.g. fullscreen toggle, page navigation)
    const currentContainer = getPlayerContainer();
    if (indicator.parentNode !== currentContainer) {
        createIndicator(); // This will re-attach
    }

    // Set content using textContent to comply with Trusted Types CSP
    const displayText = message || `${speed.toFixed(2).replace(/\.?0+$/, '')}x`;
    const speedSpan = indicator.querySelector('.indicator-speed');
    if (speedSpan) {
        speedSpan.textContent = displayText;
    }

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
 * Handles both regular YouTube videos and YouTube Shorts
 */
function getVideoElement() {
    // Check if we're on a Shorts page
    const isShortsPage = window.location.pathname.startsWith('/shorts');

    if (isShortsPage) {
        // YouTube Shorts uses ytd-reel-video-renderer with multiple preloaded videos
        // We need to find the active one (marked with [is-active] attribute)
        const activeReelRenderer = document.querySelector('ytd-reel-video-renderer[is-active]');
        if (activeReelRenderer) {
            const video = activeReelRenderer.querySelector('video');
            if (video) {
                return video;
            }
        }

        // Fallback: find the video that is currently playing or has the largest currentTime
        const allVideos = document.querySelectorAll('ytd-reel-video-renderer video');
        if (allVideos.length > 0) {
            // Prefer playing video
            for (const video of allVideos) {
                if (!video.paused && video.currentTime > 0) {
                    return video;
                }
            }
            // Fallback to first video in Shorts context
            return allVideos[0];
        }
    }

    // Regular YouTube video
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

        console.log('[YT Speed Control] Speed set to:', speed);
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

    // Track the last known video element to detect new videos
    let lastVideoElement = getVideoElement();

    // Also watch for video element changes - only apply speed when a NEW video is added
    const observer = new MutationObserver((mutations) => {
        const currentVideo = getVideoElement();

        // Only apply saved speed if a new video element was added
        // This allows users to change speed via site menus without being overridden
        if (currentVideo && currentVideo !== lastVideoElement) {
            console.log('[YT Speed Control] New video element detected, applying saved speed');
            lastVideoElement = currentVideo;
            applySpeedToVideo();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Special handling for YouTube Shorts scrolling
    // When scrolling to a new Short, the [is-active] attribute changes
    const shortsObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'is-active') {
                const target = mutation.target;
                // Check if this element just became active
                if (target.hasAttribute('is-active')) {
                    console.log('[YT Speed Control] Shorts scroll detected, reapplying speed');
                    lastVideoElement = getVideoElement();
                    // Small delay to ensure video is ready
                    setTimeout(applySpeedToVideo, 100);
                }
            }
        }
    });

    // Start observing for Shorts active state changes
    // Observe the document body for attribute changes on any ytd-reel-video-renderer
    shortsObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['is-active'],
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
