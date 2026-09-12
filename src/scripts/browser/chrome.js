export async function openSidePanel() {
    const currentWindow = await chrome.windows.getCurrent();

    await chrome.sidePanel.open({
        windowId: currentWindow.id,
    });
}
