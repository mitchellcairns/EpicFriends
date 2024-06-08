const { app, BrowserWindow, ipcMain } = require('electron');
const axios = require('axios');
const fs = require('fs');
const querystring = require('querystring');
const path = require('path');
const CryptoJS = require('crypto-js')

let mainWindow;
let loginWindow;
let authWindow;

const clientId = 'ec684b8c687f479fadea3cb2ad83f5c6';
const clientSecret = 'e1f31c211f28413186262d37a13fc84d';

var global_accountId = null;
var global_authToken = null;

// Encrypt token
function encryptToken(token) {
    try {
        const encryptedToken = CryptoJS.AES.encrypt(token, clientSecret).toString();
        return encryptedToken;
    } catch (error) {
        console.error('Error encrypting token:', error);
        return null;
    }
}

// Decrypt token
function decryptToken(encryptedToken) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, clientSecret);
        const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);
        return decryptedToken;
    } catch (error) {
        console.error('Error decrypting token:', error);
        return null;
    }
}

// Send pop up notification to app
function sendToast(msg)
{
    if(!mainWindow) console.log("Main window isn't ready.");
    else mainWindow.webContents.send('receive-toast', msg);
}

// Define the file path for storing the encrypted token
const tokenFilePath = path.join(app.getPath('userData'), 'access_token.txt');

// Store access token
function cacheToken(token) {
    try {
        const encryptedToken = encryptToken(token);
        if (encryptedToken) {
            fs.writeFileSync(tokenFilePath, encryptedToken);
            global_authToken = token;
            console.log('Token cached:', token);
        }
    } catch (error) {
        console.error('Error caching token:', error);
    }
}

// Clear access token
function clearToken() {
    try {
        if (fs.existsSync(tokenFilePath)) {
            fs.unlinkSync(tokenFilePath);
            console.log('Token cleared');
            updateAuthStatus(false);
        } else {
            console.log('Token file does not exist');
        }
    } catch (error) {
        console.error('Error clearing token:', error);
    }
}

// Retrieve access token
function retrieveToken() {
    try {
        const encryptedToken = fs.readFileSync(tokenFilePath, 'utf-8');
        if (encryptedToken) {
            const token = decryptToken(encryptedToken);
            console.log('Retrieved token:', token);
            return token;
        }
    } catch (error) {
        console.error('Error retrieving token:', error);
        return null;
    }
}

function updateAuthStatus(status)
{
    if(!mainWindow) console.log("Main window isn't ready.");
    else mainWindow.webContents.send('update-auth-status', status);
}

function updateFriendList(friends)
{
    if(!mainWindow) console.log("Main window isn't ready.");
    else mainWindow.webContents.send('update-friend-list', friends);
}

function getClientAuthToken(authCode)
{
    const requestBody = querystring.stringify({
        grant_type: 'authorization_code',
        code: authCode
    });

    const authHeader = Buffer.from(clientId + ':' + clientSecret).toString('base64');
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + authHeader
    };

    return axios.post('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', requestBody, {
        headers: headers
    })
    .then(response => {
        const accessToken = response.data.access_token;
        // Here, you can cache the access token for later use, e.g., in app cache or cookies
        // For demonstration purposes, let's just return the access token
        console.log("Got access token.");

        cacheToken(accessToken);
        epic_isTokenValid(accessToken);
        updateAuthStatus(true);
        return accessToken;
    })
    .catch(error => {
        console.error('Error getting access token:', error);
        throw error;
    });
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    mainWindow.loadFile('index.html');
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 600,
        height: 800,
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    loginWindow.loadURL('https://www.epicgames.com/id/login');
    loginWindow.once('ready-to-show', () => {
        loginWindow.show();
    });

    loginWindow.on('closed', () => {
        loginWindow = null;
    });
}

