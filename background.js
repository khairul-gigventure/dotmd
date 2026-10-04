const FILES = [
  "lib/Readability.js",
  "lib/turndown.js",
  "lib/turndown-plugin-gfm.js",
  "src/convert.js",
  "extract.js",
  "panel.js",
];

// Click the toolbar icon to open/close the DotMD panel on the current page.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES });
  } catch (err) {
    // chrome://, Web Store and other pages we are not allowed to inject into.
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2500);
  }
});
