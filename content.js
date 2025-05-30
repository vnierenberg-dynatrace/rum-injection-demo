
chrome.storage.sync.get(['scriptUrl'], function(data) {
    var script = document.createElement('script');
    script.src = data.scriptUrl;
    script.type = 'text/javascript';
    script.crossorigin = 'anonymous';
    document.head.appendChild(script);
});
