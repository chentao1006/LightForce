document.addEventListener('DOMContentLoaded', () => {
    // Localization
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) el.textContent = message;
    });

    const toggleSwitch = document.getElementById('toggleSwitch');
    const onlyDaylight = document.getElementById('onlyDaylight');

    // Load initial state
    chrome.storage.sync.get(['lightForceEnabled', 'onlyDaylightEnabled'], (result) => {
        // Default to enabled if not set
        toggleSwitch.checked = result.lightForceEnabled !== false;
        onlyDaylight.checked = result.onlyDaylightEnabled === true;
    });

    // Display version
    const versionEl = document.getElementById('version');
    if (versionEl && chrome.runtime.getManifest) {
        versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
    }

    function reloadActiveTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    }

    // Save state when toggled and refresh page
    toggleSwitch.addEventListener('change', () => {
        chrome.storage.sync.set({ lightForceEnabled: toggleSwitch.checked }, reloadActiveTab);
    });

    onlyDaylight.addEventListener('change', () => {
        chrome.storage.sync.set({ onlyDaylightEnabled: onlyDaylight.checked }, reloadActiveTab);
    });
});
