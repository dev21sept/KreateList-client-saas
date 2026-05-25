export const getLandingUrl = (path = '') => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev && !hostname.startsWith('app.')) {
    return path || '/';
  }
  
  const port = window.location.port ? `:${window.location.port}` : '';
  const landingBase = isDev ? `http://localhost${port}` : 'https://elister.ai';
  return `${landingBase}${path}`;
};

export const getAppUrl = (path = '') => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev && !hostname.startsWith('app.')) {
    return path || '/';
  }
  
  const port = window.location.port ? `:${window.location.port}` : '';
  const appBase = isDev ? `http://app.localhost${port}` : 'https://app.elister.ai';
  return `${appBase}${path}`;
};
