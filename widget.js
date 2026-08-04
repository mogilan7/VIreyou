(() => {
  var e,
    r = {
      249: function (e, r, t) {
        "use strict";
        function i(e, r, t) {
          return (
            r in e
              ? Object.defineProperty(e, r, {
                  value: t,
                  enumerable: !0,
                  configurable: !0,
                  writable: !0,
                })
              : (e[r] = t),
            e
          );
        }
        (t.r(r), t.d(r, { _: () => i }));
      },
    },
    t = {};
  function i(e) {
    var o = t[e];
    if (void 0 !== o) return o.exports;
    var n = (t[e] = { exports: {} });
    return (r[e](n, n.exports, i), n.exports);
  }
  ((i.d = (e, r) => {
    for (var t in r)
      i.o(r, t) &&
        !i.o(e, t) &&
        Object.defineProperty(e, t, { enumerable: !0, get: r[t] });
  }),
    (i.o = (e, r) => Object.prototype.hasOwnProperty.call(e, r)),
    (i.r = (e) => {
      ("undefined" != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(e, "__esModule", { value: !0 }));
    }),
    (e = i(249)),
    (window.ProdamusWidget = class {
      async open() {
        this.isValidConfig() &&
          (await this.addIframe(),
          (window.onmessage = (e) => {
            var r;
            (null == (r = e.data) ? void 0 : r.name) &&
              ("load" === e.data.name && this.sendConfig(),
              "close" === e.data.name && this.removeFrame());
          }));
      }
      async addIframe() {
        let e = null,
          r = null;
        ((this.iframe = document.createElement("iframe")),
          (this.iframe.style =
            "border: none; position: fixed; top: 0; left: 0; height: 100%; width: 100%; z-index: 10000000; background: rgb(0 0 0 / 50%);"),
          (this.iframe.name = "prodamusWidget"));
        let t = new Promise((t, i) => {
          ((e = t), (r = i));
        });
        return (
          (this.iframe.onload = () => {
            e();
          }),
          (this.iframe.onerror = () => {
            r();
          }),
          document.body.append(this.iframe),
          (this.iframe.src = this.iframeUrl),
          t
        );
      }
      removeFrame() {
        this.iframe.remove();
      }
      sendConfig() {
        this.iframe.contentWindow.postMessage(
          { name: "init", value: this.config },
          this.host,
        );
      }
      isValidConfig() {
        return this.requiredParams.every((e) => {
          var r;
          return (
            !!(null == (r = this.config[e]) ? void 0 : r.length) ||
            (console.error(
              `ProdamusWidget: field '${e}' is required for config`,
            ),
            !1)
          );
        });
      }
      constructor(r) {
        (e._(this, "host", null),
          e._(this, "iframeUrl", ""),
          e._(this, "iframe", null),
          e._(this, "config", null),
          e._(this, "requiredParams", [
            "merchantId",
            "salesChannelId",
            "currency",
            "products",
          ]));
        try {
          this.host = "https://widget.payform.ru/";
        } catch {
          this.host = location.origin;
        }
        ((this.iframeUrl = new URL(this.host)),
          this.iframeUrl.searchParams.append("t", Date.now()),
          (this.config = r));
      }
    }));
})();
