document.addEventListener('DOMContentLoaded', () => {
    // Localization
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) el.textContent = message;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(key);
        if (message) el.placeholder = message;
    });
    const toggleSwitch = document.getElementById('toggleSwitch');
    const onlyDaylight = document.getElementById('onlyDaylight');
    const runMode = document.getElementById('runMode');
    const toggleSiteBtn = document.getElementById('toggleSite');
    
    const manageSitesBtn = document.getElementById('manageSitesBtn');
    const siteManager = document.getElementById('siteManager');
    const newSiteInput = document.getElementById('newSiteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const siteListContainer = document.getElementById('siteListContainer');

    let currentHostname = '';
    let siteList = [];

    // Get current tab hostname and badge status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.action.getBadgeText({ tabId: tabs[0].id }, (text) => {
                if (text === 'ON') {
                    const activeBanner = document.getElementById('activeBanner');
                    if (activeBanner) activeBanner.classList.remove('hidden');
                }
            });
            
            if (tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    currentHostname = url.hostname;
                    updateSiteBtnUI();
                } catch (e) {
                    document.getElementById('siteActionContainer')?.style.setProperty('display', 'none');
                }
            }
        }
    });

    // Load initial state
    chrome.storage.sync.get(['lightForceEnabled', 'onlyDaylightEnabled', 'runMode', 'siteList'], (result) => {
        // Default to enabled if not set
        toggleSwitch.checked = result.lightForceEnabled !== false;
        onlyDaylight.checked = result.onlyDaylightEnabled === true;
        runMode.value = result.runMode || 'inclusion';
        siteList = result.siteList || [];
        updateSiteBtnUI();
        if (siteListContainer) renderSiteList();
    });

    function updateSiteBtnUI() {
        if (!currentHostname || !toggleSiteBtn) return;
        
        const isInList = siteList.some(site => currentHostname === site || currentHostname.endsWith('.' + site));
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

        const match = siteList.find(site => currentHostname === site || currentHostname.endsWith('.' + site));
        if (match) {
            siteList = siteList.filter(s => s !== match);
        } else {
            siteList.push(currentHostname);
        }

        chrome.storage.sync.set({ siteList: siteList }, () => {
            updateSiteBtnUI();
            if (siteListContainer && !siteManager.classList.contains('hidden')) {
                renderSiteList();
            }
            reloadActiveTab();
        });
    });

    const manageSitesArrow = document.getElementById('manageSitesArrow');

    if (manageSitesBtn) {
        manageSitesBtn.addEventListener('click', () => {
            const isHidden = siteManager.classList.toggle('hidden');
            if (manageSitesArrow) {
                manageSitesArrow.classList.toggle('up', !isHidden);
            }
            if (!isHidden) {
                renderSiteList();
            }
        });
    }

    if (addSiteBtn) {
        addSiteBtn.addEventListener('click', () => {
            const val = newSiteInput.value.trim();
            if (val && !siteList.includes(val)) {
                siteList.push(val);
                chrome.storage.sync.set({ siteList: siteList }, () => {
                    updateSiteBtnUI();
                    renderSiteList();
                    reloadActiveTab();
                });
                newSiteInput.value = '';
            }
        });
    }

    if (newSiteInput) {
        newSiteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addSiteBtn.click();
            }
        });
    }

    function renderSiteList() {
        siteListContainer.innerHTML = '';
        if (siteList.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-list-msg';
            emptyMsg.textContent = chrome.i18n.getMessage('emptyList');
            siteListContainer.appendChild(emptyMsg);
            return;
        }

        siteList.forEach(site => {
            const item = document.createElement('div');
            item.className = 'site-item';
            
            const domainSpan = document.createElement('span');
            domainSpan.className = 'site-item-domain';
            domainSpan.textContent = site;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'site-item-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit-btn';
            editBtn.textContent = chrome.i18n.getMessage('editSite') || 'Edit';
            editBtn.onclick = () => {
                const newDomain = prompt(chrome.i18n.getMessage('enterSiteDomain') || 'Enter domain', site);
                if (newDomain && newDomain.trim() !== '' && newDomain !== site) {
                    const idx = siteList.indexOf(site);
                    if (idx > -1) {
                        siteList[idx] = newDomain.trim();
                        chrome.storage.sync.set({ siteList: siteList }, () => {
                            updateSiteBtnUI();
                            renderSiteList();
                            reloadActiveTab();
                        });
                    }
                }
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete-btn';
            deleteBtn.textContent = chrome.i18n.getMessage('deleteSite') || 'Delete';
            deleteBtn.onclick = () => {
                siteList = siteList.filter(s => s !== site);
                chrome.storage.sync.set({ siteList: siteList }, () => {
                    updateSiteBtnUI();
                    renderSiteList();
                    reloadActiveTab();
                });
            };
            
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            
            item.appendChild(domainSpan);
            item.appendChild(actionsDiv);
            siteListContainer.appendChild(item);
        });
    }
});
