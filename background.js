
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({targetUrl: 'https://example.com/*', scriptUrl: 'https://example.com/script.js'}, function() {
        console.log('The target URL and script URL have been set.');
    });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
        chrome.storage.sync.get(['targetUrl', 'scriptUrl'], function(data) {
            if (tab.url.includes(data.targetUrl.replace('/*', ''))) {
                chrome.tabs.executeScript(tabId, {file: 'content.js'});
            }
        });
    }
});
