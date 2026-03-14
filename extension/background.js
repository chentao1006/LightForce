function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#007bff' }); // Lightsaber Blue
    chrome.action.setBadgeTextColor({ color: '#ffffff' }); // White text
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Ensure the badge is set on initial installation or update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['lightForceEnabled'], (result) => {
    const isEnabled = result.lightForceEnabled !== false; // Default to true
    updateBadge(isEnabled);
  });
});

// Set badge on browser startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(['lightForceEnabled'], (result) => {
    const isEnabled = result.lightForceEnabled !== false;
    updateBadge(isEnabled);
  });
});

// Listen for settings changes from the popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.lightForceEnabled !== undefined) {
    updateBadge(changes.lightForceEnabled.newValue);
  }
});

// Also evaluate immediately for when the service worker wakes up
chrome.storage.sync.get(['lightForceEnabled'], (result) => {
  const isEnabled = result.lightForceEnabled !== false;
  updateBadge(isEnabled);
});
