document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['targetUrl', 'scriptUrl'], function(data) {
        document.getElementById('targetUrl').value = data.targetUrl;
        document.getElementById('scriptUrl').value = data.scriptUrl;
    });

    document.getElementById('save').addEventListener('click', function() {
        var targetUrl = document.getElementById('targetUrl').value;
        var scriptUrl = document.getElementById('scriptUrl').value;
        chrome.storage.sync.set({targetUrl: targetUrl, scriptUrl: scriptUrl}, function() {
            console.log('Settings saved');
        });
    });
});