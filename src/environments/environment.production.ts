export const environment = {
  production: true,
  apiUrl: '/api',
  wsUrl: (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
    (typeof window !== 'undefined' ? window.location.host : '') + '/ws',
};
