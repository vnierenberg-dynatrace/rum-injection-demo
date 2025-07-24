// Content script that runs at document_start to disable CSP and auto-inject scripts
(async function() {
  // Get settings from storage
  const result = await chrome.storage.sync.get(['cspEnabled', 'injectionRules']);
  const cspEnabled = result.cspEnabled !== false;
  const rules = result.injectionRules || [];
  
  console.log('Content script loaded for:', location.href);
  console.log('CSP blocking enabled:', cspEnabled);
  console.log('Injection rules:', rules);
  
  // Disable CSP by overriding meta tags
  if (cspEnabled) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Remove CSP meta tags
            if (node.tagName === 'META' && 
                node.getAttribute && 
                node.getAttribute('http-equiv') && 
                node.getAttribute('http-equiv').toLowerCase().includes('content-security-policy')) {
              console.log('Removing CSP meta tag:', node);
              node.remove();
            }
            
            // Check for CSP meta tags in newly added elements
            const cspMetas = node.querySelectorAll ? node.querySelectorAll('meta[http-equiv*="content-security-policy" i]') : [];
            cspMetas.forEach(meta => {
              console.log('Removing CSP meta tag:', meta);
              meta.remove();
            });
          }
        });
      });
    });
    
    // Start observing
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true
    });
    
    // Remove any existing CSP meta tags
    document.addEventListener('DOMContentLoaded', () => {
      const existingCspMetas = document.querySelectorAll('meta[http-equiv*="content-security-policy" i]');
      existingCspMetas.forEach(meta => {
        console.log('Removing existing CSP meta tag:', meta);
        meta.remove();
      });
    });
  }
  
  // Listen for background script injection messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'injectScript') {
      console.log('Content script received injection request:', message.url);
      
      try {
        // Try Function constructor as primary method
        const func = new Function(message.content);
        func.call(window);
        console.log('Content script: Script executed successfully via Function constructor');
        sendResponse({ success: true });
      } catch (error) {
        console.error('Content script injection failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
  });
  
  // Background script handles auto-injection now - content script injection is disabled
})();
