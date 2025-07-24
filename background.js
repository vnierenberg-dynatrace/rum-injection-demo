// CSP blocking functionality
let cspBlockingEnabled = true;

// Use declarativeNetRequest for MV3 CSP blocking
async function updateCSPBlocking(enabled) {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1, 2],
      addRules: enabled ? [
        {
          id: 1,
          priority: 1,
          action: {
            type: "modifyHeaders",
            responseHeaders: [
              { header: "content-security-policy", operation: "remove" },
              { header: "content-security-policy-report-only", operation: "remove" }
            ]
          },
          condition: {
            resourceTypes: ["main_frame", "sub_frame"]
          }
        }
      ] : []
    });
    
    console.log('CSP blocking:', enabled ? 'enabled' : 'disabled');
  } catch (error) {
    console.error('Failed to update CSP blocking:', error);
  }
}

// Initialize from storage
chrome.storage.sync.get(['cspEnabled'], (result) => {
  cspBlockingEnabled = result.cspEnabled !== false;
  updateCSPBlocking(cspBlockingEnabled);
});

// Get matching URL rules
async function getMatchingRules(url) {
  try {
    const { injectionRules = [] } = await chrome.storage.sync.get(['injectionRules']);
    return injectionRules.filter(rule => {
      try {
        return new RegExp(rule.pattern).test(url);
      } catch (error) {
        console.error('Invalid regex pattern:', rule.pattern);
        return false;
      }
    });
  } catch (error) {
    console.error('Failed to get matching rules:', error);
    return [];
  }
}

// Simplified script injection with essential CSP bypass
async function injectScript(tabId, scriptUrl) {
  try {
    const response = await fetch(scriptUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const scriptContent = await response.text();
    if (!scriptContent?.trim()) throw new Error('Script content is empty');
    
    // Primary injection method: chrome.scripting with MAIN world
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (content, url) => {
        // Prevent duplicate injections
        if (window.__injectedScripts?.[url]) return 'exists';
        if (!window.__injectedScripts) window.__injectedScripts = {};
        window.__injectedScripts[url] = true;
        
        // Method 1: DOM script element (best for session replay)
        try {
          const script = document.createElement('script');
          script.textContent = content;
          script.setAttribute('data-injected-from', url);
          (document.head || document.documentElement || document.body).appendChild(script);
          console.log('Script injected via DOM element:', url);
          return 'success_dom';
        } catch (domError) {
          console.warn('DOM injection failed, trying Function constructor:', domError);
          
          // Method 2: Function constructor fallback
          try {
            new Function(content).call(window);
            console.log('Script injected via Function constructor:', url);
            return 'success_function';
          } catch (funcError) {
            // Method 3: setTimeout fallback
            try {
              setTimeout(new Function(content), 0);
              console.log('Script injected via setTimeout:', url);
              return 'success_delayed';
            } catch (timeoutError) {
              console.error('All injection methods failed:', domError, funcError, timeoutError);
              return 'failed';
            }
          }
        }
      },
      args: [scriptContent, scriptUrl]
    });
    
    return { success: true, result };
  } catch (error) {
    console.error('Script injection failed:', scriptUrl, error);
    return { success: false, error: error.message };
  }
}

// Auto-inject scripts on page load
async function autoInjectScripts(tabId, url) {
  const rules = await getMatchingRules(url);
  if (rules.length === 0) return;
  
  console.log(`Auto-injecting ${rules.length} scripts for:`, url);
  
  for (const rule of rules) {
    try {
      const result = await injectScript(tabId, rule.scriptUrl);
      // Only log successful first-time injections
      if (result?.result?.[0]?.result !== 'exists') {
        console.log('Successfully injected:', rule.scriptUrl, result?.result?.[0]?.result);
      }
    } catch (error) {
      console.error('Auto-injection failed:', rule, error);
    }
  }
}

// Tab event listeners - inject earlier for session replay
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Try multiple injection points to ensure session replay works
  if (changeInfo.status === 'loading' && tab.url) {
    // Very early injection for session replay
    setTimeout(() => autoInjectScripts(tabId, tab.url), 100);
  } else if (changeInfo.status === 'interactive' && tab.url) {
    // Backup injection
    setTimeout(() => autoInjectScripts(tabId, tab.url), 200);
  } else if (changeInfo.status === 'complete' && tab.url) {
    // Final fallback
    setTimeout(() => autoInjectScripts(tabId, tab.url), 300);
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "injectScript") {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.id) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }
      
      const result = await injectScript(tab.id, message.url);
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === "toggleCSP") {
    cspBlockingEnabled = message.enabled;
    updateCSPBlocking(cspBlockingEnabled);
    chrome.storage.sync.set({ cspEnabled: cspBlockingEnabled });
    sendResponse({ success: true });
    return true;
  }
});
