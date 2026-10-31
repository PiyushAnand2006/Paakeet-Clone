!function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "903e8b7a-a4d7-5058-8fec-18d53371ee0b");
  } catch (e) {}
}();
!function (e, t) {
  if ("object" == typeof exports && "object" == typeof module) module.exports = t();else if ("function" == typeof define && define.amd) define([], t);else {
    var r = t();
    for (var n in r) ("object" == typeof exports ? exports : e)[n] = r[n];
  }
}(global, () => (() => {
  var e = {
      73727(e, t, r) {
        const n = r(84157);
        var s;
        !function (e) {
          e[e.Classic = 1] = "Classic", e[e.Protocol = 2] = "Protocol", e[e.Both = 3] = "Both";
        }(s || (s = {})), function (e = "sentry-ipc") {
          const t = function (e) {
            return {
              createUrl: t => `${e}://${t}/sentry_key`,
              urlMatches: function (e, t) {
                return e.startsWith(this.createUrl(t));
              },
              createKey: t => `${e}.${t}`,
              namespace: e
            };
          }(e);
          if (window.__SENTRY_IPC__ = window.__SENTRY_IPC__ || {}, window.__SENTRY_IPC__[t.namespace]) ;else {
            const e = {
              sendRendererStart: () => n.ipcRenderer.send(t.createKey("start")),
              sendScope: e => n.ipcRenderer.send(t.createKey("scope"), e),
              sendEnvelope: e => n.ipcRenderer.send(t.createKey("envelope"), e),
              sendStatus: e => n.ipcRenderer.send(t.createKey("status"), e),
              sendStructuredLog: e => n.ipcRenderer.send(t.createKey("structured-log"), e),
              sendMetric: e => n.ipcRenderer.send(t.createKey("metric"), e)
            };
            if (window.__SENTRY_IPC__[t.namespace] = e, n.contextBridge) try {
              n.contextBridge.exposeInMainWorld("__SENTRY_IPC__", window.__SENTRY_IPC__);
            } catch {}
          }
        }();
      },
      85766(e, t) {
        "use strict";

        t.F7 = t.Wf = t.dw = t.Lv = t.kj = t.wM = t.DEFAULT_THEME_SETTINGS = t.E8 = t.k4 = void 0, t.isTheme = function (e) {
          return r.includes(e);
        }, t.k4 = "dark";
        const r = ["light", "dark", "system"];
        function n(e) {
          return "light" === e || "dark" === e ? {
            theme: e,
            resolved: e
          } : "system:light" === e ? {
            theme: "system",
            resolved: "light"
          } : "system:dark" === e ? {
            theme: "system",
            resolved: "dark"
          } : null;
        }
        function s(e) {
          const t = document.cookie.split("; ").find(t => t.startsWith(`${e}=`));
          return t?.slice(e.length + 1);
        }
        t.E8 = ["shell", "liveCall"], t.DEFAULT_THEME_SETTINGS = {
          shell: "light",
          liveCall: "dark"
        }, t.wM = {
          shell: "pk_theme_shell",
          liveCall: "pk_theme_live"
        }, t.kj = 31536e3, t.Lv = {
          read: e => "undefined" == typeof document ? null : function (e) {
            const r = {};
            for (const s of t.E8) {
              const o = n(e(t.wM[s]));
              o && (r[s] = o);
            }
            return r;
          }(s)[e] ?? null,
          write: (e, r, n) => {
            document.cookie = `${t.wM[e]}=${function (e, t) {
              return "system" === e ? `system:${t}` : e;
            }(r, n)}; path=/; max-age=${t.kj}; samesite=lax`;
          }
        }, t.dw = ["/dashboard", "/callSession", "/auth/desktop", "/resumeMaker"], t.Wf = ["/resumeMaker/print"], t.F7 = /^\/callSession\/[^/]+(\/mobile)?$/, JSON.stringify(t.dw), JSON.stringify(t.Wf), t.k4, JSON.stringify(t.F7.source), JSON.stringify(t.wM.liveCall), JSON.stringify(t.wM.shell), JSON.stringify(t.DEFAULT_THEME_SETTINGS.liveCall), JSON.stringify(t.DEFAULT_THEME_SETTINGS.shell), t.k4;
      },
      85086(e, t, r) {
        "use strict";

        t.ipcRendererProxy = void 0;
        const n = r(84157);
        t.ipcRendererProxy = {
          invoke: (e, ...t) => n.ipcRenderer.invoke(e, ...t),
          on: (e, t) => {
            const r = (e, r) => t(r);
            return n.ipcRenderer.on(e, r), () => n.ipcRenderer.removeListener(e, r);
          }
        };
      },
      74969(e, t, r) {
        "use strict";

        t.THEME_FLAGS = void 0, t.parseTheme = function (e, t) {
          return (0, n.isTheme)(t) ? t : n.DEFAULT_THEME_SETTINGS[e];
        };
        const n = r(85766);
        t.THEME_FLAGS = {
          shell: "shell-theme",
          liveCall: "live-call-theme"
        };
      },
      84157(e) {
        "use strict";

        e.exports = require("electron");
      }
    },
    t = {};
  function r(n) {
    var s = t[n];
    if (void 0 !== s) return s.exports;
    var o = t[n] = {
      exports: {}
    };
    return e[n](o, o.exports, r), o.exports;
  }
  var n = {};
  return (() => {
    "use strict";

    var e = n;
    Object.defineProperty(e, "__esModule", {
      value: !0
    }), r(73727);
    const t = r(84157),
      s = r(85086),
      o = r(74969);
    function i(e) {
      const t = `--${e}=`;
      return process.argv.find(e => e.startsWith(t))?.slice(t.length);
    }
    const l = "true" === i("show-meeting-start-toast-only")?.toLowerCase();
    const c = {
        shell: (0, o.parseTheme)("shell", i(o.THEME_FLAGS.shell)),
        liveCall: (0, o.parseTheme)("liveCall", i(o.THEME_FLAGS.liveCall))
      },
      a = {
        ipcRendererProxy: s.ipcRendererProxy,
        platform: process.platform,
        osVersion: process.getSystemVersion(),
        enableLoopbackAudio: () => t.ipcRenderer.invoke("enable-loopback-audio"),
        disableLoopbackAudio: () => t.ipcRenderer.invoke("disable-loopback-audio"),
        showMeetingStartNotificationOnly: l,
        initialThemeSettings: c
      };
    t.contextBridge.exposeInMainWorld("electron", a);
  })(), n;
})());
//# debugId=903e8b7a-a4d7-5058-8fec-18d53371ee0b
