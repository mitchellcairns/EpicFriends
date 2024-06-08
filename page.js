

const friendTextBox = document.getElementById('friend-search-textvalue');
const addBtn = document.getElementById('epidAddBtn');
const loginBtn = document.getElementById('epicLoginBtn');
const authBtn = document.getElementById('epicAuthBtn');
const authStatus = document.getElementById('epicAuthStatus');
const refreshBtn = document.getElementById('epicRefreshBtn');

// Stuff we run when the page is done loading
document.addEventListener('DOMContentLoaded', (event) => {
    console.log('DOM fully loaded and parsed');
    setAuthStatus(false);
    window.electronAPI.refreshApp();
});

function showToast(message) {
    // Show toast
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.display = 'block';
  
    // Fade out toast after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.style.display = 'none';
        toast.style.opacity = '1'; // Reset opacity for future use
      }, 500); // Wait for transition to complete
    }, 2500);
  }

refreshBtn.addEventListener('click' , () => {
    window.electronAPI.refreshApp();
});

function enableLoginBtn(enable)
{
    try {
        if(enable)
        {
            loginBtn.classList.remove('disable');
            loginBtn.addEventListener('click', () => {
                window.electronAPI.openLoginWindow();
            });
        }
        else
        {
            loginBtn.classList.add('disable');
            loginBtn.removeEventListener('click');
        }
    } catch (error) {
        console.log("Login button state not set.");
    }  
}

function enableAddBtn(enable)
{
    try {
        if(enable)
        {
            addBtn.classList.remove('disable');
            addBtn.addEventListener('click', () => {
                addFriendAttempt()
            });
        }
        else
        {
            addBtn.classList.add('disable');
            addBtn.removeEventListener('click');
        }
    } catch (error) {
        console.log("Add button state not set.", error);
    }  
}

function enableAuthBtn(enable)
{
    try {
        if(enable)
        {
            authBtn.classList.remove('disable');
            authBtn.addEventListener('click', () => {
                window.electronAPI.attemptAuthentication();
            });
        }
        else
        {
            authBtn.classList.add('disable');
            authBtn.removeEventListener('click');
        }
    } catch (error) {
        console.log("Auth button state not set.");
    }  
}

function setAuthStatus(value)
{
    enableLoginBtn(!value);
    enableAuthBtn(!value);
    enableAddBtn(value);

    try {
        if(value)
        {
            authStatus.innerText = "Status: Authenticated";
        }
        else
        {
            authStatus.innerText = "Status: Signed Out";
        }
    } catch (error) {
        
    }  
}

function addFriendAttempt()
{
    var displayName = String(friendTextBox.value);
    if(displayName == "")
    {
        console.log("Enter a friend ID");
        return;
    }
    window.electronAPI.addFriend(displayName);
}

window.electronAPI.onUpdateAuthStatus((value) => {
    console.log("Auth status updated via IPC");
    setAuthStatus(value);
});

window.electronAPI.onReceiveToast((msg) => {
    showToast(msg);
});

const friendContainer = document.getElementById('friend-container');
const friendTemplate = document.getElementById('friend-template');

function confirmDelete(id)
{
    const el = document.getElementById('btn-delete-'+id);

    if(el.classList.contains('confirm'))
    {
        window.electronAPI.deleteFriend(id);
    }
    else el.classList.add('confirm');
}

function cancelDelete(id)
{
    const el = document.getElementById('btn-delete-'+id);
    el.classList.remove('confirm');
}

function finalizeDelete(id)
{

}

function acceptFriend(id) {
    window.electronAPI.acceptFriend(id);
}

function renderFriendCards(friends)
{
    friendContainer.innerHTML = "";

    friends.forEach(friend => {
        const clone = friendTemplate.content.cloneNode(true);
        clone.querySelector('.player-name').textContent = friend.name;
        clone.querySelector('.player-id').textContent = friend.id;
        
        clone.getElementById('btn-delete').addEventListener('click', function () {
            const id = friend.id;
            confirmDelete(id);
        });
        clone.getElementById('btn-cancel').addEventListener('click', function () {
            const id = friend.id;
            cancelDelete(id);
        });

        clone.querySelector('.friend-card').setAttribute('id', friend.id);
        clone.getElementById('btn-delete').setAttribute('id', 'btn-delete-'+friend.id);
        clone.getElementById('btn-cancel').setAttribute('id', 'btn-cancel-'+friend.id);

        clone.getElementById('btn-accept').addEventListener('click', function () {
            const id = friend.id;
            acceptFriend(id);
        });

        if(!friend.pending)
        {
            clone.getElementById('btn-accept').classList.add('hidden');
        }
        clone.getElementById('btn-accept').setAttribute('id', 'btn-accept-'+friend.id);
        
        friendContainer.appendChild(clone);
        
    });
}
window.electronAPI.onUpdateFriendList((value) => {
    console.log("Friend list updated via IPC");
    renderFriendCards(value);
});

function setupDeletes()
{

}