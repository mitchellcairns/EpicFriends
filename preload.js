const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ipcRenderer: ipcRenderer,
    openLoginWindow: () => ipcRenderer.send('open-login-window'),
    attemptAuthentication: () => ipcRenderer.send('attempt-authentication'),

    refreshApp: () => ipcRenderer.send('refresh-app'),
    acceptFriend: (id) => ipcRenderer.send('accept-friend', id),
    deleteFriend: (id) => ipcRenderer.send('delete-friend', id),
    addFriend: (displayName) => ipcRenderer.send('add-friend', displayName),
    // Add additional functions here as needed

    // Set up methods to send from Main to Renderer
    onUpdateAuthStatus: (callback) => ipcRenderer.on('update-auth-status', (_event, value) => callback(value)),
    onUpdateFriendList: (callback) => ipcRenderer.on('update-friend-list', (_event, value) => callback(value)),
    onReceiveToast:     (callback) => ipcRenderer.on('receive-toast', (_event, msg) => callback(msg)),
});