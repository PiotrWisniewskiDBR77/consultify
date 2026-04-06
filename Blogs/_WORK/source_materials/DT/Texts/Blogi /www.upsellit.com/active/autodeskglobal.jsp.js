Array.prototype.filter||(Array.prototype.filter=function(t,e){"use strict";if("Function"!=typeof t&&"function"!=typeof t||!this)throw new TypeError;var r=this.length>>>0,o=new Array(r),n=this,l=0,i=-1;if(void 0===e)for(;++i!==r;)i in this&&t(n[i],i,n)&&(o[l++]=n[i]);else for(;++i!==r;)i in this&&t.call(e,n[i],i,n)&&(o[l++]=n[i]);return o.length=l,o}),Array.prototype.forEach||(Array.prototype.forEach=function(t){var e,r;if(null==this)throw new TypeError('"this" is null or not defined');var o=Object(this),n=o.length>>>0;if("function"!=typeof t)throw new TypeError(t+" is not a function");for(arguments.length>1&&(e=arguments[1]),r=0;r<n;){var l;r in o&&(l=o[r],t.call(e,l,r,o)),r++}}),window.NodeList&&!NodeList.prototype.forEach&&(NodeList.prototype.forEach=Array.prototype.forEach),Array.prototype.indexOf||(Array.prototype.indexOf=function(t,e){var r;if(null==this)throw new TypeError('"this" is null or not defined');var o=Object(this),n=o.length>>>0;if(0===n)return-1;var l=0|e;if(l>=n)return-1;for(r=Math.max(l>=0?l:n-Math.abs(l),0);r<n;){if(r in o&&o[r]===t)return r;r++}return-1}),document.getElementsByClassName||(document.getElementsByClassName=function(t){var e,r,o,n=document,l=[];if(n.querySelectorAll)return n.querySelectorAll("."+t);if(n.evaluate)for(r=".//*[contains(concat(' ', @class, ' '), ' "+t+" ')]",e=n.evaluate(r,n,null,0,null);o=e.iterateNext();)l.push(o);else for(e=n.getElementsByTagName("*"),r=new RegExp("(^|\\s)"+t+"(\\s|$)"),o=0;o<e.length;o++)r.test(e[o].className)&&l.push(e[o]);return l}),document.querySelectorAll||(document.querySelectorAll=function(t){var e,r=document.createElement("style"),o=[];for(document.documentElement.firstChild.appendChild(r),document._qsa=[],r.styleSheet.cssText=t+"{x-qsa:expression(document._qsa && document._qsa.push(this))}",window.scrollBy(0,0),r.parentNode.removeChild(r);document._qsa.length;)(e=document._qsa.shift()).style.removeAttribute("x-qsa"),o.push(e);return document._qsa=null,o}),document.querySelector||(document.querySelector=function(t){var e=document.querySelectorAll(t);return e.length?e[0]:null}),Object.keys||(Object.keys=function(){"use strict";var t=Object.prototype.hasOwnProperty,e=!{toString:null}.propertyIsEnumerable("toString"),r=["toString","toLocaleString","valueOf","hasOwnProperty","isPrototypeOf","propertyIsEnumerable","constructor"],o=r.length;return function(n){if("function"!=typeof n&&("object"!=typeof n||null===n))throw new TypeError("Object.keys called on non-object");var l,i,s=[];for(l in n)t.call(n,l)&&s.push(l);if(e)for(i=0;i<o;i++)t.call(n,r[i])&&s.push(r[i]);return s}}()),"function"!=typeof String.prototype.trim&&(String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g,"")}),String.prototype.replaceAll||(String.prototype.replaceAll=function(t,e){return"[object regexp]"===Object.prototype.toString.call(t).toLowerCase()?this.replace(t,e):this.replace(new RegExp(t,"g"),e)}),window.hasOwnProperty=window.hasOwnProperty||Object.prototype.hasOwnProperty;
if (typeof usi_commons === 'undefined') {
	usi_commons={logs:[],log:function(e){if(usi_commons.debug)try{usi_commons.logs.push(e),e instanceof Error?console.log(e.name+": "+e.message):console.log.apply(console,arguments)}catch(r){usi_commons.report_error_no_console(r)}},log_error:function(e){if(usi_commons.debug)try{e instanceof Error?console.log("%c USI Error:",usi_commons.log_styles.error,e.name+": "+e.message):console.log("%c USI Error:",usi_commons.log_styles.error,e)}catch(r){usi_commons.report_error_no_console(r)}},log_success:function(e){if(usi_commons.debug)try{console.log("%c USI Success:",usi_commons.log_styles.success,e)}catch(r){usi_commons.report_error_no_console(r)}},dir:function(e){if(usi_commons.debug)try{console.dir(e)}catch(r){usi_commons.report_error_no_console(r)}},log_styles:{error:"color: red; font-weight: bold;",success:"color: green; font-weight: bold;"},is_mobile:/iphone|ipod|ipad|android|blackberry|mobi/i.test(navigator.userAgent.toLowerCase()),device:/iphone|ipod|ipad|android|blackberry|mobi/i.test(navigator.userAgent.toLowerCase())?"mobile":"desktop",gup:function(e){try{e=e.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var r="[\\?&]"+e+"=([^&#\\?]*)",t=RegExp(r).exec(window.location.href);if(null==t)return"";return t[1]}catch(i){usi_commons.report_error(i)}},load_script:function(e,r,t){try{0==e.indexOf("//")&&(e="https:"+e),(-1!=e.indexOf("/pixel.jsp")||-1!=e.indexOf("/blank.jsp")||-1!=e.indexOf("/customer_ip.jsp"))&&(e=e.replace(usi_commons.cdn,usi_commons.domain));var i=document.getElementsByTagName("head")[0],o=document.createElement("script");o.type="text/javascript";var s="";t||-1!=e.indexOf("/active/")||-1!=e.indexOf("_pixel.jsp")||-1!=e.indexOf("_throttle.jsp")||-1!=e.indexOf("metro")||-1!=e.indexOf("_suppress")||-1!=e.indexOf("product_recommendations")||-1!=e.indexOf("_pid.jsp")||-1!=e.indexOf("_zips")||(s=-1==e.indexOf("?")?"?":"&",-1!=e.indexOf("pv2.js")&&(s="%7C"),s+="si="+usi_commons.get_sess()),o.src=e+s,"function"==typeof r&&(o.onload=function(){try{r()}catch(e){usi_commons.report_error(e)}}),i.appendChild(o)}catch(n){usi_commons.report_error(n)}},fetch:function(e,r,t){try{t=t||{},0===e.indexOf("//")&&(e="https:"+e);var i=e.replace(usi_commons.cdn,usi_commons.domain),o="";if(-1!==i.indexOf("?")){var s=i.split("?");i=s[0],s.length>1&&(o=s[1])}var n={method:"POST",...t};return""!==o&&(n.body=new URLSearchParams(o)),fetch(i,n).then(e=>{if(!e.ok)throw Error(`HTTP error! status: `);return e.json()}).then(e=>{"function"==typeof r&&r(e)}).catch(e=>{usi_commons.report_error(e)})}catch(a){usi_commons.report_error(a)}},load_view:function(e,r,t,i){try{if("undefined"!=typeof usi_force||-1!=location.href.indexOf("usi_force")||null==usi_cookies.get("usi_sale")&&null==usi_cookies.get("usi_launched")&&null==usi_cookies.get("usi_launched"+r)){t=t||"";var o="";""!=usi_commons.gup("usi_force_date")?o="&usi_force_date="+usi_commons.gup("usi_force_date"):"undefined"!=typeof usi_cookies&&null!=usi_cookies.get("usi_force_date")&&(o="&usi_force_date="+usi_cookies.get("usi_force_date")),usi_commons.debug&&(o+="&usi_referrer="+encodeURIComponent(location.href)),"undefined"!=typeof usi_cookies&&(null!=usi_cookies.get("usi_enable")&&(o+="&usi_enable=1"),null!=usi_cookies.get("usi_qa")&&(o+="&usi_qa=true"));var s=usi_commons.domain+"/view.jsp?hash="+e+"&siteID="+r+"&keys="+t+o;if(void 0!==usi_commons.last_view&&usi_commons.last_view==r+"_"+t)return;usi_commons.last_view=r+"_"+t,"undefined"!=typeof usi_js&&"function"==typeof usi_js.cleanup&&usi_js.cleanup(),usi_commons.load_script(s,i)}}catch(n){usi_commons.report_error(n)}},remove_loads:function(){try{if(null!=document.getElementById("usi_obj")&&document.getElementById("usi_obj").parentNode.parentNode.removeChild(document.getElementById("usi_obj").parentNode),void 0!==usi_commons.usi_loads)for(var e in usi_commons.usi_loads)null!=document.getElementById("usi_"+e)&&document.getElementById("usi_"+e).parentNode.parentNode.removeChild(document.getElementById("usi_"+e).parentNode)}catch(r){usi_commons.report_error(r)}},load:function(e,r,t,i){try{if(void 0!==window["usi_"+r])return;t=t||"";var o="";""!=usi_commons.gup("usi_force_date")?o="&usi_force_date="+usi_commons.gup("usi_force_date"):"undefined"!=typeof usi_cookies&&null!=usi_cookies.get("usi_force_date")&&(o="&usi_force_date="+usi_cookies.get("usi_force_date")),usi_commons.debug&&(o+="&usi_referrer="+encodeURIComponent(location.href)),"undefined"!=typeof usi_cookies&&(null!=usi_cookies.get("usi_enable")&&(o+="&usi_enable=1"),null!=usi_cookies.get("usi_qa")&&(o+="&usi_qa=true"));var s=usi_commons.domain+"/usi_load.jsp?hash="+e+"&siteID="+r+"&keys="+t+o;usi_commons.load_script(s,i),void 0===usi_commons.usi_loads&&(usi_commons.usi_loads={}),usi_commons.usi_loads[r]=r}catch(n){usi_commons.report_error(n)}},load_precapture:function(e,r,t){try{if(void 0!==usi_commons.last_precapture_siteID&&usi_commons.last_precapture_siteID==r)return;usi_commons.last_precapture_siteID=r;var i="";"undefined"!=typeof usi_cookies&&null!=usi_cookies.get("usi_enable")&&(i+="&usi_enable=1");var o=usi_commons.domain+"/hound/monitor.jsp?qs="+e+"&siteID="+r+i;usi_commons.load_script(o,t)}catch(s){usi_commons.report_error(s)}},load_mail:function(e,r,t){try{var i=usi_commons.domain+"/mail.jsp?qs="+e+"&siteID="+r+"&domain="+encodeURIComponent(usi_commons.domain);usi_commons.load_script(i,t)}catch(o){usi_commons.report_error(o)}},load_products:function(e){try{if(!e.siteID||!e.pid)return;var r="";["siteID","association_siteID","pid","less_expensive","rows","days_back","force_exact","match","nomatch","name_from","image_from","price_from","url_from","extra_from","extra_merge","custom_callback","allow_dupe_names","expire_seconds","name","ordersID","cartsID","viewsID","companyID","order_by"].forEach(function(t,i){e[t]&&(r+=(0==i?"?":"&")+t+"="+e[t])}),e.filters&&(r+="&filters="+encodeURIComponent(e.filters.map(function(e){return encodeURIComponent(e)}).join("&"))),usi_commons.load_script(usi_commons.cdn+"/utility/product_recommendations_filter_v3.jsp"+r,function(){"function"==typeof e.callback&&e.callback()})}catch(t){usi_commons.report_error(t)}},send_prod_rec:function(e,r,t){var i=!1;try{if(document.getElementsByTagName("html").length>0&&null!=document.getElementsByTagName("html")[0].className&&-1!=document.getElementsByTagName("html")[0].className.indexOf("translated"))return!1;var o=[e,r.name,r.link,r.pid,r.price,r.image];if(-1==o.indexOf(void 0)){var s=[e,r.name.replace(/\|/g,"&#124;"),r.link,r.pid,r.price,r.image].join("|")+"|";r.extra&&(s+=r.extra.replace(/\|/g,"&#124;")+"|"),usi_commons.load_script(usi_commons.domain+"/utility/pv2."+(t?"jsp":"js")+"?"+encodeURIComponent(s)),i=!0}}catch(n){usi_commons.report_error(n),i=!1}return i},report_error:function(e){if(null!=e&&("string"==typeof e&&(e=Error(e)),e instanceof Error)){if(void 0===usi_commons.error_reported){if(usi_commons.error_reported=!0,-1!==location.href.indexOf("usishowerrors"))throw e;usi_commons.load_script(usi_commons.domain+"/err.jsp?oops="+encodeURIComponent(e.message)+"-"+encodeURIComponent(e.stack)+"&url="+encodeURIComponent(location.href)),usi_commons.log_error(e.message),usi_commons.dir(e)}}},report_error_no_console:function(e){if(null!=e&&("string"==typeof e&&(e=Error(e)),e instanceof Error)){if(void 0===usi_commons.error_reported){if(usi_commons.error_reported=!0,-1!==location.href.indexOf("usishowerrors"))throw e;usi_commons.load_script(usi_commons.domain+"/err.jsp?oops="+encodeURIComponent(e.message)+"-"+encodeURIComponent(e.stack)+"&url="+encodeURIComponent(location.href))}}},gup_or_get_cookie:function(e,r,t){try{if("undefined"==typeof usi_cookies){usi_commons.log_error("usi_cookies is not defined");return}r=r||usi_cookies.expire_time.day,"usi_enable"==e&&(r=usi_cookies.expire_time.hour);var i=null,o=usi_commons.gup(e);return""!==o?(i=o,usi_cookies.set(e,i,r,t)):i=usi_cookies.get(e),i||""}catch(s){usi_commons.report_error(s)}},get_sess:function(){var e=null;if("undefined"==typeof usi_cookies)return"";try{if(null==usi_cookies.get("usi_si")){var r=Math.random().toString(36).substring(2);return r.length>6&&(r=r.substring(0,6)),e=r+"_"+Math.round(new Date().getTime()/1e3),usi_cookies.set("usi_si",e,86400),e}null!=usi_cookies.get("usi_si")&&(e=usi_cookies.get("usi_si")),usi_cookies.set("usi_si",e,86400)}catch(t){usi_commons.report_error(t)}return e},get_id:function(e){e||(e="");var r=null;try{if(null==usi_cookies.get("usi_v")&&null==usi_cookies.get("usi_id"+e)){var t=Math.random().toString(36).substring(2);return t.length>6&&(t=t.substring(0,6)),r=t+"_"+Math.round(new Date().getTime()/1e3),usi_cookies.set("usi_id"+e,r,2592e3,!0),r}null!=usi_cookies.get("usi_v")&&(r=usi_cookies.get("usi_v")),null!=usi_cookies.get("usi_id"+e)&&(r=usi_cookies.get("usi_id"+e)),usi_cookies.set("usi_id"+e,r,2592e3,!0)}catch(i){usi_commons.report_error(i)}return r},load_session_data:function(e){try{null==usi_cookies.get_json("usi_session_data")?usi_commons.load_script(usi_commons.domain+"/utility/session_data.jsp?extended="+(e?"true":"false")):(usi_app.session_data=usi_cookies.get_json("usi_session_data"),void 0!==usi_app.session_data_callback&&usi_app.session_data_callback())}catch(r){usi_commons.report_error(r)}},customer_ip:function(e){try{-1!=e?usi_cookies.set("usi_suppress","1",usi_cookies.expire_time.never):usi_app.main()}catch(r){usi_commons.report_error(r)}},customer_check:function(e){try{if(!usi_app.is_enabled&&!usi_cookies.value_exists("usi_ip_checked"))return usi_cookies.set("usi_ip_checked","1",usi_cookies.expire_time.day),usi_commons.load_script(usi_commons.domain+"/utility/customer_ip2.jsp?companyID="+e),!1;return!0}catch(r){usi_commons.report_error(r)}}};
	usi_commons.domain = "https://app.upsellit.com";
	usi_commons.cdn = "https://www.upsellit.com";
	usi_commons.debug = false;
	if (location.href.indexOf("usidebug") != -1 || location.href.indexOf("usi_debug") != -1) {
		usi_commons.debug = true;
	}
	setTimeout(function() {
		try {
			if (usi_commons.gup_or_get_cookie("usi_debug") != "") usi_commons.debug = true;
			if (usi_commons.gup_or_get_cookie("usi_qa") != "") {
				usi_commons.domain = usi_commons.cdn = "https://prod.upsellit.com";
			}
		} catch(err) {
			usi_commons.report_error(err);
		}
	}, 1000);
}

