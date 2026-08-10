document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const sessionStatus = document.getElementById('session-status');
  const userVal = document.getElementById('user-val');
  const btnLogin = document.getElementById('btn-login-mercari');

  // Query Mercari cookies to check session state
  chrome.cookies.getAll({ domain: 'mercari.com' }, (cookies) => {
    const hasSid = cookies.some(c => c.name === 'sid' || c.name === 'user_id');
    if (hasSid) {
      statusBadge.classList.add('active');
      statusText.textContent = 'Active';
      sessionStatus.textContent = 'Logged In';
      sessionStatus.style.color = '#10b981';
      userVal.textContent = 'Connected';
    } else {
      statusText.textContent = 'Disconnected';
      sessionStatus.textContent = 'Not Logged In';
      sessionStatus.style.color = '#ef4444';
      userVal.textContent = 'N/A';
    }
  });

  btnLogin.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.mercari.com/signin/' });
  });
});
