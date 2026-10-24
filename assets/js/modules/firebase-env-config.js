/**
 * Firebase Configuration Loader
 * Loads Firebase config from environment or secure storage
 * Never hardcode API keys in source code!
 */

const getFirebaseConfig = ({ silent = false } = {}) => {
  const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
  
  if (isElectron) {
    return {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      databaseURL: process.env.FIREBASE_DATABASE_URL || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
    };
  }
  
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
    return window.__FIREBASE_CONFIG__;
  }
  
  try {
    const stored = localStorage.getItem('firebase_config');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  
  if (!silent) {
    console.error('[Firebase] No configuration found! Set environment variables or inject at build time.');
  }
  return {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  };
};

const validateConfig = (config) => {
  const required = ['apiKey', 'authDomain', 'projectId'];
  const missing = required.filter(field => !config[field]);
  if (missing.length > 0) {
    throw new Error(`[Firebase] Missing required config fields: ${missing.join(', ')}`);
  }
  return true;
};

export { getFirebaseConfig, validateConfig };

if (typeof window !== 'undefined') {
  window.getFirebaseConfig = getFirebaseConfig;
  window.validateFirebaseConfig = validateConfig;
}