getUpsellitContext = function(action) {
    // Feel free to implement this however you like - this is just a simplified example.
    switch (action) {
        case 'creative-load':
            if (usi_cookies.get_json("usi_load_json") == null) {
                usi_cookies.set_json('usi_load_json', []);
            }
            var usi_json_data = usi_cookies.get_json("usi_load_json");
            usi_cookies.set_json('usi_load_json', []);
            return usi_json_data;
        case 'creative-clicked':
            if (usi_cookies.get_json("usi_click_json") == null) {
                usi_cookies.set_json('usi_click_json', []);
            }
            var usi_json_data = usi_cookies.get_json("usi_click_json");
            usi_cookies.set_json('usi_click_json', []);
            return usi_json_data;
        case 'order-completed':
            if (usi_cookies.get_json("usi_order_json") == null) {
                usi_cookies.set_json('usi_order_json', []);
            }
            var usi_json_data = usi_cookies.get_json("usi_order_json");
            usi_cookies.set_json('usi_order_json', []);
            return usi_json_data;
        default:
            return null;
    }
};
usi_commons.load_script_bak = usi_commons.load_script;
usi_commons.load_script = function(source, callback, nocache) {
    try {
        if (source.indexOf("/load.jsp") != -1) {
            if (usi_cookies.get_json("usi_load_json") == null) {
                usi_cookies.set_json('usi_load_json', []);
            }
            var usi_load_json = usi_cookies.get_json("usi_load_json");
            var usi_load_object = {};
            usi_load_object.cid = source.split("&cid=")[1].split("&")[0];
            usi_load_object.id = source.split("?id=")[1].split("&")[0];
            usi_load_object.sid = source.split("&sid=")[1].split("&")[0];
            usi_load_object.url = location.href;
            usi_load_json.push(usi_load_object);
            var payload = {
                action:"creative_load",
                event: usi_load_object
            }
            document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
            usi_cookies.set_json('usi_load_json', usi_load_json);
        } else if (source.indexOf("/link.jsp") != -1) {
            if (usi_cookies.get_json("usi_click_json") == null) {
                usi_cookies.set_json('usi_click_json', []);
            }
            var usi_click_json = usi_cookies.get_json("usi_click_json");
            var usi_click_object = {};
            usi_click_object.cid = source.split("&cid=")[1].split("&")[0];
            usi_click_object.id = source.split("?id=")[1].split("&")[0];
            usi_click_object.sid = source.split("&sid=")[1].split("&")[0];
            usi_click_object.duration = source.split("&duration=")[1].split("&")[0];
            usi_click_json.push(usi_click_object);
            var payload = {
                action:"creative_clicked",
                event: usi_click_object
            }
            document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
            usi_cookies.set_json('usi_click_json', usi_click_json);
        } else {
            usi_commons.load_script_bak(source, usi_data_event, nocache);
        }
        if (typeof(callback) !== "undefined") callback();
    } catch(err) {
        usi_commons.report_error(err);
    }
}
usi_data_event = function() {
    try {
        if (typeof(usi_js) !== "undefined") {
            usi_js.load_js_override = usi_js.load_js;
            usi_js.load_js = function (js_url, callback) {
                try {
                    if (js_url.indexOf("load.jsp") == 0) {
                        if (usi_cookies.get_json("usi_load_json") == null) {
                            usi_cookies.set_json('usi_load_json', []);
                        }
                        var usi_load_json = usi_cookies.get_json("usi_load_json");
                        var usi_load_object = {};
                        usi_load_object.cid = usi_js.campaign.config_id;
                        usi_load_object.id = usi_js.campaign.id;
                        usi_load_object.lm = '1';
                        usi_load_object.sid = usi_js.campaign.site_id;
                        usi_load_object.url = location.href;
                        usi_load_json.push(usi_load_object);
                        var payload = {
                            action:"creative_load",
                            event: usi_load_object
                        }
                        document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
                        usi_cookies.set_json('usi_load_json', usi_load_json);
                    } else if (js_url.indexOf("/link.jsp") != -1) {
                        if (usi_cookies.get_json("usi_click_json") == null) {
                            usi_cookies.set_json('usi_click_json', []);
                        }
                        var usi_click_json = usi_cookies.get_json("usi_click_json");
                        var usi_click_object = {};
                        usi_click_object.cid = usi_js.campaign.config_id;
                        usi_click_object.id = usi_js.campaign.id;
                        usi_click_object.sid = usi_js.campaign.site_id;
                        usi_click_object.duration = usi_js.campaign.click_cookie;
                        usi_click_json.push(usi_click_object);
                        var payload = {
                            action:"creative_clicked",
                            event: usi_click_object
                        }
                        document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
                        usi_cookies.set_json('usi_click_json', usi_click_json);
                    } else {
                        usi_js.load_js_override(js_url, callback);
                    }
                } catch(err) {
                    usi_commons.report_error(err);
                }
            };
            usi_js.click_cookie_override = usi_js.click_cookie;
            usi_js.click_cookie = function () {
                try {
                    if (usi_cookies.get_json("usi_click_json") == null) {
                        usi_cookies.set_json('usi_click_json', []);
                    }
                    var usi_click_json = usi_cookies.get_json("usi_click_json");
                    var usi_click_object = {};
                    usi_click_object.cid = usi_js.campaign.config_id;
                    usi_click_object.id = usi_js.campaign.id;
                    usi_click_object.sid = usi_js.campaign.site_id;
                    usi_click_object.duration = usi_js.campaign.click_cookie;
                    usi_click_json.push(usi_click_object);
                    var payload = {
                        action:"creative_clicked",
                        event: usi_click_object
                    }
                    document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
                    usi_cookies.set_json('usi_click_json', usi_click_json);
                    usi_js.click_cookie_override();
                } catch(err) {
                    usi_commons.report_error(err);
                }
            }
        }
        usi_load_link = function(id, config_id, site_id, click_cookie) {
            try {
                if (usi_cookies.get_json("usi_click_json") == null) {
                    usi_cookies.set_json('usi_click_json', []);
                }
                var usi_click_json = usi_cookies.get_json("usi_click_json");
                var usi_click_object = {};
                usi_click_object.cid = config_id;
                usi_click_object.id = id;
                usi_click_object.sid = site_id;
                usi_click_object.duration = click_cookie;
                usi_click_json.push(usi_click_object);
                var payload = {
                    action:"creative_clicked",
                    event: usi_click_object
                }
                document.dispatchEvent(new CustomEvent('upsellit', { detail: payload }));
                usi_cookies.set_json('usi_click_json', usi_click_json);
            } catch(err) {
                usi_commons.report_error(err);
            }
        }
    } catch(err) {
        usi_commons.report_error(err);
    }
};if (typeof usi_company_json === 'undefined') {try {usi_company_json = {
  "campaigns": {
    "view": [
      {
        "name": "AMER - CA | New Return Visitor TT",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-CA",
          "fr-CA"
        ],
        "required_cookies": [
          "cartReferenceStage",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "AMER - US only | New Return Visitor TT (Logged Out)",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}",
        "return_eligible_logged_out": true,
        "is_checkout_page": false,
        "locales": [
          "en-US"
        ],
        "required_cookies": [
          "cartReferenceStage",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ],
        "lift": {
          "id": "59827"
        }
      },
      {
        "name": "AMER - US only | New Return Visitor TT (Logged Out)",
        "siteID": "59819",
        "hash": "hEgWYx7DXzysFaW1sEi6rny",
        "key": "{{usi_commons.device}}",
        "return_eligible_logged_out": true,
        "is_checkout_page": false,
        "locales": [
          "en-US"
        ],
        "required_cookies": [
          "cartReference",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ],
        "lift": {
          "id": "59827"
        }
      },
      {
        "name": "AMER - US only | New Return Visitor TT (Logged In)",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-US"
        ],
        "required_cookies": [
          "cartReferenceStage",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "AMER - US only | New Return Visitor TT (Logged In)",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-US"
        ],
        "required_cookies": [
          "cartReference",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "AMER - CA | New Return Visitor TT",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-CA",
          "fr-CA"
        ],
        "required_cookies": [
          "cartReference",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "AMER - AR,BR,MX | New Return Visitor TT",
        "siteID": "61565",
        "hash": "kWrE13RsTmb32yo4eFfJMF1",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "es-AR",
          "pt-BR",
          "es-MX"
        ],
        "required_cookies": [
          "usi_odm_cart_link",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "Autodesk - Americas - Inboxed Incentive | Cart Preserver [New Version]",
        "siteID": "61545",
        "hash": "oyhlmMV3erl9DoXtu0XxHSr",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "is_checkout_page": false,
        "pages": [
          "www-pt.autodesk.com",
          "www.autodesk.com"
        ],
        "locales": [
          "en-US",
          "en-CA",
          "fr-CA",
          "es-MX",
          "pt-BR",
          "es-AR"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "Autodesk Global - Product page Active Cart Exit technology",
        "siteID": "60347",
        "hash": "8Rdw78K3wi7NzRFeGJ4PKQ4",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "is_checkout_page": false,
        "locales": [
          "en-US",
          "en-CA",
          "fr-CA",
          "es-MX",
          "pt-BR",
          "es-AR"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      }
    ]
  },
  "aff_links": {
    "en-CA": "https://www.jdoqocy.com/click-2681135-12797027",
    "en-US": "https://www.anrdoezrs.net/click-2681135-14065590",
    "es-AR": "https://www.dpbolvw.net/click-2681135-14065695",
    "es-MX": "https://www.anrdoezrs.net/click-2681135-14065692",
    "fr-CA": "https://www.jdoqocy.com/click-2681135-14065693",
    "pt-BR": "https://www.kqzyfj.com/click-2681135-14065694"
  },
  "cloud_products_upsell_matrix": {
    "en-US": [
      {
        "targets": [
          "F360",
          "FSN"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO CART",
        "region": "AMERICAS"
      }
    ],
    "en-CA": [
      {
        "targets": [
          "F360",
          "FSN"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO CART",
        "region": "AMERICAS"
      }
    ],
    "fr-CA": [
      {
        "targets": [
          "F360",
          "FSN"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO CART",
        "region": "AMERICAS"
      }
    ]
  },
  "privacy_policy": {
    "en-US": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "en-CA": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "es-AR": {
      "disclaimer": "Usamos tu informaci\u00F3n de acuerdo con nuestra",
      "cta": "Pol\u00EDtica de Privacidad"
    },
    "es-MX": {
      "disclaimer": "Usamos tu informaci\u00F3n de acuerdo con nuestra",
      "cta": "Pol\u00EDtica de Privacidad"
    },
    "fr-CA": {
      "disclaimer": "Nous utilisons vos informations conform\u00E9ment \u00E0 notre",
      "cta": "Politique de Confidentialit\u00E9"
    },
    "pt-BR": {
      "disclaimer": "Usamos a sua informa\u00E7\u00E3o de acordo com a nossa",
      "cta": "Pol\u00EDtica de Privacidade"
    }
  },
  "bundle_offers": {
    "3DSMAX_en-US_1-year": {
      "copy": "Save $1,875 annually when you bundle! Switch to the M&E Collection and get MotionBuilder, Maya, and more for just $780 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=%5Bcountry%3AUS%3Bcurrency%3AUSD%3BofferingCode%3AMECOLL%3BofferingId%3AOD-000195%3BofferingName%3AMedia%20%26%20Entertainment%20Collection%3BpriceRegionCode%3AA0%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "3DSMAX_en-CA_1-year": {
      "copy": "Save CA$2,690 annually when you bundle! Switch to the M&E Collection and get MotionBuilder, Maya, and more for just CA$1,080 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=%5Bcountry%3ACA%3Bcurrency%3ACAD%3BofferingCode%3AMECOLL%3BofferingId%3AOD-000195%3BofferingName%3AMedia%20%26%20Entertainment%20Collection%3BpriceRegionCode%3AA2%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "MAYA_en-US_1-year": {
      "copy": "Save $1,875 annually when you bundle! Switch to the M&E Collection and get MotionBuilder, 3ds Max, and more for just $780 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=%5Bcountry%3AUS%3Bcurrency%3AUSD%3BofferingCode%3AMECOLL%3BofferingId%3AOD-000195%3BofferingName%3AMedia%20%26%20Entertainment%20Collection%3BpriceRegionCode%3AA0%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "MAYA_en-CA_1-year": {
      "copy": "Save CA$2,690 annually when you bundle! Switch to the M&E Collection and get MotionBuilder, 3ds Max, and more for just CA$1,080 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=%5Bcountry%3ACA%3Bcurrency%3ACAD%3BofferingCode%3AMECOLL%3BofferingId%3AOD-000195%3BofferingName%3AMedia%20%26%20Entertainment%20Collection%3BpriceRegionCode%3AA2%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "ACDIST_en-US_1-year_pdm": {
      "copy": "Save $1,985 annually when you bundle! Switch to the PDM Collection and get AutoCAD, 3ds Max, and more for just $1,280 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=%5Bcountry%3AUS%3Bcurrency%3AUSD%3BofferingCode%3APDCOLL%3BofferingId%3AOD-000234%3BofferingName%3AProduct%20Design%20%26%20MFG%20Collection%3BpriceRegionCode%3AA0%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "ACDIST_en-CA_1-year_pdm": {
      "copy": "Save CA$4,120 annually when you bundle! Switch to the PDM Collection and get AutoCAD, Revit, 3ds Max, and more for just CA$1,765 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=%5Bcountry%3ACA%3Bcurrency%3ACAD%3BofferingCode%3APDCOLL%3BofferingId%3AOD-000234%3BofferingName%3AProduct%20Design%20%26%20MFG%20Collection%3BpriceRegionCode%3AA2%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "INVPROSA_en-US_1-year": {
      "copy": "Save $1,985 annually when you bundle! Switch to the PDM Collection and get AutoCAD, 3ds Max, and more for just $790 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=%5Bcountry%3AUS%3Bcurrency%3AUSD%3BofferingCode%3APDCOLL%3BofferingId%3AOD-000234%3BofferingName%3AProduct%20Design%20%26%20MFG%20Collection%3BpriceRegionCode%3AA0%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "INVPROSA_en-CA_1-year": {
      "copy": "Save CA$2,750 annually when you bundle! Switch to the PDM Collection and get AutoCAD, 3ds Max, and more for just CA$1,090 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=%5Bcountry%3ACA%3Bcurrency%3ACAD%3BofferingCode%3APDCOLL%3BofferingId%3AOD-000234%3BofferingName%3AProduct%20Design%20%26%20MFG%20Collection%3BpriceRegionCode%3AA2%3Bquantity%3A1%3BintendedUsageCode%3ACOM%3BaccessModelCode%3AS%3BtermCode%3AA01%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BservicePlanIdCode%3ASTND%3BbillingBehaviorCode%3AA200%3BbillingTypeCode%3AB100%3BbillingFrequencyCode%3AB05%3BexternalProductCode%3Anull%5D",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "ACDIST_en-US_1-year": {
      "copy": "Save $2,975 annually when you bundle! Switch to the AEC Collection and get Revit, Civil 3D, 3ds Max, and more for just $1,580 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "ACDIST_en-CA_1-year": {
      "copy": "Save CA$4,120 annually when you bundle! Switch to the AEC Collection and get AutoCAD, Revit, 3ds Max, and more for just CA$2,185 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=[country:CA;currency:CAD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A2;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "old_ACDIST_en-US_1-year": {
      "copy": "Save 15% on AutoCAD when you buy a bundle of three - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-US?priceIds=27150%5Bqty:3%5D&promoCodes=1yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "CIV3D_en-US_1-year": {
      "copy": "Save $2,975 annually when you bundle! Switch to the AEC Collection and get AutoCAD, Revit, 3ds Max, and more for just $805 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "CIV3D_en-CA_1-year": {
      "copy": "Save CA$4,120 annually when you bundle! Switch to the AEC Collection and get AutoCAD, Revit, 3ds Max, and more for just CA$1,115 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=[country:CA;currency:CAD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A2;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "RVT_en-US_1-year": {
      "copy": "Save $2,975 annually when you bundle! Switch to the AEC Collection and get AutoCAD, Civil 3D, 3ds Max, and more for just $670 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "RVT_en-CA_1-year": {
      "copy": "Save CA$4,120 annually when you bundle! Switch to the AEC Collection and get AutoCAD, Civil 3D, 3ds Max, and more for just CA$925 extra. Unlock a complete set of professional solutions.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=[country:CA;currency:CAD;offeringCode:AECCOL;offeringId:OD-000052;offeringName:AEC Collection;priceRegionCode:A2;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "RVTLT_en-US_1-year": {
      "copy": "For only $10 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get AutoCAD LT included.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:RVTLTS;offeringId:OD-000280;offeringName:AutoCAD Revit LT Suite;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "RVTLT_en-CA_1-year": {
      "copy": "For only CA$15 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get AutoCAD LT included.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=[country:CA;currency:CAD;offeringCode:RVTLTS;offeringId:OD-000280;offeringName:AutoCAD Revit LT Suite;priceRegionCode:A2;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "F360PDE_en-US": {
      "copy": "This extension requires Fusion. Subscribe to Fusion for Design and access advanced design, simulation, and data management capabilities with $841 savings.",
      "cta": "Upgrade now",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:F360PD;offeringId:OD-000420;offeringName:Fusion for Design;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "F360SE_en-US": {
      "copy": "This extension requires Fusion. Subscribe to Fusion for Design and access advanced design, simulation, and data management capabilities with $841 savings.",
      "cta": "Upgrade now",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:F360PD;offeringId:OD-000420;offeringName:Fusion for Design;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "F360ME_en-US": {
      "copy": "This extension requires Fusion. Subscribe to Fusion for Design and access advanced design, simulation, and data management capabilities with $841 savings.",
      "cta": "Upgrade now",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:F360PD;offeringId:OD-000420;offeringName:Fusion for Design;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "F36MEIA_en-US": {
      "copy": "This extension requires Fusion. Subscribe to both Fusion and the Manufacturing Extension and save $99 with Fusion for Manufacturing.",
      "cta": "Upgrade now",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=[country:US;currency:USD;offeringCode:F360MFG;offeringId:OD-000421;offeringName:Fusion for Manufacturing;priceRegionCode:A0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05]",
      "qty": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ]
    },
    "ACDIST_en-US_3-year": {
      "copy": "Save 15% on AutoCAD when you buy a bundle of three - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-US?priceIds=27152%5Bqty:3%5D&promoCodes=3yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "old_ACDIST_en-CA_1-year": {
      "copy": "Save 15% on AutoCAD when you buy a bundle of three - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-CA?priceIds=23998%5Bqty:3%5D&promoCodes=1yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_en-CA_3-year": {
      "copy": "Save 15% on AutoCAD when you buy a bundle of three - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-CA?priceIds=24000%5Bqty:3%5D&promoCodes=3yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fr-CA_1-an": {
      "copy": "\u00C9conomisez 15 % sur vos abonnements lorsque vous en achetez trois \u00E0 la fois - ",
      "cta": "PROFITEZ DE L\u2019OFFRE",
      "url": "\"{{usi_app.checkout_url}}/fr-CA?priceIds=23998%5Bqty:3%5D&promoCodes=1yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fr-CA_3-ans": {
      "copy": "\u00C9conomisez 15 % sur vos abonnements lorsque vous en achetez trois \u00E0 la fois - ",
      "cta": "PROFITEZ DE L\u2019OFFRE",
      "url": "\"{{usi_app.checkout_url}}/fr-CA?priceIds=24000%5Bqty:3%5D&promoCodes=3yrACAD3pack&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_en-US_1-year": {
      "copy": "Get 5 subscriptions of AutoCAD LT for the price of 4 - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-US?priceIds=24131%5Bqty:5%5D&promoCodes=1yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-US_3-year": {
      "copy": "Get 5 subscriptions of AutoCAD LT for the price of 4 - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-US?priceIds=24147%5Bqty:5%5D&promoCodes=3yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-CA_1-year": {
      "copy": "Get 5 subscriptions of AutoCAD LT for the price of 4 - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-CA?priceIds=24117%5Bqty:5%5D&promoCodes=1yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-CA_3-year": {
      "copy": "Get 5 subscriptions of AutoCAD LT for the price of 4 - ",
      "cta": "Get the bundle",
      "url": "\"{{usi_app.checkout_url}}/en-CA?priceIds=24133%5Bqty:5%5D&promoCodes=3yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fr-CA_1-an": {
      "copy": "Obtenez 5 abonnements \u00E0 AutoCAD LT pour le prix de 4 - ",
      "cta": "PROFITEZ DE L\u2019OFFRE",
      "url": "\"{{usi_app.checkout_url}}/fr-CA?priceIds=24117%5Bqty:5%5D&promoCodes=1yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fr-CA_3-ans": {
      "copy": "Obtenez 5 abonnements \u00E0 AutoCAD LT pour le prix de 4 - ",
      "cta": "PROFITEZ DE L\u2019OFFRE",
      "url": "\"{{usi_app.checkout_url}}/fr-CA?priceIds=24133%5Bqty:5%5D&promoCodes=3yrlt5pack&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    }
  },
  "email_info": {
    "es-AR": {
      "link": "/store?Action=DisplayPage&Locale=es_AR&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_la_usi_email&Currency=USD",
      "from_name": "Equipo de atenci\u00F3n al cliente de Autodesk",
      "optin_head": "\u00BFTienes Prisa?",
      "optin_desc": "Quiero recibir por email el contenido de mi carrito.",
      "optin_ok": "Enviar ahora",
      "tt_head": "\u00A1Tu carrito te espera!",
      "tt_btn": "CONTINUAR COMPRA"
    },
    "en-CA": {
      "link": "/en-CA?mktvar002=afc_ca_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-US": {
      "link": "/en-US?mktvar002=afc_us_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "es-MX": {
      "link": "/store?Action=DisplayPage&Locale=es_MX&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_mx_usi_email",
      "from_name": "Equipo de atenci\u00F3n al cliente de Autodesk",
      "optin_head": "\u00BFTienes Prisa?",
      "optin_desc": "Quiero recibir por email el contenido de mi carrito.",
      "optin_ok": "Enviar ahora",
      "tt_head": "No olvides tu carrito",
      "tt_btn": "CONTIN\u00DAA EL PROCESO DE COMPRA"
    },
    "fr-CA": {
      "link": "/fr-CA?mktvar002=afc_frca_usi_email",
      "from_name": "Autodesk Boutique en ligne",
      "optin_head": "Vous \u00EAtes press\u00E9?",
      "optin_desc": "Nous pouvons vous envoyer le contenu de votre panier par e-mail.",
      "optin_ok": "OK",
      "tt_head": "N\u2019abandonnez pas votre panier",
      "tt_btn": "PROCEDEZ AU PAIEMENT"
    },
    "pt-BR": {
      "link": "/store?Action=DisplayPage&Locale=pt_BR&SiteID=adskbr&id=QuickBuyCartPage&mktvar002=afc_br_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "Precisa de mais tempo?",
      "optin_desc": "Envie os itens do carrinho para o seu email.",
      "optin_ok": "OK",
      "tt_head": "N\u00E3o Deixe Seu Carrinho Para Tr\u00E1s",
      "tt_btn": "CONCLUA SUA COMPRA"
    }
  }
};} catch (err) {usi_commons.report_error(err);}}

if (typeof usi_app === 'undefined') {
	try {
		if("undefined"==typeof usi_cookies){if(usi_cookies={expire_time:{minute:60,hour:3600,two_hours:7200,four_hours:14400,day:86400,week:604800,two_weeks:1209600,month:2592e3,year:31536e3,never:31536e4},max_cookies_count:15,max_cookie_length:1e3,update_window_name:function(e,i,t){try{var r=-1;if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r=n.getTime()}var o=window.top||window,u=0;null!=i&&-1!=i.indexOf("=")&&(i=i.replace(RegExp("=","g"),"USIEQLS")),null!=i&&-1!=i.indexOf(";")&&(i=i.replace(RegExp(";","g"),"USIPRNS"));for(var l=o.name.split(";"),a="",c=0;c<l.length;c++){var f=l[c].split("=");3==f.length?(f[0]==e&&(f[1]=i,f[2]=r,u=1),null!=f[1]&&"null"!=f[1]&&(a+=f[0]+"="+f[1]+"="+f[2]+";")):""!=l[c]&&(a+=l[c]+";")}0==u&&(a+=e+"="+i+"="+r+";"),o.name=a}catch(s){}},flush_window_name:function(e){try{for(var i=window.top||window,t=i.name.split(";"),r="",n=0;n<t.length;n++){var o=t[n].split("=");3==o.length&&(0==o[0].indexOf(e)||(r+=t[n]+";"))}i.name=r}catch(u){}},get_from_window_name:function(e){try{for(var i,t,r=(window.top||window).name.split(";"),n=0;n<r.length;n++){var o=r[n].split("=");if(3==o.length){if(o[0]==e&&(t=o[1],-1!=t.indexOf("USIEQLS")&&(t=t.replace(/USIEQLS/g,"=")),-1!=t.indexOf("USIPRNS")&&(t=t.replace(/USIPRNS/g,";")),!("-1"!=o[2]&&0>usi_cookies.datediff(o[2]))))return i=[t,o[2]]}else if(2==o.length&&o[0]==e)return t=o[1],-1!=t.indexOf("USIEQLS")&&(t=t.replace(/USIEQLS/g,"=")),-1!=t.indexOf("USIPRNS")&&(t=t.replace(/USIPRNS/g,";")),i=[t,new Date().getTime()+6048e5]}}catch(u){}return null},datediff:function(e){return e-new Date().getTime()},count_cookies:function(e){return e=e||"usi_",usi_cookies.search_cookies(e).length},root_domain:function(){try{var e=document.domain.split("."),i=e[e.length-1];if("com"==i||"net"==i||"org"==i||"us"==i||"co"==i||"ca"==i)return e[e.length-2]+"."+e[e.length-1]}catch(t){}return 0==document.domain.indexOf("www.")?document.domain.replace("www.",""):document.domain},create_cookie:function(e,i,t){if(!1!==navigator.cookieEnabled&&void 0===window.usi_nocookies){var r="";if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r="; expires="+n.toGMTString()}var o="samesite=none;";0==location.href.indexOf("https://")&&(o+="secure;");var u=usi_cookies.root_domain();"undefined"!=typeof usi_parent_domain&&-1!=document.domain.indexOf(usi_parent_domain)&&(u=usi_parent_domain),document.cookie=e+"="+encodeURIComponent(i)+r+"; path=/;domain="+u+"; "+o}},create_nonencoded_cookie:function(e,i,t){if(!1!==navigator.cookieEnabled&&void 0===window.usi_nocookies){var r="";if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r="; expires="+n.toGMTString()}var o="samesite=none;";0==location.href.indexOf("https://")&&(o+="secure;");var u=usi_cookies.root_domain();document.cookie=e+"="+i+r+"; path=/;domain="+location.host+"; "+o,document.cookie=e+"="+i+r+"; path=/;domain="+u+"; "+o,document.cookie=e+"="+i+r+"; path=/;domain=; "+o}},read_cookie:function(e){if(!1===navigator.cookieEnabled)return null;var i=e+"=",t=[];try{t=document.cookie.split(";")}catch(r){}for(var n=0;n<t.length;n++){for(var o=t[n];" "==o.charAt(0);)o=o.substring(1,o.length);if(0==o.indexOf(i))return decodeURIComponent(o.substring(i.length,o.length))}return null},del:function(e){usi_cookies.set(e,null,-100);try{null!=localStorage&&localStorage.removeItem(e),null!=sessionStorage&&sessionStorage.removeItem(e)}catch(i){}},get_ls:function(e){try{var i=localStorage.getItem(e);if(null!=i){if(0==i.indexOf("{")&&-1!=i.indexOf("usi_expires")){var t=JSON.parse(i);if(new Date().getTime()>t.usi_expires)return localStorage.removeItem(e),null;i=t.value}return decodeURIComponent(i)}}catch(r){}return null},get:function(e){var i=usi_cookies.read_cookie(e);if(null!=i)return i;try{if(null!=localStorage&&(i=usi_cookies.get_ls(e),null!=i))return i;if(null!=sessionStorage&&(i=sessionStorage.getItem(e),void 0===i&&(i=null),null!=i))return decodeURIComponent(i)}catch(t){}var r=usi_cookies.get_from_window_name(e);if(null!=r&&r.length>1)try{i=decodeURIComponent(r[0])}catch(n){return r[0]}return i},get_json:function(e){var i=null,t=usi_cookies.get(e);if(null==t)return null;try{i=JSON.parse(t)}catch(r){t=t.replace(/\\"/g,'"');try{i=JSON.parse(JSON.parse(t))}catch(n){try{i=JSON.parse(t)}catch(o){}}}return i},search_cookies:function(e){e=e||"";var i=[];return document.cookie.split(";").forEach(function(t){var r=t.split("=")[0].trim();(""===e||0===r.indexOf(e))&&i.push(r)}),i},set:function(e,i,t,r){"undefined"!=typeof usi_nevercookie&&!0==usi_nevercookie&&(r=!1),void 0===t&&(t=-1);try{i=i.replace(/(\r\n|\n|\r)/gm,"")}catch(n){}"undefined"==typeof usi_windownameless&&usi_cookies.update_window_name(e+"",i+"",t);try{if(t>0&&null!=localStorage){var o=new Date,u={value:i,usi_expires:o.getTime()+1e3*t};localStorage.setItem(e,JSON.stringify(u))}else null!=sessionStorage&&sessionStorage.setItem(e,i)}catch(l){}if(r||null==i){if(null!=i){if(null==usi_cookies.read_cookie(e)&&!r&&usi_cookies.search_cookies("usi_").length+1>usi_cookies.max_cookies_count){usi_cookies.report_error('Set cookie "'+e+'" failed. Max cookies count is '+usi_cookies.max_cookies_count);return}if(i.length>usi_cookies.max_cookie_length){usi_cookies.report_error('Cookie "'+e+'" truncated ('+i.length+"). Max single-cookie length is "+usi_cookies.max_cookie_length);return}}usi_cookies.create_cookie(e,i,t)}},set_json:function(e,i,t,r){var n=JSON.stringify(i).replace(/^"/,"").replace(/"$/,"");usi_cookies.set(e,n,t,r)},flush:function(e){e=e||"usi_";var i,t,r,n=document.cookie.split(";");for(i=0;i<n.length;i++)0==(t=n[i]).trim().toLowerCase().indexOf(e)&&(r=t.trim().split("=")[0],usi_cookies.del(r));usi_cookies.flush_window_name(e);try{if(null!=localStorage)for(var o in localStorage)0==o.indexOf(e)&&localStorage.removeItem(o);if(null!=sessionStorage)for(var o in sessionStorage)0==o.indexOf(e)&&sessionStorage.removeItem(o)}catch(u){}},print:function(){for(var e=document.cookie.split(";"),i="",t=0;t<e.length;t++){var r=e[t];0==r.trim().toLowerCase().indexOf("usi_")&&(console.log(decodeURIComponent(r.trim())+" (cookie)"),i+=","+r.trim().toLowerCase().split("=")[0]+",")}try{if(null!=localStorage)for(var n in localStorage)0==n.indexOf("usi_")&&"string"==typeof localStorage[n]&&-1==i.indexOf(","+n+",")&&(console.log(n+"="+usi_cookies.get_ls(n)+" (localStorage)"),i+=","+n+",");if(null!=sessionStorage)for(var n in sessionStorage)0==n.indexOf("usi_")&&"string"==typeof sessionStorage[n]&&-1==i.indexOf(","+n+",")&&(console.log(n+"="+sessionStorage[n]+" (sessionStorage)"),i+=","+n+",")}catch(o){}for(var u=(window.top||window).name.split(";"),l=0;l<u.length;l++){var a=u[l].split("=");if(3==a.length&&0==a[0].indexOf("usi_")&&-1==i.indexOf(","+a[0]+",")){var c=a[1];-1!=c.indexOf("USIEQLS")&&(c=c.replace(/USIEQLS/g,"=")),-1!=c.indexOf("USIPRNS")&&(c=c.replace(/USIPRNS/g,";")),console.log(a[0]+"="+c+" (window.name)"),i+=","+r.trim().toLowerCase().split("=")[0]+","}}},value_exists:function(){var e,i;for(e=0;e<arguments.length;e++)if(i=usi_cookies.get(arguments[e]),""===i||null===i||"null"===i||"undefined"===i)return!1;return!0},report_error:function(e){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(e)},check_multi_domain:function(){try{"undefined"!=typeof usi_app&&usi_app.company_id?usi_cookies.get("usi_app.company_id")?usi_cookies.get("usi_app.company_id")!==usi_app.company_id&&(window.name=""):usi_cookies.set("usi_app.company_id",usi_app.company_id):setTimeout(function(){usi_cookies.check_multi_domain()},2e3)}catch(e){"undefined"!=typeof usi_commons&&usi_commons.report_error(e)}},monitor_page_views:function(){try{if(void 0===usi_cookies.last_url||usi_cookies.last_url!=location.href){usi_cookies.last_url=location.href;var e=window.self===window.top,i=-1!==location.href.indexOf("/checkouts/");e&&(usi_cookies.get("usi_entry_url_1")||usi_cookies.set("usi_entry_url_1",usi_cookies.last_url,21600),null==document.referrer||usi_cookies.get("usi_referrer_url")||-1!=document.referrer.indexOf(location.host)||usi_cookies.set("usi_referrer_url",document.referrer||"direct traffic",21600)),(e||i)&&(usi_cookies.get("usi_entry_url_1")&&usi_cookies.get("usi_entry_url_1")!=usi_cookies.last_url&&usi_cookies.set("usi_last_url_1",usi_cookies.last_url,21600),usi_cookies.set("usi_pv_count",String(Number(usi_cookies.get("usi_pv_count")||0)+1),21600))}setTimeout(usi_cookies.monitor_page_views,2e3)}catch(t){"undefined"!=typeof usi_commons&&usi_commons.report_error(t)}}},"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.gup&&"function"==typeof usi_commons.gup_or_get_cookie)try{usi_commons.force_date=usi_commons.gup_or_get_cookie("usi_force_date"),usi_commons.force_group=usi_commons.gup_or_get_cookie("usi_force_group"),usi_commons.is_enabled=""!=usi_commons.gup_or_get_cookie("usi_enable",usi_cookies.expire_time.hour,!0),usi_commons.is_forced=""!=usi_commons.gup_or_get_cookie("usi_force",usi_cookies.expire_time.hour,!0),""!=usi_commons.gup("usi_email_id")?usi_cookies.set("usi_email_id",usi_commons.gup("usi_email_id").split(".")[0],Number(usi_commons.gup("usi_email_id").split(".")[1]),!0):null==usi_cookies.read_cookie("usi_email_id")&&null!=usi_cookies.get_from_window_name("usi_email_id")&&usi_cookies.set("usi_email_id",usi_cookies.get_from_window_name("usi_email_id")[0],(usi_cookies.get_from_window_name("usi_email_id")[1]-new Date().getTime())/1e3,!0),""!=usi_commons.gup_or_get_cookie("usi_debug")&&(usi_commons.debug=!0),""!=usi_commons.gup_or_get_cookie("usi_qa")&&(usi_commons.domain=usi_commons.cdn="https://prod.upsellit.com"),usi_cookies.monitor_page_views()}catch(e){usi_commons.report_error(e)}-1!=location.href.indexOf("usi_clearcookies")&&usi_cookies.flush(),usi_cookies.check_multi_domain()}
"undefined"==typeof usi_date&&((usi_date={}).add_hours=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+36e5*t)},usi_date.add_minutes=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+6e4*t)},usi_date.add_seconds=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+1e3*t)},usi_date.is_date=function(e){return null!=e&&"object"==typeof e&&e instanceof Date==!0&&!1===isNaN(e.getTime())},usi_date.is_after=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()>r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_before=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()<r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_between=function(e,t){return usi_date.check_format(e,t),usi_date.is_after(e)&&usi_date.is_before(t)},usi_date.check_format=function(e,t){(-1!=e.indexOf(" ")||t&&-1!=t.indexOf(" "))&&"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error("Incorrect format: Use YYYY-MM-DDThh:mm:ss")},usi_date.string_to_date=function(e,t){t=t||!1;var r=null,s=/^[0-2]?[0-9]\/[0-3]?[0-9]\/\d{4}(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e),n=/^(\d{4}\-[0-2]?[0-9]\-[0-3]?[0-9])(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e);if(2===(s||[]).length){if(r=new Date(e),""===(s[1]||"")&&!0===t){var a=new Date;r=usi_date.add_hours(r,a.getHours()),r=usi_date.add_minutes(r,a.getMinutes()),r=usi_date.add_seconds(r,a.getSeconds())}}else if(3===(n||[]).length){var c=n[1].split(/\-/g),i=c[1]+"/"+c[2]+"/"+c[0];return i+=n[2]||"",usi_date.string_to_date(i,t)}return r},usi_date.set_date=function(){var e=new Date,t=usi_commons.gup("usi_force_date");if(""!==t){t=decodeURIComponent(t);var r=usi_date.string_to_date(t,!0);null!=r?(e=r,usi_cookies.set("usi_force_date",t,usi_cookies.expire_time.hour),usi_commons.log("Date forced to: "+e)):usi_cookies.del("usi_force_date")}else e=null!=usi_cookies.get("usi_force_date")?usi_date.string_to_date(usi_cookies.get("usi_force_date"),!0):new Date;return e},usi_date.diff=function(e,t,r,s){null==s&&(s=1),""!=(r||"")&&(r=usi_date.get_units(r));var n=null;if(!0===usi_date.is_date(t)&&!0===usi_date.is_date(e))try{var a=Math.abs(t-e);switch(r){case"ms":n=a;break;case"seconds":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3),s);break;case"minutes":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60),s);break;case"hours":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60),s);break;case"days":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60)/parseFloat(24),s)}}catch(c){n=null}return n},usi_date.get_units=function(e){var t="";switch(e.toLowerCase()){case"days":case"day":case"d":t="days";break;case"hours":case"hour":case"hrs":case"hr":case"h":t="hours";break;case"minutes":case"minute":case"mins":case"min":case"m":t="minutes";break;case"seconds":case"second":case"secs":case"sec":case"s":t="seconds";break;case"ms":case"milliseconds":case"millisecond":case"millis":case"milli":t="ms"}return t});
"undefined"==typeof usi_company&&(window.usi_company={rulesets:{testing:function(e){return void 0===e.testing||(e.testing?usi_cookies.get("usi_enable"):e.testing?void 0:!usi_cookies.get("usi_enable"))},device:function(e){return!e.device||usi_commons.device===e.device},required_cookies:function(e){return!e.required_cookies||usi_cookies.value_exists.apply(null,e.required_cookies)},suppress_cookies:function(e){if(!e.suppress_cookies)return!0;for(var t=0;t<e.suppress_cookies.length;t++)if(usi_cookies.value_exists(e.suppress_cookies[t]))return!1;return!0},required_elements:function(e){if(!e.required_elements)return!0;try{for(var t=0;t<e.required_elements.length;t++)if(!document.querySelector(e.required_elements[t]))return!1;return!0}catch(r){return!1}},min_subtotal:function(e){return void 0===e.min_subtotal||usi_company.get_subtotal()>e.min_subtotal},max_subtotal:function(e){return void 0===e.max_subtotal||usi_company.get_subtotal()<e.max_subtotal},subtotal_gt:function(e){return void 0===e.subtotal_gt||usi_company.get_subtotal()>e.subtotal_gt},subtotal_lt:function(e){return void 0===e.subtotal_lt||usi_company.get_subtotal()<e.subtotal_lt},subtotal_gte:function(e){return void 0===e.subtotal_gte||usi_company.get_subtotal()>=e.subtotal_gte},subtotal_lte:function(e){return void 0===e.subtotal_lte||usi_company.get_subtotal()<=e.subtotal_lte},date_ranges:function(e){return e.date_ranges&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.date_ranges||e.date_ranges.some(function(e){return usi_date.is_date(new Date(e[1]))&&!usi_date.is_date(new Date(e[0]))?usi_date.is_before(e[1]):usi_date.is_date(new Date(e[0]))&&!usi_date.is_date(new Date(e[1]))?usi_date.is_after(e[0]):usi_date.is_between(e[0],e[1])})},is_after:function(e){return e.is_after&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.is_after||usi_date.is_after(e.is_after)},is_before:function(e){return e.is_before&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.is_before||usi_date.is_before(e.is_before)},is_entry:function(e){if(void 0===e.is_entry)return!0;var t=usi_cookies.get("usi_referrer_url"),r=document.referrer==t||""==document.referrer&&"direct traffic"==t,s=location.href==usi_cookies.get("usi_entry_url_1")&&r;return e.is_entry?s:e.is_entry?void 0:!s},page_visits:function(e){if(void 0===e.page_visits)return!0;var t=Number(usi_cookies.get("usi_pv_count"));return("number"!=typeof e.page_visits.equals||t===e.page_visits.equals)&&("number"!=typeof e.page_visits.min||!(t<=e.page_visits.min))&&("number"!=typeof e.page_visits.max||!(t>=e.page_visits.max))},countries:function(e){return e.countries&&!usi_app.country?usi_commons.log("usi_app.country is required"):!e.countries||-1!==e.countries.indexOf(usi_app.country)},states:function(e){return e.states&&!usi_app.state?usi_commons.log("usi_app.state is required"):!e.states||-1!==e.states.indexOf(usi_app.state)},suppress_countries:function(e){return e.suppress_countries&&!usi_app.country?usi_commons.log("usi_app.country is required"):!e.suppress_countries||-1===e.suppress_countries.indexOf(usi_app.country)},suppress_states:function(e){return e.suppress_states&&!usi_app.state?usi_commons.log("usi_app.state is required"):!e.suppress_states||-1===e.suppress_states.indexOf(usi_app.state)},traffic_percent:function(e){return void 0===e.traffic_percent||(e.siteID&&!usi_cookies.get("usi_traffic"+e.siteID)&&usi_cookies.set("usi_traffic"+e.siteID,Math.random()>e.traffic_percent?"true":"false"),e.siteID&&"true"===usi_cookies.get("usi_traffic"+e.siteID))},traffic_source:function(e){return void 0===e.traffic_source||(usi_cookies.get("usi_traffic_source")||usi_commons.log_error("usi_traffic_source required"),""===usi_cookies.get("usi_traffic_source")&&-1!==e.traffic_source.indexOf("direct")||e.traffic_source.some(function(e){return -1!==usi_cookies.get("usi_traffic_source").indexOf(e)}))},pages:function(e){return void 0===e.pages||e.pages.some(function(e){return"/"===e?location.pathname==e:-1!==location.href.indexOf(e)})},suppressed_pages:function(e){return void 0===e.suppressed_pages||!e.suppressed_pages.some(function(e){return"/"===e?location.pathname==e:-1!==location.href.indexOf(e)})},logged_in:function(e){return void 0===e.logged_in||(e.logged_in?"loggedin"===usi_cookies.get("usi_visitor"):e.logged_in?void 0:"loggedin"!==usi_cookies.get("usi_visitor"))},logged_out:function(e){return void 0===e.logged_out||(e.logged_out?"loggedin"!==usi_cookies.get("usi_visitor"):e.logged_out?void 0:"loggedin"===usi_cookies.get("usi_visitor"))},return_visitor:function(e){if(void 0===e.return_visitor)return!0;if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=usi_commons.gup_or_get_cookie("usi_force_return");if("1"===t||"0"===t)return"1"===t===e.return_visitor;var r=usi_company.is_return("number"==typeof e.return_visitor?e.return_visitor:24);return e.return_visitor?r:!r},new_visitor:function(e){if(void 0===e.new_visitor)return!0;if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=usi_commons.gup_or_get_cookie("usi_force_return");if("1"===t||"0"===t)return"0"===t===e.new_visitor;var r=usi_company.is_return("number"==typeof e.new_visitor?e.new_visitor:24);return e.new_visitor?!r:r},last_purchase:function(e){if(void 0===e.last_purchase)return!0;var t=Number(usi_cookies.get("usi_customer_purchased"));return e.last_purchase.equals?e.last_purchase.equals==t:e.last_purchase.min?e.last_purchase.min>=t:!!e.last_purchase.max&&e.last_purchase.max<=t},return_customer:function(e){return void 0===e.return_customer||(e.return_customer?usi_cookies.get("usi_customer_purchased"):e.return_customer?void 0:!usi_cookies.get("usi_customer_purchased"))},new_customer:function(e){return void 0===e.new_customer||(e.new_customer?!usi_cookies.get("usi_customer_purchased"):e.new_customer?void 0:usi_cookies.get("usi_customer_purchased"))}},get_subtotal:function(){return usi_cookies.get("usi_subtotal")?Number(usi_cookies.get("usi_subtotal").replace(/[^0-9.]/g,"")):0},is_return:function(e){if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=!1,r="usi_return_visitor",s=usi_date.set_date();!1===usi_cookies.value_exists(r)&&usi_cookies.set(r,s,usi_cookies.expire_time.never,!0);var i=new Date(usi_cookies.get(r));return usi_date.is_date(i)&&(t=usi_date.diff(i,s,"hours",2)>=e),t},test_load:function(e,t){return!1},before_load:function(e){usi_commons.log("Loading: "+(e._name?e._name+", ":e.name?e.name+", ":"")+(e.siteID?e.siteID+", ":"")+(e.key?e.key:"")),"string"==typeof e.before_load&&"function"==typeof usi_app[e.before_load]&&usi_app[e.before_load](e)},on_load:function(e,t){"object"==typeof e&&e.on_load&&("object"==typeof t&&"function"==typeof t[e.on_load]?t[e.on_load]():"object"==typeof usi_app&&"function"==typeof usi_app[e.on_load]&&usi_app[e.on_load]())},post_load_campaigns:function(e){if("1"==usi_commons.gup_or_get_cookie("usi_testing")&&e.campaigns){var t=Object.keys(usi_company.rulesets);t=t.concat(Object.keys(usi_company.custom_rulesets)),t=Array.from(new Set(t)).sort();var r={};for(var s in e.campaigns)r[s.charAt(0)]=e.campaigns[s].map(function(e){return e._missing?e._missing.map(e=>t.indexOf(e)):-1});var i=JSON.stringify(r),n=JSON.stringify(t),o=JSON.stringify(e);i!=sessionStorage.usi_campaign_results&&sessionStorage.setItem("usi_campaign_results",i),n!=sessionStorage.usi_campaign_keys&&(sessionStorage.usi_campaign_json||sessionStorage.setItem("usi_campaign_json",o),sessionStorage.setItem("usi_campaign_keys",n))}},load_campaigns:function(e,t){try{if(!e||!e.campaigns)return;function r(e,t){var r=0;!function s(){if(!(r>=e.length)){var i=e[r++];t(i,function(e){e||s()})}}()}function s(e,t,r){if(!e)return"";var s=e.match(/^{{\s*usi_app\.([\w.]+)\s*}}$/);if(s){var i=s[1].split(".");let n=usi_app;for(let o of i){if(null==n||"object"!=typeof n)return e;n=n[o]}return"function"==typeof n?n(r||t):n}return e.replace(/{{\s*usi_commons\.device\s*}}/,usi_commons.device).replace(/{{\s*usi_app\.([\w.]+)\s*}}/g,function(e,t){if(!t)return e;for(var s=t.split("."),i=usi_app,n=0;n<s.length;n++){if(null==i||"object"!=typeof i)return e;i=i[s[n]]}return null==i?e:"function"==typeof i?i(r):i})}function i(e,t){var r=Object.assign({},e);for(var i in r)r.hasOwnProperty(i)&&"string"==typeof r[i]&&r[i].match(/{{\s*usi_app\.([\w.]+)\s*}}/)&&(r[i]=s(r[i],r,t));return r}function n(e,t){try{var r,n,o,u=[],a={};if(e.segments&&Array.isArray(e.segments))for(var c=0;c<e.segments.length;c++){var f=e.segments[c],p=[];for(var l in f)if(f.hasOwnProperty(l)){var d=usi_company.custom_rulesets[l]||usi_company.rulesets[l];for(var g in"function"!=typeof d||d(Object.assign({},e,f))||p.push(l),usi_company.custom_rulesets)if(usi_company.custom_rulesets.hasOwnProperty(g)){var m=usi_company.custom_rulesets[g];m({...e,...f})||p.push(g)}}if(0===p.length){a=f;break}}var v=Object.assign({},e,a);for(var y in"view"===v._type&&"undefined"==typeof usi_force&&-1==location.href.indexOf("usi_force")&&(v.suppress_cookies=v.suppress_cookies||[],-1===v.suppress_cookies.indexOf("usi_sale")&&v.suppress_cookies.push("usi_sale","usi_launched","usi_launched"+v.siteID),e.suppress_cookies=v.suppress_cookies),usi_company.rulesets)!usi_company.custom_rulesets[y]&&usi_company.rulesets.hasOwnProperty(y)&&((0,usi_company.rulesets[y])(v)||u.push(y));for(var h in usi_company.custom_rulesets)if(usi_company.custom_rulesets.hasOwnProperty(h)){var m=usi_company.custom_rulesets[h];m(v)||u.push(h)}if(e._missing=u,u.length>0)return t(!1);var b=[];if(v.list){if(!usi_app.company_id)return usi_commons.log_error("usi_app.company_id is required");if(!v.list.ids)return usi_commons.log_error("campaign.list.ids is required");if(!v.list.label)return usi_commons.log_error("campaign.list.label is required");b.push(function(t){var r=i(v.list,v);if(v.product=Array.isArray(r.ids)?r.ids.join(","):s(r.ids,v),v.save_token="usi_ls_"+v.list.label+"_"+v.product,sessionStorage[v.save_token])return t("true"===sessionStorage[v.save_token]);usi_company.lookup_callback=function(s){try{e.list._found=s,r.type=r.type||"suppress";var i=0===s&&"suppress"===r.type||1===s&&"enable"===r.type;sessionStorage.setItem(v.save_token,i.toString()),i||u.push("list"),t(i)}catch(n){usi_commons.report_error(n)}};var n=usi_commons.domain+"/utility/lookup_suppressions.jsp?companyID="+usi_app.company_id+"&product="+v.product+"&label="+r.label+"&match="+(r.match||"any")+"&callback=usi_company.lookup_callback";usi_commons.load_script(n)})}if(v.lift){if("undefined"==typeof usi_split_test)return usi_commons.log_error("usi_split_test is required");if(!v.lift.id)return usi_commons.log_error("campaign.lift.id is required");b.push(function(t){usi_split_test.instantiate_callback(v.lift.id,function(r){if(0==r)return u.push("lift"),t(!1);e.lift._group=r,t(!0)})})}"object"==typeof v.split&&b.push(function(t){var r,s=Object.keys(v.split),i=usi_commons.gup("usi_force_group");if(i)r=i;else if(v._group)r=v._group;else if(v.lift&&"boolean"==typeof v.lift.split&&v.lift.split&&v.lift._group)r=v.lift._group;else{for(var n=0,o={},u=0;u<s.length;u++){var a=s[u],c=v.split[a].percent;o[a]="number"==typeof c&&c>0?c:1,n+=o[a]}for(var f=Math.random()*n,p=0,l=0;l<s.length;l++){var d=s[l];if(p+=o[d],f<p){r=d;break}}r||(r=s[0])}var g=v.split[r];for(var m in g)g.hasOwnProperty(m)&&(v[m]=g[m]);e._group=r,t(!0)}),b.push(function(e){if(v.recommendations){var t=i(v.recommendations,v);if(!t.pid)return usi_commons.log_error("recommendations.pid is required");if(!t.siteID)return usi_commons.log_error("recommendations.siteID is required");t.callback=function(){v.recommendations.filter_callback&&"function"==typeof usi_app[v.recommendations.filter_callback]&&usi_app[v.recommendations.filter_callback](v);var t=v.recommendations.name?v.recommendations.name.replace("usi_app.",""):"product_rec",r=usi_app[t]&&usi_app[t].data&&usi_app[t].data.length?usi_app[t].data.length:0,s=void 0!==v.recommendations.min_rows?v.recommendations.min_rows:v.recommendations.rows?v.recommendations.rows:3,i=usi_commons.gup("usi_test")||r>=s;i||u.push("recommendations"),e(i)},usi_commons.load_products(t)}else e(!0)}),r=b,n=function(e){v.siteID||u.push("siteID"),"anon"==v._type||v.hash||u.push("hash"),t(e,v)},o=0,function e(t){return t?o>=r.length?n(!0):void r[o++](e):n(!1)}(!0)}catch($){usi_commons.report_error($),t(!1)}}usi_company.custom_rulesets=t||[],e.campaigns.usi_load&&r(e.campaigns.usi_load,function(e,t){e._type="usi_load",n(e,function(r,n){e._active=r,r&&n&&n.siteID&&n.hash?(usi_company.before_load(n),usi_commons.load(n.hash,n.siteID,n.key?s(n.key,n):"",function(){var e=window["usi_"+n.siteID];void 0!==e&&(e.company_json=i(n),n.on_load&&usi_company.on_load(n,e)),t(usi_company.test_load(r,n))})):t(r)})}),e.campaigns.view&&r(e.campaigns.view,function(e,t){e._type="view",n(e,function(r,n){e._active=r,r&&n&&n.siteID&&n.hash&&(usi_company.before_load(n),usi_commons.load_view(n.hash,n.siteID,n.key?s(n.key,n):"",function(){"undefined"!=typeof usi_js&&(usi_js.company_json=i(n),n.on_load&&usi_company.on_load(n,usi_js))})),t(r)})}),e.campaigns.anon&&r(e.campaigns.anon,function(e,t){e._type="anon",n(e,function(r,s){if(e._active=r,r&&s&&s.siteID){if(usi_app.anon_data=i(s),usi_company.before_load(s),"undefined"==typeof usi_user_id)return usi_commons.log_error("usi_user_id is required");s.found_user_callback&&"function"==typeof usi_app[s.found_user_callback]&&(usi_user_id.found_user_callback=usi_app[s.found_user_callback]),usi_user_id.activate(s.siteID),s.on_load&&usi_company.on_load(s,usi_user_id)}t(r)})}),e.campaigns.precapture&&r(e.campaigns.precapture,function(e,t){e._type="precapture",n(e,function(r,s){e._active=r,r&&s&&s.siteID&&s.hash&&(usi_app.precapture_data=i(s),usi_company.before_load(s),usi_commons.load_precapture(s.hash,s.siteID,function(){s.on_load&&usi_company.on_load(s,usi_js_monitor)})),t(r)})}),usi_company.post_load_campaigns()}catch(o){usi_commons.report_error(o)}}});
"undefined"==typeof usi_aff&&(usi_aff={fix_linkshare:function(){try{if(""!=usi_commons.gup("ranSiteID")&&(usi_aff.log_url(),-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))){usi_cookies.del("usi_clicked_1");var e=new Date,i=e.getUTCFullYear()+(e.getUTCMonth()+1<10?"0":"")+(e.getUTCMonth()+1)+(10>e.getUTCDate()?"0":"")+e.getDate(),c=(10>e.getUTCHours()?"0":"")+e.getUTCHours()+(10>e.getUTCMinutes()?"0":"")+e.getUTCMinutes();usi_cookies.create_nonencoded_cookie("usi_rmStore","ald:"+i+"_"+c+"|atrv:"+usi_commons.gup("ranSiteID"),usi_cookies.expire_time.month)}null!=usi_cookies.read_cookie("usi_rmStore")&&(usi_cookies.create_nonencoded_cookie("rmStore",usi_cookies.read_cookie("usi_rmStore"),usi_cookies.expire_time.month),localStorage.setItem("rmStore",'{"/":"'+usi_cookies.read_cookie("usi_rmStore")+'"}'))}catch(r){usi_commons.report_error(r)}},fix_cj:function(){try{if(""!=usi_commons.gup("cjevent")||""!=usi_commons.gup("CJEVENT")){usi_aff.log_url(),usi_cookies.del("cjUser");var e=usi_commons.gup("cjevent");""==e&&(e=usi_commons.gup("CJEVENT")),(-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))&&(usi_cookies.del("usi_clicked_1"),usi_cookies.create_nonencoded_cookie("usi_cjevent",e,usi_cookies.expire_time.month))}null!=usi_cookies.read_cookie("usi_cjevent")&&(usi_cookies.create_nonencoded_cookie("cjevent",usi_cookies.read_cookie("usi_cjevent"),usi_cookies.expire_time.month),localStorage.setItem("as_onsite_cjevent",usi_cookies.read_cookie("usi_cjevent")),localStorage.setItem("cjevent",usi_cookies.read_cookie("usi_cjevent")),sessionStorage.setItem("cjevent",usi_cookies.read_cookie("usi_cjevent")))}catch(i){usi_commons.report_error(i)}},fix_sas:function(){try{""!=usi_commons.gup("sscid")&&(usi_aff.load_script("https://www.upsellit.com/launch/blank.jsp?aff_click_sas="+encodeURIComponent(location.href)),(-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))&&(usi_cookies.del("usi_clicked_1"),usi_cookies.create_nonencoded_cookie("usi_sscid",usi_commons.gup("sscid"),usi_cookies.expire_time.month))),null!=usi_cookies.read_cookie("usi_sscid")&&usi_cookies.create_nonencoded_cookie("sas_m_awin",'{"clickId":"'+usi_cookies.read_cookie("usi_sscid")+'"}',usi_cookies.expire_time.month)}catch(e){usi_commons.report_error(e)}},fix_awin:function(e){try{""!=usi_commons.gup("awc")&&(usi_aff.log_url(),(-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))&&(usi_cookies.del("usi_clicked_1"),usi_cookies.create_nonencoded_cookie("usi_awc",usi_commons.gup("awc"),usi_cookies.expire_time.month),usi_cookies.del("_aw_j_"+e))),null!=usi_cookies.read_cookie("usi_awc")&&(usi_cookies.del("_aw_j_"+e),usi_cookies.create_nonencoded_cookie("AwinChannelCookie","aw",2592e3,!0),usi_cookies.create_nonencoded_cookie("AwinCookie","aw",2592e3,!0),usi_cookies.create_nonencoded_cookie("awin_source","aw",2592e3,!0),usi_cookies.create_nonencoded_cookie("_aw_m_"+e,usi_cookies.read_cookie("usi_awc"),usi_cookies.expire_time.month),usi_cookies.create_nonencoded_cookie("awc",usi_cookies.read_cookie("usi_awc"),usi_cookies.expire_time.month),"undefined"!=typeof AWIN&&void 0!==AWIN.Tracking&&void 0!==AWIN.Tracking.StorageProvider&&AWIN.Tracking.StorageProvider.setAWC(e,usi_cookies.read_cookie("usi_awc")))}catch(i){usi_commons.report_error(i)}},fix_pj:function(){try{if(""!=usi_commons.gup("clickId")&&(usi_aff.log_url(),-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))){usi_cookies.del("usi_clicked_1");var e=new Date;usi_cookies.create_nonencoded_cookie("usi-pjn-click",'[{"id":"'+usi_commons.gup("clickId")+'","days":'+Math.floor(e/864e5)+',"type":"p"}]',usi_cookies.expire_time.month)}null!=usi_cookies.read_cookie("usi-pjn-click")&&(usi_cookies.create_nonencoded_cookie("pjn-click",usi_cookies.read_cookie("usi-pjn-click"),usi_cookies.expire_time.month),localStorage.setItem("pjnClickData",usi_cookies.read_cookie("usi-pjn-click")))}catch(i){usi_commons.report_error(i)}},fix_ir:function(e){try{if((""!=usi_commons.gup("irclickid")||""!=usi_commons.gup("clickid"))&&(usi_aff.log_url(),-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))){usi_cookies.del("usi_clicked_1");var i=usi_commons.gup("irclickid");""==i&&(i=usi_commons.gup("clickid"));var c=Date.now().toString(),r=c+"|-1|"+c+"|"+i+"|";usi_cookies.create_nonencoded_cookie("usi_IR_"+e,r,usi_cookies.expire_time.month)}null!=usi_cookies.read_cookie("usi_IR_"+e)&&(usi_cookies.create_nonencoded_cookie("IR_"+e,usi_cookies.read_cookie("usi_IR_"+e),usi_cookies.expire_time.month),usi_cookies.create_nonencoded_cookie("irclickid",usi_cookies.read_cookie("usi_IR_"+e).split("|")[3],usi_cookies.expire_time.month))}catch(o){usi_commons.report_error(o)}},fix_cf:function(){try{""!=usi_commons.gup("cfclick")&&(usi_aff.log_url(),(-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))&&(usi_cookies.del("usi_clicked_1"),usi_cookies.create_nonencoded_cookie("usi-cfjump-click",usi_commons.gup("cfclick"),usi_cookies.expire_time.month))),null!=usi_cookies.read_cookie("usi-cfjump-click")&&(usi_cookies.create_nonencoded_cookie("cfjump-click",usi_cookies.read_cookie("usi-cfjump-click"),usi_cookies.expire_time.month),usi_cookies.create_nonencoded_cookie("cfclick",usi_cookies.read_cookie("usi-cfjump-click"),usi_cookies.expire_time.month))}catch(e){usi_commons.report_error(e)}},fix_avantlink:function(){try{""!=usi_commons.gup("avad")&&(usi_aff.log_url(),(-1!=location.href.indexOf("usi_email_id")||null!=usi_cookies.get("usi_clicked_1"))&&(usi_cookies.del("usi_clicked_1"),usi_cookies.create_nonencoded_cookie("usi_avad",usi_commons.gup("avad"),usi_cookies.expire_time.month),usi_aff.wait_for_avmws=function(){null!=usi_cookies.get("avmws")?usi_cookies.create_nonencoded_cookie("usi_avmws",usi_cookies.get("avmws"),usi_cookies.expire_time.month):setTimeout(usi_aff.wait_for_avmws,1e3)},usi_aff.wait_for_avmws())),null!=usi_cookies.read_cookie("usi_avmws")&&usi_cookies.create_nonencoded_cookie("avmws",usi_cookies.read_cookie("usi_avmws"),usi_cookies.expire_time.month)}catch(e){usi_commons.report_error(e)}},get_impact_pixel:function(){var e="";try{for(var i=document.getElementsByTagName("script"),c=0;c<i.length;c++){var r=i[c].innerText;if(r&&(-1!=r.indexOf("ire('trackConversion'")||-1!=r.indexOf('ire("trackConversion"'))){e=(e=(e=r.trim().replace(/\s/g,"")).split("trackConversion")[1]).split("});")[0];break}}}catch(o){usi_commons.report_error(o)}return e},log_url:function(){usi_aff.load_script("https://www.upsellit.com/launch/blank.jsp?aff_click="+encodeURIComponent(location.href))},monitor_affiliate_pixel:function(e){try{var i=usi_aff.report_affiliate_pixels();if(i)return"function"==typeof e&&e(i),usi_aff.parse_pixels(i);setTimeout(function(){usi_aff.monitor_affiliate_pixel(e)},1e3)}catch(c){usi_commons.report_error(c)}},parse_pixels:function(e){try{usi_aff.load_script("https://www.upsellit.com/launch/blank.jsp?pixel_found="+encodeURIComponent(location.href)+"&"+e)}catch(i){usi_commons.report_error(i)}},report_affiliate_pixels:function(){var e="";try{var i={cj:document.querySelector("[src*='emjcd.com']"),sas:document.querySelector("[src*='shareasale.com/sale.cfm']"),linkshare:document.querySelector("[src*='track.linksynergy.com']"),pj:document.querySelector("[src*='t.pepperjamnetwork.com/track']"),avant:document.querySelector("[src*='tracking.avantlink.com/ptcfp.php']"),ir:{src:usi_aff.get_impact_pixel()},awin1:document.querySelector("[src*='awin1.com/sread']"),awin2:document.querySelector("[src*='zenaps.com/sread.js']"),cf:document.querySelector("[src*='https://cfjump.'][src*='.com/track']"),saasler1:document.querySelector("[src*='engine.saasler.com']"),saasler2:document.querySelector("[src*='saasler-impact.herokuapp.com']")};for(var c in i)i[c]&&i[c].src&&(e+="&"+c+"="+encodeURIComponent(i[c].src))}catch(r){usi_commons.report_error(r)}return e},load_script:function(e){try{var i=document.getElementsByTagName("head")[0],c=document.createElement("script");c.type="text/javascript",c.src=e,i.appendChild(c)}catch(r){usi_commons.report_error(r)}}});
		usi_app = {};

		usi_app.checkout_url = "https://checkout.autodesk.com";
		if (location.href.indexOf("https://checkout-pt.autodesk.com/") != -1 || location.href.indexOf("https://www-pt.autodesk.com/") != -1) {
			usi_app.checkout_url = "https://checkout-pt.autodesk.com";
		}

		window.upsellit = {};
		window.upsellit.showEmailFailedDialog = function(optionalErrorMessage) {
			try {
				window.upsellit = {};
				usi_force = true;
				usi_commons.load_view("oyhlmMV3erl9DoXtu0XxHSr", "61545",usi_commons.device+"_"+usi_app.get_locale(), function() {
					try {
						usi_app.load_automatically = function() {
							if (typeof (usi_js) !== "undefined") {
								usi_js.pre_display = function () {
									return true;
								};
								usi_js.display();
								window.upsellit.showEmailFailedDialog(optionalErrorMessage);
								return;
							}
							setTimeout(usi_app.load_automatically, 100);
						};
						usi_app.load_automatically();
					} catch(err) {
						usi_commons.report_error(err);
					}
				});
			} catch(err) {
				usi_commons.report_error(err);
			}
		}
		window.upsellit.showEmailSuccessfullySentDialog = function() {
			try {
				window.upsellit = {};
				usi_force = true;
				usi_commons.load_view("oyhlmMV3erl9DoXtu0XxHSr", "61545",usi_commons.device+"_"+usi_app.get_locale(), function() {
					try {
						usi_app.load_automatically = function() {
							if (typeof (usi_js) !== "undefined") {
								usi_js.pre_display = function () {
									return true;
								};
								usi_js.display();
								window.upsellit.showEmailSuccessfullySentDialog();
								return;
							}
							setTimeout(usi_app.load_automatically, 100);
						};
						usi_app.load_automatically();
					} catch(err) {
						usi_commons.report_error(err);
					}
				});
			} catch(err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.main = function () {
			try {
				usi_app.company_id = "3614";
				usi_app.americas = ["en-US", "en-CA", "fr-CA", "es-MX", "es-MX", "pt-BR", "es-AR"];
				usi_app.northamerica = ["en-US", "en-CA", "fr-CA", "es-MX"];
				usi_app.emea = ["fr-BE", "nl-BE", "cs-CZ", "da-DK", "fi-FI", "fr-FR", "de-DE", "hu-HU", "it-IT", "nl-NL", "no-NO", "pl-PL", "ru-RU", "pt-PT", "es-ES", "sv-SE", "de-CH", "it-CH", "fr-CH", "tr-TR", "en-EU"];
				usi_app.emea_uk = ["fr-BE", "nl-BE", "cs-CZ", "da-DK", "fi-FI", "fr-FR", "de-DE", "hu-HU", "it-IT", "nl-NL", "no-NO", "pl-PL", "ru-RU", "pt-PT", "es-ES", "sv-SE", "de-CH", "it-CH", "fr-CH", "tr-TR", "en-EU", "en-UK", "en-SE"];
				usi_app.anz = ["en-NZ", "en-AU"];
				usi_app.uk = ["en-UK", "en-SE"]; // en-SE is Middle East (new)
				usi_app.apac = ["en-MY", "en-SG", "ja-JP", "ko-KR", "en-IN", "zh-CN"];
				usi_app.latinamerica = ["es-MX", "pt-BR", "es-AR"]; // Latin America locales are included in Americas
				usi_app.cb_checkout_countries = ["zh-CN", "en-SE", "es-MX", "es-AR", "pt-BR", "en-MY", "en-SG", "en-IN", "ko-KR", "tr-TR"];

				usi_app.locale = usi_app.get_locale();

				usi_app.aff_links = usi_company_json.aff_links;
				usi_app.privacy_policy = usi_company_json.privacy_policy;

				usi_app.url = location.href.toLowerCase();
				usi_app.force_date = usi_commons.gup_or_get_cookie('usi_force_date');
				usi_app.is_enabled = usi_commons.gup_or_get_cookie("usi_enable", usi_cookies.expire_time.hour, true) != "";
				usi_app.is_forced = usi_commons.gup_or_get_cookie("usi_force", usi_cookies.expire_time.hour, true) != "";
				usi_app.is_suppressed = !usi_app.is_forced && (usi_cookies.value_exists("usi_sale") || !usi_app.is_enabled);
				usi_app.is_checkout_page = usi_app.url.indexOf("checkout.autodesk") != -1 || usi_app.url.indexOf("commerce.autodesk") != -1 || usi_app.url.indexOf("store.autodesk") != -1 || usi_app.url.indexOf("checkout-pt.autodesk") != -1;

				usi_app.is_return_visitor = usi_app.check_if_return_visitor() || usi_commons.gup_or_get_cookie('usi_force_return_visitor') !== '';
				usi_app.is_logged_out = (document.querySelector(".uh-me-menu-sign-in-text") != null && document.querySelector(".uh-me-menu-sign-in-text").textContent.trim() != "") || (document.querySelector(".account.wrapAccordion .accordion") != null && document.querySelector(".account.wrapAccordion .accordion").classList.contains("active"));

				usi_cookies.del('usi_num_items');
				usi_app.monitor_for_cart();

				//usi_app.load();

			} catch(err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.load = function() {
			try {
				usi_commons.log("usi_app.load()");
				usi_company.load_campaigns(usi_company_json, usi_app.custom_rulesets);
			} catch(err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.monitor_for_cart = function() {
			try {
				var cart_prefix = "usi_prod_";
				if (typeof(window.adsk) == "undefined" || window.adsk == null || typeof(window.adsk.cart) == "undefined" || window.adsk.cart == null || window.adsk.cart.getData() == null) {
					// delete active cart cookies if cart is empty
					if (usi_cookies.get('usi_num_items') != null) {
						usi_cookies.flush(cart_prefix);
						usi_cookies.del("usi_num_items");
						usi_cookies.del("usi_cartId");
						usi_cookies.del("usi_cartUrl");
						usi_cookies.del("usi_cartId");
						usi_cookies.del("usi_pids");

						if (typeof usi_js !== 'undefined' && typeof usi_js.cleanup === 'function') {
							usi_js.cleanup();
						}
					}
				} else {
					usi_app.cart = window.adsk.cart.getData();
					var usi_cart_items_string = JSON.stringify(usi_app.cart.items);
					if (usi_cart_items_string != usi_app.cart_items_string) {
						if (usi_cookies.get('usi_num_items') != null) {
							if (typeof usi_js !== 'undefined' && typeof usi_js.cleanup === 'function') {
								usi_js.cleanup();
							}
						}
						usi_app.cart_items_string  =  JSON.stringify(usi_app.cart.items);
						var usi_pids = usi_app.cart.items.map(function (item) {
							return item.offeringId; //Or maybe offeringCode
						});
						usi_cookies.flush(cart_prefix);
						usi_cookies.set("usi_pids", usi_pids.join(","), usi_cookies.expire_time.week);
						usi_cookies.set('usi_num_items', usi_app.cart.items.length, usi_cookies.expire_time.week);
						usi_cookies.set('usi_cartUrl', usi_app.cart.cartUrl, usi_cookies.expire_time.week);
						usi_cookies.set('usi_cartId', usi_app.cart.cartId, usi_cookies.expire_time.week);
						usi_app.cart.items.forEach(function (product, index) {
							if (index >= 3) return;
							usi_cookies.set(cart_prefix + "image" + "_" + (index + 1), "https://www2.upsellit.com/admin/custom/proxy.jsp?url=" + product["badgeUrl"], usi_cookies.expire_time.week);
							usi_cookies.set(cart_prefix + "name" + "_" + (index + 1), product["offeringName"], usi_cookies.expire_time.week);
							usi_cookies.set(cart_prefix + "qty" + "_" + (index + 1), product["quantity"], usi_cookies.expire_time.week);
							usi_cookies.set(cart_prefix + "price" + "_" + (index + 1), product["price"], usi_cookies.expire_time.week);
							usi_cookies.set(cart_prefix + "term" + "_" + (index + 1), product["termLabel"], usi_cookies.expire_time.week);
						});
						window.adsk.cartRecovery.isEmailRequired().then((value) => {
							usi_app.email_required = value;
							usi_app.load();
						});
					}
				}
				setTimeout(usi_app.monitor_for_cart, 1000);
			} catch(err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.custom_rulesets = {
			locales: function(c){
				if (typeof c.locales === "undefined") return true;
				return c.locales.indexOf(usi_app.locale) !== -1;
			},
			monthly: function(c){
				if (typeof c.monthly === "undefined") return true;
				return c.monthly === usi_app.has_monthly();
			},
			is_cb_cart: function(c){
				if (typeof c.is_cb_cart === "undefined") return true;
				if (c.is_cb_cart) return usi_app.is_cb_cart;
				if (!c.is_cb_cart) return !usi_app.is_cb_cart;
			},
			is_email_allowed: function(c){
				if (typeof c.is_email_allowed === "undefined") return true;
				if (usi_cookies.value_exists("usi_suppress_pc")) return false;// LC was submitted
				if (!usi_app.is_odm_cart && !usi_app.is_cb_cart) return false;// not a valid cart type
				if (usi_app.is_odm_cart && usi_commons.gup('cartId') == "") return false;//cart rebuild parameter available
				if (usi_app.is_cb_cart && !usi_cookies.value_exists("usi_odm_cart_link")) return false;//cart rebuild cookie available
				return true;
			},
			
			has_fusion: function(c) {
				if (typeof c.has_fusion == "undefined") return true;
				if (location.href.indexOf("checkout.autodesk") !== -1) {
					if (usi_app.products && usi_app.products.length == 0) {
						for (var i = 0; i < usi_app.products.length; i++) {
							if (usi_app.products[i].name.toLowerCase().indexOf("fusion") != -1) {
								return c.has_fusion;
							}
						}
					}
				} else if (location.href.indexOf("F360") !== -1 || location.href.indexOf("fusion") !== -1) {
					return c.has_fusion;
				}
				return !c.has_fusion;
			},
			return_eligible: function(c){
				if (typeof c.return_eligible === "undefined") return true;
				return (document.cookie.indexOf('usi_launched=') == -1 && document.referrer.indexOf("autodesk.com") == -1 && usi_app.is_return_visitor && !usi_app.is_logged_out);
			},
			return_eligible_logged_out: function(c){
				if (typeof c.return_eligible_logged_out === "undefined") return true;
				return (document.cookie.indexOf('usi_launched=') == -1 && document.referrer.indexOf("autodesk.com") == -1 && usi_app.is_return_visitor && usi_app.is_logged_out);
			},
			is_checkout_page: function(c){
				if (typeof c.is_checkout_page === "undefined") return true;
				if (c.is_checkout_page) return usi_app.is_checkout_page;
				if (!c.is_checkout_page) return !usi_app.is_checkout_page;
			},
			is_checkout_payment_page: function(c){
				if (typeof c.is_checkout_payment_page === "undefined") return true;
				if (c.is_checkout_payment_page) return usi_app.is_checkout_payment_page;
				if (!c.is_checkout_payment_page) return !usi_app.is_checkout_payment_page;
			},
			is_checkout_logged_in: function(c){
				if (typeof c.is_checkout_logged_in === "undefined") return true;
				if (c.is_checkout_logged_in) return usi_app.is_checkout_logged_in;
				if (!c.is_checkout_logged_in) return !usi_app.is_checkout_logged_in;
			},
			expired_trial: function(c) {
				if (typeof c.expired_trial == "undefined") return true;
				return usi_cookies.value_exists("usi_expired_trial");
			},
			eligible_site_visits: function(c) {
				if (typeof c.eligible_site_visits == "undefined") return true;
				return usi_app.eligible_site_visits;
			},
			eligible_us_acad_visits: function(c) {
				if (typeof c.eligible_us_acad_visits == "undefined") return true;
				return usi_app.eligible_us_acad_visits;
			},
			eligible_autocad_plus_downgrade: function(c) {
				if (typeof c.eligible_autocad_plus_downgrade == "undefined") return true;
				return (usi_app.products.length > 0 && usi_app.products[0].plc == "ACDIST" && usi_app.products[0].term == "1-year");
			},
			paySessionId_not_found: function(c) {
				if (typeof c.paySessionId_not_found == "undefined") return true;
				return !(usi_cookies.get("preservedQueryParams") != null && usi_cookies.get("preservedQueryParams").indexOf("paySessionId") != -1);
			}
		};

		usi_app.get_locale = function () {
			try {
				var temp_locale = "";
				if (window['utag_data'] && window['utag_data']['locale']) {
					temp_locale = window['utag_data']['locale'];
				}
				return temp_locale;
			} catch (err) {
				usi_commons.report_error(err);
			}
			return "";
		};

		usi_app.check_if_return_visitor = function() {
			try {
				usi_commons.log("usi_app.check_if_return_visitor()");
				var return_visitor = false;
				var cookie_name = "usi_return_visitor";
				var now = usi_date.set_date();

				try {
					if (usi_cookies.value_exists(cookie_name) === false) {
						usi_cookies.set(cookie_name, now, usi_cookies.expire_time.never, true);
					}
					var previous = new Date(usi_cookies.get(cookie_name));
					if (usi_date.is_date(previous)) {
						return_visitor = usi_date.diff(previous, now, 'hour', 2) > 24;
					}
				} catch(err) {
					usi_commons.report_error(err);
				}
				return return_visitor;
			} catch(err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.main();

	} catch(err) {
		usi_commons.report_error(err);
	}
}