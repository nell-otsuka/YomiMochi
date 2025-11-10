// Popup script - Settings management
const translatorSelect = document.getElementById('translator');
const apiKeyInput = document.getElementById('apiKey');

// Load saved settings
chrome.storage.local.get(['translator', 'deeplApiKey'], (result) => {
  if (result.translator) {
    translatorSelect.value = result.translator;
  }
  if (result.deeplApiKey) {
    apiKeyInput.value = result.deeplApiKey;
  }
});

// Save translator preference when changed
translatorSelect.addEventListener('change', () => {
  const selected = translatorSelect.value;
  chrome.storage.local.set({ translator: selected });
  
  // Notify content script and background
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'translatorChanged', translator: selected });
    });
  });
  chrome.runtime.sendMessage({ action: 'translatorChanged', translator: selected });
});

// Save API key when changed (with debounce)
let saveTimeout;
apiKeyInput.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const apiKey = apiKeyInput.value.trim();
    chrome.storage.local.set({ deeplApiKey: apiKey });
    
    // Notify background to update API key
    chrome.runtime.sendMessage({ action: 'apiKeyChanged', apiKey: apiKey });
  }, 500);
});
