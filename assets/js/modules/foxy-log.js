// Foxy expanded logging helper (classic script, loads before all modules).
// Problem: diagnostic logs print live `Object` references that must be clicked
// open one by one (thousands during a 5-member call), and copying the console
// gives useless `Object` lines. This helper adds an opt-in expanded mode:
//
//   window.foxyExpandLogs(true)   -> all Foxy logs print as open text (JSON)
//   window.foxyExpandLogs(false)  -> back to collapsed Object mode (default)
//
// Default behavior is UNCHANGED (collapsed) so there is zero overhead/risk
// unless the user explicitly enables expanded mode while debugging.
// Persisted preference: run foxyExpandLogs(true) once and it stays ON across
// reloads for YOU, while everyone else (and DEVs) keeps the default collapsed
// mode. Default stays collapsed on purpose: collapsed Objects allow live
// drill-down into nested state beyond the 800-char text cap, and avoid
// stringify work on low-end devices unless debugging.
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
