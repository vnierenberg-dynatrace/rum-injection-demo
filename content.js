
chrome.storage.sync.get(['targetUrl', 'scriptUrl'], function (data) {
    if (window.location.origin.includes(data.targetUrl.replace('/*', ''))) {
        var script = document.createElement('script');
        script.src = data.scriptUrl;
        script.type = 'text/javascript';
        script.crossorigin = 'anonymous';
        document.head.appendChild(script);
    }
});
