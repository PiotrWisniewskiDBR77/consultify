! function() {
    function t(t, e) { var n = RegExp("[?&]" + e + "=([^&#]*)", "i").exec(t); return null == n ? "" : n[1] || "" }

    function e(t) { var e = document.cookie.match(RegExp("(^| )" + t + "=([^;]+)", "i")); if (e) return e[2] }

    function n(t) { var e = document.cookie,
            n = t + "=",
            o = e.indexOf("; " + n); if (-1 == o) { if (0 != (o = e.indexOf(n))) return null } else { o += 2; var i = document.cookie.indexOf(";", o); - 1 == i && (i = e.length) } return decodeURI(e.substring(o + n.length, i)) }

    function o(t) { var n = e("utmparam"); if (n) { var o = (n = n.split("/")).find(function(e) { if (e.includes(t)) return e }); if (o) return o.split("+")[1] } return "" }
    String.prototype.includes || (String.prototype.includes = function(t, e) { return "number" != typeof e && (e = 0), !(e + t.length > this.length) && -1 !== this.indexOf(t, e) }), Array.prototype.find || Object.defineProperty(Array.prototype, "find", { value: function(t) { if (this == null) throw TypeError('"this" is null or not defined'); var e = Object(this),
                n = e.length >>> 0; if ("function" != typeof t) throw TypeError("predicate must be a function"); for (var o = arguments[1], i = 0; i < n;) { var a = e[i]; if (t.call(o, a, i, e)) return a;
                i++ } } }), Array.prototype.forEach || (Array.prototype.forEach = function(t) { "use strict"; if (void 0 === this || this === null || "function" != typeof t) throw TypeError(); for (var e = Object(this), n = e.length >>> 0, o = arguments.length >= 2 ? arguments[1] : void 0, i = 0; i < n; i++) i in e && t.call(o, e[i], i, e) }), window.onerror = function(t) { window.console }; var i, a, r = Object.prototype.hasOwnProperty;! function(n, l) { if (!n.DSxWebAppForm || !n.DSxWebAppForm.embedLoaded) {
            (DSxWebAppForm = n.DSxWebAppForm = n.DSxWebAppForm || {}).embedLoaded = !0; var c = n.addEventListener ? "addEventListener" : "attachEvent",
                d = n[c],
                u = "attachEvent" == c ? "onmessage" : "message";
            DSxWebAppForm.loadForm = function t(n, o, a) { var l = arguments[0],
                    c = arguments[1]; if ("string" == typeof l ? (l.includes("WebForm") || l.includes("WFC") || l.includes("LDP")) && (o = l, a = c) : "string" == typeof c && (c.includes("WebForm") || c.includes("WFC") || c.includes("LDP")) && (o = c, a = l), function t(e) { if (null == e) return !0; if (e.length > 0) return !1; if (0 === e.length || "object" != typeof e) return !0; for (var n in e)
                            if (r.call(e, n)) return !1;
                        return !0 }(a) && (a = { takecontrol: "" }), void 0 != i) m(o, a);
                else var d = 0,
                    u = setInterval(function() { i = e("VUID"), d += 1, void 0 != i && (m(o, a), clearInterval(u)), 10 === d && (m(o, a), clearInterval(u)) }, 200) } }

        function m(r, c) { if (null != (parentDiv = l.getElementById(l.querySelector('[id^="DSxWebAppForm"]').id)) && "object" == typeof parentDiv && null == parentDiv.querySelector("iframe")) { var m = r;
                console.log("configName: ", r); var f = l.createElement("iframe"),
                    s = t(n.location.href, "utm_source") ? t(n.location.href, "utm_source") : o("utm_source"),
                    p = t(n.location.href, "utm_medium") ? t(n.location.href, "utm_medium") : o("utm_medium"),
                    h = t(n.location.href, "utm_campaign") ? t(n.location.href, "utm_campaign") : o("utm_campaign"),
                    g = t(n.location.href, "utm_term") ? t(n.location.href, "utm_term") : o("utm_term"),
                    $ = t(n.location.href, "utm_content") ? t(n.location.href, "utm_content") : o("utm_content"),
                    y = t(n.location.href, "gclid") ? "&gclid=" + t(n.location.href, "gclid") : "",
                    v = t(n.location.href, "int_campaign") ? t(n.location.href, "int_campaign") : o("int_campaign"),
                    b = t(n.location.href, "VARId") ? "&varId=" + t(n.location.href, "VARId") : ""; if (l.documentElement.lang) { var w = "&lang=" + l.documentElement.lang.split("-")[0]; "nn" == l.documentElement.lang.split("-")[0] && (w = "&lang=no_NO") } var _ = "?",
                    E = e("uuid230"),
                    I = t(n.location.href, "RCid") ? t(n.location.href, "RCid") : decodeURI(e("Rcid")); "" != I && void 0 != I && "undefined" != I && (_ += "id=" + I); var S = "&config=" + r,
                    k = "";
                k = !0 === S.toString().includes("WFC") || !0 === S.toString().includes("LDP") ? "https://t.forms.community.3ds.com/webApp/webFormV2JSON" : "https://t.forms.community.3ds.com/webApp/webAppProxy", f.src = k + (_ || "") + (S || "") + ((s ? "&utm_source=" + s : "") + (p ? "&utm_medium=" + p : "") + (h ? "&utm_campaign=" + h : "") + (g ? "&utm_term=" + g : "") + ($ ? "&utm_content=" + $ : "") + (v ? "&int_campaign=" + v : "") || "") + (y || "") + (w || "") + (b || "") + ("undefined" != i && void 0 != i ? "&VUID=" + i : "&VUID=impossible to define") + (E ? "&uuid230=" + E : ""), f.id = m, f.name = m, f.style.padding = "0", f.style.margin = "0", f.style.display = "block", f.style.width = "99%", f.style.backgroundColor = "transparent", f.style.overflow = "hidden", f.style.userSelect = "none !important", f.allowtransparency = "true", f.frameBorder = "0", void 0 != parentDiv && (parentDiv.appendChild(f), l.getElementById(m).style.userSelect = "none"), d(u, function(e) { if (l.getElementById(m)) { if ("getParentControlInfo" == e.data && ("" != c.takecontrol ? l.getElementById(m).contentWindow.postMessage("parentTookControl", "*") : l.getElementById(m).contentWindow.postMessage("", "*")), "getParentParamData" == e.data && l.getElementById(m).contentWindow.postMessage({ id: "parentParam", data: t(n.location.href, "SurveyData") }, "*"), "onSuccess" == e.data.id) c.takecontrol(e.data.data);
                        else if ("resizeIFrame" == e.data.id) { if (e.data.data.newHeight != a) { var o = e.data.data.newHeight;
                                l.getElementById(m).style.height = o + "px", a = e.data.data.newHeight } } else "createCookie" == e.data.id ? l.cookie = e.data.data.cookieName + "=" + e.data.data.cookieValue + ";domain=" + function t() { var e = document; try { try { e = top.document.domain } catch (n) { e = document.domain } var o = void 0 !== e && e.toLowerCase().split("."); if (o.length < 2 || e.match("^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$")) return ""; var i = o[o.length - 3],
                                    a = o[o.length - 2],
                                    r = o[o.length - 1]; if ("co" == a || "com" == a) return "." + i + "." + a + "." + r; return "." + a + "." + r } catch (l) {} }() : "openURL" == e.data.id ? l.location.href = e.data.data.url : "reloadParent" == e.data.id && n.top.location.reload() } }, !1) } } }(window, document) }();