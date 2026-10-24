import {
  initializeApp as e,
  getApp as t,
  getApps as s
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth as a
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  initializeFirestore as i,
  persistentLocalCache as r,
  persistentMultipleTabManager as o
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getDatabase as c
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getFirebaseConfig } from "./modules/firebase-env-config.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwddv_-qEU0_5ZLTZTWCgox7VVvtxZx68",
  authDomain: "discord-94524.firebaseapp.com",
  databaseURL: "https://discord-94524-default-rtdb.firebaseio.com",
  projectId: "discord-94524",
  storageBucket: "discord-94524.firebasestorage.app",
  messagingSenderId: "25789751728",
  appId: "1:25789751728:web:60d7e38a4b8fc4f1b77675",
  measurementId: "G-J4YB8VD70Z"
};

let f;
let d;
let p;
let b;

export let db = null;
export let auth = null;
export let rtdb = null;

let _initPromise = null;
function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const injectedConfig = getFirebaseConfig({ silent: true });
    const config = Object.fromEntries(Object.entries(firebaseConfig).map(([key, value]) => [
      key,
      injectedConfig[key] || value
    ]));

    const hasPlaceholders = ["apiKey", "authDomain", "projectId"].some(key =>
      !config[key] || (typeof config[key] === "string" && config[key].startsWith("YOUR_"))
    );
    if (hasPlaceholders) {
      console.warn("[Firebase] Configuration is missing; Firebase services are disabled until valid settings are provided.");
      return;
    }
    
    f = 0 === s().length ? e(config) : t();
    
    try {
      d = i(f, {
        localCache: r({
          tabManager: o()
        })
      })
      window.__firestoreDb = d;
    } catch (e) {
      if ("failed-precondition" === e.code || e.message.includes("already been initialized")) {
        const { getFirestore: e } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        d = e(f)
      } else {
        const { getFirestore: e } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        d = e(f)
      }
    }
    p = a(f);
    if (/^https:\/\/(?:[^/]+\.)?firebaseio\.com(?:\/.*)?$/.test(config.databaseURL) ||
        /^https:\/\/[^/]+\.firebasedatabase\.app(?:\/.*)?$/.test(config.databaseURL)) {
      b = c(f, config.databaseURL);
    } else {
      console.warn("[Firebase] Realtime Database URL is missing or invalid; Realtime Database is disabled.");
      b = null;
    }
    db = d;
    auth = p;
    rtdb = b;
  })();
  return _initPromise;
}

initFirebase().catch(err => {
  console.error('[Firebase] Initialization failed:', err);
});

export const getApp = () => f;
export const getDb = () => d;
export const getAuth = () => p;
export const getRtdb = () => b;
export const whenReady = () => initFirebase();
