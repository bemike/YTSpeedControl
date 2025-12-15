/**
 * YT Speed Control - Service Worker (Background Script)
 * Handles message routing between popup and content scripts
 */

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default values on first install
        chrome.storage.sync.set({
            playbackSpeed: 1.0,
            showIndicator: true,
            indicatorDuration: 2000
        });
        console.log('[YT Speed Control] Extension installed with default settings');
    }
});

// Handle messages between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Forward speedUpdated messages to popup
    if (message.action === 'speedUpdated') {
        // This will be received by popup if it's open
        // No need to explicitly forward, Chrome handles broadcast
        return;
    }

    return true;
});

// Optional: Open YouTube when clicking extension icon if no YouTube tab is open
chrome.action.onClicked.addListener(async (tab) => {
    // This won't fire if popup is defined, but keeping for potential future use
    const youtubeTabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
    if (youtubeTabs.length === 0) {
        chrome.tabs.create({ url: 'https://www.youtube.com' });
    }
});
