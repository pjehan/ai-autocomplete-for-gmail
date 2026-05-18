/**
 * Options management for Chrome Extension Email Autocomplete
 * Handles reading, saving, and updating user preferences
 */

// Default settings
const DEFAULT_SETTINGS = {
  triggerDelay: 600,
  language: 'auto'
};

/**
 * Load settings from chrome.storage.sync
 * @returns {Promise<Object>} Settings object
 */
async function loadSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    triggerDelay: parseInt(result.triggerDelay) || DEFAULT_SETTINGS.triggerDelay,
    language: result.language || DEFAULT_SETTINGS.language
  };
}

/**
 * Save settings to chrome.storage.sync
 * @param {Object} settings - Settings to save
 */
async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
  console.log('Settings saved:', settings);
}

/**
 * Update the options page UI with current settings
 */
async function updateUI() {
  const settings = await loadSettings();
  document.getElementById('trigger-delay').value = settings.triggerDelay;
  document.getElementById('language').value = settings.language;
}

/**
 * Handle form submission
 * @param {Event} e - Form submit event
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const triggerDelay = parseInt(document.getElementById('trigger-delay').value);
  const language = document.getElementById('language').value;
  
  await saveSettings({ triggerDelay, language });
  
  // Show confirmation
  alert('Settings saved successfully!');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  document.getElementById('save-btn').addEventListener('click', handleSubmit);
});
