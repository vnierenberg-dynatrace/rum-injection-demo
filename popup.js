// UI Elements
const cspToggle = document.getElementById("cspToggle");
const cspToggleSwitch = document.getElementById("cspToggleSwitch");
const urlPattern = document.getElementById("urlPattern");
const scriptUrl = document.getElementById("scriptUrl");
const saveRuleBtn = document.getElementById("saveRuleBtn");
const clearRulesBtn = document.getElementById("clearRulesBtn");
const currentDomainBtn = document.getElementById("currentDomainBtn");
const allPagesBtn = document.getElementById("allPagesBtn");
const rulesList = document.getElementById("rulesList");
const status = document.getElementById("status");

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadRules();
  await displayRules();
  initializeCollapsibleSections();
  initializeInfoTooltip();
  initializeEventDelegation();
});

// Initialize collapsible sections
function initializeCollapsibleSections() {
  const sections = document.querySelectorAll('.section');
  
  sections.forEach(section => {
    const header = section.querySelector('.section-header');
    if (header) {
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
    }
  });
}

// Initialize info tooltip
function initializeInfoTooltip() {
  const infoIcon = document.getElementById('infoIcon');
  const infoTooltip = document.getElementById('infoTooltip');
  
  if (infoIcon && infoTooltip) {
    let isTooltipVisible = false;
    
    infoIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      isTooltipVisible = !isTooltipVisible;
      infoTooltip.classList.toggle('show', isTooltipVisible);
    });
    
    // Close tooltip when clicking outside
    document.addEventListener('click', () => {
      if (isTooltipVisible) {
        isTooltipVisible = false;
        infoTooltip.classList.remove('show');
      }
    });
    
    // Prevent tooltip from closing when clicking inside it
    infoTooltip.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// Initialize event delegation for remove buttons
function initializeEventDelegation() {
  // Event delegation for remove buttons
  rulesList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('rule-remove')) {
      const index = parseInt(e.target.getAttribute('data-rule-index'));
      if (!isNaN(index)) {
        await removeRule(index);
      }
    }
  });
}

// Show status message
function showStatus(message, isError = false) {
  status.textContent = message;
  status.className = `status ${isError ? 'error' : 'success'} show`;
  status.classList.remove('hidden');
  
  setTimeout(() => {
    status.classList.remove('show');
    setTimeout(() => {
      status.classList.add('hidden');
    }, 300);
  }, 3000);
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['cspEnabled', 'urlPattern', 'scriptUrl']);
    const isEnabled = result.cspEnabled !== false;
    cspToggle.checked = isEnabled;
    cspToggleSwitch.classList.toggle('active', isEnabled);
    urlPattern.value = result.urlPattern || '';
    scriptUrl.value = result.scriptUrl || '';
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      cspEnabled: cspToggle.checked,
      urlPattern: urlPattern.value,
      scriptUrl: scriptUrl.value
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// Load rules from storage
async function loadRules() {
  try {
    const result = await chrome.storage.sync.get(['injectionRules']);
    return result.injectionRules || [];
  } catch (error) {
    console.error('Failed to load rules:', error);
    return [];
  }
}

// Save rules to storage
async function saveRules(rules) {
  try {
    await chrome.storage.sync.set({ injectionRules: rules });
  } catch (error) {
    console.error('Failed to save rules:', error);
  }
}

// Display active rules
async function displayRules() {
  const rules = await loadRules();
  if (rules.length === 0) {
    rulesList.innerHTML = '<div class="empty-state">No active rules</div>';
    return;
  }
  
  rulesList.innerHTML = rules.map((rule, index) => `
    <div class="rule-item">
      <div class="rule-pattern">Pattern: ${rule.pattern}</div>
      <div class="rule-url">Script: ${rule.scriptUrl}</div>
      <button data-rule-index="${index}" class="rule-remove">Remove</button>
    </div>
  `).join('');
}

// Remove rule function
async function removeRule(index) {
  try {
    const rules = await loadRules();
    if (index >= 0 && index < rules.length) {
      rules.splice(index, 1);
      await saveRules(rules);
      await displayRules();
      showStatus('Rule removed successfully');
    }
  } catch (error) {
    console.error('Failed to remove rule:', error);
    showStatus('Failed to remove rule', true);
  }
}

// Get current tab URL
async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url;
}

// Create domain regex from URL
function createDomainRegex(url) {
  try {
    const domain = new URL(url).hostname;
    // Remove www. if it exists to avoid double www
    const cleanDomain = domain.replace(/^www\./, '');
    return `^https?://(www\\.)?${cleanDomain.replace(/\./g, '\\.')}.*`;
  } catch (error) {
    return '';
  }
}

// Event Listeners
cspToggleSwitch.addEventListener("click", async () => {
  cspToggle.checked = !cspToggle.checked;
  cspToggleSwitch.classList.toggle('active', cspToggle.checked);
  
  await saveSettings();
  chrome.runtime.sendMessage({ 
    action: "toggleCSP", 
    enabled: cspToggle.checked 
  });
  
  showStatus(`CSP blocking ${cspToggle.checked ? 'enabled' : 'disabled'}`);
});

currentDomainBtn.addEventListener("click", async () => {
  const currentUrl = await getCurrentTabUrl();
  if (currentUrl) {
    urlPattern.value = createDomainRegex(currentUrl);
    await saveSettings();
    showStatus('Current domain pattern set');
  }
});

allPagesBtn.addEventListener("click", async () => {
  urlPattern.value = '.*';
  await saveSettings();
  showStatus('Set to match all pages');
});

saveRuleBtn.addEventListener("click", async () => {
  const pattern = urlPattern.value.trim();
  const url = scriptUrl.value.trim();
  
  if (!pattern || !url) {
    showStatus("Please enter both URL pattern and script URL", true);
    return;
  }
  
  try {
    // Test regex pattern
    new RegExp(pattern);
    
    const rules = await loadRules();
    rules.push({ pattern, scriptUrl: url });
    await saveRules(rules);
    await displayRules();
    await saveSettings();
    
    showStatus("Rule saved! Script will auto-inject on page refresh/navigation.");
  } catch (error) {
    showStatus("Invalid regex pattern", true);
  }
});

clearRulesBtn.addEventListener("click", async () => {
  await saveRules([]);
  await displayRules();
  showStatus("All rules cleared");
});

// Auto-save inputs
urlPattern.addEventListener("input", saveSettings);
scriptUrl.addEventListener("input", saveSettings);