const authUrl = 'https://www.epicgames.com/id/api/redirect?clientId=ec684b8c687f479fadea3cb2ad83f5c6&responseType=code'
function createClientAuthWindow() {
    authWindow = new BrowserWindow({
        width:0,
        height:0,
        parent: mainWindow,
        modal: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    authWindow.loadURL(authUrl);

    authWindow.webContents.on('did-finish-load', async () => {
        try {
            const data = await authWindow.webContents.executeJavaScript(`
                document.querySelector('pre').innerText
            `);
            // Here 'data' contains the text inside the <pre> tag.
            const auth = JSON.parse(data).authorizationCode;
            console.log("Auth code: ",auth);
            getClientAuthToken(auth);
        } catch (error) {
            console.error('Error extracting data:', error);
        }
    });
}

// Create the window when the app is ready
app.on('ready', createWindow);

ipcMain.on('open-login-window', () => {
    if(!loginWindow) {
        createLoginWindow();
    }
    else
    {
        loginWindow.show();
    }
});

ipcMain.on('attempt-authentication', () => {
    createClientAuthWindow();
});

// Tells the main.js that we are ready to go
ipcMain.on('refresh-app', async () => {
    
    // See if our current token exists
    const thisToken = retrieveToken();
    var valid = false;

    // We don't have a token
    if(thisToken==null)
    {
        // Clear auth status
        updateAuthStatus(false);
        sendToast("Need to authenticate");
        return;
    }
    else
    {
        // Check if token is valid
        valid = await epic_isTokenValid(thisToken);
    }

    // If the token isn't valid, delete the token and update our auth status
    if(!valid)
    {
        clearToken();
        updateAuthStatus(false);
        sendToast("Need to authenticate again");
        return;
    }
    else
    {
        // If we get here, our global_accountId is set
        // Set our global_token
        updateAuthStatus(true);
        global_authToken = thisToken;
    }

    // Finally, refresh the friend list
    epic_getFriendList(global_authToken, global_accountId);
    sendToast("Authenticated");
});

ipcMain.on('add-friend', (event, displayName) => {
    if(global_accountId == null)
    {
        console.log("Account ID is null.");
        sendToast("Error ID");
        return;
    }
    if(global_authToken == null)
    {
        console.log("No auth token. null.");
        sendToast("Need to authenticate");
        return;
    }

    epic_addFriend(global_authToken, global_accountId, displayName);
});

ipcMain.on('accept-friend', (event, id) => {
    if(global_accountId == null)
    {
        console.log("Account ID is null.");
        sendToast("Error ID");
        return;
    }
    if(global_authToken == null)
    {
        console.log("No auth token. null.");
        sendToast("Need to authenticate");
        return;
    }

    epic_acceptFriend(global_authToken, global_accountId, id);
});

ipcMain.on('delete-friend', (event, id) => {
    if(global_accountId == null)
    {
        console.log("Account ID is null.");
        sendToast("Error ID");
        return;
    }
    if(global_authToken == null)
    {
        console.log("No auth token. null.");
        sendToast("Need to authenticate");
        return;
    }

    epic_removeFriend(global_authToken, global_accountId, id);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// API functions
async function epic_isTokenValid(accessToken) {
    const url = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/verify';
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.get(url, { headers });
        console.log(response.data);

        console.log("Got authorized user acct ID.");
        // Set our account ID
        global_accountId = response.data.account_id;

        return true;
    } catch (error) {
        // Clear token
        console.log("Token is expired.");
        global_accountId = null;
        return false;
    }
}

async function epic_getUserIdFromName(accessToken, displayName) {

    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${displayName}`;
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.get(url, { headers });
        console.log(response.data);
        return response.data.id;
    } catch (error) {
        console.error('Error finding user by name:', error);
        return null;
    }

}

async function epic_addFriend(accessToken, accountId, displayName) {

    if(accountId == null)
    {
        console.log("Account ID is null.");
        return;
    }

    console.log("Trying to find ID for user ", displayName);
    
    // First, get the username id
    const friendId = await epic_getUserIdFromName(accessToken, displayName);

    if(friendId == null)
    {
        console.log("No matching user found");
        sendToast("User not found");
        return;
    }

    console.log("User ID for ", displayName, " - ", friendId);

    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${friendId}`;
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.post(url, null, { headers });
        console.log(response.data);
        sendToast("Request sent");

        // Refresh friends list
        epic_getFriendList(accessToken, accountId);

        return response.data;
    } catch (error) {
        console.error('Error adding friend:', error);
        throw error;
    }
}

async function epic_acceptFriend(accessToken, accountId, friendId) {

    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${friendId}`;
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.post(url, null, { headers });
        console.log(response.data);
        sendToast("Accepted friend");

        // Refresh friends list
        epic_getFriendList(accessToken, accountId);

        return response.data;
    } catch (error) {
        console.error('Error adding friend:', error);
        throw error;
    }
}

async function epic_removeFriend(accessToken, accountId, friendId) {
    if(accountId == null)
    {
        console.log("Account ID is null.");
        return;
    }
    
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${friendId}`;
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.delete(url, { headers });
        sendToast("Deleted");

        // Refresh friends list
        epic_getFriendList(accessToken, accountId);
        return response.data;
    } catch (error) {
        console.error('Error removing friend:', error);
        throw error;
    }
}

async function epic_getFriendList(accessToken, accountId) {
    if(accountId == null)
    {
        console.log("Account ID is null.");
        return;
    }
    
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/summary`;
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.get(url, { headers });

        // Format our friends list
        const friends = [];
        
        for(const friend of response.data.friends) {
            const name = await epic_getUsernameByAccountId(accessToken, friend.accountId);
            friends.push({
                name: name,
                id: friend.accountId,
                pending: false,
            });
        }

        for(const friend of response.data.outgoing) {
            const name = await epic_getUsernameByAccountId(accessToken, friend.accountId);
            friends.push({
                name: name + ' (Pending)',
                id: friend.accountId,
                pending: false,
                waiting: true,
            });
        }

        for(const friend of response.data.incoming) {
            const name = await epic_getUsernameByAccountId(accessToken, friend.accountId);
            friends.push({
                name: name,
                id: friend.accountId,
                waiting: false,
                pending: true,
            });
        }

        // Push friend data to app here
        updateFriendList(friends);

        return response.data;
    } catch (error) {
        console.error('Error retrieving friend list:', error);
        throw error;
    }
}

async function epic_getUsernameByAccountId(accessToken, accountId) {
    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}`; // Replace with the appropriate endpoint for username retrieval
    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.get(url, { headers });
        return response.data.displayName;
    } catch (error) {
        console.error('Error getting username by account ID:', error);
        throw error;
    }
}
