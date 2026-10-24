try {
  window.FOXY_EXPAND_LOGS = (typeof localStorage !== "undefined" && localStorage.getItem("foxy_expand_logs") === "1");
} catch (_) {
  window.FOXY_EXPAND_LOGS = false;
}

window.foxyFmt = function(data, maxLen) {
  maxLen = maxLen || 800;
  try {
    var seen = [];
    var s = JSON.stringify(data, function(k, v) {
      if (v instanceof Error) {
        return {
          name: v.name,
          message: v.message,
          stack: String(v.stack || "").split("\n").slice(0, 4).join(" <- ")
        };
      }
      if (typeof v === "function") return "[Function]";
      if (v && typeof v === "object") {
        if (seen.indexOf(v) !== -1) return "[Circular]";
        seen.push(v);
      }
      if (typeof v === "string" && v.length > 200) return v.slice(0, 200) + "…";
      return v;
    });
    if (s == null) return String(data);
    return s.length > maxLen ? s.slice(0, maxLen) + "…(truncated)" : s;
  } catch (_) {
    try { return String(data); } catch (_) { return "[unserializable]"; }
  }
};

window.foxyLog = function(level, tag, data) {
  try {
    var fn = (level && console[level]) || console.log;
    var extras = Array.prototype.slice.call(arguments, 3);
    if (window.FOXY_EXPAND_LOGS) {
      var text = tag + " " + window.foxyFmt(data);
      for (var i = 0; i < extras.length; i++) text += " " + window.foxyFmt(extras[i]);
      fn.call(console, text);
    } else if (arguments.length > 2) {
      fn.apply(console, [tag, data].concat(extras));
    } else {
      fn.call(console, tag);
    }
  } catch (_) {}
};

window.foxyExpandLogs = function(on) {
  window.FOXY_EXPAND_LOGS = on !== false;
  try {
    if (typeof localStorage !== "undefined") {
      if (window.FOXY_EXPAND_LOGS) localStorage.setItem("foxy_expand_logs", "1");
      else localStorage.removeItem("foxy_expand_logs");
    }
  } catch (_) {}
  try {
    console.info("[Foxy][log] expanded logs " + (window.FOXY_EXPAND_LOGS ? "ON — Objects print open as text (remembered)" : "OFF — back to collapsed Objects"));
  } catch (_) {}
};
