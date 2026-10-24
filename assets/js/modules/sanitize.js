/**
 * HTML Sanitization Utility
 * Provides safe alternatives to innerHTML for user-controlled content
 */

const ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'u', 's', 'code', 'pre', 'span', 'div', 'p',
  'br', 'a', 'img', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'mark', 'small', 'sub', 'sup', 'del', 'ins'
]);

const ALLOWED_ATTRIBUTES = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target', 'rel',
  'data-tag', 'data-message-id', 'data-sender-uid', 'data-context', 'data-raw-text',
  'data-pending', 'data-action', 'data-args', 'data-uid', 'data-msg-id', 'data-count',
  'contenteditable', 'role', 'aria-label', 'aria-multiline',
  'placeholder', 'tabindex'
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'data:']);

const BLOCKED_EVENT_HANDLERS = [
  'onload', 'onerror', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
  'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange',
  'onsubmit', 'onreset', 'onselect', 'onresize', 'onscroll', 'onunload',
  'onabort', 'onbeforeunload', 'onhashchange', 'onmessage', 'onpopstate',
  'onstorage', 'onpagehide', 'onpageshow', 'ononline', 'onoffline',
  'ondrag', 'ondragstart', 'ondragend', 'ondragenter', 'ondragleave',
  'ondragover', 'ondrop', 'oncopy', 'oncut', 'onpaste'
];

function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeAttributeValue(name, value) {
  if (!value || typeof value !== 'string') return '';
  
  if (name === 'href' || name === 'src') {
    if (!isSafeUrl(value)) return '';
    return escapeHtml(value);
  }
  
  if (name === 'style') {
    return sanitizeCss(value);
  }
  
  if (name.startsWith('on')) {
    return '';
  }
  
  return escapeHtml(value);
}

function sanitizeCss(css) {
  if (!css) return '';
  const dangerous = [
    'expression', 'javascript:', 'vbscript:', 'mocha:', 'livescript:',
    'behavior', '-moz-binding', 'xss', 'import', '@import'
  ];
  let result = css;
  for (const d of dangerous) {
    const regex = new RegExp(d, 'gi');
    result = result.replace(regex, '');
  }
  return result.replace(/[{};]/g, '');
}

export function createSafeElement(tag, attributes = {}, children = []) {
  const el = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (ALLOWED_ATTRIBUTES.has(key.toLowerCase())) {
      const safeValue = sanitizeAttributeValue(key, value);
      if (safeValue) {
        if (key.startsWith('data-') || key === 'class' || key === 'id' || key === 'style') {
          el.setAttribute(key, safeValue);
        } else if (key === 'href' || key === 'src') {
          el[key] = safeValue;
        } else {
          el.setAttribute(key, safeValue);
        }
      }
    }
  }
  
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else if (Array.isArray(child)) {
      el.appendChild(createSafeElement(...child));
    }
  }
  
  return el;
}

export function setSafeInnerHTML(container, htmlString) {
  if (!container) return;
  
  const template = document.createElement('template');
  template.innerHTML = htmlString;
  
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const safeFragment = document.createDocumentFragment();
  const allowedTagsLower = new Set([...ALLOWED_TAGS].map(t => t.toLowerCase()));
  
  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }
  
  for (const node of nodesToProcess) {
    if (node.nodeType === Node.TEXT_NODE) {
      safeFragment.appendChild(document.createTextNode(node.textContent));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (allowedTagsLower.has(tagName)) {
        const safeEl = document.createElement(tagName);
        
        for (const attr of node.attributes) {
          const attrName = attr.name.toLowerCase();
          if (ALLOWED_ATTRIBUTES.has(attrName) && !BLOCKED_EVENT_HANDLERS.includes(attrName)) {
            const safeValue = sanitizeAttributeValue(attrName, attr.value);
            if (safeValue) {
              safeEl.setAttribute(attr.name, safeValue);
            }
          }
        }
        
        safeFragment.appendChild(safeEl);
        
        const childWalker = document.createTreeWalker(
          node,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let textNode;
        while (textNode = childWalker.nextNode()) {
          safeEl.appendChild(document.createTextNode(textNode.textContent));
        }
      }
    }
  }
  
  container.innerHTML = '';
  container.appendChild(safeFragment);
}

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

export function safeTemplate(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const val = values[i];
      if (val instanceof HTMLElement) {
        result += val.outerHTML;
      } else if (typeof val === 'object' && val !== null) {
        result += escapeHtml(JSON.stringify(val));
      } else {
        result += escapeHtml(String(val));
      }
    }
  }
  return result;
}

export function escapeForAttribute(value) {
  return escapeHtml(String(value));
}

export function escapeForJsString(value) {
  if (!value) return "";
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/<\/script>/gi, '<\\/script>');
}

window.sanitizeHtml = sanitizeHtml;
window.setSafeInnerHTML = setSafeInnerHTML;
window.createSafeElement = createSafeElement;
window.safeTemplate = safeTemplate;
window.escapeForAttribute = escapeForAttribute;
window.escapeForJsString = escapeForJsString;
