import { getAuth, signInWithPopup, GoogleAuthProvider, signInAnonymously, onAuthStateChanged, signInWithCredential, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { buildProfileColorPatch, getRandomProfileColor, extractPhotoColor } from "./profile-color.js";

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
const googleLoginBtn = document.getElementById("google-login-btn");
const guestLoginBtn = document.getElementById("guest-login-btn");
const errorAlert = document.getElementById("error-alert");
const errorMessageText = document.getElementById("error-message-text");
const loadingSpinner = document.getElementById("loading-spinner");

function setLoading(show) {
  show ? (loadingSpinner.style.display = "flex", errorAlert.style.display = "none") : loadingSpinner.style.display = "none";
}

function showError(msg) {
  errorMessageText.textContent = msg;
  errorAlert.style.display = "flex";
  setLoading(false);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    setLoading(true);
    try {
      await (async (user) => {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const existing = userSnap.exists() ? userSnap.data() : null;
        const authPhoto = user.photoURL || "";
        if (userSnap.exists()) {
          const photoURL = authPhoto || existing.photoURL || "";
          const patch = { lastLogin: serverTimestamp(), photoURL };
          const colorPatch = await buildProfileColorPatch(existing, photoURL, existing.bannerColor);
          if (colorPatch) Object.assign(patch, colorPatch);
          await setDoc(userRef, patch, { merge: true });
        } else {
          const tag = Math.floor(1000 + 9000 * Math.random()).toString();
          let displayName = user.displayName || window.__fb("app_auth.guest_name", "ضيف");
          let photoURL = authPhoto;
          if (window.guestPendingProfile) {
            displayName = window.guestPendingProfile.name || displayName;
            photoURL = window.guestPendingProfile.photo || photoURL;
          }
          const fullTag = `${displayName}#${tag}`;
          if (window.guestPendingProfile) {
            try {
              await updateProfile(user, {
                displayName,
                photoURL
              });
            } catch (e) {
              console.warn("فشل تحديث ملف الزائر:", e);
            }
          }
          let avatarColor = null;
          if (photoURL && /^https?:\/\//i.test(photoURL)) avatarColor = await extractPhotoColor(photoURL, 1500, 4000);
          if (!avatarColor) avatarColor = getRandomProfileColor();
          await setDoc(userRef, {
            uid: user.uid,
            displayName,
            tag,
            fullTag,
            photoURL,
            avatarColor,
            bannerColor: avatarColor,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            friends: []
          });
        }
      })(user);
    } catch (e) {
      console.error("فشل إنشاء مستند المستخدم:", e);
    }
    window.location.replace("web.html");
  }
});

if (window.electronAPI && window.electronAPI.onExternalAuthSuccess) {
  window.electronAPI.onExternalAuthSuccess(async (tokens) => {
    try {
      const credential = GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken);
      await signInWithCredential(auth, credential);
      window.location.replace("web.html");
    } catch (e) {
      showError(window.__fb("login_page.error_browser_auth", "فشل إكمال تسجيل الدخول من المتصفح."));
    }
  });
}

googleLoginBtn.addEventListener("click", async () => {
  try {
    setLoading(true);
    if (window.electronAPI && window.electronAPI.googleLoginExternal) {
      return void window.electronAPI.googleLoginExternal();
    }
    await signInWithPopup(auth, googleProvider);
    window.location.replace("web.html");
  } catch (e) {
    let msg = window.__fb("login_page.error_google", "حدث خطأ أثناء تسجيل الدخول بجوجل.");
    if (e.code === "auth/popup-closed-by-user") msg = window.__fb("login_page.error_popup_closed", "تم إغلاق نافذة تسجيل الدخول. حاول مرة أخرى.");
    else if (e.code === "auth/cancelled-popup-request") msg = window.__fb("login_page.pending_request", "يوجد طلب تسجيل دخول قيد المعالجة بالفعل.");
    showError(msg);
  }
});

const guestModal = document.getElementById("guest-modal");
const guestNameInput = document.getElementById("guest-name-input");
const guestPhotoInput = document.getElementById("guest-photo-input");
const guestCancelBtn = document.getElementById("guest-cancel-btn");
const guestConfirmBtn = document.getElementById("guest-confirm-btn");

guestLoginBtn.addEventListener("click", () => {
  guestModal && (guestModal.style.display = "flex");
});
guestNameInput && guestNameInput.addEventListener("input", () => {
  guestNameInput.style.border = "none";
});

const guestAvatarPreview = document.getElementById("guest-avatar-preview");
const guestFileInput = document.getElementById("guest-file-input");
const guestAvatarIcon = document.getElementById("guest-avatar-icon");
const guestAvatarImg = document.getElementById("guest-avatar-img");
const guestAvatarFox = document.getElementById("guest-avatar-fox");

if (guestAvatarIcon) guestAvatarIcon.style.display = "none";
if (guestAvatarPreview) guestAvatarPreview.style.backgroundColor = getRandomProfileColor();

guestAvatarPreview && guestFileInput && (guestAvatarPreview.onclick = () => guestFileInput.click(), guestFileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 2097152) return void alert(window.__fb("login_page.image_too_big", "حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 2 ميجا."));
    const reader = new FileReader;
    reader.onload = (e) => {
      const result = e.target.result;
      guestAvatarImg && (guestAvatarImg.src = result, guestAvatarImg.style.display = "block");
      guestAvatarFox && (guestAvatarFox.style.display = "none");
      guestAvatarIcon && (guestAvatarIcon.style.display = "none");
      guestPhotoInput && (guestPhotoInput.value = result);
    };
    reader.readAsDataURL(file);
  }
});

guestCancelBtn && guestCancelBtn.addEventListener("click", () => {
  guestModal.style.display = "none";
  guestNameInput.value = "";
  guestPhotoInput.value = "";
  guestAvatarImg && (guestAvatarImg.src = "", guestAvatarImg.style.display = "none");
  guestAvatarFox && (guestAvatarFox.style.display = "block");
  guestAvatarIcon && (guestAvatarIcon.style.display = "none");
  guestAvatarPreview && (guestAvatarPreview.style.backgroundColor = getRandomProfileColor());
  guestFileInput && (guestFileInput.value = "");
});

guestConfirmBtn && guestConfirmBtn.addEventListener("click", async () => {
  try {
    const name = guestNameInput.value.trim();
    const photo = guestPhotoInput.value.trim();
    if (!name) return guestNameInput.style.border = "1px solid #ff4747", guestNameInput.focus(), void alert(window.__fb("login_page.enter_name_first", "يرجى إدخال اسم مستعار للمتابعة."));
    guestModal.style.display = "none";
    setLoading(true);
    window.guestPendingProfile = { name, photo };
    await signInAnonymously(auth);
  } catch (e) {
    showError(window.__fb("login_page.guest_error", "حدث خطأ أثناء محاولة الدخول كزائر. يرجى المحاولة لاحقاً."));
  }
});

function h(e) {
  e ? (f.style.display = "flex", w.style.display = "none") : f.style.display = "none";
}

function E(e) {
  p.textContent = e, w.style.display = "flex", h(!1);
}