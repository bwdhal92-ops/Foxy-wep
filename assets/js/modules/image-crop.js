let cropFile = null;
let cropMode = 'avatar';
let cropImage = null;
let cropScale = 1;
let frameOffsetX = 0;
let frameOffsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOrigOffsetX = 0;
let dragOrigOffsetY = 0;

const ASPECT = {
  avatar: 1,
  banner: 3
};

window.openCropModal = function(file, mode) {
  cropFile = file;
  cropMode = mode;
  cropScale = 1;
  frameOffsetX = 0;
  frameOffsetY = 0;

  const modal = document.getElementById('crop-modal');
  const title = document.getElementById('crop-modal-title');
  const img = document.getElementById('crop-image');
  const zoom = document.getElementById('crop-zoom');

  title.textContent = mode === 'avatar' ? window.__fb('app_profile.crop_title_avatar', 'قص الصورة الشخصية') : window.__fb('app_profile.crop_title_banner', 'قص الخلفية');

  const reader = new FileReader();
  reader.onload = function(e) {
    img.onload = function() {
      cropImage = img;
      zoom.value = 1;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      applyCropTransform();
      setTimeout(applyCropTransform, 50);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

function closeCropModal() {
  const modal = document.getElementById('crop-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  cropImage = null;
  cropFile = null;
}

window.closeCropModal = closeCropModal;

function clampOffset(cw, ch, fw, fh) {
  const maxX = (cw - fw) / 2;
  const maxY = (ch - fh) / 2;
  frameOffsetX = Math.max(-maxX, Math.min(maxX, frameOffsetX));
  frameOffsetY = Math.max(-maxY, Math.min(maxY, frameOffsetY));
}

function applyCropTransform() {
  const img = document.getElementById('crop-image');
  const container = document.getElementById('crop-container');
  const frame = document.getElementById('crop-frame');
  if (!img || !container || !frame || !cropImage) return;

  const ratio = ASPECT[cropMode] || 1;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  let fw, fh;
  if (ratio >= 1) {
    fw = cw * 0.85;
    fh = fw / ratio;
    if (fh > ch * 0.85) {
      fh = ch * 0.85;
      fw = fh * ratio;
    }
  } else {
    fh = ch * 0.85;
    fw = fh * ratio;
    if (fw > cw * 0.85) {
      fw = cw * 0.85;
      fh = fw / ratio;
    }
  }
  clampOffset(cw, ch, fw, fh);
  frame.style.width = fw + 'px';
  frame.style.height = fh + 'px';
  frame.style.top = ((ch - fh) / 2 + frameOffsetY) + 'px';
  frame.style.left = ((cw - fw) / 2 + frameOffsetX) + 'px';

  const iw = cropImage.naturalWidth;
  const ih = cropImage.naturalHeight;

  let displayW = cw * cropScale;
  let displayH = displayW * (ih / iw);
  if (displayH < ch * cropScale) {
    displayH = ch * cropScale;
    displayW = displayH * (iw / ih);
  }

  img.style.width = displayW + 'px';
  img.style.height = displayH + 'px';
  img.style.left = (cw / 2 - displayW / 2) + 'px';
  img.style.top = (ch / 2 - displayH / 2) + 'px';
}

function getCropRect() {
  const container = document.getElementById('crop-container');
  const img = document.getElementById('crop-image');
  const frame = document.getElementById('crop-frame');
  if (!container || !img || !frame || !cropImage) return null;

  const cRect = container.getBoundingClientRect();
  const fRect = frame.getBoundingClientRect();
  const iRect = img.getBoundingClientRect();

  const fx = fRect.left - cRect.left;
  const fy = fRect.top - cRect.top;
  const fw = fRect.width;
  const fh = fRect.height;

  const ix = parseFloat(img.style.left) || 0;
  const iy = parseFloat(img.style.top) || 0;
  const iw = parseFloat(img.style.width) || cropImage.naturalWidth;
  const ih = parseFloat(img.style.height) || cropImage.naturalHeight;

  const natW = cropImage.naturalWidth;
  const natH = cropImage.naturalHeight;
  const scaleX = natW / iw;
  const scaleY = natH / ih;

  const cropX = (fx - ix) * scaleX;
  const cropY = (fy - iy) * scaleY;
  const cropW = fw * scaleX;
  const cropH = fh * scaleY;

  return {
    x: Math.max(0, cropX),
    y: Math.max(0, cropY),
    w: Math.min(cropW, natW - cropX),
    h: Math.min(cropH, natH - cropY)
  };
}

async function cropAndExport() {

  if (cropFile?.type === 'image/gif') return cropFile;
  const rect = getCropRect();
  if (!rect || rect.w < 1 || rect.h < 1) return null;

  const canvas = document.createElement('canvas');
  const maxSize = cropMode === 'avatar' ? 512 : 1200;
  let outW, outH;
  if (rect.w >= rect.h) {
    outW = maxSize;
    outH = Math.round(rect.h * (maxSize / rect.w));
  } else {
    outH = maxSize;
    outW = Math.round(rect.w * (maxSize / rect.h));
  }
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropImage, rect.x, rect.y, rect.w, rect.h, 0, 0, outW, outH);

  return new Promise(function(resolve) {
    canvas.toBlob(function(blob) {
      if (!blob) return resolve(null);
      resolve(new File([blob], cropFile.name, {
        type: 'image/jpeg'
      }));
    }, 'image/jpeg', 0.92);
  });
}

window.confirmCrop = async function() {
  const croppedFile = await cropAndExport();
  if (!croppedFile) return alert(window.__fb('app_profile.crop_failed', 'فشل قص الصورة'));

  const btn = document.getElementById('crop-confirm-btn');
  btn.disabled = true;
  btn.textContent = window.__fb('app_profile.crop_processing', 'جاري المعالجة...');

  try {
    const {
      compressImage,
      uploadToImgBB
    } = await import('./mentions.js');

    if (cropMode === 'avatar') {
      const imgFile = croppedFile.type === 'image/gif' ? croppedFile : await compressImage(croppedFile, 512, 512);
      const result = await uploadToImgBB(imgFile, function(pct) {
        const el = document.getElementById('avatar-upload-percent');
        if (el) el.textContent = pct + '%';
      });
      const avatarColor = await extractDominantColorSimple(result.url);
      window.pendingAvatarURL = result.url;
      window.pendingAvatarDelete = false;
      window.pendingAvatarColor = avatarColor || null;

      if (typeof window.updateLocalAvatarUI === 'function') {
        window.updateLocalAvatarUI(result.url);
      }
      if (avatarColor && typeof window.updateBannerColorPreview === 'function') {
        window.updateBannerColorPreview(avatarColor);
      }
      if (typeof window.showSettingsSaveBar === 'function') {
        window.showSettingsSaveBar();
      }
    } else if (cropMode === 'banner') {
      const imgFile = croppedFile.type === 'image/gif' ? croppedFile : await compressImage(croppedFile, 1200, 400);
      const result = await uploadToImgBB(imgFile);
      window.pendingBannerURL = result.url;
      window.pendingBannerDelete = false;

      const colorInput = document.getElementById('settings-banner-color');
      if (colorInput && typeof window.updateBannerColorPreview === 'function') {
        window.updateBannerColorPreview(colorInput.value || '#3b82f6');
      }
      const removeBtn = document.getElementById('settings-remove-banner-btn');
      if (removeBtn) removeBtn.classList.remove('hidden');
      const removeBtnMobile = document.getElementById('settings-remove-banner-btn-mobile');
      if (removeBtnMobile) removeBtnMobile.classList.remove('hidden');
      if (typeof window.showSettingsSaveBar === 'function') {
        window.showSettingsSaveBar();
      }
      if (typeof window.addSystemMsg === 'function') {
        window.addSystemMsg(window.__fb('app_profile.crop_success_banner', 'تم رفع الخلفية بنجاح! لا تنس حفظ التغييرات.'));
      }
    }

    closeCropModal();
  } catch (e) {
    alert(window.__fb('app_profile.image_upload_failed', 'فشل رفع الصورة: ') + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = window.__fb('app_profile.crop_confirm', 'تأكيد القص');
  }
};

async function extractDominantColorSimple(url) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 50, 50);
        var data = ctx.getImageData(0, 0, 50, 50).data;
        var r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (var i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (avg < 20 || avg > 235) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) return resolve(null);
        resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = function() {
      resolve(null);
    };
    img.src = 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=50&h=50&fit=cover&output=webp';
  });
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(function(x) {
    return x.toString(16).padStart(2, '0');
  }).join('');
}

