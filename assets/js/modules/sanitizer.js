const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=/]/g, s => HTML_ENTITIES[s]);
}

function escapeAttribute(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=]/g, s => HTML_ENTITIES[s]);
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return 'about:blank';
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('data:') || 
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('file:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('mailto:')) {
    return 'about:blank';
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'about:blank';
    }
    return parsed.href;
  } catch {
    return 'about:blank';
  }
}

function sanitizeStyleValue(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[{};]/g, '').replace(/expression\s*\(/gi, '').replace(/javascript\s*:/gi, '');
}

function sanitizeClassName(className) {
  if (!className || typeof className !== 'string') return '';
  return className.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
}

function sanitizeId(id) {
  if (!id || typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_\-:]/g, '').trim();
}

function createSafeElement(tag, attributes = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.substring(2).toLowerCase(), value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'className') {
      el.className = sanitizeClassName(value);
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        el.dataset[sanitizeId(dataKey)] = escapeAttribute(dataValue);
      }
    } else {
      el.setAttribute(sanitizeId(key), escapeAttribute(value));
    }
  }
  for (const child of children) {
    if (child instanceof Node) {
      el.appendChild(child);
    } else if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    }
  }
  return el;
}

function setSafeInnerHTML(element, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_ATTRIBUTE,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          const allowedTags = ['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 
            'code', 'pre', 'blockquote', 'a', 'img', 'svg', 'path', 'line', 'circle', 'rect',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input', 'select'];
          if (!allowedTags.includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const allowedAttrs = ['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'target', 
            'rel', 'data-tag', 'data-message-id', 'data-sender-uid', 'data-context', 'onclick'];
          for (const attr of node.attributes) {
            if (!allowedAttrs.includes(attr.name.toLowerCase()) && !attr.name.startsWith('data-')) {
              node.removeAttribute(attr.name);
            } else if (attr.name === 'href' || attr.name === 'src') {
              attr.value = sanitizeUrl(attr.value);
            } else if (attr.name === 'onclick') {
              node.removeAttribute('onclick');
            } else if (attr.name === 'style') {
              attr.value = attr.value.replace(/expression\s*\(/gi, '').replace(/javascript\s*:/gi, '');
            }
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  walker.currentNode = template.content;
  while (walker.nextNode()) {}
  
  element.innerHTML = '';
  element.appendChild(template.content);
}

export const Sanitizer = {
  escapeHtml,
  escapeAttribute,
  sanitizeUrl,
  sanitizeStyleValue,
  sanitizeClassName,
  sanitizeId,
  createSafeElement,
  setSafeInnerHTML
};

window.Sanitizer = Sanitizer;
