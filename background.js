/**
 * Background script for Chrome Extension Email Autocomplete
 * Manages badge status updates from content scripts
 */

// Default badge settings
const DEFAULT_BADGE = { text: '', color: '#666', textColor: '#fff' };

/**
 * Update the extension badge based on model availability
 * @param {Object} request - Message data
 * @param {string} request.type - Message type ('SET_BADGE')
 * @param {string} request.status - Model status ('available', 'loading', 'unavailable')
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_BADGE') {
    const { status } = request;
    
    let badgeConfig;
    switch (status) {
      case 'available':
        badgeConfig = DEFAULT_BADGE;
        break;
      case 'loading':
        badgeConfig = { ...DEFAULT_BADGE, color: '#4285f4', text: '...' };
        break;
      case 'unavailable':
        badgeConfig = { ...DEFAULT_BADGE, color: '#db4437', text: '!' };
        break;
      default:
        badgeConfig = DEFAULT_BADGE;
    }
    
    chrome.action.setBadgeText({ text: badgeConfig.text });
    chrome.action.setBadgeBackgroundColor({ color: badgeConfig.color});
    chrome.action.setBadgeTextColor({ color: badgeConfig.textColor });
  }
});