document.addEventListener('mousedown', function(e) {
  var frame = document.getElementById('crop-frame');
  if (!frame || !frame.closest('#crop-container')) return;
  if (e.target.closest('#crop-zoom, #crop-zoom *')) return;
  if (document.getElementById('crop-modal').classList.contains('hidden')) return;

  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOrigOffsetX = frameOffsetX;
  dragOrigOffsetY = frameOffsetY;
  frame.style.cursor = 'grabbing';
  e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  frameOffsetX = dragOrigOffsetX + (e.clientX - dragStartX);
  frameOffsetY = dragOrigOffsetY + (e.clientY - dragStartY);
  applyCropTransform();
});

document.addEventListener('mouseup', function() {
  if (!isDragging) return;
  isDragging = false;
  var frame = document.getElementById('crop-frame');
  if (frame) frame.style.cursor = 'grab';
});

document.addEventListener('touchstart', function(e) {
  var frame = document.getElementById('crop-frame');
  if (!frame || !frame.closest('#crop-container')) return;
  if (e.target.closest('#crop-zoom, #crop-zoom *')) return;
  if (document.getElementById('crop-modal').classList.contains('hidden')) return;
  var touch = e.touches[0];
  isDragging = true;
  dragStartX = touch.clientX;
  dragStartY = touch.clientY;
  dragOrigOffsetX = frameOffsetX;
  dragOrigOffsetY = frameOffsetY;
}, {
  passive: true
});

document.addEventListener('touchmove', function(e) {
  if (!isDragging) return;
  var touch = e.touches[0];
  frameOffsetX = dragOrigOffsetX + (touch.clientX - dragStartX);
  frameOffsetY = dragOrigOffsetY + (touch.clientY - dragStartY);
  applyCropTransform();
}, {
  passive: true
});

document.addEventListener('touchend', function() {
  isDragging = false;
});

document.addEventListener('input', function(e) {
  if (e.target.id === 'crop-zoom') {
    cropScale = parseFloat(e.target.value);
    applyCropTransform();
  }
});

window.addEventListener('resize', function() {
  if (!document.getElementById('crop-modal').classList.contains('hidden')) {
    applyCropTransform();
  }
});
