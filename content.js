/**
 * YomiMochi
 */

let currentTranslator = 'deepl'; // Default

// Load translator preference
chrome.storage.local.get(['translator'], (result) => {
  if (result.translator) {
    currentTranslator = result.translator;
  }
});

// Listen for translator changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translatorChanged') {
    currentTranslator = request.translator;
  }
});

// Translate via background script (background handles caching)
async function translate(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'translate', text: text, translator: currentTranslator },
      (response) => {
        if (response && response.success) {
          resolve(response.translation);
        } else {
          reject(new Error(response ? response.error : 'No response'));
        }
      }
    );
  });
}

// Check if text has Japanese
function hasJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

// Scan for textboxes every 500ms
setInterval(() => {
  const textboxes = document.querySelectorAll('.extracted-text[role="textbox"]');
  
  // Process each textbox individually
  for (const box of textboxes) {
    // Skip already translated
    if (box.getAttribute('data-translated') === 'true') continue;
    
    // Get ALL text nodes using TreeWalker
    const textNodes = [];
    const walker = document.createTreeWalker(
      box,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        textNodes.push(text);
      }
    }
    
    // If no text nodes, skip
    if (textNodes.length === 0) continue;
    
    // DEDUPLICATE: Remove duplicate strings from array
    const uniqueStrings = [...new Set(textNodes)];
    
    // Join into single string
    const combinedText = uniqueStrings.join(' ');
    
    // Skip if no Japanese
    if (!hasJapanese(combinedText)) continue;
    
    // Process this textbox
    processTextbox(box, combinedText);
  }
  
}, 500);

async function processTextbox(textbox, japaneseText) {
  try {
    const translation = await translate(japaneseText);
    
    // Get original dimensions BEFORE modifying
    const rect = textbox.getBoundingClientRect();
    const styles = window.getComputedStyle(textbox);
    
    // Lock the dimensions
    textbox.style.setProperty('width', rect.width + 'px', 'important');
    textbox.style.setProperty('height', rect.height + 'px', 'important');
    textbox.style.setProperty('min-width', rect.width + 'px', 'important');
    textbox.style.setProperty('min-height', rect.height + 'px', 'important');
    textbox.style.setProperty('max-width', rect.width + 'px', 'important');
    textbox.style.setProperty('max-height', rect.height + 'px', 'important');
    
    // Replace text content
    textbox.innerHTML = '';
    textbox.textContent = translation;
    
    // Auto-shrink font to fit - aggressive approach
    const shrinkFont = () => {
      let fontSize = parseFloat(window.getComputedStyle(textbox).fontSize);
      let changed = false;
      
      while ((textbox.scrollHeight > textbox.clientHeight || textbox.scrollWidth > textbox.clientWidth) && fontSize > 10) {
        fontSize -= 1;
        textbox.style.fontSize = fontSize + 'px';
        changed = true;
      }
      
      return changed;
    };
    
    // Try immediately
    shrinkFont();
    
    // Keep trying for 2 seconds at regular intervals
    const startTime = Date.now();
    const keepTrying = () => {
      if (Date.now() - startTime < 2000) {
        shrinkFont();
        requestAnimationFrame(keepTrying);
      }
    };
    requestAnimationFrame(keepTrying);
    
    // Mark as translated
    textbox.setAttribute('data-translated', 'true');
  } catch (error) {
    textbox.textContent = `[ERROR: ${error.message}]`;
  }
}

console.log('[AutoTranslate] Started - scanning every 500ms');
