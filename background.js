/**
 * Background script - Handles API calls
 * Content scripts CAN'T make cross-origin requests, so we do it here
 */

let DEEPL_API_KEY = ''; // User must provide their own key
const DEEPL_API_URL_FREE = 'https://api-free.deepl.com/v2/translate';
const DEEPL_API_URL_PAID = 'https://api.deepl.com/v2/translate';
const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

// Translation cache
const cache = new Map();

// Promise to ensure API key is loaded
const apiKeyPromise = new Promise((resolve) => {
  chrome.storage.local.get(['deeplApiKey'], (result) => {
    if (result.deeplApiKey) {
      DEEPL_API_KEY = result.deeplApiKey;
    }
    resolve();
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    // Wait for API key to load before translating
    apiKeyPromise.then(() => {
      return translate(request.text, request.translator || 'deepl');
    })
      .then(translation => {
        sendResponse({ success: true, translation: translation });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'apiKeyChanged') {
    DEEPL_API_KEY = request.apiKey;
    // Clear cache when API key changes
    cache.clear();
  }
  
  if (request.action === 'translatorChanged') {
    // Clear cache when translator changes
    cache.clear();
  }
});

// Translate function
async function translate(text, translator = 'deepl') {
  const cacheKey = `${translator}:${text}`;
  
  // Check cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  let translation;
  
  if (translator === 'google') {
    translation = await translateGoogle(text);
  } else {
    translation = await translateDeepL(text);
  }
  
  // Cache it
  cache.set(cacheKey, translation);
  return translation;
}

// DeepL translation
async function translateDeepL(text) {
  // Try free endpoint first
  try {
    return await callDeepLAPI(DEEPL_API_URL_FREE, text);
  } catch (error) {
    // If auth error, try paid endpoint
    if (error.message.includes('403') || error.message.includes('401')) {
      return await callDeepLAPI(DEEPL_API_URL_PAID, text);
    }
    throw error;
  }
}

async function callDeepLAPI(url, text) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `text=${encodeURIComponent(text)}&source_lang=JA&target_lang=EN-US`
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

// Google Translate (free endpoint)
async function translateGoogle(text) {
  try {
    const url = `${GOOGLE_TRANSLATE_URL}?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    // Google returns nested arrays: [[["translated", "original", null, null, 3]]]
    return data[0].map(item => item[0]).join('');
  } catch (error) {
    throw new Error(`Google Translate failed: ${error.message}`);
  }
}
