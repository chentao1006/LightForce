document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');

    // Load initial state
    chrome.storage.sync.get(['lightForceEnabled'], (result) => {
        // Default to enabled if not set
        const isEnabled = result.lightForceEnabled !== false;
        toggleSwitch.checked = isEnabled;
    });

    // Save state when toggled and refresh page
    toggleSwitch.addEventListener('change', () => {
        const isEnabled = toggleSwitch.checked;
        chrome.storage.sync.set({ lightForceEnabled: isEnabled }, () => {
            // Reload active tab to apply changes immediately
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if(tabs[0]) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });
});
