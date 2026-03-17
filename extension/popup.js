document.addEventListener('DOMContentLoaded', () => {
    // Localization
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) el.textContent = message;
    });

    const toggleSwitch = document.getElementById('toggleSwitch');
    const onlyDaylight = document.getElementById('onlyDaylight');
    const runMode = document.getElementById('runMode');
    const toggleSiteBtn = document.getElementById('toggleSite');

    let currentHostname = '';
    let siteList = [];

    // Get current tab hostname
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                currentHostname = url.hostname;
                updateSiteBtnUI();
            } catch (e) {
                document.getElementById('siteActionContainer')?.style.setProperty('display', 'none');
            }
        }
    });

    // Load initial state
    chrome.storage.sync.get(['lightForceEnabled', 'onlyDaylightEnabled', 'runMode', 'siteList'], (result) => {
        // Default to enabled if not set
        toggleSwitch.checked = result.lightForceEnabled !== false;
        onlyDaylight.checked = result.onlyDaylightEnabled === true;
        runMode.value = result.runMode || 'exclusion';
        siteList = result.siteList || [];
        updateSiteBtnUI();
    });

    function updateSiteBtnUI() {
        if (!currentHostname || !toggleSiteBtn) return;
        
        const isInList = siteList.includes(currentHostname);
        if (isInList) {
            toggleSiteBtn.textContent = chrome.i18n.getMessage('removeFromList');
            toggleSiteBtn.classList.add('remove');
        } else {
            toggleSiteBtn.textContent = chrome.i18n.getMessage('addToList');
            toggleSiteBtn.classList.remove('remove');
        }
    }

    // Display version
    const versionEl = document.getElementById('version');
    if (versionEl && chrome.runtime.getManifest) {
        versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
    }

    function reloadActiveTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
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

    runMode.addEventListener('change', () => {
        chrome.storage.sync.set({ runMode: runMode.value }, reloadActiveTab);
    });

    toggleSiteBtn.addEventListener('click', () => {
        if (!currentHostname) return;

        const index = siteList.indexOf(currentHostname);
        if (index > -1) {
            siteList.splice(index, 1);
        } else {
            siteList.push(currentHostname);
        }

        chrome.storage.sync.set({ siteList: siteList }, () => {
            updateSiteBtnUI();
            reloadActiveTab();
        });
    });
});
