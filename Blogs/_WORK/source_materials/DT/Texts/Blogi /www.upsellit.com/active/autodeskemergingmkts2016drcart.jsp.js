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
"undefined"==typeof usi_date&&((usi_date={}).add_hours=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+36e5*t)},usi_date.add_minutes=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+6e4*t)},usi_date.add_seconds=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+1e3*t)},usi_date.is_date=function(e){return null!=e&&"object"==typeof e&&e instanceof Date==!0&&!1===isNaN(e.getTime())},usi_date.is_after=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()>r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_before=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()<r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_between=function(e,t){return usi_date.check_format(e,t),usi_date.is_after(e)&&usi_date.is_before(t)},usi_date.check_format=function(e,t){(-1!=e.indexOf(" ")||t&&-1!=t.indexOf(" "))&&"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error("Incorrect format: Use YYYY-MM-DDThh:mm:ss")},usi_date.string_to_date=function(e,t){t=t||!1;var r=null,s=/^[0-2]?[0-9]\/[0-3]?[0-9]\/\d{4}(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e),n=/^(\d{4}\-[0-2]?[0-9]\-[0-3]?[0-9])(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e);if(2===(s||[]).length){if(r=new Date(e),""===(s[1]||"")&&!0===t){var a=new Date;r=usi_date.add_hours(r,a.getHours()),r=usi_date.add_minutes(r,a.getMinutes()),r=usi_date.add_seconds(r,a.getSeconds())}}else if(3===(n||[]).length){var c=n[1].split(/\-/g),i=c[1]+"/"+c[2]+"/"+c[0];return i+=n[2]||"",usi_date.string_to_date(i,t)}return r},usi_date.set_date=function(){var e=new Date,t=usi_commons.gup("usi_force_date");if(""!==t){t=decodeURIComponent(t);var r=usi_date.string_to_date(t,!0);null!=r?(e=r,usi_cookies.set("usi_force_date",t,usi_cookies.expire_time.hour),usi_commons.log("Date forced to: "+e)):usi_cookies.del("usi_force_date")}else e=null!=usi_cookies.get("usi_force_date")?usi_date.string_to_date(usi_cookies.get("usi_force_date"),!0):new Date;return e},usi_date.diff=function(e,t,r,s){null==s&&(s=1),""!=(r||"")&&(r=usi_date.get_units(r));var n=null;if(!0===usi_date.is_date(t)&&!0===usi_date.is_date(e))try{var a=Math.abs(t-e);switch(r){case"ms":n=a;break;case"seconds":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3),s);break;case"minutes":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60),s);break;case"hours":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60),s);break;case"days":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60)/parseFloat(24),s)}}catch(c){n=null}return n},usi_date.get_units=function(e){var t="";switch(e.toLowerCase()){case"days":case"day":case"d":t="days";break;case"hours":case"hour":case"hrs":case"hr":case"h":t="hours";break;case"minutes":case"minute":case"mins":case"min":case"m":t="minutes";break;case"seconds":case"second":case"secs":case"sec":case"s":t="seconds";break;case"ms":case"milliseconds":case"millisecond":case"millis":case"milli":t="ms"}return t});if("undefined"==typeof usi_cookies){if(usi_cookies={expire_time:{minute:60,hour:3600,two_hours:7200,four_hours:14400,day:86400,week:604800,two_weeks:1209600,month:2592e3,year:31536e3,never:31536e4},max_cookies_count:15,max_cookie_length:1e3,update_window_name:function(e,i,t){try{var r=-1;if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r=n.getTime()}var o=window.top||window,u=0;null!=i&&-1!=i.indexOf("=")&&(i=i.replace(RegExp("=","g"),"USIEQLS")),null!=i&&-1!=i.indexOf(";")&&(i=i.replace(RegExp(";","g"),"USIPRNS"));for(var l=o.name.split(";"),a="",c=0;c<l.length;c++){var f=l[c].split("=");3==f.length?(f[0]==e&&(f[1]=i,f[2]=r,u=1),null!=f[1]&&"null"!=f[1]&&(a+=f[0]+"="+f[1]+"="+f[2]+";")):""!=l[c]&&(a+=l[c]+";")}0==u&&(a+=e+"="+i+"="+r+";"),o.name=a}catch(s){}},flush_window_name:function(e){try{for(var i=window.top||window,t=i.name.split(";"),r="",n=0;n<t.length;n++){var o=t[n].split("=");3==o.length&&(0==o[0].indexOf(e)||(r+=t[n]+";"))}i.name=r}catch(u){}},get_from_window_name:function(e){try{for(var i,t,r=(window.top||window).name.split(";"),n=0;n<r.length;n++){var o=r[n].split("=");if(3==o.length){if(o[0]==e&&(t=o[1],-1!=t.indexOf("USIEQLS")&&(t=t.replace(/USIEQLS/g,"=")),-1!=t.indexOf("USIPRNS")&&(t=t.replace(/USIPRNS/g,";")),!("-1"!=o[2]&&0>usi_cookies.datediff(o[2]))))return i=[t,o[2]]}else if(2==o.length&&o[0]==e)return t=o[1],-1!=t.indexOf("USIEQLS")&&(t=t.replace(/USIEQLS/g,"=")),-1!=t.indexOf("USIPRNS")&&(t=t.replace(/USIPRNS/g,";")),i=[t,new Date().getTime()+6048e5]}}catch(u){}return null},datediff:function(e){return e-new Date().getTime()},count_cookies:function(e){return e=e||"usi_",usi_cookies.search_cookies(e).length},root_domain:function(){try{var e=document.domain.split("."),i=e[e.length-1];if("com"==i||"net"==i||"org"==i||"us"==i||"co"==i||"ca"==i)return e[e.length-2]+"."+e[e.length-1]}catch(t){}return 0==document.domain.indexOf("www.")?document.domain.replace("www.",""):document.domain},create_cookie:function(e,i,t){if(!1!==navigator.cookieEnabled&&void 0===window.usi_nocookies){var r="";if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r="; expires="+n.toGMTString()}var o="samesite=none;";0==location.href.indexOf("https://")&&(o+="secure;");var u=usi_cookies.root_domain();"undefined"!=typeof usi_parent_domain&&-1!=document.domain.indexOf(usi_parent_domain)&&(u=usi_parent_domain),document.cookie=e+"="+encodeURIComponent(i)+r+"; path=/;domain="+u+"; "+o}},create_nonencoded_cookie:function(e,i,t){if(!1!==navigator.cookieEnabled&&void 0===window.usi_nocookies){var r="";if(-1!=t){var n=new Date;n.setTime(n.getTime()+1e3*t),r="; expires="+n.toGMTString()}var o="samesite=none;";0==location.href.indexOf("https://")&&(o+="secure;");var u=usi_cookies.root_domain();document.cookie=e+"="+i+r+"; path=/;domain="+location.host+"; "+o,document.cookie=e+"="+i+r+"; path=/;domain="+u+"; "+o,document.cookie=e+"="+i+r+"; path=/;domain=; "+o}},read_cookie:function(e){if(!1===navigator.cookieEnabled)return null;var i=e+"=",t=[];try{t=document.cookie.split(";")}catch(r){}for(var n=0;n<t.length;n++){for(var o=t[n];" "==o.charAt(0);)o=o.substring(1,o.length);if(0==o.indexOf(i))return decodeURIComponent(o.substring(i.length,o.length))}return null},del:function(e){usi_cookies.set(e,null,-100);try{null!=localStorage&&localStorage.removeItem(e),null!=sessionStorage&&sessionStorage.removeItem(e)}catch(i){}},get_ls:function(e){try{var i=localStorage.getItem(e);if(null!=i){if(0==i.indexOf("{")&&-1!=i.indexOf("usi_expires")){var t=JSON.parse(i);if(new Date().getTime()>t.usi_expires)return localStorage.removeItem(e),null;i=t.value}return decodeURIComponent(i)}}catch(r){}return null},get:function(e){var i=usi_cookies.read_cookie(e);if(null!=i)return i;try{if(null!=localStorage&&(i=usi_cookies.get_ls(e),null!=i))return i;if(null!=sessionStorage&&(i=sessionStorage.getItem(e),void 0===i&&(i=null),null!=i))return decodeURIComponent(i)}catch(t){}var r=usi_cookies.get_from_window_name(e);if(null!=r&&r.length>1)try{i=decodeURIComponent(r[0])}catch(n){return r[0]}return i},get_json:function(e){var i=null,t=usi_cookies.get(e);if(null==t)return null;try{i=JSON.parse(t)}catch(r){t=t.replace(/\\"/g,'"');try{i=JSON.parse(JSON.parse(t))}catch(n){try{i=JSON.parse(t)}catch(o){}}}return i},search_cookies:function(e){e=e||"";var i=[];return document.cookie.split(";").forEach(function(t){var r=t.split("=")[0].trim();(""===e||0===r.indexOf(e))&&i.push(r)}),i},set:function(e,i,t,r){"undefined"!=typeof usi_nevercookie&&!0==usi_nevercookie&&(r=!1),void 0===t&&(t=-1);try{i=i.replace(/(\r\n|\n|\r)/gm,"")}catch(n){}"undefined"==typeof usi_windownameless&&usi_cookies.update_window_name(e+"",i+"",t);try{if(t>0&&null!=localStorage){var o=new Date,u={value:i,usi_expires:o.getTime()+1e3*t};localStorage.setItem(e,JSON.stringify(u))}else null!=sessionStorage&&sessionStorage.setItem(e,i)}catch(l){}if(r||null==i){if(null!=i){if(null==usi_cookies.read_cookie(e)&&!r&&usi_cookies.search_cookies("usi_").length+1>usi_cookies.max_cookies_count){usi_cookies.report_error('Set cookie "'+e+'" failed. Max cookies count is '+usi_cookies.max_cookies_count);return}if(i.length>usi_cookies.max_cookie_length){usi_cookies.report_error('Cookie "'+e+'" truncated ('+i.length+"). Max single-cookie length is "+usi_cookies.max_cookie_length);return}}usi_cookies.create_cookie(e,i,t)}},set_json:function(e,i,t,r){var n=JSON.stringify(i).replace(/^"/,"").replace(/"$/,"");usi_cookies.set(e,n,t,r)},flush:function(e){e=e||"usi_";var i,t,r,n=document.cookie.split(";");for(i=0;i<n.length;i++)0==(t=n[i]).trim().toLowerCase().indexOf(e)&&(r=t.trim().split("=")[0],usi_cookies.del(r));usi_cookies.flush_window_name(e);try{if(null!=localStorage)for(var o in localStorage)0==o.indexOf(e)&&localStorage.removeItem(o);if(null!=sessionStorage)for(var o in sessionStorage)0==o.indexOf(e)&&sessionStorage.removeItem(o)}catch(u){}},print:function(){for(var e=document.cookie.split(";"),i="",t=0;t<e.length;t++){var r=e[t];0==r.trim().toLowerCase().indexOf("usi_")&&(console.log(decodeURIComponent(r.trim())+" (cookie)"),i+=","+r.trim().toLowerCase().split("=")[0]+",")}try{if(null!=localStorage)for(var n in localStorage)0==n.indexOf("usi_")&&"string"==typeof localStorage[n]&&-1==i.indexOf(","+n+",")&&(console.log(n+"="+usi_cookies.get_ls(n)+" (localStorage)"),i+=","+n+",");if(null!=sessionStorage)for(var n in sessionStorage)0==n.indexOf("usi_")&&"string"==typeof sessionStorage[n]&&-1==i.indexOf(","+n+",")&&(console.log(n+"="+sessionStorage[n]+" (sessionStorage)"),i+=","+n+",")}catch(o){}for(var u=(window.top||window).name.split(";"),l=0;l<u.length;l++){var a=u[l].split("=");if(3==a.length&&0==a[0].indexOf("usi_")&&-1==i.indexOf(","+a[0]+",")){var c=a[1];-1!=c.indexOf("USIEQLS")&&(c=c.replace(/USIEQLS/g,"=")),-1!=c.indexOf("USIPRNS")&&(c=c.replace(/USIPRNS/g,";")),console.log(a[0]+"="+c+" (window.name)"),i+=","+r.trim().toLowerCase().split("=")[0]+","}}},value_exists:function(){var e,i;for(e=0;e<arguments.length;e++)if(i=usi_cookies.get(arguments[e]),""===i||null===i||"null"===i||"undefined"===i)return!1;return!0},report_error:function(e){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(e)},check_multi_domain:function(){try{"undefined"!=typeof usi_app&&usi_app.company_id?usi_cookies.get("usi_app.company_id")?usi_cookies.get("usi_app.company_id")!==usi_app.company_id&&(window.name=""):usi_cookies.set("usi_app.company_id",usi_app.company_id):setTimeout(function(){usi_cookies.check_multi_domain()},2e3)}catch(e){"undefined"!=typeof usi_commons&&usi_commons.report_error(e)}},monitor_page_views:function(){try{if(void 0===usi_cookies.last_url||usi_cookies.last_url!=location.href){usi_cookies.last_url=location.href;var e=window.self===window.top,i=-1!==location.href.indexOf("/checkouts/");e&&(usi_cookies.get("usi_entry_url_1")||usi_cookies.set("usi_entry_url_1",usi_cookies.last_url,21600),null==document.referrer||usi_cookies.get("usi_referrer_url")||-1!=document.referrer.indexOf(location.host)||usi_cookies.set("usi_referrer_url",document.referrer||"direct traffic",21600)),(e||i)&&(usi_cookies.get("usi_entry_url_1")&&usi_cookies.get("usi_entry_url_1")!=usi_cookies.last_url&&usi_cookies.set("usi_last_url_1",usi_cookies.last_url,21600),usi_cookies.set("usi_pv_count",String(Number(usi_cookies.get("usi_pv_count")||0)+1),21600))}setTimeout(usi_cookies.monitor_page_views,2e3)}catch(t){"undefined"!=typeof usi_commons&&usi_commons.report_error(t)}}},"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.gup&&"function"==typeof usi_commons.gup_or_get_cookie)try{usi_commons.force_date=usi_commons.gup_or_get_cookie("usi_force_date"),usi_commons.force_group=usi_commons.gup_or_get_cookie("usi_force_group"),usi_commons.is_enabled=""!=usi_commons.gup_or_get_cookie("usi_enable",usi_cookies.expire_time.hour,!0),usi_commons.is_forced=""!=usi_commons.gup_or_get_cookie("usi_force",usi_cookies.expire_time.hour,!0),""!=usi_commons.gup("usi_email_id")?usi_cookies.set("usi_email_id",usi_commons.gup("usi_email_id").split(".")[0],Number(usi_commons.gup("usi_email_id").split(".")[1]),!0):null==usi_cookies.read_cookie("usi_email_id")&&null!=usi_cookies.get_from_window_name("usi_email_id")&&usi_cookies.set("usi_email_id",usi_cookies.get_from_window_name("usi_email_id")[0],(usi_cookies.get_from_window_name("usi_email_id")[1]-new Date().getTime())/1e3,!0),""!=usi_commons.gup_or_get_cookie("usi_debug")&&(usi_commons.debug=!0),""!=usi_commons.gup_or_get_cookie("usi_qa")&&(usi_commons.domain=usi_commons.cdn="https://prod.upsellit.com"),usi_cookies.monitor_page_views()}catch(e){usi_commons.report_error(e)}-1!=location.href.indexOf("usi_clearcookies")&&usi_cookies.flush(),usi_cookies.check_multi_domain()}
if (typeof usi_analytics === 'undefined') {
	usi_analytics = {
		cookie_length : 30,
		load_script:function(source) {
			var docHead = document.getElementsByTagName("head")[0];
			//if (top.location != location) docHead = parent.document.getElementsByTagName("head")[0];
			var newScript = document.createElement('script');
			newScript.type = 'text/javascript';
			newScript.src = source;
			docHead.appendChild(newScript);
		},
		get_id:function() {
			var usi_id = null;
			try {
				if (usi_cookies.get('usi_analytics') == null && usi_cookies.get('usi_id') == null) {
					var usi_rand_str = Math.random().toString(36).substring(2);
					if (usi_rand_str.length > 6) usi_rand_str = usi_rand_str.substring(0, 6);
					usi_id = usi_rand_str + "_" + Math.round((new Date()).getTime() / 1000);
					usi_cookies.set('usi_id', usi_id, 30 * 86400, true);
					return usi_id;
				}
				if (usi_cookies.get('usi_analytics') != null) usi_id = usi_cookies.get('usi_analytics');
				if (usi_cookies.get('usi_id') != null) usi_id = usi_cookies.get('usi_id');
				usi_cookies.set('usi_id', usi_id, 30 * 86400, true);
			} catch(err) {
				usi_commons.report_error(err);
			}
			return usi_id;
		},
		send_page_hit:function(report_type, companyID, data1) {
			var qs = "";
			if (data1) qs += data1;
			usi_analytics.load_script(usi_commons.domain + "/analytics/hit.js?usi_a="+usi_analytics.get_id(companyID)+"&usi_t="+(Date.now())+"&usi_r="+report_type+"&usi_c="+companyID+qs+"&usi_u="+encodeURIComponent(location.href));
		}
	};
}"undefined"==typeof usi_dom&&((usi_dom={}).get_elements=function(e,t){var n=[];return t=t||document,n=Array.prototype.slice.call(t.querySelectorAll(e))},usi_dom.get_first_element=function(e,t){if(""===(e||""))return null;if(t=t||document,"[object Array]"!==Object.prototype.toString.call(e))return t.querySelector(e);for(var n=null,r=0;r<e.length;r++){var i=e[r];if(null!=(n=usi_dom.get_first_element(i,t)))break}return n},usi_dom.get_element_text_no_children=function(e,t){var n="";if(null==t&&(t=!1),null!=(e=e||document)&&null!=e.childNodes)for(var r=0;r<e.childNodes.length;++r)3===e.childNodes[r].nodeType&&(n+=e.childNodes[r].textContent);return!0===t&&(n=usi_dom.clean_string(n)),n.trim()},usi_dom.clean_string=function(e){return"string"!=typeof e?void 0:(e=(e=(e=(e=(e=(e=(e=e.replace(/[\u2010-\u2015\u2043]/g,"-")).replace(/[\u2018-\u201B]/g,"'")).replace(/[\u201C-\u201F]/g,'"')).replace(/\u2024/g,".")).replace(/\u2025/g,"..")).replace(/\u2026/g,"...")).replace(/\u2044/g,"/")).replace(/[^\x20-\xFF\u0100-\u017F\u0180-\u024F\u20A0-\u20CF]/g,"").trim()},usi_dom.string_to_decimal=function(e){var t=null;if("string"==typeof e)try{var n=parseFloat(e.replace(/[^0-9\.-]+/g,""));!1===isNaN(n)&&(t=n)}catch(r){usi_commons.log("Error: "+r.message)}return t},usi_dom.string_to_integer=function(e){var t=null;if("string"==typeof e)try{var n=parseInt(e.replace(/[^0-9-]+/g,""));!1===isNaN(n)&&(t=n)}catch(r){usi_commons.log("Error: "+r.message)}return t},usi_dom.get_absolute_url=function(){var e;return function(t){return(e=e||document.createElement("a")).href=t,e.href}}(),usi_dom.format_currency=function(e,t,n){var r="";return isNaN(e)&&(e=usi_dom.currency_to_decimal(e)),!1===isNaN(e)&&("object"==typeof Intl&&"function"==typeof Intl.NumberFormat?(t=t||"en-US",n=n||{style:"currency",currency:"USD"},r=Number(e).toLocaleString(t,n)):r=e),r},usi_dom.currency_to_decimal=function(e){return 0==e.indexOf("&")&&-1!=e.indexOf(";")?e=e.substring(e.indexOf(";")+1):-1!=e.indexOf("&")&&-1!=e.indexOf(";")&&(e=e.substring(0,e.indexOf("&"))),isNaN(e)&&(e=e.replace(/[^0-9,.]/g,"")),e.indexOf(",")==e.length-3&&(-1!=e.indexOf(".")&&(e=e.replace(".","")),e=e.replace(",",".")),e=e.replace(/[^0-9.]/g,"")},usi_dom.to_decimal_places=function(e,t){if(null==e||"number"!=typeof e||null==t||"number"!=typeof t)return null;if(0==t)return parseFloat(Math.round(e));for(var n=10,r=1;r<t;r++)n*=10;return parseFloat(Math.round(e*n)/n)},usi_dom.trim_string=function(e,t,n){return n=n||"",(e=e||"").length>t&&(e=e.substring(0,t),""!==n&&(e+=n)),e},usi_dom.attach_event=function(e,t,n){var r=usi_dom.find_supported_element(e,n);usi_dom.detach_event(e,t,r),r.addEventListener?r.addEventListener(e,t,!1):r.attachEvent("on"+e,t)},usi_dom.detach_event=function(e,t,n){var r=usi_dom.find_supported_element(e,n);r.removeEventListener?r.removeEventListener(e,t,!1):r.detachEvent("on"+e,t)},usi_dom.find_supported_element=function(e,t){return(t=t||document)===window?window:!0===usi_dom.is_event_supported(e,t)?t:t===document?window:usi_dom.find_supported_element(e,document)},usi_dom.is_event_supported=function(e,t){return null!=t&&void 0!==t["on"+e]},usi_dom.is_defined=function(e,t){if(null==e||""===(t||""))return!1;var n=!0,r=e;return t.split(".").forEach(function(e){!0===n&&(null==r||"object"!=typeof r||!1===r.hasOwnProperty(e)?n=!1:r=r[e])}),n},usi_dom.ready=function(e){void 0!==document.readyState&&"complete"===document.readyState?e():window.addEventListener?window.addEventListener("load",e,!0):window.attachEvent?window.attachEvent("onload",e):setTimeout(e,5e3)},usi_dom.fit_text=function(e,t){t||(t={});var n={multiLine:!0,minFontSize:.1,maxFontSize:20,widthOnly:!1},r={};for(var i in n)t.hasOwnProperty(i)?r[i]=t[i]:r[i]=n[i];var l=Object.prototype.toString.call(e);function o(e,t){a=e.innerHTML,d=parseInt(window.getComputedStyle(e,null).getPropertyValue("font-size"),10),c=(n=e,r=window.getComputedStyle(n,null),(n.clientWidth-parseInt(r.getPropertyValue("padding-left"),10)-parseInt(r.getPropertyValue("padding-right"),10))/d),u=(i=e,l=window.getComputedStyle(i,null),(i.clientHeight-parseInt(l.getPropertyValue("padding-top"),10)-parseInt(l.getPropertyValue("padding-bottom"),10))/d),c&&(t.widthOnly||u)||(t.widthOnly?usi_commons.log("Set a static width on the target element "+e.outerHTML):usi_commons.log("Set a static height and width on the target element "+e.outerHTML)),-1===a.indexOf("textFitted")?((o=document.createElement("span")).className="textFitted",o.style.display="inline-block",o.innerHTML=a,e.innerHTML="",e.appendChild(o)):o=e.querySelector("span.textFitted"),t.multiLine||(e.style["white-space"]="nowrap"),f=t.minFontSize,s=t.maxFontSize;for(var n,r,i,l,o,u,a,c,d,f,p,s,$=f,g=1e3;f<=s&&g>0;)g--,p=s+f-.1,o.style.fontSize=p+"em",o.scrollWidth/d<=c&&(t.widthOnly||o.scrollHeight/d<=u)?($=p,f=p+.1):s=p-.1;o.style.fontSize!==$+"em"&&(o.style.fontSize=$+"em")}"[object Array]"!==l&&"[object NodeList]"!==l&&"[object HTMLCollection]"!==l&&(e=[e]);for(var u=0;u<e.length;u++)o(e[u],r)});
"undefined"==typeof usi_date&&((usi_date={}).add_hours=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+36e5*t)},usi_date.add_minutes=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+6e4*t)},usi_date.add_seconds=function(e,t){return!1===usi_date.is_date(e)?e:new Date(e.getTime()+1e3*t)},usi_date.is_date=function(e){return null!=e&&"object"==typeof e&&e instanceof Date==!0&&!1===isNaN(e.getTime())},usi_date.is_after=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()>r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_before=function(e){try{usi_date.check_format(e);var t=usi_date.set_date(),r=new Date(e);return t.getTime()<r.getTime()}catch(s){"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error(s)}return!1},usi_date.is_between=function(e,t){return usi_date.check_format(e,t),usi_date.is_after(e)&&usi_date.is_before(t)},usi_date.check_format=function(e,t){(-1!=e.indexOf(" ")||t&&-1!=t.indexOf(" "))&&"undefined"!=typeof usi_commons&&"function"==typeof usi_commons.report_error&&usi_commons.report_error("Incorrect format: Use YYYY-MM-DDThh:mm:ss")},usi_date.string_to_date=function(e,t){t=t||!1;var r=null,s=/^[0-2]?[0-9]\/[0-3]?[0-9]\/\d{4}(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e),n=/^(\d{4}\-[0-2]?[0-9]\-[0-3]?[0-9])(\s[0-2]?[0-9]\:[0-5]?[0-9](?:\:[0-5]?[0-9])?)?$/.exec(e);if(2===(s||[]).length){if(r=new Date(e),""===(s[1]||"")&&!0===t){var a=new Date;r=usi_date.add_hours(r,a.getHours()),r=usi_date.add_minutes(r,a.getMinutes()),r=usi_date.add_seconds(r,a.getSeconds())}}else if(3===(n||[]).length){var c=n[1].split(/\-/g),i=c[1]+"/"+c[2]+"/"+c[0];return i+=n[2]||"",usi_date.string_to_date(i,t)}return r},usi_date.set_date=function(){var e=new Date,t=usi_commons.gup("usi_force_date");if(""!==t){t=decodeURIComponent(t);var r=usi_date.string_to_date(t,!0);null!=r?(e=r,usi_cookies.set("usi_force_date",t,usi_cookies.expire_time.hour),usi_commons.log("Date forced to: "+e)):usi_cookies.del("usi_force_date")}else e=null!=usi_cookies.get("usi_force_date")?usi_date.string_to_date(usi_cookies.get("usi_force_date"),!0):new Date;return e},usi_date.diff=function(e,t,r,s){null==s&&(s=1),""!=(r||"")&&(r=usi_date.get_units(r));var n=null;if(!0===usi_date.is_date(t)&&!0===usi_date.is_date(e))try{var a=Math.abs(t-e);switch(r){case"ms":n=a;break;case"seconds":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3),s);break;case"minutes":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60),s);break;case"hours":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60),s);break;case"days":n=usi_dom.to_decimal_places(parseFloat(a)/parseFloat(1e3)/parseFloat(60)/parseFloat(60)/parseFloat(24),s)}}catch(c){n=null}return n},usi_date.get_units=function(e){var t="";switch(e.toLowerCase()){case"days":case"day":case"d":t="days";break;case"hours":case"hour":case"hrs":case"hr":case"h":t="hours";break;case"minutes":case"minute":case"mins":case"min":case"m":t="minutes";break;case"seconds":case"second":case"secs":case"sec":case"s":t="seconds";break;case"ms":case"milliseconds":case"millisecond":case"millis":case"milli":t="ms"}return t});
"undefined"==typeof usi_ajax&&((usi_ajax={}).get=function(e,t){try{return usi_ajax.get_with_options({url:e},t)}catch(r){usi_commons.report_error(r)}},usi_ajax.get_with_options=function(e,t){null==t&&(t=function(){});var r={};if((e=e||{}).headers=e.headers||[],null==XMLHttpRequest)return t(Error("XMLHttpRequest not supported"),r);if(""===(e.url||""))return t(Error("url cannot be blank"),r);try{var a=new XMLHttpRequest;a.withCredentials=!0,a.open("GET",e.url,!0),a.setRequestHeader("Content-type","application/json"),e.headers.forEach(function(e){""!==(e.name||"")&&""!==(e.value||"")&&a.setRequestHeader(e.name,e.value)}),a.onreadystatechange=function(){if(4===a.readyState){r.status=a.status,r.responseText=a.responseText||"";var e=null;return 0!==String(a.status).indexOf("2")&&(e=Error("http.status: "+a.status)),t(e,r)}},a.send()}catch(n){return usi_commons.report_error(n),t(n,r)}},usi_ajax.post=function(e,t,r){try{return usi_ajax.post_with_options({url:e,params:t},r)}catch(a){usi_commons.report_error(a)}},usi_ajax.post_with_options=function(e,t){null==t&&(t=function(){});var r={};if((e=e||{}).headers=e.headers||[],e.paramsDataType=e.paramsDataType||"string",e.params=e.params||"",null==XMLHttpRequest)return t(Error("XMLHttpRequest not supported"),r);if(""===(e.url||""))return t(Error("url cannot be blank"),r);try{var a=new XMLHttpRequest;a.open("POST",e.url,!0),"formData"===e.paramsDataType||("object"===e.paramsDataType?(a.setRequestHeader("Content-type","application/json; charset=utf-8"),e.params=JSON.stringify(e.params)):a.setRequestHeader("Content-type","application/x-www-form-urlencoded")),e.headers.forEach(function(e){""!==(e.name||"")&&""!==(e.value||"")&&a.setRequestHeader(e.name,e.value)}),a.onreadystatechange=function(){if(4===a.readyState){r.status=a.status,r.responseText=a.responseText||"",r.responseURL=a.responseURL||"";var e=null;return 0!==String(a.status).indexOf("2")&&(e=Error("http.status: "+a.status)),t(e,r)}},a.send(e.params)}catch(n){return usi_commons.report_error(n),t(n,r)}},usi_ajax.form_post=function(e,t,r){try{r=r||"post";var a=document.createElement("form");a.setAttribute("method",r),a.setAttribute("action",e),null!=t&&"object"==typeof t&&Object.keys(t).forEach(function(e){var r=document.createElement("input");r.setAttribute("type","hidden"),r.setAttribute("name",e),r.setAttribute("value",t[e]),a.appendChild(r)}),document.body.appendChild(a),a.submit()}catch(n){usi_commons.report_error(n)}},usi_ajax.put_with_options=function(e,t){null==t&&(t=function(){});var r={};if((e=e||{}).headers=e.headers||[],null==XMLHttpRequest)return t(Error("XMLHttpRequest not supported"),r);if(""===(e.url||""))return t(Error("url cannot be blank"),r);try{var a=new XMLHttpRequest;a.open("PUT",e.url,!0),a.setRequestHeader("Content-type","application/json"),e.headers.forEach(function(e){""!==(e.name||"")&&""!==(e.value||"")&&a.setRequestHeader(e.name,e.value)}),a.onreadystatechange=function(){if(4===a.readyState){r.status=a.status,r.responseText=a.responseText||"";var e=null;return 0!==String(a.status).indexOf("2")&&(e=Error("http.status: "+a.status)),t(e,r)}},a.send()}catch(n){return usi_commons.report_error(n),t(n,r)}},usi_ajax.listener=function e(t){if(null==t&&(t=!1),null!=XMLHttpRequest){var e=this;e.ajax={},e.clear=function(){e.ajax.requests=[],e.ajax.registeredRequests=[],e.ajax.scriptLoads=[],e.ajax.registeredScriptLoads=[]},e.clear(),e.register=function(t,r,a){try{t=(t||"*").toUpperCase(),r=r||"*",a=a||function(){};var n={method:t,url:r,callback:a};e.ajax.registeredRequests.push(n)}catch(s){usi_commons.report_error(s)}},e.registerScriptLoad=function(t,r){try{t=t||"*",r=r||function(){};var a={url:t,callback:r};e.ajax.registeredScriptLoads.push(a)}catch(n){usi_commons.report_error(n)}},e.registerFormSubmit=function(e,r){try{null!=e&&usi_dom.attach_event("submit",function(a){if(!0===t&&usi_commons.log("USI AJAX: form submit"),null!=a&&!0===a.returnValue){a.preventDefault();var n={action:e.action,data:{},e:a},s=["submit"];if(Array.prototype.slice.call(e.elements).forEach(function(e){try{-1===s.indexOf(e.type)&&("checkbox"===e.type?!0===e.checked&&(n.data[e.name]=e.value):n.data[e.name]=e.value)}catch(t){usi_commons.report_error(t)}}),null!=r)return r(null,n);a.returnValue=!0}},e)}catch(a){usi_commons.report_error(a)}},e.listen=function(){try{e.ajax.originalOpen=XMLHttpRequest.prototype.open,e.ajax.originalSend=XMLHttpRequest.prototype.send,XMLHttpRequest.prototype.open=function(r,a){var n=this;r=(r||"").toUpperCase(),a=a||"",a=usi_dom.get_absolute_url(a),!0===t&&usi_commons.log("USI AJAX: open["+r+"]: "+a);var s={method:r,url:a,openDate:new Date};e.ajax.requests.push(s);var u=null;e.ajax.registeredRequests.forEach(function(e){(e.method==r||"*"==e.method)&&(a.indexOf(e.url)>-1||"*"==e.url)&&(u=e)}),null!=u&&(!0===t&&usi_commons.log("USI AJAX: Registered URL["+r+"]: "+a),n.requestObj=s,n.requestObj.callback=u.callback),e.ajax.originalOpen.apply(n,arguments)},XMLHttpRequest.prototype.send=function(r){var a=this;null!=a.requestObj&&(!0===t&&usi_commons.log("USI AJAX: Send Registered URL["+a.requestObj.method+"]: "+a.requestObj.url),""!=(r||"")&&(a.requestObj.params=r),a.addEventListener?a.addEventListener("readystatechange",function(){e.ajax.readyStateChanged(a)},!1):e.ajax.proxifyOnReadyStateChange(a)),e.ajax.originalSend.apply(a,arguments)},e.ajax.readyStateChanged=function(e){if(4===e.readyState&&null!=e.requestObj&&(e.requestObj.completedDate=new Date,!0===t&&usi_commons.log("Completed: "+e.requestObj.url),null!=e.requestObj.callback)){var r={requestObj:e.requestObj,responseText:e.responseText};return e.requestObj.callback(null,r)}},e.ajax.proxifyOnReadyStateChange=function(t){var r=t.onreadystatechange;null!=r&&(t.onreadystatechange=function(){e.ajax.readyStateChanged(t),r()})},document.head.addEventListener("load",function(t){if(null!=t&&null!=t.target&&""!=(t.target.src||"")){var r=t.target.src,a={url:r=usi_dom.get_absolute_url(r),completedDate:new Date};e.ajax.scriptLoads.push(a);var n=null;if(e.ajax.registeredScriptLoads.forEach(function(e){(r.indexOf(e.url)>-1||"*"==e.url)&&(n=e)}),null!=n&&null!=n.callback)return n.callback(null,a)}},!0),usi_commons.log("USI AJAX: listening ...")}catch(r){usi_commons.report_error(r),usi_commons.log("usi_ajax.listener ERROR: "+r.message)}},e.unregisterAll=function(){e.ajax.registeredRequests=[],e.ajax.registeredScriptLoads=[]}}});
"undefined"==typeof usi_split_test&&(usi_split_test={split_test_name:"usi_dice_roll",split_group:"-1",split_siteID:"-1",split_test_cookie_length:2,get_split_var:function(t){if(t=t||"",null==usi_cookies.get("usi_visitor_id"+t)){var i=Math.random().toString(36).substring(2);i.length>6&&(i=i.substring(0,6));var s="v_"+i+"_"+Math.round(new Date().getTime()/1e3)+"_"+t;return usi_cookies.set("usi_visitor_id"+t,s,86400*this.split_test_cookie_length,!0),s}return usi_cookies.get("usi_visitor_id"+t)},report_test:function(t,i){usi_commons.load_script(usi_commons.domain+"/utility/split_test.jsp?siteID="+t+"&group="+i+"&usi_visitor_id="+this.get_split_var(t)),void 0!==usi_split_test.set_verification&&setTimeout("usi_split_test.set_verification("+i+");",1e3)},get_group:function(t){return usi_cookies.get(this.split_test_name+t)},instantiate_callback:function(t,i){usi_cookies.get("usi_force_group")?i(usi_cookies.get("usi_force_group")):null==usi_cookies.get(this.split_test_name+t)?(usi_app["control_group_callback"+t]=i,usi_commons.load_script(usi_commons.domain+"/utility/split_test.jsp?siteID="+t+"&usi_visitor_id="+this.get_split_var(t))):i(usi_cookies.get(this.split_test_name+t))},instantiate:function(t,i){null==usi_cookies.get(this.split_test_name+t)?(0===i||i&&""!=i?this.split_group=i:Math.random()>.5?this.split_group="0":this.split_group="1",this.report_test(t,this.split_group),usi_cookies.set(this.split_test_name+t,this.split_group,86400*this.split_test_cookie_length,!0)):this.split_group=usi_cookies.get(this.split_test_name+t)}});
"undefined"==typeof usi_company&&(window.usi_company={rulesets:{testing:function(e){return void 0===e.testing||(e.testing?usi_cookies.get("usi_enable"):e.testing?void 0:!usi_cookies.get("usi_enable"))},device:function(e){return!e.device||usi_commons.device===e.device},required_cookies:function(e){return!e.required_cookies||usi_cookies.value_exists.apply(null,e.required_cookies)},suppress_cookies:function(e){if(!e.suppress_cookies)return!0;for(var t=0;t<e.suppress_cookies.length;t++)if(usi_cookies.value_exists(e.suppress_cookies[t]))return!1;return!0},required_elements:function(e){if(!e.required_elements)return!0;try{for(var t=0;t<e.required_elements.length;t++)if(!document.querySelector(e.required_elements[t]))return!1;return!0}catch(r){return!1}},min_subtotal:function(e){return void 0===e.min_subtotal||usi_company.get_subtotal()>e.min_subtotal},max_subtotal:function(e){return void 0===e.max_subtotal||usi_company.get_subtotal()<e.max_subtotal},subtotal_gt:function(e){return void 0===e.subtotal_gt||usi_company.get_subtotal()>e.subtotal_gt},subtotal_lt:function(e){return void 0===e.subtotal_lt||usi_company.get_subtotal()<e.subtotal_lt},subtotal_gte:function(e){return void 0===e.subtotal_gte||usi_company.get_subtotal()>=e.subtotal_gte},subtotal_lte:function(e){return void 0===e.subtotal_lte||usi_company.get_subtotal()<=e.subtotal_lte},date_ranges:function(e){return e.date_ranges&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.date_ranges||e.date_ranges.some(function(e){return usi_date.is_date(new Date(e[1]))&&!usi_date.is_date(new Date(e[0]))?usi_date.is_before(e[1]):usi_date.is_date(new Date(e[0]))&&!usi_date.is_date(new Date(e[1]))?usi_date.is_after(e[0]):usi_date.is_between(e[0],e[1])})},is_after:function(e){return e.is_after&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.is_after||usi_date.is_after(e.is_after)},is_before:function(e){return e.is_before&&"undefined"==typeof usi_date?usi_commons.log("usi_date is required"):!e.is_before||usi_date.is_before(e.is_before)},is_entry:function(e){if(void 0===e.is_entry)return!0;var t=usi_cookies.get("usi_referrer_url"),r=document.referrer==t||""==document.referrer&&"direct traffic"==t,s=location.href==usi_cookies.get("usi_entry_url_1")&&r;return e.is_entry?s:e.is_entry?void 0:!s},page_visits:function(e){if(void 0===e.page_visits)return!0;var t=Number(usi_cookies.get("usi_pv_count"));return("number"!=typeof e.page_visits.equals||t===e.page_visits.equals)&&("number"!=typeof e.page_visits.min||!(t<=e.page_visits.min))&&("number"!=typeof e.page_visits.max||!(t>=e.page_visits.max))},countries:function(e){return e.countries&&!usi_app.country?usi_commons.log("usi_app.country is required"):!e.countries||-1!==e.countries.indexOf(usi_app.country)},states:function(e){return e.states&&!usi_app.state?usi_commons.log("usi_app.state is required"):!e.states||-1!==e.states.indexOf(usi_app.state)},suppress_countries:function(e){return e.suppress_countries&&!usi_app.country?usi_commons.log("usi_app.country is required"):!e.suppress_countries||-1===e.suppress_countries.indexOf(usi_app.country)},suppress_states:function(e){return e.suppress_states&&!usi_app.state?usi_commons.log("usi_app.state is required"):!e.suppress_states||-1===e.suppress_states.indexOf(usi_app.state)},traffic_percent:function(e){return void 0===e.traffic_percent||(e.siteID&&!usi_cookies.get("usi_traffic"+e.siteID)&&usi_cookies.set("usi_traffic"+e.siteID,Math.random()>e.traffic_percent?"true":"false"),e.siteID&&"true"===usi_cookies.get("usi_traffic"+e.siteID))},traffic_source:function(e){return void 0===e.traffic_source||(usi_cookies.get("usi_traffic_source")||usi_commons.log_error("usi_traffic_source required"),""===usi_cookies.get("usi_traffic_source")&&-1!==e.traffic_source.indexOf("direct")||e.traffic_source.some(function(e){return -1!==usi_cookies.get("usi_traffic_source").indexOf(e)}))},pages:function(e){return void 0===e.pages||e.pages.some(function(e){return"/"===e?location.pathname==e:-1!==location.href.indexOf(e)})},suppressed_pages:function(e){return void 0===e.suppressed_pages||!e.suppressed_pages.some(function(e){return"/"===e?location.pathname==e:-1!==location.href.indexOf(e)})},logged_in:function(e){return void 0===e.logged_in||(e.logged_in?"loggedin"===usi_cookies.get("usi_visitor"):e.logged_in?void 0:"loggedin"!==usi_cookies.get("usi_visitor"))},logged_out:function(e){return void 0===e.logged_out||(e.logged_out?"loggedin"!==usi_cookies.get("usi_visitor"):e.logged_out?void 0:"loggedin"===usi_cookies.get("usi_visitor"))},return_visitor:function(e){if(void 0===e.return_visitor)return!0;if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=usi_commons.gup_or_get_cookie("usi_force_return");if("1"===t||"0"===t)return"1"===t===e.return_visitor;var r=usi_company.is_return("number"==typeof e.return_visitor?e.return_visitor:24);return e.return_visitor?r:!r},new_visitor:function(e){if(void 0===e.new_visitor)return!0;if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=usi_commons.gup_or_get_cookie("usi_force_return");if("1"===t||"0"===t)return"0"===t===e.new_visitor;var r=usi_company.is_return("number"==typeof e.new_visitor?e.new_visitor:24);return e.new_visitor?!r:r},last_purchase:function(e){if(void 0===e.last_purchase)return!0;var t=Number(usi_cookies.get("usi_customer_purchased"));return e.last_purchase.equals?e.last_purchase.equals==t:e.last_purchase.min?e.last_purchase.min>=t:!!e.last_purchase.max&&e.last_purchase.max<=t},return_customer:function(e){return void 0===e.return_customer||(e.return_customer?usi_cookies.get("usi_customer_purchased"):e.return_customer?void 0:!usi_cookies.get("usi_customer_purchased"))},new_customer:function(e){return void 0===e.new_customer||(e.new_customer?!usi_cookies.get("usi_customer_purchased"):e.new_customer?void 0:usi_cookies.get("usi_customer_purchased"))}},get_subtotal:function(){return usi_cookies.get("usi_subtotal")?Number(usi_cookies.get("usi_subtotal").replace(/[^0-9.]/g,"")):0},is_return:function(e){if("undefined"==typeof usi_date)return usi_commons.log("usi_date is required");var t=!1,r="usi_return_visitor",s=usi_date.set_date();!1===usi_cookies.value_exists(r)&&usi_cookies.set(r,s,usi_cookies.expire_time.never,!0);var i=new Date(usi_cookies.get(r));return usi_date.is_date(i)&&(t=usi_date.diff(i,s,"hours",2)>=e),t},test_load:function(e,t){return!1},before_load:function(e){usi_commons.log("Loading: "+(e._name?e._name+", ":e.name?e.name+", ":"")+(e.siteID?e.siteID+", ":"")+(e.key?e.key:"")),"string"==typeof e.before_load&&"function"==typeof usi_app[e.before_load]&&usi_app[e.before_load](e)},on_load:function(e,t){"object"==typeof e&&e.on_load&&("object"==typeof t&&"function"==typeof t[e.on_load]?t[e.on_load]():"object"==typeof usi_app&&"function"==typeof usi_app[e.on_load]&&usi_app[e.on_load]())},post_load_campaigns:function(e){if("1"==usi_commons.gup_or_get_cookie("usi_testing")&&e.campaigns){var t=Object.keys(usi_company.rulesets);t=t.concat(Object.keys(usi_company.custom_rulesets)),t=Array.from(new Set(t)).sort();var r={};for(var s in e.campaigns)r[s.charAt(0)]=e.campaigns[s].map(function(e){return e._missing?e._missing.map(e=>t.indexOf(e)):-1});var i=JSON.stringify(r),n=JSON.stringify(t),o=JSON.stringify(e);i!=sessionStorage.usi_campaign_results&&sessionStorage.setItem("usi_campaign_results",i),n!=sessionStorage.usi_campaign_keys&&(sessionStorage.usi_campaign_json||sessionStorage.setItem("usi_campaign_json",o),sessionStorage.setItem("usi_campaign_keys",n))}},load_campaigns:function(e,t){try{if(!e||!e.campaigns)return;function r(e,t){var r=0;!function s(){if(!(r>=e.length)){var i=e[r++];t(i,function(e){e||s()})}}()}function s(e,t,r){if(!e)return"";var s=e.match(/^{{\s*usi_app\.([\w.]+)\s*}}$/);if(s){var i=s[1].split(".");let n=usi_app;for(let o of i){if(null==n||"object"!=typeof n)return e;n=n[o]}return"function"==typeof n?n(r||t):n}return e.replace(/{{\s*usi_commons\.device\s*}}/,usi_commons.device).replace(/{{\s*usi_app\.([\w.]+)\s*}}/g,function(e,t){if(!t)return e;for(var s=t.split("."),i=usi_app,n=0;n<s.length;n++){if(null==i||"object"!=typeof i)return e;i=i[s[n]]}return null==i?e:"function"==typeof i?i(r):i})}function i(e,t){var r=Object.assign({},e);for(var i in r)r.hasOwnProperty(i)&&"string"==typeof r[i]&&r[i].match(/{{\s*usi_app\.([\w.]+)\s*}}/)&&(r[i]=s(r[i],r,t));return r}function n(e,t){try{var r,n,o,u=[],a={};if(e.segments&&Array.isArray(e.segments))for(var c=0;c<e.segments.length;c++){var f=e.segments[c],p=[];for(var l in f)if(f.hasOwnProperty(l)){var d=usi_company.custom_rulesets[l]||usi_company.rulesets[l];for(var g in"function"!=typeof d||d(Object.assign({},e,f))||p.push(l),usi_company.custom_rulesets)if(usi_company.custom_rulesets.hasOwnProperty(g)){var m=usi_company.custom_rulesets[g];m({...e,...f})||p.push(g)}}if(0===p.length){a=f;break}}var v=Object.assign({},e,a);for(var y in"view"===v._type&&"undefined"==typeof usi_force&&-1==location.href.indexOf("usi_force")&&(v.suppress_cookies=v.suppress_cookies||[],-1===v.suppress_cookies.indexOf("usi_sale")&&v.suppress_cookies.push("usi_sale","usi_launched","usi_launched"+v.siteID),e.suppress_cookies=v.suppress_cookies),usi_company.rulesets)!usi_company.custom_rulesets[y]&&usi_company.rulesets.hasOwnProperty(y)&&((0,usi_company.rulesets[y])(v)||u.push(y));for(var h in usi_company.custom_rulesets)if(usi_company.custom_rulesets.hasOwnProperty(h)){var m=usi_company.custom_rulesets[h];m(v)||u.push(h)}if(e._missing=u,u.length>0)return t(!1);var b=[];if(v.list){if(!usi_app.company_id)return usi_commons.log_error("usi_app.company_id is required");if(!v.list.ids)return usi_commons.log_error("campaign.list.ids is required");if(!v.list.label)return usi_commons.log_error("campaign.list.label is required");b.push(function(t){var r=i(v.list,v);if(v.product=Array.isArray(r.ids)?r.ids.join(","):s(r.ids,v),v.save_token="usi_ls_"+v.list.label+"_"+v.product,sessionStorage[v.save_token])return t("true"===sessionStorage[v.save_token]);usi_company.lookup_callback=function(s){try{e.list._found=s,r.type=r.type||"suppress";var i=0===s&&"suppress"===r.type||1===s&&"enable"===r.type;sessionStorage.setItem(v.save_token,i.toString()),i||u.push("list"),t(i)}catch(n){usi_commons.report_error(n)}};var n=usi_commons.domain+"/utility/lookup_suppressions.jsp?companyID="+usi_app.company_id+"&product="+v.product+"&label="+r.label+"&match="+(r.match||"any")+"&callback=usi_company.lookup_callback";usi_commons.load_script(n)})}if(v.lift){if("undefined"==typeof usi_split_test)return usi_commons.log_error("usi_split_test is required");if(!v.lift.id)return usi_commons.log_error("campaign.lift.id is required");b.push(function(t){usi_split_test.instantiate_callback(v.lift.id,function(r){if(0==r)return u.push("lift"),t(!1);e.lift._group=r,t(!0)})})}"object"==typeof v.split&&b.push(function(t){var r,s=Object.keys(v.split),i=usi_commons.gup("usi_force_group");if(i)r=i;else if(v._group)r=v._group;else if(v.lift&&"boolean"==typeof v.lift.split&&v.lift.split&&v.lift._group)r=v.lift._group;else{for(var n=0,o={},u=0;u<s.length;u++){var a=s[u],c=v.split[a].percent;o[a]="number"==typeof c&&c>0?c:1,n+=o[a]}for(var f=Math.random()*n,p=0,l=0;l<s.length;l++){var d=s[l];if(p+=o[d],f<p){r=d;break}}r||(r=s[0])}var g=v.split[r];for(var m in g)g.hasOwnProperty(m)&&(v[m]=g[m]);e._group=r,t(!0)}),b.push(function(e){if(v.recommendations){var t=i(v.recommendations,v);if(!t.pid)return usi_commons.log_error("recommendations.pid is required");if(!t.siteID)return usi_commons.log_error("recommendations.siteID is required");t.callback=function(){v.recommendations.filter_callback&&"function"==typeof usi_app[v.recommendations.filter_callback]&&usi_app[v.recommendations.filter_callback](v);var t=v.recommendations.name?v.recommendations.name.replace("usi_app.",""):"product_rec",r=usi_app[t]&&usi_app[t].data&&usi_app[t].data.length?usi_app[t].data.length:0,s=void 0!==v.recommendations.min_rows?v.recommendations.min_rows:v.recommendations.rows?v.recommendations.rows:3,i=usi_commons.gup("usi_test")||r>=s;i||u.push("recommendations"),e(i)},usi_commons.load_products(t)}else e(!0)}),r=b,n=function(e){v.siteID||u.push("siteID"),"anon"==v._type||v.hash||u.push("hash"),t(e,v)},o=0,function e(t){return t?o>=r.length?n(!0):void r[o++](e):n(!1)}(!0)}catch($){usi_commons.report_error($),t(!1)}}usi_company.custom_rulesets=t||[],e.campaigns.usi_load&&r(e.campaigns.usi_load,function(e,t){e._type="usi_load",n(e,function(r,n){e._active=r,r&&n&&n.siteID&&n.hash?(usi_company.before_load(n),usi_commons.load(n.hash,n.siteID,n.key?s(n.key,n):"",function(){var e=window["usi_"+n.siteID];void 0!==e&&(e.company_json=i(n),n.on_load&&usi_company.on_load(n,e)),t(usi_company.test_load(r,n))})):t(r)})}),e.campaigns.view&&r(e.campaigns.view,function(e,t){e._type="view",n(e,function(r,n){e._active=r,r&&n&&n.siteID&&n.hash&&(usi_company.before_load(n),usi_commons.load_view(n.hash,n.siteID,n.key?s(n.key,n):"",function(){"undefined"!=typeof usi_js&&(usi_js.company_json=i(n),n.on_load&&usi_company.on_load(n,usi_js))})),t(r)})}),e.campaigns.anon&&r(e.campaigns.anon,function(e,t){e._type="anon",n(e,function(r,s){if(e._active=r,r&&s&&s.siteID){if(usi_app.anon_data=i(s),usi_company.before_load(s),"undefined"==typeof usi_user_id)return usi_commons.log_error("usi_user_id is required");s.found_user_callback&&"function"==typeof usi_app[s.found_user_callback]&&(usi_user_id.found_user_callback=usi_app[s.found_user_callback]),usi_user_id.activate(s.siteID),s.on_load&&usi_company.on_load(s,usi_user_id)}t(r)})}),e.campaigns.precapture&&r(e.campaigns.precapture,function(e,t){e._type="precapture",n(e,function(r,s){e._active=r,r&&s&&s.siteID&&s.hash&&(usi_app.precapture_data=i(s),usi_company.before_load(s),usi_commons.load_precapture(s.hash,s.siteID,function(){s.on_load&&usi_company.on_load(s,usi_js_monitor)})),t(r)})}),usi_company.post_load_campaigns()}catch(o){usi_commons.report_error(o)}}});
if (typeof usi_company_json === 'undefined') {try {usi_company_json = {
  "upsell_list": {
    "ACDIST": {
      "23998": 24000,
      "24012": 24022,
      "24013": 24023,
      "24014": 24024,
      "24015": 24025,
      "24016": 24026,
      "24034": 24036,
      "24040": 24042,
      "5175204500": 5175204700,
      "5175178900": 5175179100,
      "5175203600": 5175203800,
      "5265851400": 5265851600
    },
    "ACDLT": {
      "24117": 24133,
      "24123": 24139,
      "24124": 24140,
      "24125": 24141,
      "24126": 24142,
      "24127": 24143,
      "24129": 24145,
      "24131": 24147,
      "334624900": 334625100,
      "334805700": 334805900,
      "5064672900": 5064673100
    },
    "ACDLTM": {
      "21818": 21815,
      "21826": 21816,
      "21827": 21811,
      "21828": 21817,
      "21829": 21814,
      "21830": 21813,
      "21831": 21812,
      "22131": 22133,
      "5343030900": 5343031000
    },
    "MAYA": {
      "24523": 24525,
      "24541": 24555,
      "24542": 24551,
      "24543": 24561,
      "24544": 24554,
      "24545": 24553,
      "24559": 24552,
      "24565": 24567,
      "332331300": 332331700,
      "5282211400": 5276772200,
      "5026767800": 5026768000,
      "5064675600": 5064675800,
      "5342460100": 5342460200
    },
    "MAYALT": {
      "24571": 24573,
      "24579": 24590,
      "24580": 24591,
      "24581": 24592,
      "24582": 24593,
      "24583": 24597,
      "24595": 24589,
      "24601": 24602,
      "325558800": 4426974500,
      "5343130400": 5343130500,
      "5023725400": 5023725600,
      "5109132800": 5109133000
    },
    "RVT": {
      "24896": 24898,
      "24914": 24924,
      "24915": 24925,
      "24916": 24926,
      "24917": 24927,
      "24918": 24928,
      "24932": 24934,
      "24938": 24940,
      "334478800": 334479000,
      "5282506000": 5282505900,
      "5342419400": 5342419500,
      "5106958300": 5106958500,
      "5250171200": 5250171400
    },
    "RVTLT": {
      "24944": 24946,
      "24962": 24972,
      "24963": 24973,
      "24964": 24974,
      "24965": 24975,
      "24966": 24976,
      "24980": 24982,
      "24984": 24986,
      "334576200": 334576400,
      "5343022500": 5343022600,
      "5146831400": 5146831600,
      "5145960000": 5145960200
    },
    "3DSMAX": {
      "23738": 23770,
      "23740": 23772,
      "23746": 23778,
      "23747": 23779,
      "23748": 23780,
      "23749": 23781,
      "23750": 23782,
      "23752": 23784,
      "334495200": 334495400,
      "335051800": 335052000,
      "5342420600": 5342420700,
      "5064674700": 5064674900
    },
    "AECCOL": {
      "23951": 23953,
      "23969": 23979,
      "23970": 23980,
      "23971": 23981,
      "23972": 23982,
      "23973": 23983,
      "23987": 23989,
      "23993": 23995,
      "5342419700": 5342419800,
      "5282507500": 5282507400,
      "5056161400": 5056161600,
      "5064643100": 5064643300,
      "5056951700": 5056951900
    },
    "PDCOLL": {
      "24825": 24827,
      "24843": 24854,
      "24844": 24855,
      "24845": 24856,
      "24846": 24857,
      "24847": 24863,
      "24861": 24853,
      "24867": 24869,
      "5282507800": 5282507700,
      "5056953400": 5056953600,
      "5342521500": 5342521600,
      "5056163100": 5056163300,
      "5064644000": 5064644200
    },
    "MECOLL": {
      "5342420000": 5342420100,
      "5282508200": 5282508100,
      "5056164800": 5056165000,
      "5064644900": 5064645100,
      "5056159500": 5056159700
    },
    "CIV3D": {
      "24231": 24233,
      "24249": 24259,
      "24250": 24260,
      "24251": 24261,
      "24252": 24262,
      "24253": 24263,
      "24267": 24269,
      "24273": 24275,
      "334627700": 334627900,
      "334803200": 334803400,
      "5342421200": 5342421300,
      "5282505700": 5282505600,
      "5064676500": 5064676700
    }
  },
  "upsell_pids_list": {
    "18179": 21889,
    "18181": 21892,
    "18183": 21895,
    "18185": 21898,
    "18187": 21904,
    "18191": 21907,
    "23498": 23514,
    "23499": 23515,
    "23500": 23516,
    "23501": 23517,
    "23502": 23518,
    "23503": 23519,
    "23504": 23520,
    "23505": 23521,
    "23807": 23809,
    "23821": 23831,
    "23822": 23804,
    "23823": 23832,
    "23824": 23833,
    "23825": 23834,
    "23842": 23844,
    "23848": 23850,
    "24072": 24082,
    "24073": 24083,
    "24074": 24084,
    "24075": 24085,
    "24076": 24086,
    "24094": 24096,
    "24447": 24457,
    "24448": 24458,
    "24449": 24459,
    "24450": 24460,
    "24451": 24461,
    "24463": 24465,
    "24781": 24783,
    "24799": 24809,
    "24800": 24810,
    "24801": 24811,
    "24802": 24812,
    "24803": 24813,
    "24815": 24817,
    "24819": 24821,
    "25220": 25221,
    "25227": 25234,
    "25228": 25235,
    "25229": 25236,
    "25230": 25232,
    "25231": 25233,
    "25238": 25239,
    "25241": 25242,
    "25480": 25481,
    "25486": 26018,
    "25501": 25502,
    "25512": 25513,
    "25553": 25554,
    "25750": 25756,
    "25752": 25758,
    "25753": 25759,
    "25882": 25888,
    "25884": 25890,
    "25885": 25891,
    "25936": 25942,
    "25938": 25944,
    "25939": 25945,
    "25972": 25978,
    "25974": 25980,
    "25975": 25981,
    "26173": 26179,
    "26175": 26181,
    "26176": 26182,
    "26387": 26388,
    "26409": 26410,
    "26418": 26419,
    "26424": 26425,
    "26481": 26184,
    "26594": 26595,
    "26616": 26617,
    "26625": 26626,
    "26631": 26632,
    "26660": 26183,
    "26899": 26900,
    "26906": 26913,
    "26907": 26914,
    "26908": 26915,
    "26909": 26911,
    "26910": 26912,
    "26917": 26918,
    "26920": 26921,
    "26923": 26924,
    "26930": 26935,
    "26932": 26937,
    "26933": 26938,
    "26934": 26939,
    "26941": 26942,
    "27018": 27019,
    "27021": 27022,
    "27024": 27025,
    "27027": 27028,
    "27030": 27031,
    "27034": 27035,
    "27037": 27038,
    "27042": 27043,
    "27045": 27046,
    "27048": 27049,
    "27050": 27051,
    "27053": 27054,
    "27055": 27056,
    "27066": 27067,
    "27068": 27069,
    "27070": 27071,
    "27072": 27073,
    "27075": 27076,
    "27078": 27079,
    "27082": 27083,
    "27085": 27086,
    "27088": 27089,
    "27090": 27091,
    "27093": 27094,
    "27096": 27097,
    "27099": 27100,
    "27102": 27103,
    "27104": 27105,
    "27107": 27108,
    "27110": 27111,
    "27112": 27113,
    "27115": 27116,
    "27118": 27119,
    "27121": 27122,
    "27127": 27129,
    "27132": 27134,
    "27138": 27140,
    "27145": 27147,
    "27150": 27152,
    "27157": 27159,
    "27162": 27164,
    "27171": 27172,
    "27174": 27175,
    "27177": 27178,
    "27179": 27180,
    "27184": 27186,
    "27190": 27192,
    "27210": 27211,
    "27212": 27213,
    "27214": 27216,
    "27218": 27220,
    "27223": 27224,
    "27228": 27230,
    "27235": 27237,
    "27239": 27240,
    "27245": 27247,
    "27248": 27250,
    "27255": 27257,
    "27261": 27263,
    "27270": 27272,
    "27274": 27275,
    "27277": 27278,
    "27281": 27284,
    "27288": 27290,
    "27291": 27293,
    "27298": 27300,
    "27304": 27306,
    "27310": 27312,
    "27317": 27319,
    "27322": 27324,
    "27328": 27330,
    "27335": 27337,
    "27340": 27342,
    "27349": 27351,
    "27352": 27354,
    "27361": 27362,
    "27363": 27364,
    "27366": 27367,
    "27368": 27369,
    "27373": 27375,
    "27377": 27379,
    "27397": 27398,
    "27399": 27400,
    "27401": 27403,
    "27405": 27407,
    "27410": 27411,
    "27415": 27417,
    "27422": 27424,
    "27426": 27428,
    "27432": 27434,
    "27435": 27437,
    "27442": 27444,
    "27448": 27450,
    "27454": 27456,
    "27458": 27459,
    "27460": 27461,
    "27465": 27467,
    "27471": 27473,
    "27474": 27476,
    "27481": 27483,
    "27485": 27487,
    "27491": 27493,
    "27514": 27524,
    "27515": 27525,
    "27516": 27526,
    "27517": 27527,
    "27518": 27528,
    "27539": 27549,
    "27541": 27551,
    "27543": 27553,
    "27545": 27555,
    "27547": 27557,
    "27569": 27579,
    "27571": 27581,
    "27573": 27583,
    "27575": 27585,
    "27577": 27587,
    "27604": 27614,
    "27605": 27615,
    "27606": 27616,
    "27607": 27617,
    "27608": 27618,
    "27629": 27639,
    "27630": 27640,
    "27631": 27641,
    "27632": 27642,
    "27633": 27643,
    "27664": 27674,
    "27665": 27675,
    "27666": 27676,
    "27667": 27677,
    "27668": 27678,
    "27679": 27689,
    "27680": 27690,
    "27681": 27691,
    "27682": 27692,
    "27683": 27693,
    "27724": 27731,
    "27725": 27732,
    "27726": 27733,
    "27727": 27729,
    "27728": 27730,
    "27739": 27746,
    "27740": 27747,
    "27741": 27748,
    "27742": 27744,
    "27743": 27745,
    "27754": 27761,
    "27755": 27762,
    "27756": 27763,
    "27757": 27759,
    "27758": 27760,
    "27764": 27771,
    "27765": 27772,
    "27766": 27773,
    "27767": 27769,
    "27768": 27770,
    "27789": 27799,
    "27790": 27800,
    "27791": 27801,
    "27792": 27802,
    "27793": 27803,
    "27809": 27819,
    "27810": 27820,
    "27811": 27821,
    "27812": 27822,
    "27813": 27823,
    "27909": 27916,
    "27910": 27917,
    "27911": 27918,
    "27912": 27914,
    "27913": 27915,
    "27919": 27926,
    "27920": 27927,
    "27921": 27928,
    "27922": 27924,
    "27923": 27925,
    "27929": 27939,
    "27930": 27940,
    "27931": 27941,
    "27932": 27942,
    "27933": 27943,
    "27949": 27959,
    "27950": 27960,
    "27951": 27961,
    "27952": 27962,
    "27953": 27963,
    "27974": 27979,
    "27975": 27980,
    "27976": 27981,
    "27977": 27982,
    "27978": 27983,
    "27999": 28009,
    "28000": 28010,
    "28001": 28011,
    "28002": 28012,
    "28003": 28013,
    "28034": 28044,
    "28035": 28045,
    "28036": 28046,
    "28037": 28047,
    "28038": 28048,
    "28054": 28064,
    "28055": 28065,
    "28056": 28066,
    "28057": 28067,
    "28058": 28068,
    "28084": 28094,
    "28085": 28095,
    "28086": 28096,
    "28087": 28097,
    "28088": 28098,
    "28099": 28109,
    "28101": 28111,
    "28103": 28113,
    "28105": 28115,
    "28107": 28117,
    "28134": 28144,
    "28135": 28145,
    "28136": 28146,
    "28137": 28147,
    "28138": 28148,
    "28164": 28174,
    "28165": 28175,
    "28166": 28176,
    "28167": 28177,
    "28168": 28178,
    "28194": 28204,
    "28195": 28205,
    "28196": 28206,
    "28197": 28207,
    "28198": 28208,
    "28214": 28221,
    "28215": 28222,
    "28216": 28223,
    "28217": 28219,
    "28218": 28220,
    "28229": 28234,
    "28230": 28235,
    "28231": 28236,
    "28232": 28237,
    "28233": 28238,
    "28254": 28264,
    "28255": 28265,
    "28256": 28266,
    "28258": 28268,
    "28274": 28284,
    "28275": 28285,
    "28276": 28286,
    "28277": 28287,
    "28278": 28288,
    "28299": 28309,
    "28301": 28311,
    "28303": 28313,
    "28305": 28315,
    "28307": 28317,
    "28334": 28344,
    "28335": 28345,
    "28336": 28346,
    "28337": 28347,
    "28338": 28348,
    "28364": 28374,
    "28365": 28375,
    "28366": 28376,
    "28367": 28377,
    "28368": 28378,
    "28394": 28404,
    "28395": 28405,
    "28396": 28406,
    "28397": 28407,
    "28398": 28408,
    "28413": 28415,
    "28418": 28420,
    "28424": 28426,
    "28431": 28433,
    "28436": 28438,
    "28445": 28447,
    "28450": 28452,
    "28459": 28460,
    "28461": 28462,
    "28464": 28465,
    "28471": 28473,
    "28475": 28477,
    "28494": 28496,
    "28498": 28499,
    "28500": 28502,
    "28504": 28506,
    "28509": 28510,
    "28514": 28516,
    "28521": 28523,
    "28525": 28527,
    "28531": 28533,
    "28534": 28536,
    "28541": 28543,
    "28546": 28548,
    "28553": 28555,
    "28557": 28558,
    "28559": 28560,
    "28564": 28566,
    "28570": 28572,
    "28573": 28575,
    "28580": 28582,
    "28586": 28588,
    "28592": 28594,
    "30314": 30320,
    "30316": 30322,
    "30317": 30323,
    "30318": 30324,
    "30319": 30325,
    "30332": 30338,
    "30334": 30340,
    "30335": 30341,
    "30336": 30342,
    "30337": 30343,
    "30350": 30356,
    "30352": 30358,
    "30353": 30359,
    "30354": 30360,
    "30355": 30361,
    "30368": 30374,
    "30370": 30376,
    "30371": 30377,
    "30372": 30378,
    "30373": 30379,
    "30386": 30392,
    "30388": 30394,
    "30389": 30395,
    "30390": 30396,
    "30391": 30397,
    "30403": 30409,
    "30405": 30411,
    "30406": 30412,
    "30407": 30413,
    "30408": 30414,
    "30421": 30427,
    "30423": 30429,
    "30424": 30430,
    "30425": 30431,
    "30426": 30432,
    "30439": 30445,
    "30441": 30447,
    "30442": 30448,
    "30443": 30449,
    "30444": 30450,
    "30469": 30475,
    "30471": 30477,
    "30472": 30478,
    "30473": 30479,
    "30474": 30480,
    "30487": 30493,
    "30489": 30495,
    "30490": 30496,
    "30491": 30497,
    "30492": 30498,
    "30505": 30511,
    "30507": 30513,
    "30508": 30514,
    "30509": 30515,
    "30510": 30516,
    "30517": 30523,
    "30519": 30525,
    "30520": 30526,
    "30521": 30527,
    "30522": 30528,
    "30535": 30541,
    "30537": 30543,
    "30538": 30544,
    "30539": 30545,
    "30540": 30546,
    "30552": 30558,
    "30554": 30560,
    "30555": 30561,
    "30556": 30562,
    "30557": 30563,
    "30618": 30624,
    "30620": 30626,
    "30621": 30627,
    "30622": 30628,
    "30623": 30629,
    "30634": 30641,
    "30635": 30642,
    "30637": 30640,
    "30638": 30644,
    "30639": 30645,
    "30646": 30652,
    "30648": 30654,
    "30649": 30655,
    "30650": 30656,
    "30651": 30657,
    "30658": 30664,
    "30660": 30666,
    "30661": 30667,
    "30662": 30668,
    "30663": 30669,
    "30676": 30682,
    "30678": 30684,
    "30679": 30685,
    "30680": 30686,
    "30681": 30687,
    "30694": 30700,
    "30696": 30702,
    "30697": 30703,
    "30698": 30704,
    "30699": 30705,
    "30718": 30724,
    "30720": 30726,
    "30721": 30727,
    "30722": 30728,
    "30723": 30729,
    "30736": 30742,
    "30738": 30744,
    "30739": 30745,
    "30740": 30746,
    "30741": 30747,
    "30754": 30760,
    "30756": 30762,
    "30757": 30763,
    "30758": 30764,
    "30759": 30765,
    "30770": 30776,
    "30772": 30778,
    "30773": 30779,
    "30774": 30780,
    "30775": 30781,
    "30788": 30794,
    "30790": 30796,
    "30791": 30797,
    "30792": 30798,
    "30793": 30799,
    "30806": 30812,
    "30808": 30814,
    "30809": 30815,
    "30810": 30816,
    "30811": 30817,
    "30824": 30830,
    "30826": 30832,
    "30827": 30833,
    "30828": 30834,
    "30829": 30835,
    "30842": 30848,
    "30844": 30850,
    "30845": 30851,
    "30846": 30852,
    "30847": 30853,
    "30859": 30865,
    "30861": 30867,
    "30862": 30868,
    "30863": 30869,
    "30864": 30870,
    "30877": 30883,
    "30879": 30885,
    "30880": 30886,
    "30881": 30887,
    "30882": 30888,
    "30894": 30900,
    "30896": 30902,
    "30897": 30903,
    "30898": 30904,
    "30899": 30905,
    "30911": 30917,
    "30913": 30919,
    "30914": 30920,
    "30915": 30921,
    "30916": 30922,
    "30929": 30935,
    "30931": 30937,
    "30932": 30938,
    "30933": 30939,
    "30934": 30940,
    "30947": 30953,
    "30949": 30955,
    "30950": 30956,
    "30951": 30957,
    "30952": 30958,
    "30965": 30971,
    "30967": 30973,
    "30968": 30974,
    "30969": 30975,
    "30970": 30976,
    "31171": 31216,
    "31174": 31217,
    "31178": 31219,
    "31190": 31221,
    "31191": 31222,
    "31192": 31223,
    "31193": 31224,
    "31194": 31225,
    "31202": 31231,
    "31210": 31233,
    "31211": 31234,
    "31212": 31235,
    "31213": 31236,
    "31214": 31237,
    "31215": 31238,
    "31267": 31268,
    "31270": 31271,
    "31273": 31274,
    "31276": 31277,
    "31279": 31280,
    "31283": 31284,
    "31286": 31287,
    "31289": 31290,
    "31292": 31293,
    "31295": 31296,
    "31298": 31299,
    "31301": 31302,
    "31304": 31305,
    "31308": 31309,
    "31310": 31311,
    "31312": 31313,
    "31314": 31315,
    "31317": 31318,
    "31320": 31321,
    "31329": 31330,
    "31332": 31333,
    "31334": 31335,
    "31336": 31337,
    "31338": 31340,
    "31342": 31343,
    "31346": 31347,
    "31349": 31350,
    "31352": 31353,
    "31355": 31356,
    "31358": 31359,
    "31361": 31362,
    "31364": 31365,
    "31367": 31368,
    "31370": 31371,
    "31373": 31374,
    "31376": 31377,
    "31379": 31380,
    "31382": 31383,
    "31385": 31386,
    "320236000": 320236200,
    "325558800": 4426974500,
    "332331300": 332331700,
    "332902900": 332903100,
    "333863000": 333863200,
    "334506000": 334506200,
    "334508800": 334509000,
    "334509600": 334509800,
    "334570800": 334571000,
    "334602100": 334602300,
    "334602900": 334603100,
    "334605700": 334605900,
    "334612600": 334612800,
    "334613400": 334613600,
    "334614300": 334614500,
    "334803200": 334803400,
    "334805700": 334805900,
    "334808100": 334808300,
    "334818600": 334818800,
    "334819400": 334819600,
    "334820200": 334820400,
    "334821000": 334821200,
    "335051800": 335052000,
    "335075100": 335075300,
    "1703520900": 1703521100,
    "2957206500": 2957206700,
    "3411569100": 3411569300,
    "5342418900": 5342419000,
    "5342460100": 5342460200,
    "5342419400": 5342419500,
    "5342419700": 5342419800,
    "5342420000": 5342420100,
    "5342420300": 5342420400,
    "5342420600": 5342420700,
    "5342420900": 5342421000,
    "5342421200": 5342421300,
    "5342521500": 5342521600,
    "5343021700": 5343021800,
    "5343023300": 5343023400,
    "5343023700": 5343023800,
    "5343024500": 5343024600,
    "5343129700": 5343129800,
    "5343026500": 5343026600,
    "5343026900": 5343027000,
    "5343027300": 5343027400,
    "5350614700": 5350614800,
    "5343028100": 5343028200,
    "5343028900": 5343029000,
    "5343029300": 5343029400,
    "5343030100": 5343030200,
    "5343030500": 5343030600,
    "5343063500": 5343063600,
    "5343063900": 5343064000,
    "5343064300": 5343064400,
    "5343064700": 5343064800,
    "5343130400": 5343130500,
    "5350615100": 5350615200,
    "5361225400": 5361225500,
    "5403743200": 5403743300,
    "5470242000": 5470242100,
    "5476961700": 5476961800,
    "5476962100": 5476962200,
    "5476962500": 5476962600,
    "5476962900": 5476963000,
    "5476963300": 5476963400,
    "5518111900": 5518112000,
    "5343022500": 5343022600,
    "5343025700": 5343025800,
    "5365151600": 5365151700,
    "5365152000": 5365152100,
    "5512493500": 5512493600,
    "5354508700": 5354508800,
    "5355291600": 5355291700,
    "5355292000": 5355292100,
    "5355292400": 5355292500,
    "5355292800": 5355292900,
    "5355293200": 5355293300,
    "5355294000": 5355294100,
    "5355294400": 5355294500,
    "5355294800": 5355294900,
    "5355295200": 5355295300,
    "5355338600": 5355338700,
    "5355339000": 5355339100,
    "5355339400": 5355339500,
    "5355339800": 5355339900,
    "5355341000": 5355341100,
    "5362831900": 5362832000,
    "5458662100": 5458662200,
    "5476471900": 5476472000,
    "5476472300": 5476472400,
    "5476472700": 5476472800,
    "5477212500": 5477212600,
    "5476473100": 5476473200,
    "5502121600": 5502121700,
    "5502122000": 5502122100,
    "5507001800": 5507001900,
    "5506981600": 5506981700,
    "5505021600": 5505021700,
    "5518873200": 5518873300,
    "5109491100": 5109491200,
    "5109491700": 5109491800,
    "5056508900": 5056509700,
    "5056511000": 5056511800,
    "5056512200": 5056512400,
    "5057001300": 5057001500,
    "5056971800": 5056972000,
    "5057003200": 5057003400,
    "5062041000": 5062041200,
    "5078233900": 5078234100,
    "5094063600": 5094063800,
    "5102021100": 5102713900,
    "5130211300": 5130211500,
    "5130211800": 5130212000,
    "5175179800": 5175180000,
    "5175204900": 5175205400,
    "5175204500": 5175204700,
    "5228007900": 5228008100,
    "5266342300": 5266342500,
    "5271518300": 5271518500,
    "5361224100": 5361224300,
    "5470362500": 5470362700,
    "5476474600": 5476474800,
    "5476475100": 5476475300,
    "5476475600": 5476475800,
    "5477713100": 5477713300,
    "5476477500": 5476477600,
    "5518792600": 5518792800,
    "5343024900": 5343025000,
    "5265851400": 5265851600,
    "5276772300": 5276772200,
    "5282211400": 5282211300,
    "5282505700": 5282505600,
    "5282506000": 5282505900,
    "5282506300": 5282506200,
    "5282506600": 5282506500,
    "5282506900": 5282506800,
    "5282507200": 5282507100,
    "5282507500": 5282507400,
    "5282507800": 5282507700,
    "5282508200": 5282508100,
    "5394892000": 5394891900,
    "5320061200": 5320061300,
    "5322801900": 5322802000,
    "5322802200": 5322802300,
    "5322802500": 5322802600,
    "5322802800": 5322802900,
    "5322803100": 5322803200,
    "5322803700": 5322803800,
    "5322804000": 5322804100,
    "5322804600": 5322804700,
    "5322804900": 5322805000,
    "5322805200": 5322805300,
    "5322806100": 5322806200,
    "5322806400": 5322806500,
    "5322806700": 5322806800,
    "5322807000": 5322807100,
    "5322807300": 5322807400,
    "5322807600": 5322807700,
    "5334481500": 5334481600,
    "5334481800": 5334481900,
    "5334482100": 5334482200,
    "5334482400": 5334482500,
    "5336683600": 5336683700,
    "5336683900": 5336684000,
    "5340676800": 5340676900,
    "5347507100": 5347507200,
    "5347507400": 5347507500,
    "5361225700": 5361225800,
    "5398223300": 5398223400,
    "5477051500": 5477051600,
    "5477051800": 5477051900,
    "5477052100": 5477052200,
    "5477211800": 5477211900,
    "5477052400": 5477052500,
    "5518873800": 5518873900,
    "5507461400": 5507461500,
    "5507441400": 5507441500,
    "4318736500": 4318736700,
    "5056159500": 5056159700,
    "5056951700": 5056951900,
    "5056953400": 5056953600,
    "5059471200": 5059471400,
    "5078626600": 5078626800,
    "5101750700": 5105052300,
    "5123431800": 5123432000,
    "5125261200": 5125261400,
    "5145960000": 5145960200,
    "5175180700": 5175180900,
    "5175203600": 5175203800,
    "5250171200": 5250171400,
    "5361222500": 5361222600,
    "5448052200": 5448052400,
    "5466101900": 5466102100,
    "5518794100": 5518794300,
    "5509331600": 5509331700,
    "5509332000": 5509332100,
    "5509332400": 5509332500,
    "5509332800": 5509332900,
    "5509333200": 5509333300,
    "5509333600": 5509333700,
    "5509334000": 5509334100,
    "5509334400": 5509334500,
    "5509334800": 5509334900,
    "5509335200": 5509335300,
    "5509335600": 5509335700,
    "5509336000": 5509336100,
    "5509336400": 5509336500,
    "5509336800": 5509336900,
    "5520212100": 5520212200,
    "OD-000050": "A06"
  },
  "upsell_pids_list_monthly": {
    "334570700": 334570800,
    "334624800": 334624900,
    "335504700": 335504800,
    "5175180600": 5175180700,
    "5175204400": 5175204500,
    "5175205600": 5175204900
  }
};} catch (err) {usi_commons.report_error(err);}}
if (typeof usi_11831_json === 'undefined') {try {usi_11831_json = {
  "campaigns": {
    "precapture": [
      {
        "name": "US Precapture",
        "siteID": "38524",
        "hash": "I4TiwTxZ4ksFu6rBhJFhWus",
        "locales": [
          "en-US"
        ],
        "is_email_allowed": true,
        "has_fusion": false
      },
      {
        "name": "CA Precapture",
        "siteID": "38526",
        "hash": "GDPAK9DgSAis76ZbbzoIqJ6",
        "locales": [
          "en-CA"
        ],
        "is_email_allowed": true
      },
      {
        "name": "FR-CA Precapture",
        "siteID": "38528",
        "hash": "78qQ7iKExSByA4OHUR5Z5Pp",
        "locales": [
          "fr-CA"
        ],
        "is_email_allowed": true
      },
      {
        "name": "MX Precapture",
        "siteID": "38530",
        "hash": "u1fiev1Gxper6YDsNGmwNrs",
        "locales": [
          "es-MX"
        ],
        "is_email_allowed": true
      },
      {
        "name": "BR Precapture",
        "siteID": "38532",
        "hash": "II7jbtjsGoRpgsVwTUJlOq9",
        "locales": [
          "pt-BR"
        ],
        "is_email_allowed": true
      },
      {
        "name": "AR Precapture",
        "siteID": "38534",
        "hash": "Vm1ZH21W8EvgYR531jbS7Qo",
        "locales": [
          "es-AR"
        ],
        "is_email_allowed": true
      }
    ],
    "view": [
      {
        "name": "AMER - CA | New Return Visitor TT",
        "siteID": "53843",
        "hash": "79Cm9AdhCOj8LRMlDWhgW6c",
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
        "siteID": "59819",
        "hash": "hEgWYx7DXzysFaW1sEi6rny",
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
        "siteID": "53843",
        "hash": "79Cm9AdhCOj8LRMlDWhgW6c",
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
        "siteID": "53843",
        "hash": "79Cm9AdhCOj8LRMlDWhgW6c",
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
        "siteID": "53843",
        "hash": "79Cm9AdhCOj8LRMlDWhgW6c",
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
        "siteID": "53843",
        "hash": "79Cm9AdhCOj8LRMlDWhgW6c",
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
        "name": "US | Cart Preserver LC | Cart Rebuilder",
        "siteID": "49313",
        "hash": "QIVeyLvqeRX6Y8fOjEAf4sk",
        "key": "{{usi_commons.device}}",
        "is_checkout_page": false,
        "locales": [
          "en-US"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "AMER | Cart Preserver LC | Cart Rebuilder",
        "siteID": "49313",
        "hash": "QIVeyLvqeRX6Y8fOjEAf4sk",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "is_checkout_page": false,
        "locales": [
          "en-CA",
          "fr-CA",
          "es-MX",
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
        "is_before": "2000-01-01",
        "name": "AMER Payment Abandon",
        "device": "mobile",
        "locales": [
          "pt-BR",
          "es-AR",
          "es-MX",
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "Mobile AMER payment",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "AMER Survey | Payment Abandon (logged out)",
            "siteID": "30309",
            "hash": "p4rtU0G9AIOKxfjpyrkWr9W",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "name": "US/CA Payment Abandon | Desktop | AB test (90/10) | Flash Sale",
        "device": "desktop",
        "siteID": "30141",
        "hash": "yVgCFhqDcscGL3KqUnbfumi",
        "key": "{{usi_commons.device}}",
        "locales": [
          "en-US",
          "en-CA"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "name": "US/CA Payment Abandon | Mobile | AB test (90/10) | Flash Sale",
        "device": "mobile",
        "siteID": "30151",
        "hash": "WQQyBnFTKKbuUrne4X5tHxq",
        "key": "{{usi_commons.device}}",
        "locales": [
          "en-US",
          "en-CA"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "AMER Payment Abandon",
        "device": "desktop",
        "locales": [
          "pt-BR",
          "es-AR",
          "es-MX",
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "Desktop AMER payment",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "AMER Survey | Payment Abandon (logged out)",
            "siteID": "30309",
            "hash": "p4rtU0G9AIOKxfjpyrkWr9W",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "AMER Payment Abandon",
        "device": "mobile",
        "locales": [
          "pt-BR",
          "es-AR",
          "es-MX",
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "Mobile AMER payment",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "AMER Survey | Payment Abandon (logged in)",
            "siteID": "30309",
            "hash": "p4rtU0G9AIOKxfjpyrkWr9W",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "AMER Payment Abandon",
        "device": "desktop",
        "locales": [
          "pt-BR",
          "es-AR",
          "es-MX",
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "Desktop AMER payment",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "AMER Survey | Payment Abandon (logged in)",
            "siteID": "30309",
            "hash": "p4rtU0G9AIOKxfjpyrkWr9W",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "name": "AMER DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "pt-BR",
          "es-AR",
          "es-MX"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile AMER DR payment",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "device": "mobile"
          },
          {
            "name": "Desktop AMER DR payment",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "Autodesk - Americas - Precise Promotion | Multi Visit Flex Offer (Pre-Cart)",
        "key": "{{usi_commons.device}}",
        "siteID": "59887",
        "hash": "L6tMvHA6xU68cJUYiYAJ8OJ",
        "locales": [
          "en-US"
        ],
        "eligible_site_visits": true,
        "eligible_us_acad_visits": true,
        "lift": {
          "id": "59891"
        },
        "pages": [
          "/products/autocad/overview"
        ],
        "suppress_cookies": [
          "usi_prod_name_1",
          "usi_prod_price_1",
          "usi_prod_image_1"
        ]
      },
      {
        "is_before": "2000-01-01",
        "name": "US GUAC Payment | Desktop | AB test | AutoCAD LT - Downgrade",
        "device": "desktop",
        "locales": [
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_autocad_plus_downgrade": true,
        "split": {
          "1": {
            "name": "Americas - Precise Promotion | Payment Abandon, Desktop",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "key": "{{usi_app.get_payment_key}}_downgrade"
          },
          "2": {
            "name": "Americas - Precise Promotion | Downgrade - Checkout (Active Cart)",
            "siteID": "62095",
            "hash": "Hm3hODMpRIoifgYcG11ayI5",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "US GUAC Payment | Desktop | AB test | AutoCAD LT - Downgrade",
        "device": "mobile",
        "locales": [
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_autocad_plus_downgrade": true,
        "split": {
          "1": {
            "name": "Americas - Precise Promotion | Payment Abandon, Mobile",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "key": "{{usi_app.get_payment_key}}_downgrade"
          },
          "2": {
            "name": "Americas - Precise Promotion | Downgrade - Checkout (Active Cart)",
            "siteID": "62095",
            "hash": "Hm3hODMpRIoifgYcG11ayI5",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "US GUAC Payment | Desktop | AB test | Revit LT - Downgrade",
        "device": "desktop",
        "locales": [
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_revit_downgrade": true,
        "split": {
          "1": {
            "name": "Americas - Precise Promotion | Payment Abandon, Desktop",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "key": "{{usi_app.get_payment_key}}_downgrade_RVTLT"
          },
          "2": {
            "name": "Americas - Precise Promotion | Downgrade - Checkout (Active Cart)",
            "siteID": "62095",
            "hash": "Hm3hODMpRIoifgYcG11ayI5",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_RVTLT"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "US GUAC Payment | Desktop | AB test | Revit LT - Downgrade",
        "device": "mobile",
        "locales": [
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_revit_downgrade": true,
        "split": {
          "1": {
            "name": "Americas - Precise Promotion | Payment Abandon, Mobile",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "key": "{{usi_app.get_payment_key}}_downgrade_RVTLT"
          },
          "2": {
            "name": "Americas - Precise Promotion | Downgrade - Checkout (Active Cart)",
            "siteID": "62095",
            "hash": "Hm3hODMpRIoifgYcG11ayI5",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_RVTLT"
          }
        }
      },
      {
        "name": "US GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-US"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | US GUAC Payment",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "device": "mobile"
          },
          {
            "name": "Desktop | US GUAC Payment",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "North America GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-CA",
          "fr-CA"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | CA/MX FR GUAC Payment",
            "siteID": "30151",
            "hash": "WQQyBnFTKKbuUrne4X5tHxq",
            "device": "mobile"
          },
          {
            "name": "Desktop | CA/MX FR GUAC Payment",
            "siteID": "30141",
            "hash": "yVgCFhqDcscGL3KqUnbfumi",
            "device": "desktop"
          }
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
          "F360"
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
    "FSN_en-CA_1-year": {
      "copy": "Add more and save 25%. Buy 3 Fusion subscriptions and get the 4th for free.",
      "cta": "Get 4 for 3.",
      "url": "{{usi_app.checkout_url}}/en-CA/cart?offers=%5Bcountry%3ACA%3Bcurrency%3ACAD%3BpriceRegionCode%3AA2%3Bquantity%3A4%3BofferingName%3AFusion%3BofferingId%3AOD-002134%3BofferingCode%3AFSN%3BaccessModelCode%3AS%3BtermCode%3AA01%3BintendedUsageCode%3ACOM%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BbillingFrequencyCode%3AB05%3BbillingTypeCode%3AB100%3BbillingBehaviorCode%3AA200%3BservicePlanIdCode%3ASTND%5D&promoCodes=%5BFY27FSN4FOR3%5D&_gl=1*19kufy4*_gcl_au*MTc4MTMxNDQ0MS4xNzcyNTc4ODI1*_ga*MTQ0MDc5NzkwMS4xNzcyNTc4ODI1*_ga_NZSJ72N6RX*czE3NzI1Nzg4MjUkbzEkZzEkdDE3NzI1Nzg4MzckajQ4JGwwJGgw",
      "qty": [
        "1",
        "2",
        "3"
      ]
    },
    "FSN_en-US_1-year": {
      "copy": "Add more and save 25%. Buy 3 Fusion subscriptions and get the 4th for free.",
      "cta": "Get 4 for 3.",
      "url": "{{usi_app.checkout_url}}/en-US/cart?offers=%5Bcountry%3AUS%3Bcurrency%3AUSD%3BpriceRegionCode%3AA0%3Bquantity%3A4%3BofferingName%3AFusion%3BofferingId%3AOD-002134%3BofferingCode%3AFSN%3BaccessModelCode%3AS%3BtermCode%3AA01%3BintendedUsageCode%3ACOM%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BbillingFrequencyCode%3AB05%3BbillingTypeCode%3AB100%3BbillingBehaviorCode%3AA200%3BservicePlanIdCode%3ASTND%5D&promoCodes=%5BFY27FSN4FOR3%5D&_gl=1*1s8yv1*_gcl_au*MjkyNDQ0NjQuMTc3MjE1MjQ3MQ..*FPAU*MTQ4NTQ4MjgwOS4xNzY4NDE4ODk3*_ga*MTY2OTczNDI3MS4xNzcyMTQwMjYy*_ga_NZSJ72N6RX*czE3NzIyMTIyNjUkbzckZzEkdDE3NzIyMTI0OTIkajEkbDAkaDA",
      "qty": [
        "1",
        "2",
        "3"
      ]
    },
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
    "ACDLT_en-US_1-year": {
      "copy": "For less than $12 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get Revit LT included.",
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
    "ACDLT_en-CA_1-year": {
      "copy": "For less than CA$15 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get Revit LT included.",
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
    "old_ACDLT_en-US_1-year": {
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
    "old_ACDLT_en-CA_1-year": {
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
if (typeof usi_11833_json === 'undefined') {try {usi_11833_json = {
  "campaigns": {
    "precapture": [
      {
        "name": "NZ Precapture",
        "siteID": "38522",
        "hash": "xPvEHH139qNyARgocRfHFzH",
        "locales": [
          "en-NZ"
        ],
        "is_email_allowed": true
      },
      {
        "name": "AU Precapture",
        "siteID": "38520",
        "hash": "dLwDplwhWR2X6pb9k1sKsAI",
        "locales": [
          "en-AU"
        ],
        "is_email_allowed": true
      },
      {
        "name": "JP Precapture",
        "siteID": "38542",
        "hash": "WMM0bXqSf4pBMsc9YW0gP5S",
        "locales": [
          "ja-JP"
        ],
        "is_email_allowed": true
      },
      {
        "name": "MY Precapture",
        "siteID": "38538",
        "hash": "KGyo2AS5IlePToEUsYnMTvy",
        "locales": [
          "en-MY"
        ],
        "is_email_allowed": true
      },
      {
        "name": "SG Precapture",
        "siteID": "38540",
        "hash": "HkBJlsPa3TdpMg2VMpI6MbN",
        "locales": [
          "en-SG"
        ],
        "is_email_allowed": true
      },
      {
        "name": "IN Precapture",
        "siteID": "38536",
        "hash": "u1fiev1Gxper6YDsNGmwNrs",
        "locales": [
          "en-IN"
        ],
        "is_email_allowed": true
      },
      {
        "name": "KR Precapture",
        "siteID": "38544",
        "hash": "igQ8Ek3Ky7bByFKWH8I9HaC",
        "locales": [
          "ko-KR"
        ],
        "is_email_allowed": true,
        "suppress_cookies": [
          "usi_suppress_kr"
        ]
      },
      {
        "name": "CN Precapture",
        "siteID": "38546",
        "hash": "3b6ZU2VJ1aTgy8ja4pBwcdv",
        "locales": [
          "zh-CN"
        ],
        "is_email_allowed": true
      }
    ],
    "view": [
      {
        "name": "JP/IN Payment Abandon | Desktop | AB test (90/10) | Flash Sale",
        "device": "desktop",
        "siteID": "30147",
        "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
        "key": "{{usi_commons.device}}",
        "locales": [
          "ja-JP",
          "en-IN"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "name": "JP/IN Payment Abandon | Mobile | AB test (90/10) | Flash Sale",
        "device": "mobile",
        "siteID": "30157",
        "hash": "VaTh5jw8Yqu4cmDkcwerSec",
        "key": "{{usi_commons.device}}",
        "locales": [
          "ja-JP",
          "en-IN"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon (JP/KR)",
        "device": "desktop",
        "locales": [
          "ja-JP",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_autocad_plus_downgrade": true,
        "recommendations": {
          "siteID": "{{usi_app.recommendation_site_product}}",
          "pid": "{{usi_app.locale}}_ACD_1-YEAR",
          "filters": [
            "extra !*= OUTOFSTOCK"
          ],
          "min_rows": 0
        },
        "split": {
          "1": {
            "name": "APAC Desktop | JP/KR Payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "key": "{{usi_app.get_payment_key}}_downgrade"
          },
          "2": {
            "name": "AutoCAD Plus - Downgrade",
            "siteID": "61485",
            "hash": "mUAe6TZJFIKUhKyrb1OJQLO",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_dynamic"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon (JP/KR)",
        "device": "mobile",
        "locales": [
          "ja-JP",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_autocad_plus_downgrade": true,
        "recommendations": {
          "siteID": "{{usi_app.recommendation_site_product}}",
          "pid": "{{usi_app.locale}}_ACD_1-YEAR",
          "filters": [
            "extra !*= OUTOFSTOCK"
          ],
          "min_rows": 0
        },
        "split": {
          "1": {
            "name": "APAC Mobile | JP/KR Payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "key": "{{usi_app.get_payment_key}}_downgrade"
          },
          "2": {
            "name": "AutoCAD Plus - Downgrade",
            "siteID": "61485",
            "hash": "mUAe6TZJFIKUhKyrb1OJQLO",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_dynamic"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "AutoCAD Plus - Downgrade",
        "siteID": "61457",
        "hash": "4OuL1LkbaduprFbBCixH33o",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}_dynamic",
        "locales": [
          "ko-KR",
          "ja-JP"
        ],
        "required_cookies": [
          "usi_autocad_plus_eligible"
        ],
        "suppress_cookies": [
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ],
        "is_checkout_payment_page": false,
        "recommendations": {
          "siteID": "{{usi_app.recommendation_site_product}}",
          "pid": "{{usi_app.locale}}_ACD_1-YEAR",
          "filters": [
            "extra !*= OUTOFSTOCK"
          ],
          "min_rows": 0
        },
        "lift": {
          "id": "61473"
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon",
        "device": "mobile",
        "locales": [
          "ja-JP",
          "en-IN",
          "en-MY",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "APAC Mobile | SG/MY/JP Payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "APAC Survey | Payment Abandon (logged out)",
            "siteID": "31857",
            "hash": "LGxsRXL3IhIerTqg1DydbwZ",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon",
        "device": "desktop",
        "locales": [
          "ja-JP",
          "en-IN",
          "en-MY",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "APAC Desktop | SG/MY/JP Payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "APAC Survey | Payment Abandon (logged out)",
            "siteID": "31857",
            "hash": "LGxsRXL3IhIerTqg1DydbwZ",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon",
        "device": "mobile",
        "locales": [
          "ja-JP",
          "en-IN",
          "en-MY",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "APAC Mobile | SG/MY/JP Payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "APAC Survey | Payment Abandon (logged in)",
            "siteID": "31857",
            "hash": "LGxsRXL3IhIerTqg1DydbwZ",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "APAC Payment Abandon",
        "device": "desktop",
        "locales": [
          "ja-JP",
          "en-IN",
          "en-MY",
          "ko-KR"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "APAC Desktop | SG/MY/JP Payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "APAC Survey | Payment Abandon (logged in)",
            "siteID": "31857",
            "hash": "LGxsRXL3IhIerTqg1DydbwZ",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "name": "ANZ | New Return Visitor TT",
        "siteID": "56033",
        "hash": "PLUZde1a1l6rKFQ5JrM1ECL",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-AU",
          "en-NZ"
        ],
        "required_cookies": [
          "cartReference",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "APAC | Cart Preserver LC | Cart Rebuilder",
        "siteID": "53763",
        "hash": "nWlgrQfijxyfF3MwScxUTFS",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "is_checkout_page": false,
        "locales": [
          "en-MY",
          "en-SG",
          "ja-JP",
          "ko-KR",
          "en-IN",
          "zh-CN"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "ANZ | Cart Preserver LC | Cart Rebuilder",
        "siteID": "54571",
        "hash": "d2YeuymwXBPSNytWUYtR58X",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "is_checkout_page": false,
        "locales": [
          "en-NZ",
          "en-AU"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "KR DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "ko-KR"
        ],
        "suppress_cookies": [
          "usi_suppress_kr"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile KR DR payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "device": "mobile"
          },
          {
            "name": "Desktop KR DR payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "IN DR payment | Expired Trials",
        "key": "{{usi_commons.device}}",
        "siteID": "59801",
        "is_before": "2000-01-01",
        "testing": true,
        "locales": [
          "en-IN"
        ],
        "is_checkout_payment_page": true,
        "expired_trial": true,
        "split": {
          "group1": {
            "name": "IN DR payment | Expired Trials (Flex Tokens)",
            "siteID": "59801",
            "hash": "MfcR8PyFvWFovpRFBBkwRs1"
          },
          "group2": {
            "name": "IN DR payment | Expired Trials (Payment Abandon)",
            "siteID": "59803",
            "hash": "MnZMaAdlJkbx2hOiDgDtlmf"
          }
        }
      },
      {
        "name": "IN/MY/CN DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-IN",
          "en-MY",
          "zh-CN"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile IN/MY/CN DR payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "device": "mobile"
          },
          {
            "name": "Desktop IN/MY/CN DR payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "SG DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-SG"
        ],
        "is_checkout_payment_page": true,
        "segments": [
          {
            "name": "Mobile SG DR payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "device": "mobile"
          },
          {
            "name": "Desktop SG DR payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "AU/NZ DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-AU",
          "en-NZ"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile AU/NZ DR payment",
            "siteID": "30155",
            "hash": "U754YIxIignUCcGiL6waBGE",
            "device": "mobile"
          },
          {
            "name": "Desktop AU/NZ DR payment",
            "siteID": "30145",
            "hash": "6xhiBCvHYpsHSBK4ousYycP",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "AU/NZ GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-AU",
          "en-NZ"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | AU/NZ GUAC Payment",
            "siteID": "30155",
            "hash": "U754YIxIignUCcGiL6waBGE",
            "device": "mobile"
          },
          {
            "name": "Desktop | AU/NZ GUAC Payment",
            "siteID": "30145",
            "hash": "6xhiBCvHYpsHSBK4ousYycP",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "APAC GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-SG",
          "en-MY",
          "ja-JP"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | SG/MY/JP GUAC Payment",
            "siteID": "30157",
            "hash": "VaTh5jw8Yqu4cmDkcwerSec",
            "device": "mobile"
          },
          {
            "name": "Desktop | SG/MY/JP GUAC Payment",
            "siteID": "30147",
            "hash": "q6S0CfQIIS8p5t9KLFJWU6q",
            "device": "desktop"
          }
        ]
      }
    ]
  },
  "aff_links": {
    "en-MY": "https://www.kqzyfj.com/click-2681135-14065794",
    "en-SG": "https://www.anrdoezrs.net/click-2681135-14065798",
    "en-NZ": "https://www.anrdoezrs.net/click-2681135-17031466",
    "en-AU": "https://www.tkqlhce.com/click-2681135-17031459",
    "en-IN": "https://www.jdoqocy.com/click-2681135-14065797",
    "ja-JP": "https://www.jdoqocy.com/click-2681135-14065795",
    "ko-KR": "https://www.anrdoezrs.net/click-2681135-14065796",
    "zh-CN": "https://www.jdoqocy.com/click-2681135-14065793"
  },
  "cloud_products_upsell_matrix": {
    "en-SG": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Connect your team & scale workflows quickly in the cloud with Flow Production Tracking.",
        "cta": "ADD TO CART",
        "region": "APAC"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "Collaborate anytime, anywhere securely in the cloud with BIM Collaborate Pro.",
        "cta": "ADD TO CART",
        "region": "APAC"
      }
    ],
    "en-MY": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Connect your team & scale workflows quickly in the cloud with Flow Production Tracking.",
        "cta": "ADD TO CART",
        "region": "APAC"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "Collaborate anytime, anywhere securely in the cloud with BIM Collaborate Pro.",
        "cta": "ADD TO CART",
        "region": "APAC"
      }
    ],
    "en-AU": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Connect your team & scale workflows quickly in the cloud with Flow Production Tracking.",
        "cta": "ADD TO BASKET",
        "region": "ANZ"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "Collaborate anytime, anywhere securely in the cloud with BIM Collaborate Pro.",
        "cta": "ADD TO BASKET",
        "region": "ANZ"
      }
    ],
    "en-NZ": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Connect your team & scale workflows quickly in the cloud with Flow Production Tracking.",
        "cta": "ADD TO BASKET",
        "region": "ANZ"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "Collaborate anytime, anywhere securely in the cloud with BIM Collaborate Pro.",
        "cta": "ADD TO BASKET",
        "region": "ANZ"
      }
    ],
    "en-IN": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Connect your team & scale workflows quickly in the cloud with Flow Production Tracking.",
        "cta": "ADD TO BASKET",
        "region": "APAC"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "Collaborate anytime, anywhere securely in the cloud with BIM Collaborate Pro.",
        "cta": "ADD TO BASKET",
        "region": "APAC"
      }
    ],
    "ja-JP": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "Flow Production Tracking \u3067\u3001\u30AF\u30E9\u30A6\u30C9\u4E0A\u306E\u30C1\u30FC\u30E0\u9023\u643A\u3068\u3001\u30B9\u30E0\u30FC\u30BA\u306A\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u9032\u884C\u3092\u3002",
        "cta": "\u30AB\u30FC\u30C8\u306B\u8FFD\u52A0",
        "region": "APAC"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "BIM Collaborate Pro \u306A\u3089\u3001\u3044\u3064\u3067\u3082\u3001\u3069\u3053\u3067\u3082\u3001\u5B89\u5168\u306B\u30AF\u30E9\u30A6\u30C9\u4E0A\u3067\u30B3\u30E9\u30DC\u30EC\u30FC\u30B7\u30E7\u30F3\u3002",
        "cta": "\u30AB\u30FC\u30C8\u306B\u8FFD\u52A0",
        "region": "APAC"
      }
    ],
    "ko-KR": [
      {
        "targets": [
          "MAYA",
          "3DSMAX"
        ],
        "upsell": "FPT",
        "text": "\uD074\uB77C\uC6B0\uB4DC \uAE30\uBC18\uC758 Flow Production Tracking\uB97C \uCD94\uAC00\uD558\uC5EC \uD504\uB85C\uC81D\uD2B8 \uAD00\uB9AC\uC5D0 \uD6A8\uC728\uC131\uC744 \uB354\uD558\uC138\uC694.",
        "cta": "\uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uB2F4\uAE30",
        "region": "APAC"
      },
      {
        "targets": [
          "RVT",
          "CIV3D"
        ],
        "upsell": "COLLRP",
        "text": "\uD074\uB77C\uC6B0\uB4DC \uAE30\uBC18\uC758BIM Collaborate Pro\uB97C \uD1B5\uD574 \uC5B8\uC81C \uC5B4\uB514\uC11C\uB098 \uD6A8\uACFC\uC801\uC73C\uB85C \uD611\uC5C5\uD558\uC138\uC694.",
        "cta": "\uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uB2F4\uAE30",
        "region": "APAC"
      }
    ]
  },
  "privacy_policy": {
    "en-AU": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "en-NZ": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    }
  },
  "bundle_offers": {
    "FSN_en-AU_1-year": {
      "copy": "Add more and save 25%. Buy 3 Fusion subscriptions and get the 4th for free.",
      "cta": "Get 4 for 3.",
      "url": "{{usi_app.checkout_url}}/en-AU/cart?offers=%5Bcountry%3AAU%3Bcurrency%3AAUD%3BpriceRegionCode%3AAH%3Bquantity%3A4%3BofferingName%3AFusion%3BofferingId%3AOD-002134%3BofferingCode%3AFSN%3BaccessModelCode%3AS%3BtermCode%3AA01%3BintendedUsageCode%3ACOM%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BbillingFrequencyCode%3AB05%3BbillingTypeCode%3AB100%3BbillingBehaviorCode%3AA200%3BservicePlanIdCode%3ASTND%5D&promoCodes=%5BFY27FSN4FOR3%5D&_gl=1*vdsruo*_gcl_au*MjkyNDQ0NjQuMTc3MjE1MjQ3MQ..*FPAU*MTQ4NTQ4MjgwOS4xNzY4NDE4ODk3*_ga*MTY2OTczNDI3MS4xNzcyMTQwMjYy*_ga_NZSJ72N6RX*czE3NzIyMTIyNjUkbzckZzEkdDE3NzIyMTI1OTckajUzJGwwJGgw",
      "qty": [
        "1",
        "2",
        "3"
      ]
    },
    "RVTLT_en-AU_1-year": {
      "copy": "For only A$16 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get AutoCAD LT included.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-AU/cart?offers=[country:AU;currency:AUD;offeringCode:RVTLTS;offeringId:OD-000280;offeringName:AutoCAD Revit LT Suite;priceRegionCode:AH;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
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
    "ACDLT_en-NZ_1-year": {
      "copy": "Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://commerce.autodesk.com/en-NZ?pid=5532232800%5Bqty:3%5D&offerid=63431897920\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_en-NZ_3-year": {
      "copy": "Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://commerce.autodesk.com/en-NZ?pid=5532232900%5Bqty:3%5D&offerid=63431897920\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDIST_en-NZ_3-year": {
      "copy": "Get 3 AutoCAD subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://commerce.autodesk.com/en-NZ?pid=5654504900%5Bqty%3A3%5D&offerid=63437020720\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDIST_en-NZ_1-year": {
      "copy": "Get 3 AutoCAD subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://commerce.autodesk.com/en-NZ?pid=5654504800%5Bqty%3A3%5D&offerid=63437020720\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_en-MY_1-year": {
      "copy": "Online exclusive! Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://store.autodesk.com/store/adskjp/en_MY/buy/productID.5763107700/quantity.3/OfferID.63543759920/Currency.MYR\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_en-MY_3-year": {
      "copy": "Online exclusive! Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://store.autodesk.com/store/adskjp/en_MY/buy/productID.5763107900/quantity.3/OfferID.63543759920/Currency.MYR\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_en-SG_1-year": {
      "copy": "Online exclusive! Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://store.autodesk.com/store/adsk/en_SG/buy/productID.5773506700/quantity.3/OfferID.63551570920/Currency.SGD\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_en-SG_3-year": {
      "copy": "Online exclusive! Get 3 AutoCAD LT subscriptions and save 20%. - ",
      "cta": "BUY NOW",
      "url": "\"https://store.autodesk.com/store/adsk/en_SG/buy/productID.5773506800/quantity.3/OfferID.63551570920/Currency.SGD\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDIST_ko-KR_1-year": {
      "copy": "AutoCAD \uC138 \uC2DC\uD2B8 \uB2F9 \uCD5C\uB300 20%* \uD560\uC778. - ",
      "cta": "\uC9C0\uAE08 \uD560\uC778\uBC1B\uAE30",
      "url": "\"https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID.5759518600/quantity.3/OfferID.63538840920/Currency.KRW\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDIST_ko-KR_3-year": {
      "copy": "AutoCAD \uC138 \uC2DC\uD2B8 \uB2F9 \uCD5C\uB300 20%* \uD560\uC778.  - ",
      "cta": "\uC9C0\uAE08 \uD560\uC778\uBC1B\uAE30",
      "url": "\"https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID.5759518700/quantity.3/OfferID.63538840920/Currency.KRW\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_ko-KR_1-year": {
      "copy": "AutoCAD LT \uC138 \uC2DC\uD2B8 \uB2F9 \uCD5C\uB300 20%* \uD560\uC778. - ",
      "cta": "\uC9C0\uAE08 \uD560\uC778\uBC1B\uAE30",
      "url": "\"https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID.5644220200/quantity.3/OfferID.63412857720/Currency.KRW\"",
      "qty": [
        "2",
        "3"
      ]
    },
    "ACDLT_ko-KR_3-year": {
      "copy": "AutoCAD LT \uC138 \uC2DC\uD2B8 \uB2F9 \uCD5C\uB300 20%* \uD560\uC778. - ",
      "cta": "\uC9C0\uAE08 \uD560\uC778\uBC1B\uAE30",
      "url": "\"https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID.5644220400/quantity.3/OfferID.63412857720/Currency.KRW\"",
      "qty": [
        "2",
        "3"
      ]
    }
  },
  "email_info": {
    "en-MY": {
      "link": "/store?Action=DisplayPage&Locale=en_MY&SiteID=adskjp&id=QuickBuyCartPage&mktvar002=afc_my_usi_email&usi_var002=afc_my_usi_email",
      "link2": "https://asean.autodesk.com/benefits/multi-year-subscriptions?mktvar002=afc_my_upsellit_cartabandonmentemail",
      "link3": "https://asean.autodesk.com/benefits/buy-online-securely?mktvar002=afc_my_upsellit_cartabandonmentemail",
      "link4": "https://asean.autodesk.com/benefits/refund-policy?mktvar002=afc_my_upsellit_cartabandonmentemail",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-SG": {
      "link": "/store?Action=DisplayPage&Locale=en_SG&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_sg_usi_email",
      "link2": "https://www.autodesk.com.sg/benefits/multi-year-subscriptions?mktvar002=afc_sg_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.com.sg/benefits/buy-online-securely?mktvar002=afc_sg_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.com.sg/benefits/refund-policy?mktvar002=afc_sg_upsellit_cartabandonmentemail",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-NZ": {
      "link": "/store?Action=DisplayPage&Locale=en_NZ&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_nz_usi_email",
      "link2": "https://www.autodesk.co.nz/benefits/multi-year-subscriptions?mktvar002=afc_nz_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.co.nz/benefits/buy-online-securely?mktvar002=afc_nz_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.co.nz/benefits/refund-policy?mktvar002=afc_nz_upsellit_cartabandonmentemail",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-AU": {
      "link": "/store?Action=DisplayPage&Locale=en_AU&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_aus_usi_email&usi_var002=afc_aus_usi_email",
      "link2": "https://www.autodesk.com.au/benefits/multi-year-subscriptions?mktvar002=afc_aus_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.com.au/benefits/buy-online-securely?mktvar002=afc_aus_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.com.au/benefits/refund-policy?mktvar002=afc_aus_upsellit_cartabandonmentemail",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-IN": {
      "link": "/store?Action=DisplayPage&Locale=en_IN&SiteID=adskin&id=QuickBuyCartPage&mktvar002=afc_in_usi_email",
      "link2": "https://www.autodesk.in/benefits/multi-year-subscriptions?mktvar002=afc_in_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.in/benefits/buy-online-securely?mktvar002=afc_in_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.in/benefits/refund-policy?mktvar002=afc_in_upsellit_cartabandonmentemail",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "ja-JP": {
      "link": "/ja-JP?mktvar002=afc_jp_usi_email",
      "link2": "https://www.autodesk.co.jp/benefits/multi-year-subscriptions?mktvar002=afc_jp_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.co.jp/benefits/buy-online-securely?mktvar002=afc_jp_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.co.jp/benefits/refund-policy?mktvar002=afc_jp_upsellit_cartabandonmentemail",
      "from_name": "\u30AA\u30FC\u30C8\u30C7\u30B9\u30AF\u30B9\u30C8\u30A2\u30AB\u30B9\u30BF\u30DE\u30FC\u30B5\u30DD\u30FC\u30C8",
      "optin_head": "\u3054\u6C7A\u5B9A\u306B\u3082\u3063\u3068\u6642\u9593\u304C\u5FC5\u8981\u3067\u3059\u304B\uFF1F",
      "optin_desc": "\u6CE8\u6587\u5185\u5BB9\u306B\u3064\u3044\u3066\u30E1\u30FC\u30EB\u3092\u9001\u3063\u3066\u4E0B\u3055\u3044\u3002",
      "optin_ok": "\u306F\u3044",
      "tt_head": "\u304A\u8CB7\u3044\u5FD8\u308C\u306F\u3054\u3056\u3044\u307E\u305B\u3093\u304B\uFF1F",
      "tt_btn": "\u8CFC\u5165\u624B\u7D9A\u304D\u3092\u7D9A\u3051\u308B"
    },
    "ko-KR": {
      "link": "/store?Action=DisplayPage&Locale=ko_KR&SiteID=adskkr&id=QuickBuyCartPage&mktvar002=afc_kr_usi_email",
      "link2": "https://www.autodesk.co.kr/benefits/multi-year-subscriptions?mktvar002=afc_kr_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.co.kr/benefits/buy-online-securely?mktvar002=afc_kr_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.co.kr/benefits/refund-policy?mktvar002=afc_kr_upsellit_cartabandonmentemail",
      "from_name": "\uC624\uD1A0\uB370\uC2A4\uD06C \uC2A4\uD1A0\uC5B4",
      "optin_head": "\uC2DC\uAC04\uC774 \uB354 \uD544\uC694\uD558\uC2E0\uAC00\uC694?",
      "optin_desc": "\uC7A5\uBC14\uAD6C\uB2C8 \uB0B4\uC5ED\uC744 \uC774\uBA54\uC77C\uB85C \uBC1B\uB294\uB370 \uB3D9\uC758\uD569\uB2C8\uB2E4.",
      "optin_ok": "\uC644\uB8CC",
      "tt_head": "\uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uC0C1\uD488\uC774 \uC788\uC2B5\uB2C8\uB2E4",
      "tt_btn": "\uACB0\uC81C \uACC4\uC18D\uD558\uAE30"
    },
    "zh-CN": {
      "link": "/store?Action=DisplayPage&Locale=zh_CN&SiteID=adskcn&id=QuickBuyCartPage&mktvar002=afc_cn_usi_email",
      "link2": "https://www.autodesk.com.cn/benefits/multi-year-subscriptions?mktvar002=afc_cn_upsellit_cartabandonmentemail",
      "link3": "https://www.autodesk.com.cn/benefits/buy-online-securely?mktvar002=afc_cn_upsellit_cartabandonmentemail",
      "link4": "https://www.autodesk.com.cn/benefits/buy-online-securely?mktvar002=afc_cn_upsellit_cartabandonmentemail",
      "from_name": "\u6B27\u7279\u514B\u5BA2\u670D",
      "optin_head": "\u8D76\u65F6\u95F4\u5417\uFF1F",
      "optin_desc": "\u628A\u8D2D\u7269\u8F66\u5185\u5BB9\u53D1\u5230\u6211\u7684\u90AE\u7BB1\u3002",
      "optin_ok": "\u597D\u7684",
      "tt_head": "\u522B\u5FD8\u4E86\u60A8\u7684\u8D2D\u7269\u8F66",
      "tt_btn": "\u7EE7\u7EED\u7ED3\u8D26"
    }
  }
};} catch (err) {usi_commons.report_error(err);}}
if (typeof usi_11835_json === 'undefined') {try {usi_11835_json = {
  "campaigns": {
    "precapture": [
      {
        "name": "FR-CA Precapture",
        "siteID": "38528",
        "hash": "78qQ7iKExSByA4OHUR5Z5Pp",
        "locales": [
          "fr-CA"
        ],
        "is_email_allowed": true
      },
      {
        "name": "en-EU Precapture",
        "siteID": "38590",
        "hash": "E8bGUH1VkPoAc7TFhMNE5N9",
        "locales": [
          "en-EU"
        ],
        "is_email_allowed": true
      },
      {
        "name": "en-UK Precapture",
        "siteID": "38482",
        "hash": "rlEHcpBCoglucZnPcGngjlt",
        "locales": [
          "en-UK"
        ],
        "is_email_allowed": true,
        "has_fusion": false
      },
      {
        "name": "fr-FR Precapture",
        "siteID": "38588",
        "hash": "3ghEu26zH6mthi935Wdi4iu",
        "locales": [
          "fr-FR"
        ],
        "is_email_allowed": true
      },
      {
        "name": "DE Precapture",
        "siteID": "38586",
        "hash": "G7C7Np8JTwqrOJqB3u6vMdI",
        "locales": [
          "de-DE"
        ],
        "is_email_allowed": true,
        "has_fusion": false
      },
      {
        "name": "IT Precapture",
        "siteID": "38550",
        "hash": "NGP4vhqQbinMNWPWRpSY4pt",
        "locales": [
          "it-IT"
        ],
        "is_email_allowed": true
      },
      {
        "name": "ES Precapture",
        "siteID": "38580",
        "hash": "VQZjzBCKzDoujyMWQWkBGpY",
        "locales": [
          "es-ES"
        ],
        "is_email_allowed": true
      },
      {
        "name": "NL Precapture",
        "siteID": "38572",
        "hash": "jhpcoRkCasRMzEvAAVwpomP",
        "locales": [
          "nl-NL"
        ],
        "is_email_allowed": true
      },
      {
        "name": "PT Precapture",
        "siteID": "38568",
        "hash": "MFsFYGUcGPtJgof85lyyLAw",
        "locales": [
          "pt-PT"
        ],
        "is_email_allowed": true
      },
      {
        "name": "FI Precapture",
        "siteID": "38574",
        "hash": "YrxTN5FIsNSgchu8PVPXjtt",
        "locales": [
          "fi-FI"
        ],
        "is_email_allowed": true
      },
      {
        "name": "HU Precapture",
        "siteID": "38570",
        "hash": "6US3hR66j0efmcg2ZZGhUGx",
        "locales": [
          "hu-HU"
        ],
        "is_email_allowed": true
      },
      {
        "name": "fr-BE Precapture",
        "siteID": "38556",
        "hash": "7IbMBiaKbFzTEcRf9cOVqVD",
        "locales": [
          "fr-BE"
        ],
        "is_email_allowed": true
      },
      {
        "name": "nl-BE Precapture",
        "siteID": "38554",
        "hash": "h8ykCZ9XXox2HsHzgAVFjfH",
        "locales": [
          "nl-BE"
        ],
        "is_email_allowed": true
      },
      {
        "name": "De-CH Precapture",
        "siteID": "38552",
        "hash": "i5UtZoMZKocY9h1RxtBrhgt",
        "locales": [
          "de-CH"
        ],
        "is_email_allowed": true
      },
      {
        "name": "it-CH Precapture",
        "siteID": "38584",
        "hash": "OT1a0eifYz6ze3qrC9TL1jZ",
        "locales": [
          "it-CH"
        ],
        "is_email_allowed": true
      },
      {
        "name": "fr-CH Precapture",
        "siteID": "38548",
        "hash": "6Mpf78iyv2CJKzslySC7MFQ",
        "locales": [
          "fr-CH"
        ],
        "is_email_allowed": true
      },
      {
        "name": "PL Precapture",
        "siteID": "38564",
        "hash": "TUmmg9dJVCY0SwS3ICxwecL",
        "locales": [
          "pl-PL"
        ],
        "is_email_allowed": true
      },
      {
        "name": "NO Precapture",
        "siteID": "38558",
        "hash": "BpGjjCDRWLa4QGYO3W4F5X3",
        "locales": [
          "no-NO"
        ],
        "is_email_allowed": true
      },
      {
        "name": "RU Precapture",
        "siteID": "38578",
        "hash": "nqGNEvnQQvqYqyWAa2brElY",
        "locales": [
          "ru-RU"
        ],
        "is_email_allowed": true
      },
      {
        "name": "TR Precapture",
        "siteID": "38576",
        "hash": "oJanosyxvzBtqz0yJw7NHkr",
        "locales": [
          "tr-TR"
        ],
        "is_email_allowed": true
      },
      {
        "name": "SE Precapture",
        "siteID": "38566",
        "hash": "j2NFPwe6nLX4mHwOE1Q5m0O",
        "locales": [
          "sv-SE"
        ],
        "is_email_allowed": true
      },
      {
        "name": "CZ Precapture",
        "siteID": "38560",
        "hash": "iwnexxOIiyl0c4wPiG1Fr7t",
        "locales": [
          "cs-CZ"
        ],
        "is_email_allowed": true
      },
      {
        "name": "DK Precapture",
        "siteID": "38562",
        "hash": "db6nc8pRzzmUR30bNHos658",
        "locales": [
          "da-DK"
        ],
        "is_email_allowed": true
      },
      {
        "name": "SE Precapture",
        "siteID": "38484",
        "hash": "md2BNUG8WSbvaiC6BvGyfmD",
        "locales": [
          "en-SE"
        ],
        "is_email_allowed": true
      }
    ],
    "view": [
      {
        "name": "UK en-GB | New Return Visitor TT",
        "siteID": "56595",
        "hash": "bMq6O9w6hL4N1S41OCEVgpC",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-GB"
        ],
        "required_cookies": [
          "cartReference",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ],
        "lift": {
          "id": "56623"
        }
      },
      {
        "name": "UK en-SE | New Return Visitor TT",
        "siteID": "56595",
        "hash": "bMq6O9w6hL4N1S41OCEVgpC",
        "key": "{{usi_commons.device}}_{{usi_app.locale}}",
        "return_eligible": true,
        "is_checkout_page": false,
        "locales": [
          "en-SE"
        ],
        "required_cookies": [
          "usi_odm_cart_link",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ],
        "lift": {
          "id": "56623"
        }
      },
      {
        "name": "UK | Cart Preserver LC | Cart Rebuilder",
        "siteID": "53799",
        "hash": "aKqRAJreoT2YVhrXwbQ2WEX",
        "key": "{{usi_commons.device}}_{{usi_app.locale_lc}}",
        "is_checkout_page": false,
        "locales": [
          "en-GB",
          "en-UK",
          "en-SE"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "EMEA | Cart Preserver LC | Cart Rebuilder",
        "siteID": "54441",
        "hash": "aKqRAJreoT2YVhrXwbQ2WEX",
        "key": "{{usi_commons.device}}_{{usi_app.locale_lc}}",
        "is_checkout_page": false,
        "locales": [
          "fr-BE",
          "nl-BE",
          "cs-CZ",
          "da-DK",
          "fi-FI",
          "fr-FR",
          "de-DE",
          "hu-HU",
          "it-IT",
          "nl-NL",
          "no-NO",
          "pl-PL",
          "ru-RU",
          "pt-PT",
          "es-ES",
          "sv-SE",
          "de-CH",
          "it-CH",
          "fr-CH",
          "tr-TR",
          "en-EU",
          "en-NL"
        ],
        "required_cookies": [
          "usi_num_items",
          "usi_prod_price_1",
          "usi_prod_name_1",
          "usi_prod_image_1"
        ]
      },
      {
        "name": "SE DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-SE"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile SE DR payment",
            "siteID": "30153",
            "hash": "Aa42Q40FWvn0GbnP3HpUQN9",
            "device": "mobile"
          },
          {
            "name": "Desktop SE DR payment",
            "siteID": "30143",
            "hash": "sOhme1oOrJywRQ1XZqybhGS",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "TR DR payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "tr-TR"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile TR DR payment",
            "siteID": "30159",
            "hash": "D8DYr4G1qx3gqe95Igch2DF",
            "device": "mobile"
          },
          {
            "name": "Desktop TR DR payment",
            "siteID": "30149",
            "hash": "X4gGtOHjv4sbHM0CNLSpdZn",
            "device": "desktop"
          }
        ]
      },
      {
        "name": "UK GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "en-UK"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | UK GUAC Payment",
            "siteID": "30153",
            "hash": "Aa42Q40FWvn0GbnP3HpUQN9",
            "device": "mobile"
          },
          {
            "name": "Desktop | UK GUAC Payment",
            "siteID": "30143",
            "hash": "sOhme1oOrJywRQ1XZqybhGS",
            "device": "desktop"
          }
        ]
      },
      {
        "is_before": "2000-01-01",
        "name": "EMEA Payment Abandon",
        "device": "mobile",
        "locales": [
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "Mobile | EMEA GUAC Payment",
            "siteID": "30159",
            "hash": "D8DYr4G1qx3gqe95Igch2DF",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "EMEA Survey | Payment Abandon (logged out)",
            "siteID": "30989",
            "hash": "6LeKqgFfDtOT1FOcFXeuvvE",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "name": "IT/DE Payment Abandon | Desktop | AB test (90/10) | Flash Sale",
        "device": "desktop",
        "siteID": "30149",
        "hash": "X4gGtOHjv4sbHM0CNLSpdZn",
        "key": "{{usi_commons.device}}",
        "locales": [
          "it-IT",
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "name": "IT/DE Payment Abandon | Mobile | AB test (90/10) | Flash Sale",
        "device": "mobile",
        "siteID": "30159",
        "hash": "D8DYr4G1qx3gqe95Igch2DF",
        "key": "{{usi_commons.device}}",
        "locales": [
          "it-IT",
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "eligible_flash_sale": true,
        "date_ranges": [
          [
            "2026-03-23T00:00:00-07:00",
            "2026-04-03T23:59:00-07:00"
          ]
        ],
        "required_elements": [
          ".checkout-odm-promotions:not(:has(ul))"
        ],
        "split": {
          "1": {
            "percent": 90,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_20p"
          },
          "2": {
            "percent": 10,
            "key": "{{usi_app.get_payment_key}}_{{usi_app.get_first_plc_from_cart}}_NI"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "EMEA Payment Abandon",
        "device": "desktop",
        "locales": [
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": false,
        "split": {
          "1": {
            "percent": 90,
            "name": "Desktop | EMEA GUAC Payment",
            "siteID": "30149",
            "hash": "X4gGtOHjv4sbHM0CNLSpdZn",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "EMEA Survey | Payment Abandon (logged out)",
            "siteID": "30989",
            "hash": "6LeKqgFfDtOT1FOcFXeuvvE",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_out"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "EMEA Payment Abandon",
        "device": "mobile",
        "locales": [
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "Mobile | EMEA GUAC Payment",
            "siteID": "30159",
            "hash": "D8DYr4G1qx3gqe95Igch2DF",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "EMEA Survey | Payment Abandon (logged out)",
            "siteID": "30989",
            "hash": "6LeKqgFfDtOT1FOcFXeuvvE",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "is_before": "2000-01-01",
        "name": "EMEA Payment Abandon",
        "device": "desktop",
        "locales": [
          "de-DE"
        ],
        "is_checkout_payment_page": true,
        "is_checkout_logged_in": true,
        "split": {
          "1": {
            "percent": 90,
            "name": "Desktop | EMEA GUAC Payment",
            "siteID": "30149",
            "hash": "X4gGtOHjv4sbHM0CNLSpdZn",
            "key": "{{usi_app.get_payment_key}}"
          },
          "2": {
            "percent": 10,
            "name": "EMEA Survey | Payment Abandon (logged out)",
            "siteID": "30989",
            "hash": "6LeKqgFfDtOT1FOcFXeuvvE",
            "key": "{{usi_commons.device}}_{{usi_app.locale}}_logged_in"
          }
        }
      },
      {
        "name": "EMEA GUAC Payment",
        "key": "{{usi_app.get_payment_key}}",
        "locales": [
          "fr-BE",
          "nl-BE",
          "cs-CZ",
          "da-DK",
          "fi-FI",
          "fr-FR",
          "de-DE",
          "hu-HU",
          "it-IT",
          "nl-NL",
          "no-NO",
          "pl-PL",
          "ru-RU",
          "pt-PT",
          "es-ES",
          "sv-SE",
          "de-CH",
          "it-CH",
          "fr-CH",
          "tr-TR",
          "en-EU"
        ],
        "is_checkout_payment_page": true,
        "paySessionId_not_found": true,
        "segments": [
          {
            "name": "Mobile | EMEA GUAC Payment",
            "siteID": "30159",
            "hash": "D8DYr4G1qx3gqe95Igch2DF",
            "device": "mobile"
          },
          {
            "name": "Desktop | EMEA GUAC Payment",
            "siteID": "30149",
            "hash": "X4gGtOHjv4sbHM0CNLSpdZn",
            "device": "desktop"
          }
        ]
      }
    ]
  },
  "aff_links": {
    "en-GB": "https://www.dpbolvw.net/click-2681135-14068235",
    "en-UK": "https://www.dpbolvw.net/click-2681135-14068235",
    "en-SE": "https://www.dpbolvw.net/click-2681135-14535970",
    "en-NL": "https://www.dpbolvw.net/click-2681135-14535970",
    "en-EU": "https://www.anrdoezrs.net/click-2681135-14068240",
    "es-ES": "https://www.dpbolvw.net/click-2681135-14068238",
    "fr-FR": "https://www.dpbolvw.net/click-2681135-14068237",
    "fr-CH": "https://www.jdoqocy.com/click-2681135-14068259",
    "it-IT": "https://www.dpbolvw.net/click-2681135-14068239",
    "it-CH": "https://www.anrdoezrs.net/click-2681135-14068260",
    "pt-PT": "https://www.anrdoezrs.net/click-2681135-14068256",
    "pl-PL": "https://www.jdoqocy.com/click-2681135-14068255",
    "de-DE": "https://www.anrdoezrs.net/click-2681135-14068236",
    "de-CH": "https://www.anrdoezrs.net/click-2681135-14068257",
    "no-NO": "https://www.tkqlhce.com/click-2681135-14068247",
    "nl-NL": "https://www.tkqlhce.com/click-2681135-14068249",
    "nl-BE": "https://www.tkqlhce.com/click-2681135-14068251",
    "fr-BE": "https://www.jdoqocy.com/click-2681135-14068252",
    "ru-RU": "https://www.dpbolvw.net/click-2681135-14068261",
    "tr-TR": "https://www.kqzyfj.com/click-2681135-14068262",
    "sv-SE": "https://www.jdoqocy.com/click-2681135-14068241",
    "fi-FI": "https://www.tkqlhce.com/click-2681135-14068243",
    "hu-HU": "https://www.dpbolvw.net/click-2681135-14068254",
    "cs-CZ": "https://www.jdoqocy.com/click-2681135-14068253",
    "da-DK": "https://www.anrdoezrs.net/click-2681135-14068244"
  },
  "cloud_products_upsell_matrix": {
    "de-DE": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Bauen Sie den CAM-Funktionsumfang von Fusion 360 aus.",
        "cta": "IN DEN WARENKORB LEGEN",
        "region": "EMEA"
      }
    ],
    "en-EU": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO BASKET",
        "region": "EMEA"
      }
    ],
    "it-IT": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Amplia le funzionalit\u00E0 CAM di Fusion 360 con Machining Extension.",
        "cta": "AGGIUNGI AL CARRELLO",
        "region": "EMEA"
      }
    ],
    "fr-FR": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Avec Machining Extension, \u00E9largissez les capacit\u00E9s FAO de Fusion 360.",
        "cta": "AJOUTER AU PANIER",
        "region": "EMEA"
      }
    ],
    "en-UK": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO BASKET",
        "region": "UK"
      }
    ],
    "en-SE": [
      {
        "targets": [
          "F360"
        ],
        "upsell": "F36MEIA",
        "text": "Amplify your Fusion 360 CAM capabilities with the Machining Extension.",
        "cta": "ADD TO CART",
        "region": "UK"
      }
    ]
  },
  "privacy_policy": {
    "en-SE": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "en-UK": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "en-EU": {
      "disclaimer": "We use your information in accordance with our",
      "cta": "Privacy Policy"
    },
    "es-ES": {
      "disclaimer": "Usamos tu informaci\u00F3n de acuerdo con nuestra",
      "cta": "Pol\u00EDtica de Privacidad"
    },
    "fr-BE": {
      "disclaimer": "Nous utilisons vos informations conform\u00E9ment \u00E0 notre",
      "cta": "Politique de Confidentialit\u00E9"
    },
    "fr-FR": {
      "disclaimer": "Nous utilisons vos informations conform\u00E9ment \u00E0 notre",
      "cta": "Politique de Confidentialit\u00E9"
    },
    "fr-CH": {
      "disclaimer": "Nous utilisons vos informations conform\u00E9ment \u00E0 notre",
      "cta": "Politique de Confidentialit\u00E9"
    },
    "de-CH": {
      "disclaimer": "Wir verwenden Ihre Informationen gem\u00E4\u00DF unserer",
      "cta": "Datenschutzrichtlinie"
    },
    "de-DE": {
      "disclaimer": "Wir verwenden Ihre Informationen gem\u00E4\u00DF unserer",
      "cta": "Datenschutzrichtlinie"
    },
    "pt-PT": {
      "disclaimer": "Usamos a sua informa\u00E7\u00E3o de acordo com a nossa",
      "cta": "Pol\u00EDtica de Privacidade"
    },
    "nl-NL": {
      "disclaimer": "Wij gebruiken uw gegevens in overeenstemming met ons",
      "cta": "Privacybeleid"
    },
    "nl-BE": {
      "disclaimer": "Wij gebruiken uw gegevens in overeenstemming met ons",
      "cta": "Privacybeleid"
    },
    "it-CH": {
      "disclaimer": "Utilizziamo le tue informazioni in conformit\u00E0 con la nostra",
      "cta": "Politica sulla Privacy"
    },
    "it-IT": {
      "disclaimer": "Utilizziamo le tue informazioni in conformit\u00E0 con la nostra",
      "cta": "Politica sulla Privacy"
    },
    "tr-TR": {
      "disclaimer": "Bilgilerinizi",
      "cta": "gizlilik politikam\u0131za uygun olarak kullan\u0131yoruz"
    },
    "cs-CZ": {
      "disclaimer": "",
      "cta": "Va\u0161e \u00FAdaje pou\u017E\u00EDv\u00E1me v souladu s na\u0161imi z\u00E1sadami ochrany osobn\u00EDch \u00FAdaj\u016F"
    },
    "da-DK": {
      "disclaimer": "",
      "cta": "Vi bruger information i overensstemmelse med vores Privatlivspolitik"
    },
    "fi-FI": {
      "disclaimer": "",
      "cta": "K\u00E4yt\u00E4mme tietojasi tietosuojak\u00E4yt\u00E4nt\u00F6mme mukaisesti"
    },
    "hu-HU": {
      "disclaimer": "",
      "cta": "Adatait adatv\u00E9delmi szab\u00E1lyzatunknak megfelel\u0151en haszn\u00E1ljuk fel"
    },
    "no-NO": {
      "disclaimer": "",
      "cta": "Vi bruker informasjonen din i samsvar med v\u00E5r personvernpolitikk"
    },
    "pl-PL": {
      "disclaimer": "",
      "cta": "Wykorzystujemy Twoje dane zgodnie z nasz\u0105 polityk\u0105 prywatno\u015Bci"
    },
    "sv-SE": {
      "disclaimer": "",
      "cta": "Vi anv\u00E4nder din information i enlighet med v\u00E5r integritetspolicy"
    }
  },
  "bundle_offers": {
    "FSN_de-DE_1-year": {
      "copy": "ERHALTEN SIE 4 ZUM PREIS VON 3 F\u00F6rdern Sie die Innovationskraft Ihres Teams mit 25 % Rabatt auf vier Fusion-Abonnements.",
      "cta": "JETZT KAUFEN.",
      "url": "{{usi_app.checkout_url}}/de-DE/cart?offers=%5Bcountry%3ADE%3Bcurrency%3AEUR%3BpriceRegionCode%3AE0%3Bquantity%3A4%3BofferingName%3AFusion%3BofferingId%3AOD-002134%3BofferingCode%3AFSN%3BaccessModelCode%3AS%3BtermCode%3AA01%3BintendedUsageCode%3ACOM%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BbillingFrequencyCode%3AB05%3BbillingTypeCode%3AB100%3BbillingBehaviorCode%3AA200%3BservicePlanIdCode%3ASTND%5D&promoCodes=%5BFY27FSN4FOR3%5D&_gl=1*1cfhx1z*_gcl_au*MjkyNDQ0NjQuMTc3MjE1MjQ3MQ..*FPAU*MTQ4NTQ4MjgwOS4xNzY4NDE4ODk3*_ga*MTY2OTczNDI3MS4xNzcyMTQwMjYy*_ga_NZSJ72N6RX*czE3NzIyMTIyNjUkbzckZzEkdDE3NzIyMTI1OTckajUzJGwwJGgw",
      "qty": [
        "1",
        "2",
        "3"
      ]
    },
    "FSN_en-UK_1-year": {
      "copy": "Add more and save 25%. Buy 3 Fusion subscriptions and get the 4th for free.",
      "cta": "Get 4 for 3.",
      "url": "{{usi_app.checkout_url}}/en-GB/cart?offers=%5Bcountry%3AUK%3Bcurrency%3AGBP%3BpriceRegionCode%3AE5%3Bquantity%3A4%3BofferingName%3AFusion%3BofferingId%3AOD-002134%3BofferingCode%3AFSN%3BaccessModelCode%3AS%3BtermCode%3AA01%3BintendedUsageCode%3ACOM%3BconnectivityCode%3AC100%3BconnectivityIntervalCode%3AC04%3BbillingFrequencyCode%3AB05%3BbillingTypeCode%3AB100%3BbillingBehaviorCode%3AA200%3BservicePlanIdCode%3ASTND%5D&promoCodes=%5BFY27FSN4FOR3%5D&_gl=1*vdsruo*_gcl_au*MjkyNDQ0NjQuMTc3MjE1MjQ3MQ..*FPAU*MTQ4NTQ4MjgwOS4xNzY4NDE4ODk3*_ga*MTY2OTczNDI3MS4xNzcyMTQwMjYy*_ga_NZSJ72N6RX*czE3NzIyMTIyNjUkbzckZzEkdDE3NzIyMTI1OTckajUzJGwwJGgw",
      "qty": [
        "1",
        "2",
        "3"
      ]
    },
    "RVTLT_en-EU_1-year": {
      "copy": "For only \u20AC11 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get AutoCAD LT included.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-NL/cart?offers=[country:NL;currency:EUR;offeringCode:RVTLTS;offeringId:OD-000280;offeringName:AutoCAD Revit LT Suite;priceRegionCode:E0;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
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
    "RVTLT_en-UK_1-year": {
      "copy": "For only \u00A310 more per month (billed annually), upgrade to AutoCAD Revit LT Suite and get AutoCAD LT included.",
      "cta": "Upgrade now!",
      "url": "{{usi_app.checkout_url}}/en-GB/cart?offers=[country:GB;currency:GBP;offeringCode:RVTLTS;offeringId:OD-000280;offeringName:AutoCAD Revit LT Suite;priceRegionCode:E5;quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:A01;connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:B05;externalProductCode:null]",
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
    "ACDIST_en-UK_1-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/en-GB?priceIds=27340%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_en-UK_3-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/en-GB?priceIds=33295%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_en-UK_1-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/en-GB?priceIds=27349%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-UK_3-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/en-GB?priceIds=33846%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_en-SE_1-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "https://store.autodesk.com/store/adsk/en_SE/buy/productID.5533762400/quantity.3/OfferID.63351545410/Currency.USD",
      "qty": [
        "2"
      ]
    },
    "ACDIST_en-SE_3-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "https://store.autodesk.com/store/adsk/en_SE/buy/productID.5533762500/quantity.3/OfferID.63351545410/Currency.USD",
      "qty": [
        "2"
      ]
    },
    "ACDLT_en-SE_1-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "https://store.autodesk.com/store/adsk/en_SE/buy/productID.5533762000/quantity.1/OfferID.63351545610/Currency.USD",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-SE_3-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "https://store.autodesk.com/store/adsk/en_SE/buy/productID.5533762100/quantity.1/OfferID.63351545610/Currency.USD",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_en-EU_1-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/europe?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_en-EU_3-year": {
      "copy": "Get 15% off three AutoCAD subscriptions - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/europe?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_en-EU_1-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/europe?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_en-EU_3-year": {
      "copy": "Get 5 subscriptions for the price of 4 - ",
      "cta": "Save now",
      "url": "\"{{usi_app.checkout_url}}/europe?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_fr-BE_1-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-BE?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fr-BE_3-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-BE?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_fr-BE_1-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-BE?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fr-BE_3-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-BE?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_nl-BE_1-year": {
      "copy": "Krijg 15% korting op 3 AutoCAD-abonnementen - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-BE?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_nl-BE_3-year": {
      "copy": "Krijg 15% korting op 3 AutoCAD-abonnementen - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-BE?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_nl-BE_1-year": {
      "copy": "Krijg 5 abonnementen voor de prijs van 4 - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-BE?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_nl-BE_3-year": {
      "copy": "Krijg 5 abonnementen voor de prijs van 4 - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-BE?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_de-DE_1-year": {
      "copy": "15 % Rabatt auf drei AutoCAD-Abonnements - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-DE?priceIds=27633%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_de-DE_3-year": {
      "copy": "15 % Rabatt auf drei AutoCAD-Abonnements - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-DE?priceIds=33329%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_de-DE_1-year": {
      "copy": "Holen Sie sich 5 Abonnements zum Preis von 4 - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-DE?priceIds=27665%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_de-DE_3-year": {
      "copy": "Holen Sie sich 5 Abonnements zum Preis von 4 - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-DE?priceIds=33795%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_fr-FR_1-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-FR?priceIds=27630%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fr-FR_3-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-FR?priceIds=33332%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_fr-FR_1-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-FR?priceIds=27664%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fr-FR_3-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-FR?priceIds=33796%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_it-IT_1-year": {
      "copy": "Ottieni il 15% di sconto su 3 abbonamenti ad AutoCAD - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-IT?priceIds=27629%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_it-IT_3-year": {
      "copy": "Ottieni il 15% di sconto su 3 abbonamenti ad AutoCAD - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-IT?priceIds=33333%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_it-IT_1-year": {
      "copy": "5 abbonamenti al prezzo di 4 - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-IT?priceIds=27666%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_it-IT_3-year": {
      "copy": "5 abbonamenti al prezzo di 4 - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-IT?priceIds=33798%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_es-ES_1-year": {
      "copy": "Descuento de un 15% al comprar 3 suscripciones de AutoCAD - ",
      "cta": "AHORRE AHORA",
      "url": "\"{{usi_app.checkout_url}}/es-ES?priceIds=27632%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_es-ES_3-year": {
      "copy": "Descuento de un 15% al comprar 3 suscripciones de AutoCAD - ",
      "cta": "AHORRE AHORA",
      "url": "\"{{usi_app.checkout_url}}/es-ES?priceIds=33334%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_es-ES_1-year": {
      "copy": "Obtenga 5 suscripciones por el precio de 4 - ",
      "cta": "AHORRE AHORA",
      "url": "\"{{usi_app.checkout_url}}/es-ES?priceIds=27668%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_es-ES_3-year": {
      "copy": "Obtenga 5 suscripciones por el precio de 4 - ",
      "cta": "AHORRE AHORA",
      "url": "\"{{usi_app.checkout_url}}/es-ES?priceIds=33800%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_nl-NL_1-year": {
      "copy": "Krijg 15% korting op 3 AutoCAD-abonnementen - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-NL?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_nl-NL_3-year": {
      "copy": "Krijg 15% korting op 3 AutoCAD-abonnementen - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-NL?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_nl-NL_1-year": {
      "copy": "Krijg 5 abonnementen voor de prijs van 4 - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-NL?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_nl-NL_3-year": {
      "copy": "Krijg 5 abonnementen voor de prijs van 4 - ",
      "cta": "Nu Besparen",
      "url": "\"{{usi_app.checkout_url}}/nl-NL?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_pt-PT_1-year": {
      "copy": "Obtenha 15% de desconto em 3 subscri\u00E7\u00F5es do AutoCAD - ",
      "cta": "Poupe Agora",
      "url": "\"{{usi_app.checkout_url}}/pt-PT?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_pt-PT_3-year": {
      "copy": "Obtenha 15% de desconto em 3 subscri\u00E7\u00F5es do AutoCAD - ",
      "cta": "Poupe Agora",
      "url": "\"{{usi_app.checkout_url}}/pt-PT?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_pt-PT_1-year": {
      "copy": "Obtenha 5 subscri\u00E7\u00F5es pelo pre\u00E7o de 4 - ",
      "cta": "Poupe Agora",
      "url": "\"{{usi_app.checkout_url}}/pt-PT?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_pt-PT_3-year": {
      "copy": "Obtenha 5 subscri\u00E7\u00F5es pelo pre\u00E7o de 4 - ",
      "cta": "Poupe Agora",
      "url": "\"{{usi_app.checkout_url}}/pt-PT?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_no-NO_1-year": {
      "copy": "F\u00E5 15% avslag p\u00E5 tre AutoCAD-abonnementer - ",
      "cta": "SPAR N\u00C5",
      "url": "\"{{usi_app.checkout_url}}/no-NO?priceIds=32268%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_no-NO_3-year": {
      "copy": "F\u00E5 15% avslag p\u00E5 tre AutoCAD-abonnementer - ",
      "cta": "SPAR N\u00C5",
      "url": "\"{{usi_app.checkout_url}}/no-NO?priceIds=32268%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_no-NO_1-year": {
      "copy": "F\u00E5 5 abonnementer for prisen av 4 - ",
      "cta": "SPAR N\u00C5",
      "url": "\"{{usi_app.checkout_url}}/no-NO?priceIds=32244%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_no-NO_3-year": {
      "copy": "F\u00E5 5 abonnementer for prisen av 4 - ",
      "cta": "SPAR N\u00C5",
      "url": "\"{{usi_app.checkout_url}}/no-NO?priceIds=33781%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_sv-SE_1-year": {
      "copy": "F\u00E5 15 % rabatt p\u00E5 3 AutoCAD-prenumerationer - ",
      "cta": "SPARA NU",
      "url": "\"{{usi_app.checkout_url}}/sv-SE?priceIds=30390%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_sv-SE_3-year": {
      "copy": "F\u00E5 15 % rabatt p\u00E5 3 AutoCAD-prenumerationer - ",
      "cta": "SPARA NU",
      "url": "\"{{usi_app.checkout_url}}/sv-SE?priceIds=33317%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_sv-SE_1-year": {
      "copy": "F\u00E5 5 prenumerationer till priset av 4 - ",
      "cta": "SPARA NU",
      "url": "\"{{usi_app.checkout_url}}/sv-SE?priceIds=30425%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_sv-SE_3-year": {
      "copy": "F\u00E5 5 prenumerationer till priset av 4 - ",
      "cta": "SPARA NU",
      "url": "\"{{usi_app.checkout_url}}/sv-SE?priceIds=33833%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_da-DK_1-year": {
      "copy": "F\u00E5 15% rabat p\u00E5 tre AutoCAD-abonnementer - ",
      "cta": "Spar Nu",
      "url": "\"{{usi_app.checkout_url}}/da-DK?priceIds=30388%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_da-DK_3-year": {
      "copy": "F\u00E5 15% rabat p\u00E5 tre AutoCAD-abonnementer - ",
      "cta": "Spar Nu",
      "url": "\"{{usi_app.checkout_url}}/da-DK?priceIds=33313%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_da-DK_1-year": {
      "copy": "F\u00E5 fem abonnementer - ",
      "cta": "Spar Nu",
      "url": "\"{{usi_app.checkout_url}}/da-DK?priceIds=30423%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_da-DK_3-year": {
      "copy": "F\u00E5 fem abonnementer - ",
      "cta": "Spar Nu",
      "url": "\"{{usi_app.checkout_url}}/da-DK?priceIds=33830%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_fi-FI_1-year": {
      "copy": "15 %:n alennus kolmesta AutoCAD-tilauksesta - ",
      "cta": "S\u00C4\u00C4ST\u00C4 NYT",
      "url": "\"{{usi_app.checkout_url}}/fi-FI?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fi-FI_3-year": {
      "copy": "15 %:n alennus kolmesta AutoCAD-tilauksesta - ",
      "cta": "S\u00C4\u00C4ST\u00C4 NYT",
      "url": "\"{{usi_app.checkout_url}}/fi-FI?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_fi-FI_1-year": {
      "copy": "Hanki viisi tilausta nelj\u00E4n hinnalla - ",
      "cta": "S\u00C4\u00C4ST\u00C4 NYT",
      "url": "\"{{usi_app.checkout_url}}/fi-FI?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fi-FI_3-year": {
      "copy": "Hanki viisi tilausta nelj\u00E4n hinnalla - ",
      "cta": "S\u00C4\u00C4ST\u00C4 NYT",
      "url": "\"{{usi_app.checkout_url}}/fi-FI?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_pl-PL_1-year": {
      "copy": "Zyskaj 15% zni\u017Cki na 3 subskrypcje AutoCAD - ",
      "cta": "ZAOSZCZ\u0118D\u0179",
      "url": "\"{{usi_app.checkout_url}}/pl-PL?priceIds=30389%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_pl-PL_3-year": {
      "copy": "Zyskaj 15% zni\u017Cki na 3 subskrypcje AutoCAD - ",
      "cta": "ZAOSZCZ\u0118D\u0179",
      "url": "\"{{usi_app.checkout_url}}/pl-PL?priceIds=33321%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_pl-PL_1-year": {
      "copy": "5 subskrypcji w cenie 4 - ",
      "cta": "ZAOSZCZ\u0118D\u0179",
      "url": "\"{{usi_app.checkout_url}}/pl-PL?priceIds=30424%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_pl-PL_3-year": {
      "copy": "5 subskrypcji w cenie 4 - ",
      "cta": "ZAOSZCZ\u0118D\u0179",
      "url": "\"{{usi_app.checkout_url}}/pl-PL?priceIds=33831%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_cs-CZ_1-year": {
      "copy": "Z\u00EDskejte 15% slevu za 3 p\u0159edplatn\u00E1 aplikace Autodesk - ",
      "cta": "CHCI \u0160ET\u0158IT",
      "url": "\"{{usi_app.checkout_url}}/cs-CZ?priceIds=32094%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_cs-CZ_3-year": {
      "copy": "Z\u00EDskejte 15% slevu za 3 p\u0159edplatn\u00E1 aplikace Autodesk - ",
      "cta": "CHCI \u0160ET\u0158IT",
      "url": "\"{{usi_app.checkout_url}}/cs-CZ?priceIds=33366%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_cs-CZ_1-year": {
      "copy": "Z\u00EDskejte 5 p\u0159edplatn\u00FDch za cenu 4 - ",
      "cta": "CHCI \u0160ET\u0158IT",
      "url": "\"{{usi_app.checkout_url}}/cs-CZ?priceIds=32153%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_cs-CZ_3-year": {
      "copy": "Z\u00EDskejte 5 p\u0159edplatn\u00FDch za cenu 4 - ",
      "cta": "CHCI \u0160ET\u0158IT",
      "url": "\"{{usi_app.checkout_url}}/cs-CZ?priceIds=33777%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_hu-HU_1-year": {
      "copy": "15% kedvezm\u00E9ny 3 AutoCAD-el\u0151fizet\u00E9sre - ",
      "cta": "TAKAR\u00CDTSON MEG MOST",
      "url": "\"{{usi_app.checkout_url}}/hu-HU?priceIds=27631%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_hu-HU_3-year": {
      "copy": "15% kedvezm\u00E9ny 3 AutoCAD-el\u0151fizet\u00E9sre - ",
      "cta": "TAKAR\u00CDTSON MEG MOST",
      "url": "\"{{usi_app.checkout_url}}/hu-HU?priceIds=33327%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_hu-HU_1-year": {
      "copy": "5 el\u0151fizet\u00E9s 4 \u00E1r\u00E1\u00E9rt - ",
      "cta": "TAKAR\u00CDTSON MEG MOST",
      "url": "\"{{usi_app.checkout_url}}/hu-HU?priceIds=27667%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_hu-HU_3-year": {
      "copy": "5 el\u0151fizet\u00E9s 4 \u00E1r\u00E1\u00E9rt - ",
      "cta": "TAKAR\u00CDTSON MEG MOST",
      "url": "\"{{usi_app.checkout_url}}/hu-HU?priceIds=33791%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_tr-TR_1-year": {
      "copy": "3 AutoCAD aboneli\u011Fini %15'e varan indirimle al\u0131n - ",
      "cta": "TASARRUF ET",
      "url": "https://store.autodesk.com/store/adsk/tr_TR/buy/productID.5774389300/quantity.3/OfferID.63552039920/Currency.TRY",
      "qty": [
        "2"
      ]
    },
    "ACDIST_tr-TR_3-year": {
      "copy": "3 AutoCAD aboneli\u011Fini %15'e varan indirimle al\u0131n - ",
      "cta": "TASARRUF ET",
      "url": "https://store.autodesk.com/store/adsk/tr_TR/buy/productID.5774389400/quantity.3/OfferID.63552039920/Currency.TRY",
      "qty": [
        "2"
      ]
    },
    "ACDLT_tr-TR_1-year": {
      "copy": "4 abonelik fiyat\u0131na 5 abonelik edinin - ",
      "cta": "TASARRUF ET",
      "url": "https://store.autodesk.com/store/adsk/tr_TR/buy/productID.5774389600/quantity.5/OfferID.63552040120/Currency.TRY",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_tr-TR_3-year": {
      "copy": "4 abonelik fiyat\u0131na 5 abonelik edinin - ",
      "cta": "TASARRUF ET",
      "url": "https://store.autodesk.com/store/adsk/tr_TR/buy/productID.5774389700/quantity.5/OfferID.63552040120/Currency.TRY",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_de-CH_1-year": {
      "copy": "15 % Rabatt auf drei AutoCAD-Abonnements - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-CH?priceIds=30386%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_de-CH_3-year": {
      "copy": "15 % Rabatt auf drei AutoCAD-Abonnements - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-CH?priceIds=33300%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_de-CH_1-year": {
      "copy": "Holen Sie sich 5 Abonnements zum Preis von 4 - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-CH?priceIds=30421%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_de-CH_3-year": {
      "copy": "Holen Sie sich 5 Abonnements zum Preis von 4 - ",
      "cta": "Jetzt sparen",
      "url": "\"{{usi_app.checkout_url}}/de-CH?priceIds=33824%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_fr-CH_1-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-CH?priceIds=30386%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_fr-CH_3-year": {
      "copy": "\u00C9conomisez 15 % sur 3 abonnements AutoCAD - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-CH?priceIds=33300%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_fr-CH_1-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-CH?priceIds=30421%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_fr-CH_3-year": {
      "copy": "5 abonnements pour le prix de 4 - ",
      "cta": "J\u00B4en profite",
      "url": "\"{{usi_app.checkout_url}}/fr-CH?priceIds=33824%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDIST_it-CH_1-year": {
      "copy": "Ottieni il 15% di sconto su 3 abbonamenti ad AutoCAD - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-CH?priceIds=30386%5Bqty:3%5D&promoCodes=3PACK1YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDIST_it-CH_3-year": {
      "copy": "Ottieni il 15% di sconto su 3 abbonamenti ad AutoCAD - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-CH?priceIds=33300%5Bqty:3%5D&promoCodes=3PACK3YEMEA&plc=ACDIST\"",
      "qty": [
        "2"
      ]
    },
    "ACDLT_it-CH_1-year": {
      "copy": "5 abbonamenti al prezzo di 4 - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-CH?priceIds=30421%5Bqty:5%5D&promoCodes=LT5PACK1YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    },
    "ACDLT_it-CH_3-year": {
      "copy": "5 abbonamenti al prezzo di 4 - ",
      "cta": "Risparmia Ora",
      "url": "\"{{usi_app.checkout_url}}/it-CH?priceIds=33824%5Bqty:5%5D&promoCodes=LT5PACK3YEMEA&plc=ACDLT\"",
      "qty": [
        "2",
        "3",
        "4"
      ]
    }
  },
  "email_info": {
    "en-GB": {
      "link": "/en-GB?mktvar002=afc_gb_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-UK": {
      "link": "/en-GB?mktvar002=afc_gb_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-SE": {
      "link": "/store?Action=DisplayPage&Locale=en-SE&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_ae_usi_email&usi_var002=afc_ae_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "en-EU": {
      "link": "/europe?mktvar002=afc_eu_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "In A Hurry?",
      "optin_desc": "Please email me the contents of my cart.",
      "optin_ok": "OK",
      "tt_head": "Don't leave your cart behind!",
      "tt_btn": "CONTINUE CHECKOUT"
    },
    "es-ES": {
      "link": "/es-ES?mktvar002=afc_es_usi_email",
      "from_name": "Autodesk tienda online",
      "optin_head": "\u00BFTienes Prisa?",
      "optin_desc": "Quiero recibir por email el contenido de mi carrito.",
      "optin_ok": "Enviar ahora",
      "tt_head": "No olvide su carrito",
      "tt_btn": "CONTIN\u00DAE EL PROCESO DE COMPRA"
    },
    "fr-FR": {
      "link": "/fr-FR?mktvar002=afc_fr_usi_email",
      "from_name": "Autodesk Boutique en ligne",
      "optin_head": "Vous \u00EAtes press\u00E9?",
      "optin_desc": "Nous pouvons vous envoyer le contenu de votre panier par e-mail.",
      "optin_ok": "OK",
      "tt_head": "N\u2019abandonnez pas votre panier",
      "tt_btn": "PROCEDEZ AU PAIEMENT"
    },
    "fr-CH": {
      "link": "/fr-CH?mktvar002=afc_frch_usi_email",
      "from_name": "Autodesk Boutique en ligne",
      "optin_head": "Vous \u00EAtes press\u00E9?",
      "optin_desc": "Nous pouvons vous envoyer le contenu de votre panier par e-mail.",
      "optin_ok": "OK",
      "tt_head": "N\u2019abandonnez pas votre panier",
      "tt_btn": "PROCEDEZ AU PAIEMENT"
    },
    "it-IT": {
      "link": "/it-IT?mktvar002=afc_it_usi_email",
      "from_name": "Autodesk negozio online",
      "optin_head": "Hai fretta?",
      "optin_desc": "Inviami il contenuto del carrello tramite e-mail.",
      "optin_ok": "OK",
      "tt_head": "Non perdere il carrello",
      "tt_btn": "PROSEGUI CON L\u2019ACQUISTO"
    },
    "it-CH": {
      "link": "/it-CH?mktvar002=afc_itch_usi_email",
      "from_name": "Autodesk negozio online",
      "optin_head": "Hai fretta?",
      "optin_desc": "Inviami il contenuto del carrello tramite e-mail.",
      "optin_ok": "OK",
      "tt_head": "Non perdere il tuo carrello",
      "tt_btn": "PROSEGUI CON IL CHECKOUT"
    },
    "pt-PT": {
      "link": "/pt-PT?mktvar002=afc_pt_usi_email",
      "from_name": "Suporte Autodesk",
      "optin_head": "Est\u00E1 com pressa?",
      "optin_desc": "Por favor, enviem-me por e-mail o conte\u00FAdo do meu carrinho.",
      "optin_ok": "OK",
      "tt_head": "N\u00E3o deixe o seu carrinho para tr\u00E1s",
      "tt_btn": "CONTINUAR A COMPRA"
    },
    "pl-PL": {
      "link": "/pl-PL?mktvar002=afc_pl_usi_email",
      "from_name": "Pomoc techniczna Autodesk",
      "optin_head": "\u015Apieszysz si\u0119?",
      "optin_desc": "Prosz\u0119 wys\u0142a\u0107 mi zawarto\u015B\u0107 koszyka w wiadomo\u015Bci e-mail.",
      "optin_ok": "OK",
      "tt_head": "Nie porzucaj swojego koszyka",
      "tt_btn": "PRZEJD\u0179 DO REALIZACJI ZAM\u00D3WIENIA"
    },
    "de-DE": {
      "link": "/de-DE?mktvar002=afc_de_usi_email",
      "from_name": "Autodesk Online-Shop",
      "optin_head": "Ben\u00F6tigen Sie mehr Zeit?",
      "optin_desc": "Bitte schicken Sie mir den Inhalt meines Einkaufswagens per E-Mail.",
      "optin_ok": "OK",
      "tt_head": "Lassen Sie den Warenkorb nicht zur\u00FCck",
      "tt_btn": "BEZAHLEN FORTSETZEN"
    },
    "de-CH": {
      "link": "/de-CH?mktvar002=afc_de_usi_email",
      "from_name": "Autodesk Online-Shop",
      "optin_head": "Ben\u00F6tigen Sie mehr Zeit?",
      "optin_desc": "Bitte schicken Sie mir den Inhalt meines Einkaufswagens per E-Mail.",
      "optin_ok": "OK",
      "tt_head": "Lassen Sie den Warenkorb nicht zur\u00FCck",
      "tt_btn": "BEZAHLEN FORTSETZEN"
    },
    "no-NO": {
      "link": "/no-NO?mktvar002=afc_no_usi_email",
      "from_name": "Autodesk-st\u00F8tte",
      "optin_head": "Har det travelt?",
      "optin_desc": "Send meg en e-post om innholdet i handlevognen min.",
      "optin_ok": "OK",
      "tt_head": "Ikke glem handlekurven din",
      "tt_btn": "TILBAKE TIL KASSA"
    },
    "nl-NL": {
      "link": "/nl-NL?mktvar002=afc_nl_usi_email",
      "from_name": "Autodesk-helpdesk",
      "optin_head": "Heeft u haast?",
      "optin_desc": "E-mail mij de inhoud van mijn winkelwagentje.",
      "optin_ok": "OK",
      "tt_head": "Vergeet Uw Winkelwagen niet",
      "tt_btn": "DOORGAAN MET AFREKENEN"
    },
    "nl-BE": {
      "link": "/nl-BE?mktvar002=afc_nlbe_usi_email",
      "from_name": "Autodesk-helpdesk",
      "optin_head": "Heeft u haast?",
      "optin_desc": "E-mail mij de inhoud van mijn winkelwagentje.",
      "optin_ok": "OK",
      "tt_head": "Vergeet Uw Winkelwagen niet",
      "tt_btn": "DOORGAAN MET AFREKENEN"
    },
    "fr-BE": {
      "link": "/fr-BE?mktvar002=afc_frbe_usi_email",
      "from_name": "Autodesk Boutique en ligne",
      "optin_head": "Vous \u00EAtes press\u00E9?",
      "optin_desc": "Nous pouvons vous envoyer le contenu de votre panier par e-mail.",
      "optin_ok": "OK",
      "tt_head": "N\u2019abandonnez pas votre panier",
      "tt_btn": "PROCEDEZ AU PAIEMENT"
    },
    "ru-RU": {
      "link": "/ru-RU?mktvar002=afc_ru_usi_email",
      "from_name": "\u0421\u043B\u0443\u0436\u0431\u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432 Autodesk",
      "optin_head": "\u041D\u0443\u0436\u043D\u043E \u0431\u043E\u043B\u044C\u0448\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u0438?",
      "optin_desc": "\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430 \u043F\u043E\u0448\u043B\u0438\u0442\u0435 \u043C\u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u043C\u043E\u0435\u0439 \u043A\u043E\u0440\u0437\u0438\u043D\u044B",
      "optin_ok": "\u0414\u0410",
      "tt_head": "\u0412 \u0432\u0430\u0448\u0435\u0439 \u043A\u043E\u0440\u0437\u0438\u043D\u0435 \u043E\u0441\u0442\u0430\u043B\u0438\u0441\u044C \u0437\u0430\u043A\u0430\u0437\u044B",
      "tt_btn": "\u041F\u0420\u041E\u0414\u041E\u041B\u0416\u0418\u0422\u042C \u041E\u0424\u041E\u0420\u041C\u041B\u0415\u041D\u0418\u0415 \u0417\u0410\u041A\u0410\u0417\u0410"
    },
    "tr-TR": {
      "link": "/store?Action=DisplayPage&Locale=tr_TR&SiteID=adsk&id=QuickBuyCartPage&mktvar002=afc_tr_usi_email",
      "from_name": "Autodesk m\u00FC\u015Fteri hizmetleri ekibi",
      "optin_head": "Daha fazla zamana ihtiyac\u0131m\u0131z var?",
      "optin_desc": "Sepetin i\u00E7eri\u011Finideki ileri e-postaya g\u00F6nderin l\u00FCtfen",
      "optin_ok": "Tamam",
      "tt_head": "Sepetinizi Geride B\u0131rakmay\u0131n",
      "tt_btn": "\u00D6DEMEYE DEVAM ET"
    },
    "sv-SE": {
      "link": "/sv-SE?mktvar002=afc_se_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "Har du br\u00E5ttom?",
      "optin_desc": "Mejla mig inneh\u00E5llet i min kundvagn.",
      "optin_ok": "OK",
      "tt_head": "\u00D6verge inte din kundvagn",
      "tt_btn": "FORTS\u00C4TT CHECKA UT"
    },
    "fi-FI": {
      "link": "/fi-FI?mktvar002=afc_fi_usi_email{{usi_pids}}",
      "from_name": "Autodesk-tuki",
      "optin_head": "Onko sinulla kiire?",
      "optin_desc": "L\u00E4het\u00E4 minulle ostoskorini sis\u00E4lt\u00F6 s\u00E4hk\u00F6postilla.",
      "optin_ok": "OK",
      "tt_head": "\u00C4l\u00E4 j\u00E4t\u00E4 ostoskoria taaksesi",
      "tt_btn": "JATKA KASSALLE"
    },
    "hu-HU": {
      "link": "/hu-HU?mktvar002=afc_hu_usi_email",
      "from_name": "Autodesk t\u00E1mogat\u00E1s",
      "optin_head": "Siet?",
      "optin_desc": "K\u00E9rem, k\u00FCldj\u00E9k el e-mailben a kosaram tartalm\u00E1t.",
      "optin_ok": "OK",
      "tt_head": "Ne hagyja el a kosar\u00E1t",
      "tt_btn": "FEJEZZE BE A V\u00C1S\u00C1RL\u00C1ST"
    },
    "cs-CZ": {
      "link": "/cs-CZ?mktvar002=afc_cz_usi_email",
      "from_name": "Podpora spole\u010Dnosti Autodesk",
      "optin_head": "M\u00E1te nasp\u011Bch?",
      "optin_desc": "Za\u0161lete mi e-mailem obsah ko\u0161\u00EDku.",
      "optin_ok": "OK",
      "tt_head": "Nenechte sv\u016Fj voz\u00EDk zapadnout prachem",
      "tt_btn": "POKRA\u010COVAT S PLACEN\u00CDM"
    },
    "da-DK": {
      "link": "/da-DK?mktvar002=afc_dk_usi_email",
      "from_name": "Autodesk Support",
      "optin_head": "Har du travlt?",
      "optin_desc": "Email mig venligst indholdet i min kurv.",
      "optin_ok": "OK",
      "tt_head": "Efterlad ikke din kurv",
      "tt_btn": "FORTS\u00C6T TIL CHECKOUT"
    }
  }
};} catch (err) {usi_commons.report_error(err);}}

usi_parent_domain = document.domain.replace("store.", "").replace("cart.", "").replace("checkout.", "").replace("www.", "");
if (window.usi_app === undefined && window === window.parent) {
	try {
		if (typeof usi_cookies !== "undefined") {
			usi_cookies.max_cookies_count = 50;
		}
		usi_app = {};
		usi_app.is_storage_supported = function (type) {
			try {
				window[type].setItem('usi_' + type, '1');
				window[type].removeItem('usi_' + type);
				return true;
			} catch (e) {
				return false;
			}
		}
		usi_app.encode_link = function (dest, locale) {
			if (locale == "en-MY") return encodeURIComponent(encodeURIComponent(dest + "&usi_pids=")) + encodeURIComponent("{{usi_pids}}");
			else return encodeURIComponent(encodeURIComponent("https://" + document.domain + dest + "&usi_pids=")) + encodeURIComponent("{{usi_pids}}");
		};
		usi_app.aff_links = usi_company_json.aff_links;
		usi_app.privacy_policy = usi_company_json.privacy_policy;
		usi_app.checkout_url = "https://checkout.autodesk.com";
		if (location.href.indexOf("https://checkout-pt.autodesk.com/") != -1 || location.href.indexOf("https://www-pt.autodesk.com/") != -1) {
			usi_app.checkout_url = "https://checkout-pt.autodesk.com";
		}

		usi_app.main = function () {
			try {

				// Suppress all USI solutions
				if (usi_commons.gup_or_get_cookie("usi_suppress_all", usi_cookies.expire_time.minute * 10, true)) {
					usi_commons.log('[ main ] Suppressing all USI code...');
					return;
				}

				// Suppress on invalid docs
				if (typeof window['document'] === "undefined") {
					usi_commons.log('[ main ] Suppressing due to invalid window object...');
					return;
				}

				// Suppress on invalid session storage
				if (!usi_app.is_storage_supported('sessionStorage')) {
					usi_commons.log('[ main ] Suppressing due to invalid session storage...');
					return;
				}

				// General
				usi_app.company_id = "3614";
				usi_app.recommendation_site_product = "61603";
				usi_app.url = location.href.toLowerCase();
				usi_app.path_name = location.pathname.toLowerCase();
				usi_app.product_page_data = {};
				usi_app.products = [];
				usi_app.pids_in_cart = "";
				usi_app.plcs_in_cart = [];
				usi_app.cart_reference = "";
				usi_app.loading = 0;
				usi_app.upsell_inpage = {};
				usi_app.plc = '';
				usi_app.upsell_plcs = ['3DSMAX', 'AECCOL', 'ACD', 'ACDIST', 'ACDLT', 'ACDLTM', 'RVTLTS', 'CIV3D', 'MAYA', 'MAYALT', 'MECOLL', 'PDCOLL', 'RVT', 'RVTLT', 'FSN'];
				usi_app.upsell_plcs_monthly = ['3DSMAX', 'AECCOL', 'ACD', 'ACDIST', 'ACDLT', 'ACDLTM', 'RVTLTS', 'CIV3D', 'MAYA', 'MAYALT', 'MECOLL', 'PDCOLL', 'RVT', 'RVTLT'];
				usi_app.upsell_plcs_monthly_new = ['ACDIST', 'ACDLT', 'FSN'];
				usi_app.upsell_key = '';
				usi_app.scrape_odm_cart_counter = 1;
				usi_app.summer_promo = false;
				usi_app.save_cart_data_after_injection = true;

				// Check KR CJ Suppressions
				usi_app.kr_pid_suppressions = ['100407173', '100407533', '100407518', '100407533', '100407521', '100407499', '100408074', '100408167', '100407449', '5813072', '100408056', '100435345', '5809536', '100407445', '5819192', '100415360', '100431256', '100431260', '100431261', '100431262', '100431265', '100431266', '100431267', '5810411', '100407173', '100435891', '100435905', '5815207', '100415282', '100431247', '100431251', '100431252', '5812054', '100407495', '100445865', '100445867', '100445868', '100445869', '5812221', '100407518', '100434019', '100434022', '100434023', '5812033', '100407533', '100431263', '100435364', '100435365', '100435366', '100435367', '5809348', '100407521', '100431326', '5812036', '100407499', '5812303', '100408074', '5815382', '100417119', '100432005', '5915879', '100477338', '100480086', '100480089', '100480090', '100480097', '5909077', '100472462', '5813123', '100408167', '5901938', '100468771', '100477373', '5949385', '100498922', '100498924', '5812231', '100415381', '5812038', '100407449', '5920717', '100480010', '5914746', '100476550'];
				usi_app.url_pid = usi_commons.gup('pid') || usi_commons.gup('PID');
				if (usi_app.url_pid && usi_app.kr_pid_suppressions.indexOf(usi_app.url_pid) !== -1) {
					usi_cookies.set('usi_suppress_kr', '1', usi_cookies.expire_time.week, true);
				}

				// Flags
				usi_app.multiple_fusion_extensions_in_cart = false;
				
				usi_app.is_inpage_lift_test_bypass = false;
				usi_app.is_inpage_device_check_bypass = false;
				usi_app.is_product_upgrade_inpage = false;
				usi_app.is_fusion_extension = false;
				usi_app.suppress_delay_load = false;
				usi_app.force_date = usi_commons.gup_or_get_cookie('usi_force_date');
				usi_app.is_enabled = usi_commons.gup_or_get_cookie("usi_enable", usi_cookies.expire_time.hour, true) != "";
				usi_app.is_forced = usi_commons.gup_or_get_cookie("usi_force", usi_cookies.expire_time.hour, true) != "";
				usi_app.force_group = usi_commons.gup_or_get_cookie('usi_force_group');
				usi_app.should_rebuild = usi_cookies.get("usi_redirect_happened") == null && usi_commons.gup("usi_pids") != "" && document.querySelector(".dr_emptyCart, .empty-cart-copy, .checkout--empty-cart--text") != null;
				usi_app.clear_cart_in_progress = false;
				usi_app.is_logged_out = (document.querySelector(".uh-me-menu-sign-in-text") != null && document.querySelector(".uh-me-menu-sign-in-text").textContent.trim() != "") || (document.querySelector(".account.wrapAccordion .accordion") != null && document.querySelector(".account.wrapAccordion .accordion").classList.contains("active"));
				usi_app.is_checkout_logged_in = sessionStorage.getItem('profile') !== null;
				usi_app.is_return_visitor = usi_app.check_if_return_visitor() || usi_commons.gup_or_get_cookie('usi_force_return_visitor') !== '';

				// Regions
				usi_app.americas = ["en-US", "en-CA", "fr-CA", "es-MX", "es-MX", "pt-BR", "es-AR"];
				usi_app.northamerica = ["en-US", "en-CA", "fr-CA", "es-MX"];
				usi_app.emea = ["fr-BE", "nl-BE", "cs-CZ", "da-DK", "fi-FI", "fr-FR", "de-DE", "hu-HU", "it-IT", "nl-NL", "no-NO", "pl-PL", "ru-RU", "pt-PT", "es-ES", "sv-SE", "de-CH", "it-CH", "fr-CH", "tr-TR", "en-EU", "en-NL"];
				usi_app.emea_uk = ["fr-BE", "nl-BE", "cs-CZ", "da-DK", "fi-FI", "fr-FR", "de-DE", "hu-HU", "it-IT", "nl-NL", "no-NO", "pl-PL", "ru-RU", "pt-PT", "es-ES", "sv-SE", "de-CH", "it-CH", "fr-CH", "tr-TR", "en-EU", "en-UK", "en-SE"];
				usi_app.anz = ["en-NZ", "en-AU"];
				usi_app.uk = ["en-UK", "en-SE", "en-GB"]; // en-SE is Middle East (new)
				usi_app.apac = ["en-MY", "en-SG", "ja-JP", "ko-KR", "en-IN", "zh-CN"];
				usi_app.latinamerica = ["es-MX", "pt-BR", "es-AR"]; // Latin America locales are included in Americas
				usi_app.cb_checkout_countries = ["zh-CN", "en-SE", "es-MX", "es-AR", "pt-BR", "en-MY", "en-SG", "en-IN", "ko-KR", "tr-TR"];

				// Pages & cart types
				usi_app.is_cb_cart = document.querySelector('#cleverCart') != null;
				usi_app.is_product_page = usi_app.url.match("/products/") != null;
				usi_app.is_renewal_cart_page = location.href.indexOf("adskeren") != -1;
				usi_app.is_confirmation_page = usi_app.url.indexOf("order-confirmation") != -1;
				usi_app.efulfilment = document.getElementsByClassName("dr_legalResellerStatement")[0] != null && document.getElementsByClassName("dr_legalResellerStatement")[0].textContent.toLowerCase().indexOf("efulfilment") != -1;
				usi_app.guac_cart = (usi_app.url.indexOf("checkout.autodesk.com/") != -1 || usi_app.url.indexOf("commerce.autodesk.com/") != -1 || usi_app.url.indexOf("commerce-stg.autodesk.com/") != -1 || usi_app.url.indexOf("checkout-pt.autodesk") != -1) && !usi_app.is_cb_cart;
				usi_app.dr_cart = usi_app.url.indexOf("action=displaypage") != -1 && usi_app.url.indexOf("thankyoupage") == -1;
				usi_app.dr_cart_available = document.getElementsByClassName('product-row').length > 0;
				usi_app.is_checkout_page = usi_app.url.indexOf("checkout.autodesk") != -1 || usi_app.url.indexOf("commerce.autodesk") != -1 || usi_app.url.indexOf("store.autodesk") != -1 || usi_app.url.indexOf("checkout-pt.autodesk") != -1;
				usi_app.is_first_checkout_page = typeof window['utag'] != 'undefined' && typeof window['utag']['data'] != 'undefined' && typeof window['utag']['data']['page_name'] != 'undefined' && window['utag']['data']['page_name'].indexOf('cart details') != -1;
				usi_app.is_aec_collections_page = usi_app.url.indexOf('/collections/architecture-engineering-construction/overview') != -1;
				usi_app.is_me_collections_page = usi_app.url.indexOf('/collections/media-entertainment/overview') != -1;
				usi_app.is_pdm_collections_page = usi_app.url.indexOf('/collections/product-design-manufacturing/overview') != -1;
				usi_app.is_acd_page = usi_app.url.indexOf('/products/autocad/overview') != -1;
				usi_app.is_acdlt_page = usi_app.url.indexOf('/products/autocad-lt/overview') != -1;
				usi_app.is_odm_cart = document.querySelector('div.odm-cart-section') != null;

				usi_app.is_staging = usi_app.url.indexOf('www-pt.autodesk.com') != -1 || usi_app.url.indexOf('checkout-pt.autodesk.com') != -1 || usi_app.url.indexOf('checkout-apollo.autodesk.com') != -1;

				if (usi_app.is_confirmation_page) {
					usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?autodesk_confirmation_url=" + encodeURIComponent(location.href));
				}

				if (usi_app.is_staging && !usi_app.is_enabled) {
					return;
				}

				// suppressing indie cart pages
				if (usi_app.url.indexOf("indie-cart") != -1) {
					return usi_commons.log("[usi_app.main] Suppressing indie-cart page");
				}

				// ODM cart rebuilder link [en-AU, en-NZ, en-US, en-CA, fr-CA]
				if (usi_commons.gup("usi_offers") && document.querySelector(".dr_emptyCart, .empty-cart-copy, .checkout--empty-cart--text") != null) {
					location.href = location.href.replace("usi_offers", "offers");
				}

				// Saving usi_email_id cookie on CB cart page
				if (usi_app.is_cb_cart && usi_cookies.get("usi_email_id") != null && usi_cookies.get("usi_cb_email_id_created") == null) {
					usi_cookies.create_nonencoded_cookie("usi_cb_email_id_created", "1", usi_cookies.expire_time.week);
					usi_cookies.create_nonencoded_cookie('usi_email_id', usi_cookies.get("usi_email_id"), usi_cookies.expire_time.week);
				}

				if (document.referrer.indexOf("autodesk.com") == -1) {
					if ((/cjevent/i).test(location.href) || (/cfclick/i).test(location.href)) {
						usi_cookies.set("usi_aff_suppress", "1", usi_cookies.expire_time.two_weeks, true);
					}
				}

				// Suppressing all campaigns on CB checkout page
				if (usi_app.is_cb_cart) return usi_commons.log("[ main ] suppress all campaigns on CB checkout page");

				// Settings
				usi_app.locale = usi_app.get_locale();
				if (usi_app.americas.indexOf(usi_app.locale) != -1) {
					window.usi_company_json =  {...usi_company_json, ...usi_11831_json};
				} else if (usi_app.apac.indexOf(usi_app.locale) != -1 || usi_app.anz.indexOf(usi_app.locale) != -1) {
					window.usi_company_json =  {...usi_company_json, ...usi_11833_json};
				} else if (usi_app.emea.indexOf(usi_app.locale) != -1 || usi_app.uk.indexOf(usi_app.locale) != -1) {
					window.usi_company_json =  {...usi_company_json, ...usi_11835_json};
				}

				usi_app.bundle_offers = usi_company_json.bundle_offers;
				for (var usi_bo in usi_app.bundle_offers) {
					if (usi_app.bundle_offers[usi_bo] && usi_app.bundle_offers[usi_bo].url.match(/{{usi_app.checkout_url}}/)) {
						usi_app.bundle_offers[usi_bo].url = usi_app.bundle_offers[usi_bo].url.replace(/{{usi_app.checkout_url}}/, usi_app.checkout_url)
					}
				}

				usi_app.aff_links = usi_company_json.aff_links;
				usi_app.email_info = usi_company_json.email_info;
				for (var usi_ei in usi_app.email_info) {
					if (usi_app.email_info[usi_ei] && usi_app.aff_links[usi_ei] && usi_app.email_info[usi_ei].link) {
						if (usi_app.email_info[usi_ei].link) {
							usi_app.email_info[usi_ei].link = usi_app.aff_links[usi_ei] + "?url=" + usi_app.encode_link(usi_app.email_info[usi_ei].link, usi_ei);
						}
						if (usi_app.email_info[usi_ei].link2) {
							usi_app.email_info[usi_ei].link2 = usi_app.aff_links[usi_ei] + "?url=" + encodeURIComponent(usi_app.email_info[usi_ei].link2);
						}
						if (usi_app.email_info[usi_ei].link3) {
							usi_app.email_info[usi_ei].link3 = usi_app.aff_links[usi_ei] + "?url=" + encodeURIComponent(usi_app.email_info[usi_ei].link3);
						}
						if (usi_app.email_info[usi_ei].link4) {
							usi_app.email_info[usi_ei].link4 = usi_app.aff_links[usi_ei] + "?url=" + encodeURIComponent(usi_app.email_info[usi_ei].link4);
						}
					}
				}

				if (usi_cookies.value_exists("usi_needs_link")) {
					usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?autodesk_link_injection=" + encodeURIComponent(location.href));
					usi_cookies.del("usi_needs_link");
					usi_app.link_injection(usi_app.aff_links[usi_app.locale] + "?url=" + location.href);
				}

				// tracking page visits for AutoCAD > AutCAD LT Downgrade
				if (["en-US", "en-CA", "en-GB", "en-NZ"].indexOf(usi_app.locale) != -1 && (location.href.indexOf("/products/autocad/overview") != -1 || location.href.indexOf("/products/autocad-lt/overview") != -1 || location.href.indexOf("/products/autocad/compare") != -1)) {
					var page_visited = "";
					if (location.href.indexOf("/products/autocad/overview") != -1) page_visited = "autocad";
					else if (location.href.indexOf("/products/autocad-lt/overview") != -1) page_visited = "autocadlt";
					else if (location.href.indexOf("/products/autocad/compare") != -1) page_visited = "acadcompare";
					if (page_visited) {
						usi_app.get_page_visits(page_visited);
					}
				}

				// tracking pdp visits (Cyber Week)
				if (usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00')) {
					if (usi_app.url.indexOf('/products/revit/overview') != -1 || usi_app.url.indexOf('/products/civil-3d/overview') != -1 || usi_app.url.indexOf('/collections/architecture-engineering-construction/overview') != -1) {
						// AEC Collection Eligible
						usi_cookies.set("usi_cw_aec_eligible", "1");
					} else if (usi_app.url.indexOf('/products/navisworks/overview') != -1 || usi_app.url.indexOf('/products/inventor/overview') != -1 || usi_app.url.indexOf('/collections/product-design-manufacturing/overview') != -1) {
						// AEC Collection Eligible
						usi_cookies.set("usi_cw_pdm_eligible", "1");
					}
				}

				// tracking pdp visits (ko-KR & ja-JP AutoCAD Plus - Downgrade)
				if (["ko-KR", "ja-JP"].indexOf(usi_app.locale) != -1 && usi_app.url.indexOf('/products/autocad-plus/overview') != -1) {
					// AutoCAD Plus - Downgrade Eligible
					usi_cookies.set("usi_autocad_plus_eligible", "1", usi_cookies.expire_time.day);
				}

				// tracking site and pdp visits
				usi_app.eligible_us_acad_visits = (usi_app.get_us_acad_page_visits() >= 5);
				usi_app.eligible_site_visits = (usi_app.get_session_count() == 8);

				// Setting locales for LC campaign
				usi_app.locale_lc = usi_app.locale;
				if (usi_app.locale == 'en-NL') usi_app.locale_lc = 'en-EU';
				if (usi_app.locale == 'en-GB') usi_app.locale_lc = 'en-UK';

				// Loading pixel on EMEA/UK confirmation page (Sales fell off 2/6/24)
				if (usi_app.is_confirmation_page && typeof usi_pixel == 'undefined' && usi_app.emea_uk.indexOf(usi_app.locale) != -1) {
					usi_commons.load_script("https://www.upsellit.com/active/autodesk_new_pixel.jsp");
					return;
				}

				if (usi_cookies.get("usi_locale_reported") == null) {
					usi_cookies.set("usi_locale_reported", "1");
					usi_app.report_locale();
				}

				usi_app.set_mk_vars();

				// Collect product page data (AutoCAD 1 year only)
				if (usi_app.is_product_page && ["ko-KR", "ja-JP"].indexOf(usi_app.locale) != -1 && usi_app.url.indexOf('/products/autocad/overview') != -1 && document.querySelector('product-price[plc="ACD"][type="regular"][billing-plan="1-YEAR"] span.mfe-product-price--regular') != null) {
					usi_app.product = usi_app.scrape_product_page();
					usi_commons.send_prod_rec(usi_app.recommendation_site_product, usi_app.product, true);
					usi_commons.log(usi_app.product);
				}

				// Check for expired Trials
				if ((usi_app.locale == "en-IN" || usi_app.locale == "en-US") && sessionStorage.getItem("customerProfile") != null) {
					var customerProfile = JSON.parse(sessionStorage.getItem("customerProfile"));
					if (typeof customerProfile.entitlements === 'undefined' || customerProfile.entitlements == null) return usi_commons.log("[ main ] No trials/products");
					var expired_trial =  usi_app.expired_trial_in_cart(customerProfile);
					usi_commons.log('[ main ] expired_trial_in_cart:', expired_trial.length > 0);
					if (expired_trial.length > 0) usi_cookies.set('usi_expired_trial', 1, usi_cookies.expire_time.day);
				}

				// Suppress other solutions on renewal page
				if (usi_app.is_renewal_cart_page) {
					usi_app.init_renewal_cart();
					return;
				}

				// Look for locale prompt modal
				if (usi_app.is_checkout_page) usi_app.look_for_locale_modal();

				// Record last plc and term shown in url
				if (usi_commons.gup('plc')) {
					usi_commons.log('[ main ] PCL found in url:', usi_commons.gup('plc'));
					usi_cookies.set('usi_last_plc', usi_commons.gup('plc'), usi_cookies.expire_time.week);
				}
				if (usi_commons.gup('term')) {
					usi_commons.log('[ main ] Term found in url:', usi_commons.gup('term'));
					usi_cookies.set('usi_last_term', usi_commons.gup('term'), usi_cookies.expire_time.week);
				}

				// Scrape carts
				usi_app.rescrape_cart();

				// Idle modal suppression
				usi_app.close_on_idle_modal();

				// Save products
				if (usi_app.products && usi_app.products.length == 0 && usi_cookies.value_exists("usi_app_products")) {
					usi_app.products = usi_cookies.get_json("usi_app_products");
				} else if (usi_app.products && usi_app.products.length > 0) {
					usi_cookies.set_json("usi_app_products", usi_app.products, usi_cookies.expire_time.day, true);
				}
				// Sale notes
				usi_app.save_sale_notes();

				// Check suppressions
				usi_app.check_url_suppressions();
				if (usi_cookies.value_exists("usi_suppress")) {
					usi_commons.log("[ main ] Suppression cookie exists");
					return;
				}

				// siteID 54277 - removing original product from cart after adding upsell


				// Rebuild carts
				if (usi_app.should_rebuild) {
					if (usi_app.dr_cart) {
						setTimeout(usi_app.rebuild_dr_cart, 1500);
					} else if (usi_app.guac_cart) {
						setTimeout(usi_app.rebuild_guac_cart, 1500);
					}
					return;
				}

				// scrape minicart or cookie usi_app_products
				usi_app.scrape_minicart_or_cart_cookie();

				// Apply event listener on category pages
				if (location.href.indexOf('/products') !== -1 && !usi_app.events_bound) {
					usi_app.apply_event_listener_recheck_cart('.wp-product-card-box a.wp-add-to-cart', 'click');
				}

				// Load campaigns
				usi_app.load();
			} catch (err) {
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
			paySessionId_not_found: function(c) {
				if (typeof c.paySessionId_not_found == "undefined") return true;
				return !(usi_cookies.get("preservedQueryParams") != null && usi_cookies.get("preservedQueryParams").indexOf("paySessionId") != -1);
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
            eligible_revit_downgrade: function(c) {
				if (typeof c.eligible_revit_downgrade == "undefined") return true;
				return (usi_app.products.length > 0 && usi_app.products.findIndex(p => p.plc == "RVT" &&  p.term == "1-year") != -1);
			},
			eligible_flash_sale: function(c) {
				if (typeof c.eligible_flash_sale == "undefined") return true;
				return (["en-US", "en-CA", "ja-JP", "en-IN", "it-IT", "de-DE"].indexOf(usi_app.locale) != -1 && usi_app.products.length == 1 && usi_app.get_payment_key().indexOf("redirect") == -1 && (usi_app.products[0].plc == "ACDIST" || usi_app.products[0].plc == "ACDLT" || (["ja-JP"].indexOf(usi_app.locale) != -1) &&  usi_app.products[0].plc == "ACD") && usi_app.products[0].term == "1-year");
			}
		};
		usi_app.load = function () {
			try {
				usi_commons.log("usi_app.load()");

				// suppressing all campaigns on Fusion product pages
				if (usi_app.url.indexOf("/products/fusion") != -1) {
					return usi_commons.log("[usi_app.load] Suppressing Fusion product pages");
				}

				// Clean up previous solutions
				if (typeof usi_js !== 'undefined' && typeof usi_js.cleanup === 'function') {
					usi_js.cleanup();
				}

				// Suppress Fusion products in UK, DE, US
				usi_app.suppressf360 = false;
				var fusion_suppressed_locales = ["en-US", "de-DE", "en-UK"];
				if (fusion_suppressed_locales.indexOf(usi_app.locale) !== -1) {
					if (location.href.indexOf("checkout.autodesk") !== -1) {
						if (usi_app.products.length == 0) {
							usi_commons.log("[ load ] Delaying till all products are in the cart (so we can check for Fusion)");
							return;
						}
						for (var i = 0; i < usi_app.products.length; i++) {
							if (usi_app.products[i].name.toLowerCase().indexOf("fusion") != -1) {
								usi_commons.log("[ load ] Suppression Fusion product in cart");
								// removed cart page suppression 03/02/2026
								//usi_app.suppressf360 = true;
							}
						}
					} else if (location.href.indexOf("F360") !== -1 || location.href.indexOf("fusion") !== -1) {
						usi_commons.log("[ load ] Suppression Fusion URL");
						usi_app.suppressf360 = true;
					}
				}

				usi_company.load_campaigns(usi_company_json, usi_app.custom_rulesets);
				// Init cart page
				if (usi_app.is_odm_cart || usi_app.guac_cart) {
					// 30159, 30149
					usi_app.monitor_for_guac_payment_page();
				} else if (usi_app.dr_cart && (usi_app.dr_cart_available || usi_app.efulfilment)) {
					//30153, 30143
					usi_app.monitor_for_dr_payment_page();
				} else if (usi_app.is_cb_cart) {
					// load old campaigns on new CB cart/checkout page
					usi_app.perform_actions_for_dr_payment_page();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.expired_trial_in_cart = function (profile) {
			try {
				if (typeof profile.entitlements === 'undefined' || profile.entitlements == null) return;
				var today = new Date();
				return profile.entitlements.filter(e =>
					e.entitlementType === "TRIAL" && new Date(e.endDate) < today
				);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.start_minicart_monitor = function () {
			// Only used for LCs and Return Visitor campaign
			try {
				usi_commons.log("usi_app.start_minicart_monitor()");
				var monitor_cart = function () {
					var total = usi_app.scrape_minicart_subtotal() || 0;
					var items = usi_app.scrape_minicart() || [];
					var cart = document.querySelector('div[data-testid*="product-line-item"]');
					var cart_empty = document.querySelector('.drawer__wrapper .checkout-empty-cart');
					if (usi_app.total != total || (items && usi_app.items && JSON.stringify(usi_app.items) != JSON.stringify(items))) {
						usi_app.total = total;
						usi_app.items = items;
						if (cart) {
							usi_app.save_minicart();
						}
						usi_app.load();
					} else if (cart_empty != null && usi_cookies.value_exists('usi_subtotal')) {
						usi_commons.log("usi_app.start_minicart_monitor() -> empty cart");
						usi_cookies.flush("usi_prod_");
						usi_cookies.flush("usi_subtotal");
						usi_cookies.flush("usi_pids");
						usi_cookies.flush("usi_num_items");
						setTimeout(function () {
							usi_app.load();
						}, 1000);
					}
					setTimeout(monitor_cart, 1000);
				};
				monitor_cart();
				if (!usi_app.cart_timeout) {
					usi_app.cart_timeout = setTimeout(monitor_cart, 1000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.post_listen = function (url, callback) {
			try {
				usi_commons.log("usi_app.post_listen()");
				if (!usi_app.ajax) usi_app.ajax = {};
				usi_app.ajax[url] = new usi_ajax.listener();
				usi_app.ajax[url].register('POST', url, callback);
				usi_app.ajax[url].listen();
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.is_json = function (str) {
			try {
				JSON.parse(str);
			} catch (err) {
				return false
			}
			return true;
		};
		usi_app.handle_ajax_response = function (err, response) {
			try {
				usi_commons.log("usi_app.handle_ajax_response()");
				if (err) {
					return usi_commons.report_error(err);
				} else if (!response || !response.responseText || !usi_app.is_json(response.responseText)) {
					return usi_commons.report_error('Incorrect response');
				}
				var data = JSON.parse(response.responseText);

				console.log("ajax data", data)
				// Handle response
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.save_minicart = function () {
			//Used for LCs and Return visitor campaign
			try {
				usi_commons.log("usi_app.save_minicart()");
				var cart_prefix = "usi_prod_";
				usi_cookies.flush("usi_subtotal");
				usi_cookies.flush(cart_prefix);
				usi_app.cart = {
					items: usi_app.scrape_minicart(),
					subtotal: usi_app.scrape_minicart_subtotal()
				}
				usi_commons.log(usi_app.cart);

				if (typeof usi_app.cart.items != "undefined" && typeof usi_app.cart.subtotal != "undefined") {
					usi_cookies.set("usi_subtotal", usi_app.cart.subtotal, usi_cookies.expire_time.week);
					var usi_pids = usi_app.cart.items.map(function (item) {
						return item.pid;
					});
					usi_cookies.set("usi_pids", usi_pids.join(","), usi_cookies.expire_time.week); //Remove when new ODM cart goes live
					usi_cookies.set('usi_num_items', usi_app.cart.items.length, usi_cookies.expire_time.week);
					usi_app.cart.items.forEach(function (product, index) {
						var prop;
						if (index >= 3) return;
						for (prop in product) {
							if (product.hasOwnProperty(prop)) {
								usi_cookies.set(cart_prefix + prop + "_" + (index + 1), product[prop], usi_cookies.expire_time.week);
							}
						}
					});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_minicart_subtotal = function () {
			//Minicart subtotal scraping for LCs and Return visitor campaign
			try {
				//usi_commons.log("usi_app.scrape_minicart_subtotal()");
				var subtotal = document.querySelector('footer p.dhig-typography-headline-small');
				// new minicart
				if (usi_app.is_staging && document.querySelector("#cart-container") != null && document.querySelector('#flyout-subtotal') != null) subtotal = document.querySelector('#flyout-subtotal');
				if (subtotal != null) {
					subtotal = subtotal.textContent;
					return subtotal.replace(/[^0-9.]/g, '');
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_minicart = function () {
			//Minicart scraping for LCs and Return visitor campaign
			try {
				//usi_commons.log("usi_app.scrape_minicart()");
				return Array.from(document.querySelectorAll('div[data-testid*="product-line-item"]')).map(function (container) {
					var product = {};
					product.pid = container.getAttribute('data-line-item') != null ? container.getAttribute('data-line-item') : '';
					product.image = container.querySelector("img").src;
					if (usi_app.is_staging && document.querySelector("#cart-container") != null && container.querySelector(".odm-minicart-product-name") != null ) {
						// new minicart
						product.name = container.querySelector(".odm-minicart-product-name").textContent;
					} else {
						product.name = container.querySelector("img").alt;
					}
					if(container.querySelector("#quantity") != null){
						product.qty = container.querySelector("#quantity").value;
					} else if (container.querySelector('input[name*=quantity]') != null){
						product.qty = container.querySelector('input[name*=quantity]').value
					}
					product.price = container.querySelector('p[data-testid*="formatted-calculated-price"]').textContent.trim();
					if (container.querySelector('p[data-testid="formatted-discounted-price"]') != null) {
						var temp_old_price = container.querySelector('p[data-testid="formatted-discounted-price"]').textContent.trim();
						if (product.price != temp_old_price) {
							product.old_price = temp_old_price;
						}
					}
					if (container.querySelector('.DhigSelect--option span') != null) {
						product.term = container.querySelector('.DhigSelect--option span').textContent.trim();
					} else if (container.querySelector('.select-term-container span') != null) {
						product.term = container.querySelector('.select-term-container span').textContent.trim();
					} else if (usi_app.is_staging && document.querySelector("#cart-container") != null && container.querySelector('[data-testid="selected-term-text"]') != null) {
						// new minicart
						product.term = container.querySelector('[data-testid="selected-term-text"]').textContent.trim()
					}
					//images not showing in email, need to use a proxy
					if (product.image.indexOf('https://emsfs.autodesk.com') != -1) {
						product.image = "https://www2.upsellit.com/admin/custom/proxy.jsp?url=" + product.image;
					}
					return product;
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_odm_cart = function () {
			//Scrape ODM checkout page
			var prod_array = [];
			try {
				if (localStorage.getItem('cart') != null) {
					var locale = usi_app.get_locale() == "en-EU" ? "en-NL" : usi_app.get_locale();
					if (locale == "en-UK") locale = "en-GB";
					if (locale == "en-SE") locale = "en-AE";
					var ls_cart = JSON.parse(localStorage.getItem('cart'))[locale]['offers'];
					var cart_rows = document.querySelectorAll('div[data-testid*="product-line-item"]');

					if (cart_rows.length > 0 && typeof(ls_cart) !== "undefined") {
						// create ODM cart link cookie
						if (usi_commons.gup('cartId') != '') {
							var link = location.href.split("?")[0] + "?cartId=" + usi_commons.gup('cartId');
							usi_cookies.set('usi_odm_cart_link', link, usi_cookies.expire_time.week, true);
						}
						// scrape ODM cart
						for (var i = 0; i < cart_rows.length; i++) {
							var product = {};
							product.type = ls_cart[i]['termCode'];
							if (product.type == "A01") {
								product.type = "1-year";
							} else if (product.type == "A02") {
								product.type = "1-month";
							} else if (product.type == "A06") {
								product.type = "3-year";
							}
							product.term = product.type;
							product.qty = ls_cart[i]['quantity'].toString();
							product.plc = ls_cart[i]['offeringCode'];
							product.product_id = ls_cart[i]['offeringId'];
							product.name = cart_rows[i].querySelector('img').alt;
							if (cart_rows[i].querySelector('p[data-testid=formatted-discounted-price] > span') != null) {
								product.old_price = cart_rows[i].querySelector('p[data-testid=formatted-discounted-price] > span').innerText;
							}
							product.price = cart_rows[i].querySelector('p[data-testid=formatted-calculated-price] > span').innerText;
							product.pic = cart_rows[i].querySelector('img').src;
							//images not showing in email, need to use a proxy
							if (product.pic.indexOf('https://emsfs.autodesk.com') != -1) {
								product.pic = "https://www2.upsellit.com/admin/custom/proxy.jsp?url=" + product.pic;
							}
							if (cart_rows[i].querySelector('div.DhigSelect--option') != null) {
								product.type_full = cart_rows[i].querySelector('div.DhigSelect--option').innerText;
							} else if (cart_rows[i].querySelector('div.select-term-container > span') != null) {
								product.type_full = cart_rows[i].querySelector('div.select-term-container > span').innerText;
							}

							// scraping special promo text (it will be displayed on payment abandon TTs [30141])
							if (cart_rows[i].querySelector(".MuiListItem-gutters .odm-minicart-label") != null) {
								product.promo = cart_rows[i].querySelector(".MuiListItem-gutters .odm-minicart-label").innerText;
							}

							prod_array.push(product);
						}

						if (usi_app.save_cart_data_after_injection && usi_app.cb_checkout_countries.indexOf(usi_app.locale) != -1 && usi_app.scrape_odm_cart_counter > 2 && prod_array.length > 0) {
							// Fix for the 06/2025 Autodesk site update - Countries with a CB checkout page
							usi_commons.log('[ usi_app.scrape_odm_cart ] -> saved data after link injection');
							// load this code every time the cart is updated
							usi_app.save_cart_data_after_injection = false;
							
							usi_cookies.set_json("usi_app_products", prod_array, usi_cookies.expire_time.day, true);
							// this is needed to launch siteIDs 53843,56773,56595,56033,56751 (Return User)
							// save cart items
							usi_app.scrape_minicart_or_cart_cookie();
						}
						//usi_commons.log(prod_array);
					} else {
						// Reset the usi_app_products cookie on each cart visit to avoid showing previous cart data
						usi_cookies.del("usi_app_products");

						// Fix for the 06/2025 Autodesk site update - Countries with a CB checkout page
						// On the user's first visit to the checkout page, the local 'cart' variable is empty (e.g., {"cartId": "", "en-AE": {}}).
						// To retrieve the proper 'cart' value, we use link injection to load the same page in an iframe.
						// This logic runs when `usi_app.scrape_odm_cart_counter` equals 2.
						if (usi_app.scrape_odm_cart_counter == 2 && usi_app.cb_checkout_countries.indexOf(usi_app.locale) != -1) {
							usi_app.link_injection(window.location.href);
						}
						usi_app.scrape_odm_cart_counter ++;
						usi_commons.log('[ usi_app.scrape_odm_cart ] -> missing cart_rows or ls_cart');
						usi_commons.log('[ usi_app.scrape_odm_cart ] ->', usi_app.scrape_odm_cart_counter);
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
			return prod_array;
		};
		usi_app.scrape_guac_cart = function () {
			//Scrape GUAC checkout page
			try {
				// Extract PLC list from window object
				usi_app.pids_in_cart = "";
				var plcs = [];
				if (utag_data && utag_data['product_line_list_pipe_delimiter']) {
					if (utag_data['product_line_list_pipe_delimiter'].indexOf('|') !== -1) {
						plcs = utag_data['product_line_list_pipe_delimiter'].split('|');
					} else {
						plcs.push(utag_data['product_line_list_pipe_delimiter']);
					}
				} else if (utag_data && utag_data['products_line'] && utag_data['products_line'].length > 0) {
					plcs.push(utag_data['products_line'][0].toUpperCase());
				}
				var cart_rows = document.getElementsByClassName("checkout--product-bar");
				var prod_array = [], i, product, last_plc;
				for (i = 0; i < cart_rows.length; i++) {
					product = {};
					if (cart_rows[i].getElementsByClassName("checkout--product-bar--info-column--name-sub-column--image-container--badge").length > 0) {
						product.pic = cart_rows[i].getElementsByClassName("checkout--product-bar--info-column--name-sub-column--image-container--badge")[0].src;
						if (product.pic.indexOf("http") != -1) {
							if (cart_rows[i].querySelector("#product-term, #term") != null) {
								product.type = cart_rows[i].querySelectorAll("#product-term option, #term option")[cart_rows[i].querySelector("#product-term, #term").selectedIndex].textContent.toLowerCase();
							} else {
								product.type = cart_rows[i].getElementsByClassName("checkout--product-bar--info-column--name-sub-column--term-description")[0].getElementsByTagName("span")[0].textContent.trim();
							}
							// JAPAN translate
							if (usi_app.locale === 'ja-JP' && typeof product.type != "undefined") {
								if (product.type.indexOf("1 \u30F5\u6708") != -1) {
									product.type = "1 \u30F5\u6708";
								} else if (product.type.indexOf("3 \u5E74") != -1) {
									product.type = "3 \u5E74";
								} else if (product.type.indexOf("\u5E74") != -1) {
									product.type = "1 \u5E74";
								}
							}
							product.type_full = product.type;
							if (cart_rows[i].querySelector(".checkout--product-bar--info-column--name-sub-column--promo-title") != null) {
								product.type_full = cart_rows[i].querySelector(".checkout--product-bar--info-column--name-sub-column--promo-title").textContent.trim();
							} else if (cart_rows[i].querySelector(".checkout--product-bar--info-column--name-sub-column--term-description") != null) {
								product.type_full = cart_rows[i].querySelector(".checkout--product-bar--info-column--name-sub-column--term-description").textContent.trim();
							}
							product.name = cart_rows[i].getElementsByClassName("checkout--product-bar--info-column--name-sub-column--name")[0].textContent.trim();
							product.product_id = cart_rows[i].getAttribute("data-line-item");
							if (usi_app.pids_in_cart != "") usi_app.pids_in_cart += ",";
							usi_app.pids_in_cart += product.product_id;
							product.qty = "1";
							var qty_el = cart_rows[i].querySelector('input[name="quantity-' + product.product_id + '"]') != null ? cart_rows[i].querySelector('input[name="quantity-' + product.product_id + '"]') : cart_rows[i].querySelector('input[name*="quantity-"]');
							if (qty_el && qty_el.value) {
								product.qty = qty_el.value;
							}
							if (cart_rows[i].getElementsByClassName("checkout--product-bar--product-price-column--calculated-price").length > 0) {
								product.price = cart_rows[i].getElementsByClassName("checkout--product-bar--product-price-column--calculated-price")[0].innerHTML;
							} else if (cart_rows[i].querySelector('[class*="innerAnchorStyle-Price"]') != null) {
								product.price = cart_rows[i].querySelector('[class*="innerAnchorStyle-Price"]').innerHTML;
							} else if (cart_rows[i].querySelector('[data-testid="formatted-calculated-price"]') != null) {
								product.price = cart_rows[i].querySelector('[data-testid="formatted-calculated-price"]').innerHTML;
							} else {
								product.price = "0";
							}
							if (cart_rows[i].querySelector('[class*="innerAnchorStyle-strikeThrough-Price"]') != null) {
								product.old_price = cart_rows[i].querySelector('[class*="innerAnchorStyle-strikeThrough-Price"]').innerHTML;
							} else if (cart_rows[i].getElementsByClassName("checkout--product-bar--product-price-column--promotion-price").length > 0) {
								product.old_price = product.price;
								product.price = cart_rows[i].getElementsByClassName("checkout--product-bar--product-price-column--promotion-price")[0].innerHTML;
							}
							var promo = cart_rows[i].querySelectorAll(".show-for-large-up .checkout--product-bar--info-column--name-sub-column--promo-title");
							if (promo.length > 1) {
								product.promo = promo[promo.length - 1].innerHTML.trim();
							}
							if (typeof plcs[i] !== "undefined") {
								product.plc = plcs[i];
								last_plc = plcs[i];
							}

							if (typeof window['utag_data'] != 'undefined' && typeof window['utag_data']['products_line'] != 'undefined' && typeof window['utag_data']['products_line'][i] != 'undefined') {
								var ul = window['utag_data']['products_line'].length;
								product.plc = window['utag_data']['products_line'][ul - (i + 1)].toUpperCase();
								last_plc = window['utag_data']['products_line'][ul - (i + 1)].toUpperCase();
							}
							// Scrape terms
							product.terms = {};
							var term_options = cart_rows[i].querySelectorAll('#product-term option');
							if (term_options && term_options.length > 0) {
								term_options.forEach(function (option_el) {
									if (option_el && option_el.getAttribute('value') && option_el.textContent) {
										if (usi_app.locale === 'ja-JP') {
											product.terms[option_el.textContent] = option_el.getAttribute('value');
											if (option_el.textContent.indexOf("1 \u30F5\u6708") != -1) {
												product.terms["1 MONTH"] = option_el.getAttribute('value');
											} else if (option_el.textContent.indexOf("3\u5E74") != -1) {
												product.terms["3 YEAR"] = option_el.getAttribute('value');
											} else if (option_el.textContent.indexOf("\u5E74") != -1) {
												product.terms["1 YEAR"] = option_el.getAttribute('value');
											}
										} else {
											product.terms[option_el.textContent] = option_el.getAttribute('value');
										}
									}
								});
							}
							prod_array.push(product);
						}
					}
				}
				return prod_array;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_dr_cart = function () {
			//Scrape DR checkout page
			try {
				usi_app.pids_in_cart = "";
				if (typeof (dr_currentProdsInOrder) != "undefined") {
					for (var p = 0; p < dr_currentProdsInOrder.split(",").length; p++) {
						if (usi_app.pids_in_cart != "") usi_app.pids_in_cart += ",";
						usi_app.pids_in_cart += dr_currentProdsInOrder.split(",")[p].split("?")[1];
					}
				}
				var cart_rows = document.getElementsByClassName("product-row");
				var prod_array = [], i, product;
				var found = 0;
				for (i = 0; i < cart_rows.length; i++) {
					product = {};
					if (cart_rows[i].getElementsByClassName("dr_productThumbnail").length == 0) {
						break;
					}
					product.pic = cart_rows[i].getElementsByClassName("dr_productThumbnail")[0].src;
					if (product.pic.indexOf("http") != -1) {
						product.name = cart_rows[i].getElementsByClassName("dr_productThumbnail")[0].alt.replace(/([(\[]).*([)\]])/, "").trim();
						product.name_dr_full = cart_rows[i].getElementsByClassName("dr_productThumbnail")[0].alt;
						if (/(1 |3 )?(year|monthly) subscription/i.test(product.name)) {
							product.type = product.name.match(/(1 |3 )?(year|monthly)/i)[0].replace(/monthly/i, "Month");
							product.name = product.name.replace(/(1 |3 )?(year|monthly) subscription/i, "").trim();
						} else if (/suscripci\u00F3n.*(a\u00F1o|mensual)/i.test(product.name)) {
							product.type = product.name.match(/(1 |3 )?(a\u00F1o|mensual)/i)[0];
							product.name = product.name.replace(/suscripci\u00F3n.*(a\u00F1o|mensual)/i, "").trim();
						} else if (/((de 1 |de 3 )?ano|mensal)/i.test(product.name)) {
							product.type = product.name.match(/((de 1 |de 3 )?ano|mensal)/i)[0];
							product.name = product.name.replace(/((de 1 |de 3 )?ano|mensal)/i, "").trim();
							if (product.name.indexOf("mensal") !== -1) product.type = product.type.replace("ano", "mensal");
						} else if (/((([13])\uB144)|\uC6D4\uBCC4)/i.test(product.name)) {
							product.type = product.name.match(/((([13])\uB144)|\uC6D4\uBCC4)/i)[0];
							product.name = product.name.substring(0, product.name.indexOf(product.type)).trim();
							product.type = product.type.replace(/(\d)/, "$1 ");
						} else if (product.name.indexOf("3 \u5E74") != -1) {
							product.type = "3 \u5E74";
							product.name = product.name.split("3 \u5E74")[0].trim();
						} else if (product.name.indexOf("\u5E74") != -1) {
							product.type = "1 \u5E74";
							product.name = product.name.split("\u5E74")[0].trim();
						} else if (product.name.indexOf("3 y\u0131ll\u0131k Abonelik") != -1) {
							product.type = "3 y\u0131ll\u0131k Abonelik";
							product.name = product.name.split("3 y\u0131ll\u0131k Abonelik")[0].trim();
						} else if (product.name.indexOf("y\u0131ll\u0131k Abonelik") != -1) {
							product.type = "1 y\u0131ll\u0131k Abonelik";
							product.name = product.name.split("y\u0131ll\u0131k Abonelik")[0].trim();
						}
						product.qty = "1";
						if (cart_rows[i].getElementsByClassName("dr_qtyInput").length > 0) {
							product.qty = cart_rows[i].getElementsByClassName("dr_qtyInput")[0].value;
						} else if (cart_rows[i].getElementsByClassName("prod-Quantity").length > 0) {
							product.qty = cart_rows[i].getElementsByClassName("prod-Quantity")[0].innerHTML.replace(/[^0-9.]+/g, "")
						}
						product.price = cart_rows[i].getElementsByClassName("prod-total")[0].innerHTML;
						// remove the first div/mobile label
						product.price = product.price.substring(product.price.indexOf("</div>") + 6);
						// if there is an old price, remove it. save old price
						if (product.price.indexOf("<del>") != -1) {
							product.old_price = product.price.substring(product.price.indexOf("<del>") + 5, product.price.indexOf("</del>"));
							product.price = product.price.substring(product.price.indexOf("</span>") + 7).trim();
						}
						// keep everything before the first span close tag
						if (product.price.indexOf("</span>") != -1) {
							product.price = product.price.substring(0, product.price.indexOf("</span>") + 7).trim();
						}
						// remove the span thats around the price
						if (product.price.indexOf("<span>") != -1 && product.price.indexOf("</span>") != -1) {
							product.price = product.price.substring(product.price.indexOf("<span>") + 6, product.price.indexOf("</span>")).trim();
						}
						if (product.price == product.old_price) product.old_price = "";

						if (cart_rows[i].getElementsByClassName("dr_salesPitch").length > 0) {
							product.promo = cart_rows[i].getElementsByClassName("dr_salesPitch")[0].innerHTML.trim();
						}
						product.product_id = usi_app.pids_in_cart.split(",")[i];

						// Get PLC
						product.plc = '';
						if (window['utag'] && window['utag']['data'] && window['utag']['data']['cp.dtSa']) {
							var temp = window['utag']['data']['cp.dtSa'].split('plc=')[1];
							if (temp && temp.split('|')[0]) {
								temp = temp.split('|')[0];
								if (temp.indexOf('&') !== -1) temp = temp.split('&')[0];
								product.plc = temp;
								usi_app.plc = product.plc;
							}
						}
						if (usi_cookies.read_cookie("gc_ss_adskkr") && sessionStorage["dr_" + usi_cookies.read_cookie("gc_ss_adskkr") + "_cartData"]) {
							usi_app.plc = JSON.parse(sessionStorage["dr_" + usi_cookies.read_cookie("gc_ss_adskkr") + "_cartData"]).cart.lineItems.lineItem[0].product.parentProduct.externalReferenceId.split("-")[0];
						}
						if (product.name.indexOf('AutoCAD - ') !== -1 && product.name.indexOf('including specialized toolsets') !== -1) {
							product.plc = "ACDIST";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('AutoCAD - ') !== -1) {
							product.plc = "ACD";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('Maya') != -1) {
							product.plc = "MAYA";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('3ds Max') != -1) {
							product.plc = "3DSMAX";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('Revit') != -1) {
							product.plc = "RVT";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('Civil 3D') != -1) {
							product.plc = "CIV3D";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf("AutoCAD LT") != -1) {
							product.plc = "ACDLT";
							usi_app.plc = product.plc;
						} else if (product.name.indexOf('Flow Production Tracking') != -1) {
							product.plc = "FPT";
							usi_app.plc = product.plc;
						}
						found++;
						prod_array.push(product);

						// [ NEW ] Set CN PLC - Need this here because ACD does not get scraped properly
						var name_el = cart_rows[i].querySelector('.product-name.dr_prodName');
						if (name_el && name_el.textContent) {
							// ACD
							if (name_el.textContent.indexOf('AutoCAD including specialized toolsets') !== -1) {
								usi_app.plc = "ACD";
							} else if (name_el.textContent.indexOf('Media') !== -1 && name_el.textContent.indexOf('Entertainment Collection') !== -1) {
								usi_app.plc = "MECOLL";
							} else if (name_el.textContent.indexOf('Revit') !== -1) {
								usi_app.plc = "RVT";
							} else if (name_el.textContent.indexOf('Civil 3D') !== -1) {
								usi_app.plc = "CIV3D";
							} else if (name_el.textContent.indexOf('Navisworks') !== -1) {
								usi_app.plc = "NAVMAN";
							} else if (name_el.textContent.indexOf('Fusion 360') !== -1) {
								if (!usi_app.plc) usi_app.plc = "F360";
							} else if (name_el.textContent.indexOf('Flow Production Tracking') !== -1) {
								if (!usi_app.plc) usi_app.plc = "FPT";
							}
						}

						// [ NEW ] Save special PLC for promo TT copy
						if (usi_app.locale === 'en-IN') {
							var special_plcs = ['ACD', 'ACDLT', 'MAYA', 'AECCOL'];
							if (special_plcs.indexOf(usi_app.plc) !== -1) {
								usi_cookies.set('usi_special_plc', usi_app.plc, usi_cookies.expire_time.day);
								usi_commons.log('[ scrape_dr_cart ] * * * usi_special_plc:', usi_app.plc);
							}
						} else if (usi_app.locale === 'zh-CN') {
							var special_plcs = ['ACD', 'MAYA', '3DSMAX'];
							if (special_plcs.indexOf(usi_app.plc) !== -1) {
								usi_cookies.set('usi_special_plc', usi_app.plc, usi_cookies.expire_time.day);
								usi_commons.log('[ scrape_dr_cart ] * * * usi_special_plc:', usi_app.plc);
							}
						}
						if (!product.plc) product.plc = usi_app.plc;
					}
				}
				return prod_array;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.monitor_for_guac_payment_page = function () {
			//Monitor if cart contents tab is open for Guac and ODM carts
			try {
				if (usi_app.is_payment_page() && usi_app.products.length > 0) {
					usi_commons.log('[ monitor_for_guac_payment_page ] Payments page detected');
					setTimeout(function () {
						usi_app.perform_actions_for_guac_payment_page();
					}, 500);
				} else {
					setTimeout(usi_app.monitor_for_guac_payment_page, 500);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.monitor_for_dr_payment_page = function () {
			//Monitor if cart contents tab is open for DR carts
			try {
				//Monitor for Page 3
				if (usi_app.is_payment_page() && usi_app.products.length > 0) {
					usi_commons.log('[ monitor_for_dr_payment_page ] Payments page detected');
					usi_app.perform_actions_for_dr_payment_page();
				} else {
					setTimeout(usi_app.monitor_for_dr_payment_page, 500);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.perform_actions_for_guac_payment_page = function () {
			try {
				if (usi_app.suppress_delay_load || usi_cookies.value_exists("usi_suppress_modal")) return;
				usi_commons.log('[ perform_actions_for_guac_payment_page ] Loading solutions on guac payments page - loading:', usi_app.loading);
				if (typeof (usi_app.upsell_loaded) === "undefined") {
					usi_app.upsell_loaded = true;
					usi_app.upsells_guac();
				}
				if (usi_app.loading == 0) {
					usi_app.guac_delay_load();
				} else {
					setTimeout(usi_app.monitor_for_guac_payment_page, 500);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_payment_key = function(){
			var key = usi_app.get_locale_redirect_key();
			key += '_rebrand';
			if (key.indexOf('redirect') == -1) key += "_v2";
			return usi_app.locale + key;
		}
		usi_app.perform_actions_for_dr_payment_page = function () {
			//Load modals on checkout page for DR carts
			try {
				if (usi_app.suppressf360) return;
				// Clean up previous solutions
				if (typeof usi_js !== 'undefined' && typeof usi_js.cleanup === 'function') {
					usi_js.cleanup();
				}
				usi_app.is_checkout_payment_page = true;
				usi_company.load_campaigns(usi_company_json, usi_app.custom_rulesets);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.upsells_guac = function () {
			try {
				usi_commons.log("[USI] upsells_guac()");
				//TODO: Everytime a new ODM cart locale goes live, add it to the below list. We are slowly trying to remove this function
				if (usi_app.is_odm_cart) {
					if (["pt-BR", "es-MX", "en-EU", "en-SG", "en-MY", "ko-KR", "en-AU", "en-NZ", "en-US", "en-CA", "fr-CA", "ja-JP", "en-UK", "fr-FR", "de-DE"].indexOf(usi_app.locale) !== -1) {
						usi_commons.log("[USI] upsells_guac() -> this locale has upsells");
					} else {
						return usi_commons.log("[USI] upsells_guac() -> this locale doesn't have upsells");
					}
				}
				var usi_options = usi_app.upsell_text_setter();
				if (usi_options.cta != "") {
					//if (usi_app.products && usi_app.check_all_for_suppression(usi_app.products)) return;
					if (!usi_cookies.value_exists('usi_suppress_collections') && usi_app.locale == "en-US") {
						var collections_key = usi_app.check_collections_upgrade();
						if (collections_key) {
							usi_commons.load_view("QWSJdoCwfPck76cY19PokBL", "42730", collections_key);
							return;
						}
					}

					// [ Cloud Upsells ] Interject here to see if we should load single item upsell for APAC/ANZ
					if (!(["en-CA"].indexOf(usi_app.locale) != -1 && usi_app.products[0].plc == "FSN" && usi_app.products[0].term == "1-month") && !(["en-AU", "ja-JP"].indexOf(usi_app.locale) != -1 && usi_app.products[0].plc == "RVT" && usi_app.products[0].term == "1-month") && usi_app.locale != "en-US" && !usi_cookies.value_exists("usi_suppress_cloud_upsell") && typeof usi_company_json.cloud_products_upsell_matrix[usi_app.locale] !== "undefined") {
						// Exit function here if cloud upsell available
						if (usi_app.check_cloud_upsells()) {
							usi_commons.log("[USI] Cloud Upsell Found. (Guac)");
							return;
						}
					}

					usi_app.products.forEach(function (prod, i) {
						// Only fetch data for last product in cart
						usi_app.get_upsell_info_dynamic(prod, function (upsell) {
							usi_app.plc = prod.plc;
							if (upsell) {
								usi_commons.log('[ upsells_guac ] upsell:', upsell);
								if (upsell.upsell_type === 'bundle') {
									// stop loop to display in-page 55305 (when multiple Fusion products are in the cart)
									if (usi_app.multiple_fusion_extensions_in_cart) return;
									// Bundle upsell banner
									usi_commons.log('[ upsells_guac ] bundle_offer:', upsell.bundle_offer);
									usi_options.product_id = prod.product_id;
									usi_options.node = document.getElementsByClassName("checkout--product-bar")[i];
									var str_key = '"' + upsell.upsell_pid + '"';
									usi_options.func = 'usi_app.apply_bundle_guac(' + upsell.bundle_offer.url + ',' + str_key + ',' + prod.product_id + ');';
									usi_options.url = upsell.bundle_offer.url;
									usi_options.text = upsell.bundle_offer.copy;
									usi_options.cta = upsell.bundle_offer.cta;
									usi_options.bundle_key = upsell.upsell_pid;
									if (usi_app.is_odm_cart) {
										usi_options.node = document.querySelectorAll('div[data-testid*="product-line-item"]')[i];
									}
									usi_app.load_upsell(usi_options, prod);
								} else if (upsell.upsell_type === 'yearly') {
									// 1yr -> 3yr upsell banner
									usi_options.product_id = prod.product_id;
									usi_options.node = document.getElementsByClassName("checkout--product-bar")[i];
									usi_options.func = "usi_app.switch_items_guac(" + prod.product_id + "," + upsell.upsell_pid + ");";
									if (usi_app.is_odm_cart) {
										usi_options.node = document.querySelectorAll('div[data-testid*="product-line-item"]')[i];
									}
									usi_app.load_upsell(usi_options, prod);
								} else if (upsell.upsell_type === 'monthly') {
									// 1mo -> 1yr upsell banner
									if (["pt-BR", "es-MX", "ko-KR", "en-MY", "en-SG", "en-US", "en-CA", "fr-CA", "en-UK", "ja-JP", "fr-FR", "de-DE", "en-AU", "en-NZ"].indexOf(usi_app.locale) != -1) {
										usi_options = usi_app.upsell_text_setter_monthly(usi_options);
										usi_options.product_id = prod.product_id;
										usi_options.node = document.getElementsByClassName("checkout--product-bar")[i];
										usi_options.func = "usi_app.switch_items_guac_monthly(" + prod.product_id + "," + upsell.upsell_pid + ");";
										usi_options.type = "monthly";
										if (usi_app.is_odm_cart && usi_app.count_monthly_subscriptions() == 1) {
											usi_app.suppressf360 = false;
											usi_app.monthly_prod = prod;
											usi_options.node = document.querySelectorAll('div[data-testid*="product-line-item"]')[i];
											usi_options.cb = function (){
												usi_app.set_rescrape = function(){};
												usi_app.add_loading_graphic("");
												usi_cookies.set("usi_suppress_upsell", "1", usi_cookies.expire_time.two_weeks);

												// creating usi_click_id cookie
												if (typeof(usi_autoload) !== "undefined") {
													usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
												}

												var aff_url;
												if (["en-US"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-US/cart?offers=[country:US;currency:USD;priceRegionCode:A0;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-UK"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-GB/cart?offers=[country:GB;currency:GB;priceRegionCode:E5;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["ja-JP"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/ja-JP/cart?offers=[country:JP;currency:JPY;priceRegionCode:AI;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["fr-FR"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/fr-FR/cart?offers=[country:FR;currency:EUR;priceRegionCode:E0;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["de-DE"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/de-DE/cart?offers=[country:DE;currency:EUR;priceRegionCode:E0;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-AU"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-AU/cart?offers=[country:AU;currency:AUD;priceRegionCode:AH;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-NZ"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-NZ/cart?offers=[country:NZ;currency:NZD;priceRegionCode:AA;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-SG"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-SG/cart?offers=[country:SG;currency:SGD;priceRegionCode:AK;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-MY"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-MY/cart?offers=[country:MY;currency:USD;priceRegionCode:AG;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["ko-KR"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/ko-KR/cart?offers=[country:KR;currency:KRW;priceRegionCode:AE;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["en-CA"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/en-CA/cart?offers=[country:CA;currency:CAD;priceRegionCode:A2;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["es-MX"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/es-MX/cart?offers=[country:MX;currency:MXN;priceRegionCode:A6;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												} else if (["pt-BR"].indexOf(usi_app.locale) != -1) {
													aff_url = usi_app.checkout_url + "/pt-BR/cart?offers=[country:BR;currency:BRL;priceRegionCode:A7;quantity:1;offeringName:" + encodeURIComponent(usi_app.monthly_prod.name) + ";offeringId:" + usi_app.monthly_prod.product_id + ";offeringCode:" + usi_app.monthly_prod.plc + ";accessModelCode:S;termCode:A01;intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:B05;billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]";
												}

												if (["31809", "31843", "31847", "31839"].indexOf(usi_app.upsell_inpage.siteID) != -1) {
													// Adobe Analytics Click
													if (typeof usi_app.push_analytics_event_click === "function") {
														usi_app.push_analytics_event_click(
																".usi_inpage_upsell span",
																"Upsellit In-Page",
																"Subscription Term",
																aff_url
														);
													}
												}

												aff_url = usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(aff_url);
												var dest = usi_commons.domain + "/autolink.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + usi_app.upsell_inpage.key + "&uselink=" + encodeURIComponent(aff_url);
												usi_commons.log("[ remove_odm_cart_item ] dest:", dest);
												window.location = dest;
											};
											usi_options.func = 'usi_app.remove_odm_cart_item("' + prod.product_id + '",' + usi_options.cb + ');';
										}
										usi_app.load_upsell(usi_options, prod, true);
									}
								}
							}
						});
					});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.upsells_dr = function () {
			//Check if eligible to show Upsell campaigns for DR carts
			try {
				var names = document.getElementsByClassName("product-name dr_prodName");
				if (names.length == 0) return;
				var usi_options = usi_app.upsell_text_setter();
				if (usi_options.cta != "") {
					//if (!usi_app.products || usi_app.check_all_for_suppression(usi_app.products)) return;
					// -------------------------------------------------------------------------
					// -------------------------------------------------------------------------
					// [ Cloud Upsells ] Interject here to see if we should load single item upsell for India & Korea (special cart page)
					if (!usi_cookies.value_exists("usi_suppress_cloud_upsell") && typeof usi_company_json.cloud_products_upsell_matrix[usi_app.locale] !== "undefined") {
						// Exit function here if cloud upsell available
						if (usi_app.check_cloud_upsells()) {
							usi_commons.log("[USI] Cloud Upsell Found. (DR)");
							return;
						}
					}
					// -------------------------------------------------------------------------
					// -------------------------------------------------------------------------

					usi_app.products.forEach(function (prod, i) {
						// Only fetch data for last product in cart
						if (i === usi_app.products.length - 1) {
							var plc = usi_app.get_plc(prod.product_id);
							if (!plc && !prod.plc) {
								usi_commons.log('[ upsells_dr ] Wait for PLC');
								setTimeout(function () {
									usi_app.upsells_dr();
								}, 500);
							} else {
								prod.plc = plc || usi_app.plc;
								usi_app.get_upsell_info_dynamic(prod, function (upsell) {
									usi_app.delete_link = names[i].parentNode.parentNode.getElementsByClassName("dr_deleteItemLink")[0].href;
									usi_options.product_id = prod.product_id;
									usi_options.node = document.getElementsByClassName("product-row")[i];
									usi_options.qty = prod.qty;
									if (upsell.upsell_pid != null && usi_app.bundle_offers[upsell.upsell_pid] != null) usi_options.bundle_key = upsell.upsell_pid;
									if (usi_options.bundle_key) usi_options.func = "usi_app.switch_items_store_cart_domain(" + '"' + usi_options.bundle_key + '"' + ");";
									if (usi_app.usi_load_compat && upsell.bundle_offer && upsell.bundle_offer.copy) {
										usi_options.text = upsell.bundle_offer.copy;
										usi_options.cta = upsell.bundle_offer.cta;
										usi_options.url = upsell.bundle_offer.url;
									}
									else {
										usi_options.func = "usi_app.switch_items_dr(" + prod.product_id + "," + upsell.upsell_pid + "," + prod.qty + ");";
									}
									if (["en-SG", "en-MY", "ko-KR"].indexOf(usi_app.locale) != -1 && usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1 && (prod.type == "month" || prod.type == "\uC6D4\uBCC4")) {
										if (usi_app.count_monthly_subscriptions() == 1) usi_app.load_upsell(usi_options, prod.name_dr_full, 1);
									} else {
										usi_app.load_upsell(usi_options, prod.name_dr_full);
									}
								});
							}
						}
					});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_upsell_info_dynamic = function (prod, cb) {
			try {
				usi_commons.log('[ get_upsell_info_dynamic ] prod:', prod);
				//if (typeof usi_app.plc != "undefined") prod['plc'] = usi_app.plc;
				if (prod.product_id && prod.plc && prod.type && prod.qty && typeof cb === "function") {
					var RVTLT_en_AU_1_year = false;
					var RVTLT_en_UK_1_year = false;
					var RVTLT_en_EU_1_year = false;
					var RVTLT_en_CA_1_year = ["en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'RVTLT' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var RVTLT_en_US_1_year = ["en-US"].indexOf(usi_app.locale) != -1 && prod.plc === 'RVTLT' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var ACDLT_en_CA_1_year = usi_app.is_enabled && ["en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'ACDLT' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var ACDLT_en_US_1_year = usi_app.is_enabled && ["en-US"].indexOf(usi_app.locale) != -1 && prod.plc === 'ACDLT' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var FSN_en_AU_1_year = usi_date.is_between('2026-02-26T00:00:00-08:00', '2027-01-31T23:59:00-08:00') && ["en-AU"].indexOf(usi_app.locale) != -1 && prod.plc === 'FSN' && prod.type == "1-year" && (prod.qty == "1" || prod.qty == "2" || prod.qty == "3");
					var FSN_en_US_1_year = usi_date.is_between('2026-02-26T00:00:00-08:00', '2027-01-31T23:59:00-08:00') && ["en-US"].indexOf(usi_app.locale) != -1 && prod.plc === 'FSN' && prod.type == "1-year" && (prod.qty == "1" || prod.qty == "2" || prod.qty == "3");
					var FSN_en_CA_1_year = usi_date.is_between('2026-02-26T00:00:00-08:00', '2027-01-31T23:59:00-08:00') && ["en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'FSN' && prod.type == "1-year" && (prod.qty == "1" || prod.qty == "2" || prod.qty == "3");
					var FSN_en_UK_1_year = usi_date.is_between('2026-02-26T00:00:00-08:00', '2027-01-31T23:59:00-08:00') && ["en-UK"].indexOf(usi_app.locale) != -1 && prod.plc === 'FSN' && prod.type == "1-year" && (prod.qty == "1" || prod.qty == "2" || prod.qty == "3");
					var FSN_de_DE_1_year = usi_date.is_between('2026-02-26T00:00:00-08:00', '2027-01-31T23:59:00-08:00') && ["de-DE"].indexOf(usi_app.locale) != -1 && prod.plc === 'FSN' && prod.type == "1-year" && (prod.qty == "1" || prod.qty == "2" || prod.qty == "3");

					// (2025) Upsell | Cyber Week, In-Page
					var RVT_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'RVT' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var CIV3D_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'CIV3D' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var ACDIST_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && usi_cookies.value_exists("usi_cw_aec_eligible") && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'ACDIST' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var INVPROSA_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'INVPROSA' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var ACDIST_en_US_1_year_pdm = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && usi_cookies.value_exists("usi_cw_pdm_eligible") && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'ACDIST' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var MAYA_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === 'MAYA' && prod.type == "1-year" &&  usi_app.products.length == 1;
					var DSMAX_en_US_1_year = usi_date.is_between('2025-12-01T00:00:00-08:00', '2025-12-05T20:59:00-08:00') && ["en-US","en-CA"].indexOf(usi_app.locale) != -1 && prod.plc === '3DSMAX' && prod.type == "1-year" &&  usi_app.products.length == 1;

					// Check for bundle upsell
					if ((["en-US", "en-CA", "fr-CA"].indexOf(usi_app.locale) != -1 && (prod.plc === 'ACDIST' || prod.plc === 'ACDLT')) ||
							(["en-US"].indexOf(usi_app.locale) != -1 && prod.type == "1-year" && (prod.plc === 'F36MEIA' || prod.plc === 'F360ME' || prod.plc === 'F360SE' || prod.plc === 'F360PDE')) ||
							(["en-NZ", "en-AU"].indexOf(usi_app.locale) != -1 && (prod.plc === 'ACDIST' || prod.plc === 'ACDLT')) ||
							(["en-MY", "en-SG", "ko-KR", "zh-CN"].indexOf(usi_app.locale) != -1 && (prod.plc === 'ACDIST' || prod.plc === 'ACDLT' || prod.plc === 'ACD')) ||
							(["en-UK", "en-SE"].indexOf(usi_app.locale) != -1 && (prod.plc === 'ACDIST' || prod.plc === 'ACDLT')) ||
							(RVTLT_en_AU_1_year) ||
							(RVTLT_en_UK_1_year) ||
							(RVTLT_en_EU_1_year) ||
							(RVTLT_en_CA_1_year) ||
							(RVTLT_en_US_1_year) ||
							(ACDLT_en_CA_1_year) ||
							(ACDLT_en_US_1_year) ||
							(RVT_en_US_1_year) ||
							(CIV3D_en_US_1_year) ||
							(ACDIST_en_US_1_year) ||
							(INVPROSA_en_US_1_year) ||
							(ACDIST_en_US_1_year_pdm) ||
							(MAYA_en_US_1_year) ||
							(DSMAX_en_US_1_year) ||
							(FSN_en_AU_1_year) ||
							(FSN_en_US_1_year) ||
							(FSN_en_CA_1_year) ||
							(FSN_en_UK_1_year) ||
							(FSN_de_DE_1_year) ||
							(usi_app.emea.indexOf(usi_app.locale) != -1 && (prod.plc === 'ACDIST' || prod.plc === 'ACDLT'))) {

						//bypass desktop only check (Cyber Week)
						if (RVT_en_US_1_year || CIV3D_en_US_1_year || ACDIST_en_US_1_year || INVPROSA_en_US_1_year || ACDIST_en_US_1_year_pdm || MAYA_en_US_1_year || DSMAX_en_US_1_year) {
							usi_app.is_product_upgrade_inpage_cw = true;
						}

						//bypass in-page lift test
						if (FSN_en_AU_1_year || FSN_en_US_1_year || FSN_en_CA_1_year || FSN_en_UK_1_year || FSN_de_DE_1_year) {
							usi_app.is_inpage_lift_test_bypass = true;
						}

						//bypass in-page desktop only check
						if (FSN_en_AU_1_year || FSN_en_US_1_year || FSN_en_CA_1_year || FSN_en_UK_1_year || FSN_de_DE_1_year) {
							usi_app.is_inpage_device_check_bypass = true;
						}

						//bypass desktop only check for some inpage upgrade campaigns
						if (RVTLT_en_AU_1_year || RVTLT_en_UK_1_year || RVTLT_en_EU_1_year || RVTLT_en_CA_1_year || RVTLT_en_US_1_year || ACDLT_en_CA_1_year || ACDLT_en_US_1_year) {
							usi_app.is_product_upgrade_inpage = true;
						}

						if (prod.type.indexOf("Y") != -1 || prod.type.indexOf("M") != -1) prod.type = prod.type.toLowerCase();
						var bundle_key = prod.plc + '_' + usi_app.locale + '_' + prod.type.replace(' ', '-');
						if (["en-US"].indexOf(usi_app.locale) != -1 && prod.type == "1-year" && (prod.plc === 'F36MEIA' || prod.plc === 'F360ME' || prod.plc === 'F360SE' || prod.plc === 'F360PDE')) {
							// US | Fusion Extensions (siteID 55305)
							bundle_key = prod.plc + '_' + usi_app.locale;
							usi_app.is_fusion_extension = true;
						}
						//fix
						if (usi_app.emea.indexOf(usi_app.locale) != -1 || ["zh-CN", "ko-KR"].indexOf(usi_app.locale) != -1) {
							if (bundle_key.indexOf('_1') != -1) bundle_key = bundle_key.split('_1')[0] + "_1-year";
							if (bundle_key.indexOf('_3') != -1) bundle_key = bundle_key.split('_3')[0] + "_3-year";
						}

						// modify bundle key during cyber week
						if (ACDIST_en_US_1_year_pdm) {
							bundle_key += "_pdm";
						}

						usi_commons.log('[USI] checking bundle_key:', bundle_key);
						if ((typeof usi_app.bundle_offers[bundle_key] !== "undefined" && usi_app.bundle_offers[bundle_key].qty.indexOf(prod.qty) !== -1)) {
							if (FSN_en_AU_1_year || FSN_en_US_1_year || FSN_en_CA_1_year || FSN_en_UK_1_year || FSN_de_DE_1_year || usi_app.apac.indexOf(usi_app.locale) != -1 || usi_app.anz.indexOf(usi_app.locale) != -1 || ["tr-TR", "en-SE"].indexOf(usi_app.locale) != -1) {
								usi_app.usi_load_compat = true;
							}
							usi_commons.log('[USI] bundle found. bundle_key:', bundle_key);
							cb({
								upsell_pid: bundle_key,
								upsell_type: 'bundle',
								plc: prod.plc,
								bundle_offer: usi_app.bundle_offers[bundle_key]
							});
							return;
						}

					}

					// Check for 1yr & 3yr upsell
					usi_app.get_json_extra(prod, function (json_extra) {
						usi_commons.log('[ get_upsell_info_dynamic ] json_extra:', json_extra);
						if (json_extra) {
							var upsell_pid, upsell_type;
							for (var prop in json_extra) {
								if (Object.prototype.hasOwnProperty.call(json_extra, prop)) {
									if (prod.product_id === json_extra[prop]) {
										if (prop === '1y') {
											upsell_pid = json_extra['3y'];
											upsell_type = 'yearly';
										} else if (prop === '1m') {
											upsell_pid = json_extra['1y'];
											upsell_type = 'monthly';
										}
									}
								}
							}
							if (upsell_pid) {
								cb({
									upsell_pid: upsell_pid,
									upsell_type: upsell_type,
									plc: prod.plc
								});
							}
						} else {
							// Fall back on pid lists
							if (usi_company_json.upsell_pids_list[prod.product_id]) {
								cb({
									upsell_pid: usi_company_json.upsell_pids_list[prod.product_id],
									upsell_type: 'yearly',
									plc: prod.plc
								});
							} else if (usi_company_json.upsell_pids_list_monthly[prod.product_id]) {
								cb({
									upsell_pid: usi_company_json.upsell_pids_list_monthly[prod.product_id],
									upsell_type: 'monthly',
									plc: prod.plc
								});
							} else if (((["ko-KR", "en-MY", "en-SG", "en-US", "en-UK", "en-AU", "en-NZ"].indexOf(usi_app.locale) != -1)
									|| (["ja-JP", "fr-FR", "de-DE"].indexOf(usi_app.locale) != -1 && prod.plc == "FSN"))
									&& prod.type == "1-month"
									&& usi_app.upsell_plcs_monthly_new.indexOf(prod.plc) !== -1) {
								cb({
									upsell_pid: "A01",
									upsell_type: 'monthly',
									plc: prod.plc
								});
							} else if (
								prod.type == "1-month"
								&& ((["en-AU", "ja-JP"].indexOf(usi_app.locale) != -1 && (prod.plc == "RVT" || prod.plc == "RVTLT" || prod.plc == "AECCOL"))
									|| (["ja-JP"].indexOf(usi_app.locale) != -1 && (prod.plc == "ACDIST" || prod.plc == "ACD")))
							) {
								cb({
									upsell_pid: "A01",
									upsell_type: 'monthly',
									plc: prod.plc
								});
							} else if (
								prod.type == "1-month"
								&& ["en-US"].indexOf(usi_app.locale) != -1
								&& (prod.plc == "RVT" || prod.plc == "RVTLT" || prod.plc == "AECCOL")
							) {
								cb({
									upsell_pid: "A01",
									upsell_type: 'monthly',
									plc: prod.plc
								});
							} else if (
								prod.type == "1-month"
								&& ["en-CA", "es-MX", "pt-BR"].indexOf(usi_app.locale) != -1
								&& (usi_app.upsell_plcs_monthly_new.indexOf(prod.plc) !== -1 || prod.plc == "RVT" || prod.plc == "RVTLT" || prod.plc == "AECCOL")
							) {
								cb({
									upsell_pid: "A01",
									upsell_type: 'monthly',
									plc: prod.plc
								});
							}
						}
					});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.load_upsell = function (options, prod, monthly) {
			try {
				if (usi_cookies.get("usi_upsell_displayed") != null) return usi_commons.log('[ load_upsell ] Suppressing All Upsells');
				if (!usi_app.is_fusion_extension && usi_app.suppressf360) return;
				//if (usi_app.check_all_for_suppression(usi_app.products)) return;
				usi_commons.log('[ load_upsell ] options:', options);
				usi_commons.log('[ load_upsell ] prod:', prod);

				var usi_upsell_banner_bg_color = "#333333 !important";
				var usi_upsell_div = document.createElement("div");
				usi_upsell_div.setAttribute("class", "usi_upsell_div");

				usi_app.append_upsell_link = "";
				usi_app.upsell_inpage = {};
				var key = (typeof monthly !== "undefined") ? usi_app.locale + '_monthly' : usi_app.locale;

				if (typeof (usi_app.options) == "undefined"
						&& (usi_commons.device == "desktop" || (typeof monthly !== "undefined") || ((usi_app.is_inpage_device_check_bypass || usi_app.is_product_upgrade_inpage_cw || usi_app.is_product_upgrade_inpage || usi_app.is_fusion_extension) && usi_commons.device == "mobile"))
						&& usi_cookies.get("usi_upsell_displayed") == null) {
					usi_app.options = options;
					// Americas
					if (usi_app.americas.indexOf(usi_app.locale) != -1) {
						if (options.bundle_key) {
							if (usi_cookies.value_exists("usi_aff_suppress")) return;
							// Set bundle upsell config
							if (usi_app.is_product_upgrade_inpage_cw) {
								usi_app.usi_load_compat = true;
								usi_app.upsell_inpage.hash = "cYpQBPPpAmuowGHCmJpbkEX";
								usi_app.upsell_inpage.siteID = "61247";
								usi_commons.log("[USI] product upgrade. Loading ", usi_app.upsell_inpage.siteID);
								key = options.bundle_key + "_" + usi_commons.device;
							} else if (options.bundle_key == "RVTLT_en-CA_1-year" || options.bundle_key == "RVTLT_en-US_1-year" || options.bundle_key == "ACDLT_en-CA_1-year" || options.bundle_key == "ACDLT_en-US_1-year") {
								usi_app.usi_load_compat = true;
								usi_commons.log("[USI] product upgrade. Loading 60883");
								usi_app.upsell_inpage.hash = "f0IRjqMu712kl5PpPZYQFM7";
								usi_app.upsell_inpage.siteID = "60883";
								key = options.bundle_key + "_" + usi_commons.device;
							} else if (usi_app.is_fusion_extension) {
								usi_commons.log("[USI] Fusion Extensions identified. Loading 55305.");
								usi_app.upsell_inpage.hash = "KJG47nHCUm45DlrFHdvEV99";
								usi_app.upsell_inpage.siteID = "55305";
								usi_app.multiple_fusion_extensions_in_cart = true;
								key = options.bundle_key + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								usi_app.usi_load_compat = true;
							} else {
								usi_commons.log("[USI] bundle identified. Loading 37045.");
								usi_app.upsell_inpage.hash = "I9YBxYPEPZnJsKRRcYVOVPM";
								usi_app.upsell_inpage.siteID = "37045";
								key = options.bundle_key;
							}
						} else {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_app.upsell_inpage.hash = "NqXdwJIIhBZqFByv6V3dlLJ";
							usi_app.upsell_inpage.siteID = "31809";
							if (typeof monthly !== "undefined") {
								// extra config data needed for new monthly upsells
								usi_upsell_banner_bg_color = "#C34922 !important";
								key = key + "_" + prod.plc + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								// updated copy
								if (usi_app.locale == "en-US") {
									if (prod.plc == "ACDIST") {
                                        usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "ACDLT") {
                                        usi_app.options.text = "Save 36% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "FSN") {
                                        usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVT") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVTLT") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "AECCOL") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									}
								} else if (usi_app.locale == "en-CA") {
									if (prod.plc == "ACDIST") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "ACDLT") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "FSN") {
										usi_app.options.text = "Save 35% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVT") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVTLT") {
										usi_app.options.text = "Save 32% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "AECCOL") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									}
								} else if (usi_app.locale == "es-MX") {
									if (prod.plc == "ACDIST") {
										usi_app.options.text = "Ahorre un 33%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									} else if (prod.plc == "ACDLT") {
										usi_app.options.text = "Ahorre un 33%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									} else if (prod.plc == "FSN") {
										usi_app.options.text = "Ahorre un 33%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									} else if (prod.plc == "RVT") {
										usi_app.options.text = "Ahorre un 34%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									} else if (prod.plc == "RVTLT") {
										usi_app.options.text = "Ahorre un 32%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									} else if (prod.plc == "AECCOL") {
										usi_app.options.text = "Ahorre un 33%  sobre el precio mensual con una suscripci\u00F3n de 1 a\u00F1o.";
										usi_app.options.cta = "Actualizar ahora.";
									}
								} else if (usi_app.locale == "pt-BR") {
									if (prod.plc == "ACDIST") {
										usi_app.options.text = "Poupe 33% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									} else if (prod.plc == "ACDLT") {
										usi_app.options.text = "Poupe 33% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									} else if (prod.plc == "FSN") {
										usi_app.options.text = "Poupe 33% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									} else if (prod.plc == "RVT") {
										usi_app.options.text = "Poupe 34% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									} else if (prod.plc == "RVTLT") {
										usi_app.options.text = "Poupe 32% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									} else if (prod.plc == "AECCOL") {
										usi_app.options.text = "Poupe 33% sobre o pre\u00E7o mensal com uma subscri\u00E7\u00E3o anual.";
										usi_app.options.cta = "Atualize agora.";
									}
								}
							}
						}
					}
					// EMEA
					else if (usi_app.emea.indexOf(usi_app.locale) != -1) {
						usi_app.usi_load_compat = false; // set to true once we migrate all locales to config pointer instead of autoload.jsp
						if (options.bundle_key) {
							if (usi_cookies.value_exists("usi_aff_suppress")) return;
							if (options.bundle_key == "RVTLT_en-EU_1-year") {
								usi_app.usi_load_compat = true;
								usi_commons.log("[USI] product upgrade. Loading 60841");
								usi_app.upsell_inpage.hash = "8f6dOvWdxVxeFW2ivQW0BJS";
								usi_app.upsell_inpage.siteID = "60841";
								key = options.bundle_key + "_" + usi_commons.device;
							} else {
								usi_app.usi_load_compat = true;
								usi_commons.log("[USI] bundle identified. Loading ");
								usi_app.upsell_inpage.hash = "Dvs5VtEsekKMC97KyAMcVSs";
								usi_app.upsell_inpage.siteID = "48415";
								key = options.bundle_key;
							}
						} else {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_app.upsell_inpage.hash = "HLEKFiXoGtHqkNMuBUmG403";
							usi_app.upsell_inpage.siteID = "31823";
							if (typeof monthly !== "undefined") {
								// extra config data needed for new monthly upsells
								usi_upsell_banner_bg_color = "#C34922 !important";
								key = key + "_" + prod.plc + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								// updated copy
								if (["fr-FR"].indexOf(usi_app.locale) != -1){
									if (prod.plc == "FSN") {
										usi_app.options.text = "Offre \u00E0 dur\u00E9e limit\u00E9e : \u00E9conomisez 30% de plus sur les abonnements de 1 an \u00E0 Fusion.";
										usi_app.options.cta = "Profitez-en d\u00E8s maintenant!";
									}
								} else if (["de-DE"].indexOf(usi_app.locale) != -1){
									if (prod.plc == "FSN") {
										usi_app.options.text = "Begrenztes Angebot: Sparen Sie zus\u00E4tzliche 30 % bei einj\u00E4hrigen Abonnements f\u00FCr Fusion.";
										usi_app.options.cta = "Jetzt upgraden.";
									}
								}
							}
						}
					}
					// ANZ
					else if (usi_app.anz.indexOf(usi_app.locale) != -1) {
						usi_app.usi_load_compat = true;
						if (options.bundle_key) {
							if (usi_cookies.value_exists("usi_aff_suppress")) return;
							if (options.bundle_key == "RVTLT_en-AU_1-year") {
								usi_commons.log("[USI] product upgrade. Loading 60783");
								usi_app.upsell_inpage.hash = "sRANU4t7g1ZYxcMH47utdSX";
								usi_app.upsell_inpage.siteID = "60783";
								key = options.bundle_key + "_" + usi_commons.device;
							} else {
								usi_commons.log("[USI] bundle identified. Loading 43739");
								usi_app.upsell_inpage.hash = "UqyN3ZSE3PaS8IbOfyaoPut";
								usi_app.upsell_inpage.siteID = "43739";
								key = options.bundle_key;
							}
						} else {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_app.upsell_inpage.hash = "yaOTagKuyOVbjQW7XZykIar";
							usi_app.upsell_inpage.siteID = "31839";
							if (typeof monthly !== "undefined") {
								usi_app.usi_load_compat = false;
								// extra config data needed for new monthly upsells
								usi_upsell_banner_bg_color = "#C34922 !important";
								key = key + "_" + prod.plc + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								// updated copy
								if (["en-AU"].indexOf(usi_app.locale) != -1) {
									if (prod.plc == "ACDIST") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "ACDLT") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "FSN") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVT") {
										usi_app.options.text = "Save 34% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "RVTLT") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "AECCOL") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									}
								} else if (["en-NZ"].indexOf(usi_app.locale) != -1) {
									if (prod.plc == "ACDIST") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "ACDLT") {
										usi_app.options.text = "Save 33% when you switch to a 1-year plan.";
										usi_app.options.cta = "Upgrade now.";
									} else if (prod.plc == "FSN") {
										usi_app.options.text = "Save an extra 30% on 1 year Fusion subscriptions.";
										usi_app.options.cta = "Upgrade now.";
									}
								}
							}
						}
						usi_commons.log("[USI] site ID:", usi_app.upsell_inpage.siteID);
					}
					// UK
					else if (usi_app.uk.indexOf(usi_app.locale) != -1) {
						usi_app.usi_load_compat = false; // set to true once we migrate all locales to config pointer instead of autoload.jsp
						if (options.bundle_key) {
							if (usi_cookies.value_exists("usi_aff_suppress")) return;
							if (options.bundle_key == "RVTLT_en-UK_1-year") {
								usi_app.usi_load_compat = true;
								usi_commons.log("[USI] product upgrade. Loading 60837");
								usi_app.upsell_inpage.hash = "u9EuMeUfauUbAhizb6WQZ1h";
								usi_app.upsell_inpage.siteID = "60837";
								key = options.bundle_key + "_" + usi_commons.device;
							} else {
								usi_app.usi_load_compat = true;
								usi_commons.log("[USI] bundle identified. Loading ");
								usi_app.upsell_inpage.hash = "TLkBWPCa1Ullhjl1OhZUpV5";
								usi_app.upsell_inpage.siteID = "48353";
								key = options.bundle_key;
							}
						} else {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_app.upsell_inpage.hash = "lF2HyuutKt8vLMYCgyXbCTB";
							usi_app.upsell_inpage.siteID = "31843";
							if (typeof monthly !== "undefined") {
								// extra config data needed for new monthly upsells
								usi_upsell_banner_bg_color = "#C34922 !important";
								key = key + "_" + prod.plc + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								// updated copy
								if (prod.plc == "ACDIST") {
									usi_app.options.text = "Save 32% when you switch to a 1-year plan.";
									usi_app.options.cta = "Upgrade now.";
								} else if (prod.plc == "ACDLT") {
									usi_app.options.text = "Save 31% when you switch to a 1-year plan.";
									usi_app.options.cta = "Upgrade now.";
								} else if (prod.plc == "FSN") {
									usi_app.options.text = "Save an extra 30% on 1 year Fusion subscriptions.";
									usi_app.options.cta = "Upgrade now.";
								}
							}
						}
					}
					// APAC (no overlay)
					else if (usi_app.apac.indexOf(usi_app.locale) != -1) {
						usi_app.usi_load_compat = true;
						if (options.bundle_key) {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_commons.log("[USI] bundle identified. Loading 43737");
							usi_app.upsell_inpage.hash = "rPT4lc7nzLmG3lQN3QO5DWP";
							usi_app.upsell_inpage.siteID = "43737";
							key = options.bundle_key;
						} else {
							if (usi_cookies.value_exists("usi_suppress_upsell") || usi_cookies.value_exists("usi_aff_suppress")) return;
							usi_app.upsell_inpage.hash = "Z6p6PsyC1SEVAMCjGveVMoe";
							usi_app.upsell_inpage.siteID = "31847";
							usi_commons.log("OPTIONS:", options);
							if (typeof monthly !== "undefined") {
								// extra config data needed for new monthly upsells
								key = key + "_" + usi_app.plc + "_" + usi_commons.device;
								usi_app.upsell_inpage.key = key;
								// updated copy
								if (["en-SG"].indexOf(usi_app.locale) != -1) {
									usi_app.usi_load_compat = false;
									usi_upsell_banner_bg_color = "#C34922 !important";
									if (usi_app.plc == "ACDIST") {
										usi_app.options.text = "Change to a 1-year subscription and save 34% compared to monthly price.";
										usi_app.options.cta = "Change now.";
									} else if (usi_app.plc == "ACDLT") {
										usi_app.options.text = "Change to a 1-year subscription and save 36% compared to monthly price.";
										usi_app.options.cta = "Change now.";
									}
								} else if (["en-MY"].indexOf(usi_app.locale) != -1) {
									usi_app.usi_load_compat = false;
									usi_upsell_banner_bg_color = "#C34922 !important";
									if (usi_app.plc == "ACDIST") {
										usi_app.options.text = "Change to a 1-year subscription and save 34% compared to monthly price.";
										usi_app.options.cta = "Change now.";
									} else if (usi_app.plc == "ACDLT") {
										usi_app.options.text = "Change to a 1-year subscription and save 37% compared to monthly price.";
										usi_app.options.cta = "Change now.";
									}
								} else if (["ko-KR"].indexOf(usi_app.locale) != -1) {
									usi_app.usi_load_compat = false;
									usi_upsell_banner_bg_color = "#C34922 !important";
									if (usi_app.plc == "ACDIST") {
										usi_app.options.text = "1\uB144 \uC11C\uBE0C\uC2A4\uD06C\uB9BD\uC158 \uAD6C\uB9E4 \uC2DC, \uC6D4\uBCC4 \uC11C\uBE0C\uC2A4\uD06C\uB9BD\uC158 \uB300\uBE44 33% \uB354 \uC808\uC57D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
										usi_app.options.cta = "\uC9C0\uAE08 \uBCC0\uACBD\uD558\uC138\uC694.";
									} else if (usi_app.plc == "ACDLT") {
										usi_app.options.text = "1\uB144\u00A0\uC11C\uBE0C\uC2A4\uD06C\uB9BD\uC158\u00A0\uAD6C\uB9E4\u00A0\uC2DC,\u00A0\uC6D4\uBCC4\u00A0\uC11C\uBE0C\uC2A4\uD06C\uB9BD\uC158\u00A0\uB300\uBE44\u00A036%\u00A0\uB354\u00A0\uC808\uC57D\uD560\u00A0\uC218\u00A0\uC788\uC2B5\uB2C8\uB2E4.";
										usi_app.options.cta = "\u00A0\uC9C0\uAE08 \uBCC0\uACBD\uD558\uC138\uC694.";
									}
								} else if (["ja-JP"].indexOf(usi_app.locale) != -1) {
									if (usi_app.plc == "FSN") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 36% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									} else if (usi_app.plc == "RVT") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 34% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									} else if (usi_app.plc == "RVTLT") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 32% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									} else if (usi_app.plc == "AECCOL") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 34% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									} else if (usi_app.plc == "ACDIST") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 33% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									} else if (usi_app.plc == "ACD") {
										usi_app.usi_load_compat = false;
										usi_upsell_banner_bg_color = "#C34922 !important";
										usi_app.options.text = "1 \u5E74\u5951\u7D04\u306E\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u6708\u984D\u6599\u91D1\u306E 34% \u304C\u304A\u5F97\u306B.";
										usi_app.options.cta = "\u4ECA\u3059\u3050\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9.";
									}
								}
							}
						}
						usi_commons.log("[USI] site ID:", usi_app.upsell_inpage.siteID);
					}
				}

				usi_app.log_stuff = function(msg) {
					usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?autodesk_control=" + encodeURIComponent(msg));
				}

				if (
					(typeof monthly !== "undefined" && ["en-CA", "en-US", "en-SG", "en-MY", "ko-KR", "ja-JP", "en-AU", "en-NZ"].indexOf(usi_app.locale) != -1 && usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1)
					|| (typeof monthly !== "undefined" && ["en-CA", "en-US"].indexOf(usi_app.locale) != -1 && ["RVT", "RVTLT", "AECCOL"].indexOf(usi_app.plc) != -1)
					|| (typeof monthly !== "undefined" && ["es-MX", "pt-BR"].indexOf(usi_app.locale) != -1 && (usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1 || ["RVT", "RVTLT", "AECCOL"].indexOf(usi_app.plc) != -1))
					|| usi_app.is_inpage_lift_test_bypass
				) {
					usi_app.log_stuff("Bypass " + ((typeof monthly !== "undefined" && ["en-CA", "en-US", "en-SG", "en-MY", "ko-KR", "ja-JP", "en-AU", "en-NZ"].indexOf(usi_app.locale) != -1 && usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1)) + "_" +
							(typeof monthly !== "undefined" && ["en-CA", "en-US"].indexOf(usi_app.locale) != -1 && ["RVT", "RVTLT", "AECCOL"].indexOf(usi_app.plc) != -1) + "_" +
							(typeof monthly !== "undefined" && ["es-MX", "pt-BR"].indexOf(usi_app.locale) != -1 && (usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1 || ["RVT", "RVTLT", "AECCOL"].indexOf(usi_app.plc) != -1)));
					// Bypass monthly in-page subscription upsell control test
				} else if (
					(typeof monthly !== "undefined" && ["en-UK", "fr-FR", "de-DE"].indexOf(usi_app.locale) != -1 && usi_app.upsell_plcs_monthly_new.indexOf(usi_app.plc) !== -1)
					|| (["en-AU", "en-UK", "en-EU", "en-CA", "en-US"].indexOf(usi_app.locale) != -1 && usi_app.is_product_upgrade_inpage)
					|| (usi_app.is_product_upgrade_inpage_cw)
				) {
					usi_app.log_stuff("Yay, not bypassing! " + usi_app.locale + "_" + usi_app.is_product_upgrade_inpage + "_" + usi_app.is_product_upgrade_inpage_cw);
					var monthly_upsell_control_siteid;
					// UK
					if (["en-UK"].indexOf(usi_app.locale) != -1 && !usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "54947";
					// EMEA
					else if (["fr-FR", "de-DE"].indexOf(usi_app.locale) != -1 && !usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "56103";
					// APAC
					//else if (["en-SG", "en-MY", "ko-KR", "ja-JP"].indexOf(usi_app.locale) != -1) monthly_upsell_control_siteid = "54993";
					// ANZ (monthly)
					//else if (["en-AU", "en-NZ"].indexOf(usi_app.locale) != -1 && !usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "56101";
					// en-AU (product upgrade)
					else if (["en-AU"].indexOf(usi_app.locale) != -1 && usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "60813";
					// UK (product upgrade)
					else if (["en-UK"].indexOf(usi_app.locale) != -1 && usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "60839";
					// EU (product upgrade)
					else if (["en-EU"].indexOf(usi_app.locale) != -1 && usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "60843";
					// Americas (product upgrade)
					else if (["en-CA", "en-US"].indexOf(usi_app.locale) != -1 && usi_app.is_product_upgrade_inpage) monthly_upsell_control_siteid = "60885";
					// Americas (Cyber Week)
					else if (usi_app.is_product_upgrade_inpage_cw) monthly_upsell_control_siteid = "61365";

					usi_app.log_stuff("monthly_upsell_control_siteid: " + monthly_upsell_control_siteid);

					usi_split_test.instantiate_callback(monthly_upsell_control_siteid, function(group){
						if (group === '0') {
							usi_commons.log("Control Group: " + group);
							usi_commons.log("[USI] Suppressing checkout inpage campaign");
							usi_app.upsell_inpage = {};
						} else if (group === '1') {
							usi_commons.log("Split Group: " + group);
							usi_commons.log("[USI] Loading checkout inpage campaign");
						}
					});
				} else {
					if (!usi_app.is_fusion_extension && usi_app.americas.indexOf(usi_app.locale) != -1 && prod.plc != "FSN") return;
				}

				// delay is needed to suppress monthly to annual subscription inpage campaign if Control Group is 0
				setTimeout(function () {
					if (usi_app.upsell_inpage && usi_app.upsell_inpage.hash && usi_app.upsell_inpage.siteID && typeof(options) !== "undefined" && typeof(options.node) !== "undefined") {
						usi_commons.log("[USI] Applying inpage campaign");
						// Load inpage banner

						usi_app.log_stuff("loading: " + usi_app.upsell_inpage.hash + "_" + usi_app.upsell_inpage.siteID + "_" + key);

						if (usi_app.usi_load_compat) {
							if (document.querySelector(".wd-strikethrough") == null) {
								usi_app.bundle_options = options;
								if (typeof usi_load != 'undefined') delete usi_load;
								// separate desktop/mobile configs (2026 in-page Bundles)
								if (["43739", "37045", "48353", "48415"].indexOf(usi_app.upsell_inpage.siteID) != -1) key = key + "_" + usi_commons.device;
								usi_commons.log("[USI] Loading Campaign", usi_app.upsell_inpage.siteID, "// Key:", key);
								usi_commons.load(usi_app.upsell_inpage.hash, usi_app.upsell_inpage.siteID, key);
							}
						}
						else {
							usi_commons.log("[USI] Old Loader Loading");
							//legacy code. phasing out as of 9/25/22
							usi_commons.load_script(usi_commons.domain + "/autoload.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + key, function () {
								if (typeof usi_autoload === "undefined" && usi_app.loading !== 63857) return;
								usi_app.bundle_options = options;
								usi_app.place_css([
									'.usi_inpage_upsell { background: ',usi_upsell_banner_bg_color,' ; width: 100%; color: #fff !important; padding: 11px 10px 10px 15px; clear: both; margin-top: 4px; }',
									'.usi_inpage_upsell span { text-decoration: underline; cursor: pointer; font-weight: bold; color: #fff !important;}',
									'.usi_inpage_upsell .usi_tos { text-decoration: underline; cursor: pointer; float: right; color: white !important; }',
									'.usi_promo_icon { enable-background: new 0 0 27.9 28; display: table-cell; height: 15px; width: 15px; vertical-align: top; float: left; fill: #fff !important; margin-right: 10px; margin-top: 1px; }',
									'.cart-widget .item .usi_upsell_div { margin: 0 20px 20px 20px; }',
									'.cart-widget .item:last-of-type .usi_upsell_div { margin: 20px 0 0 0; }'
								].join(""));
								var promo_icon = '<svg  viewBox="0 0 27.9 28" x="0px" y="0px" class="usi_promo_icon" xml:space="preserve" width="100%" height="100%"><path d="M13.6,0h-8L0,5.8v8l14.3,13.8l13.3-13.2L13.6,0z M6,8.1c-1.2,0-2.2-1-2.2-2.2s1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2S7.2,8.1,6,8.1z"></path></svg>';
								var style = usi_app.dr_cart ? 'display: inline-block; margin-top: 10px;' : '';
								if (options['tos'] && options['tos_link']) {
									usi_upsell_div.innerHTML = "<div style='" + style + "'  class=\"usi_inpage_upsell\">" + promo_icon + " " + options.text + " <span onclick='usi_app.remove_bar();" + options.func + "'>" + options.cta + "</span><a class='usi_tos' style='color: white !important; text-decoration-color: white !important;' target='_blank' href='" + options['tos_link'] + "'>" + options['tos'] + "</a></div>";
								} else {
									usi_upsell_div.innerHTML = "<div style='" + style + "'  class=\"usi_inpage_upsell\">" + promo_icon + " " + options.text + " <span onclick='usi_app.remove_bar();" + options.func + "'>" + options.cta + "</span></div>";
								}
								if (options.node.getElementsByClassName("usi_upsell_div").length == 0) {
									options.node.appendChild(usi_upsell_div);
								} else {
									options.node.getElementsByClassName("usi_upsell_div")[0].innerHTML = usi_upsell_div.innerHTML;
								}

								if (["31809", "31843", "31847", "31839"].indexOf(usi_app.upsell_inpage.siteID) != -1) {
									// Adobe Analytics View
									if (typeof usi_app.push_analytics_event_view === "function") {
										usi_app.push_analytics_event_view(
												"Upsellit In-Page",
												"Subscription Term"
										);
									}
								}

							});
						}
					}
				}, 500);

			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.guac_delay_load = function () {
			try {
				if (usi_app.suppressf360 || usi_app.collection_dest_link) return;
				//if (usi_app.check_all_for_suppression(usi_app.products)) return;
				// Clean up previous solutions
				if (typeof usi_js !== 'undefined' && typeof usi_js.cleanup === 'function') {
					usi_js.cleanup();
				}

				usi_app.is_checkout_payment_page = true;
				usi_company.load_campaigns(usi_company_json, usi_app.custom_rulesets);

			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.is_payment_page = function () {
			try {
				if (usi_app.emea_uk.indexOf(usi_app.locale) != -1 || ['ja-JP'].indexOf(usi_app.locale) != -1) return true; // [3/5/2024] Payment page is shown right away for EMEA/UK/Japan

				if (usi_app.is_odm_cart) {
					return document.querySelector('div.container-order-summary-MuiAccordionSummary-content') != null || document.querySelector('div.container-odm-accordion-payment-mfe-MuiAccordionSummary-content') != null || document.querySelector('div.container-odm-accordion-customer-details-MuiAccordionSummary-content') != null;
				} else if (usi_app.efulfilment) {
					return document.querySelector(".billing .accordion.active, .confirm .accordion.active") != null;
				} else if (usi_app.dr_cart) {
					try {
						if (document.getElementById("tosAccepted") != null) return true;
						else if (document.getElementsByClassName('step-2 wizard-option').length > 0 && document.getElementsByClassName('step-2 wizard-option')[0].className.indexOf('active') != -1) return true;
						else if (document.querySelector(".billing .accordion.active, .confirm .accordion.active") != null) return true;
						else if (document.querySelector(".payment .accordion.active") != null) return true;
						else if ((["en-US", "pt-BR", "es-MX", "en-CA", "fr-CA", "es-AR", "tr-TR"]).indexOf(usi_app.locale) != -1) return true;
						else if ((["en-MY"]).indexOf(usi_app.locale) != -1 && usi_cookies.value_exists('USI_Session')) return true;
					} catch (err) {
						usi_commons.report_error(err);
					}
					return false;
				} else if (usi_app.guac_cart) {
					var payment_section = document.getElementsByClassName("checkout--payment-section--toggleable")[0];
					if (payment_section != null && (["en-US", "pt-BR", "es-MX", "en-CA", "fr-CA", "es-AR"]).indexOf(usi_app.locale) == -1) {
						return payment_section.dataset['watPageSectionEnabled'] == "true";
					}
					return document.getElementsByClassName("checkout--payment-section--toggleable") != null;
				} else if (usi_app.is_cb_cart) {
					return true;
				} else {
					return location.href.indexOf("payment/method") != -1 || location.href.indexOf("/cart/review") != -1;
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_product_page = function() {
			usi_commons.log("usi_app.scrape_product_page()");
			try {
				var product = {};
				product.link = location.protocol + '//' + location.host + location.pathname;
				product.pid = usi_app.locale + "_" + "ACD" + "_" + "1-YEAR";
				product.image = document.querySelector('.cmp-navigation-top-nav__logo img').src;
				product.name = document.querySelector('.cmp-navigation-top-nav__logo img').alt;
				product.price = document.querySelector('product-price[plc="ACD"][type="regular"][billing-plan="1-YEAR"] span.mfe-product-price--regular').textContent;
				product.in_stock = true;
				product.extra = JSON.stringify({
					stock: product.in_stock ? "INSTOCK" : "OUTOFSTOCK"
				});
				return product;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		
		usi_app.rescrape_cart = function () {
			try {
				usi_commons.log("[USI] rescrape_cart()");
				if (!usi_app.is_confirmation_page) {
					if (usi_app.is_odm_cart) {
						usi_app.products = usi_app.set_rescrape(usi_app.scrape_odm_cart, true);
					} else if (usi_app.guac_cart) {
						usi_app.find_cart_reference();
						usi_app.products = usi_app.set_rescrape(usi_app.scrape_guac_cart, true);
					} else if (usi_app.dr_cart && usi_app.dr_cart_available) {
						usi_app.products = usi_app.set_rescrape(usi_app.scrape_dr_cart, true);
						usi_app.upsells_dr();
					} else if (usi_app.is_cb_cart) {
						usi_app.save_cb_cart();
					}
					usi_app.extract_plcs();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.extract_plcs = function () {
			try {
				if (usi_app.products && usi_app.products.length > 0) {
					var plc_map = usi_cookies.get_json('usi_plc_map') || {};
					usi_app.plcs_in_cart = [];
					usi_app.products.forEach(function (prod) {
						//if (prod['plc'] && usi_app.locale == "ko-KR") delete prod['plc'];
						if (usi_cookies.value_exists("usi_last_plc") && usi_app.locale == "tr-TR") prod['plc'] = usi_cookies.get("usi_last_plc");

						// Set plc via cookie if available
						if (!prod['plc'] && prod['product_id'] && plc_map[prod['product_id']]) {
							prod['plc'] = plc_map[prod['product_id']];
						} else if (!prod['plc'] && prod['product_id']) {
							try {
								//check session storage for PLC data
								function getNames(objects) {
									return Object.keys(objects);
								}

								var cart_data_trait = getNames(JSON.parse(JSON.stringify(sessionStorage))).filter(function (v) {
									return v.indexOf("_cartData") > -1
								});
								if (cart_data_trait.length > 0) {
									var line_items = JSON.parse(sessionStorage[cart_data_trait]).cart.lineItems.lineItem;
									var current_item = line_items.filter(function (v) {
										return v.product.id == prod.product_id
									});
									if (current_item.length > 0 && current_item[0].product && current_item[0].product.parentProduct && current_item[0].product.parentProduct.externalReferenceId) {
										prod['plc'] = current_item[0].product.parentProduct.externalReferenceId.split("-")[0];
									}
								}
							} catch (err) {
								usi_commons.report_error(err);
							}
						}
						if (prod['plc']) {
							usi_app.plcs_in_cart.push(prod['plc']);
							if (!usi_app.plc) {
								usi_app.plc = prod['plc'];
								usi_cookies.set('usi_last_plc', usi_app.plc, usi_cookies.expire_time.week);
							}
						}
					});
				}
				usi_commons.log('[ extract_plcs ] products:', usi_app.products);
				usi_commons.log('[ extract_plcs ] plcs_in_cart:', usi_app.plcs_in_cart);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.update_plc_map = function (plc, ids) {
			try {
				usi_commons.log('[ update_plc_map ] plc:', plc);
				usi_commons.log('[ update_plc_map ] ids:', ids);
				var plc_map = usi_cookies.get_json('usi_plc_map') || {};
				for (var prop in ids) {
					if (Object.prototype.hasOwnProperty.call(ids, prop)) plc_map[ids[prop]] = plc;
				}
				usi_commons.log('[ update_plc_map ] map:', plc_map);
				usi_cookies.set_json('usi_plc_map', plc_map, usi_cookies.expire_time.week);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.apply_event_listener_recheck_cart = function (target, action) {
			try {
				usi_app.events_bound = true;
				var target_elements = document.querySelectorAll(target);
				if (target_elements && target_elements.length > 0) {
					for (var i = 0; i < target_elements.length; i++) {
						target_elements[i].addEventListener(action, function () {
							var plc = this.getAttribute('data-wat-val');
							if (plc && plc.indexOf(':') !== -1) {
								usi_cookies.set('usi_last_plc', plc.split(':')[0], usi_cookies.expire_time.week);
							}
						});
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.look_for_locale_modal = function () {
			try {
				var modal_cta = document.querySelector('a[data-wat-linkname="view on local site"]');
				if (modal_cta == null) modal_cta = document.querySelector('a[data-wat-linkname="View on local site"]');
				if (modal_cta && modal_cta.href) {
					var url = modal_cta.href;
					var copy = modal_cta.textContent.trim();
					usi_commons.log('[ look_for_locale_modal ] Locale redirect modal found!');
					usi_cookies.set("usi_locale_redirect_url", encodeURIComponent(url), usi_cookies.expire_time.hour, true);
					usi_cookies.set("usi_locale_redirect_copy", usi_app.encode_unicode(copy), usi_cookies.expire_time.hour, true);
					usi_commons.log('[ look_for_locale_modal ] copy (original):', copy);
					usi_commons.log('[ look_for_locale_modal ] copy (encoded):', usi_app.encode_unicode(copy));
					usi_commons.log('[ look_for_locale_modal ] url:', encodeURIComponent(url));
				} else {
					setTimeout(function () {
						usi_app.look_for_locale_modal();
					}, 1000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.close_on_idle_modal = function () {
			try {
				var idle_modal = document.getElementById("checkout--liveagent--modal");
				if (idle_modal != null) {
					var observer = new MutationObserver(function () {
						// sessionStorage.getItem("nonsensitiveHasProactiveChatLaunched") == "true"
						if (typeof usi_js != "undefined" && idle_modal.className.indexOf("wd-modal-hidden") == -1) {
							usi_js.close();
							observer.disconnect();
						}
					});
					observer.observe(idle_modal, {attributes: true});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.get_json_extra = function (prod, cb) {
			try {
				if (prod.plc && typeof cb === "function" && usi_app.locale && usi_app.upsell_plcs.indexOf(prod.plc) !== -1) {
					var new_prod = Object.assign({}, prod);

					var json_extra = {};
					// Use ids scraped from page
					if (new_prod.terms && new_prod.terms['1 YEAR']) {
						json_extra['1y'] = new_prod.terms['1 YEAR'];
						json_extra['3y'] = new_prod.terms['3 YEAR'];
						json_extra['1m'] = new_prod.terms['1 MONTH'];
						cb(json_extra);
						return;
					}
					// Pull pids from recs
					var locale = usi_app.locale;
					var rec_id = locale + '_' + prod.plc;
					usi_commons.log('[ get_json_extra ] Fetching recs for rec_id:', rec_id);

					// we don't need to pull product data for any campaign 12/19/2024
					// callback is needed
					cb();
					
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.load_product_data = function (options) {
			try {
				var queryStr = "";
				var params = ['siteID', 'association_siteID', 'pid', 'less_expensive', 'rows', 'days_back', 'match', 'nomatch', 'force_exact'];
				params.forEach(function (name, index) {
					if (options[name]) {
						queryStr += (index == 0 ? "?" : "&") + name + '=' + options[name];
					}
				});
				usi_commons.load_script(usi_commons.cdn + '/utility/product_recommendations.jsp' + queryStr, function () {
					if (typeof options.callback === 'function' && typeof usi_app.product_rec !== 'undefined') {
						options.callback(usi_app.product_rec);
					}
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.campaign_persist_callback = function (element, load_function, sid) {
			//used in 43739
			if (document.querySelector(element) == null) {
				usi_commons.log("[USI] Campaign Lost. Reloading Campaign.");
				clearInterval(usi_app.campaign_persist_interval);
				usi_js = undefined;
				usi_app.upsell_loaded = undefined;
				delete window["usi_" + sid];
				usi_app.main();
			}
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
		usi_app.campaign_persist = function (element, load_function, sid) {
			try {
				usi_app.campaign_persist_interval = setInterval(function () {
					usi_app.campaign_persist_callback(element, load_function, sid);
				}, 1000);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.remove_bar = function () {
			// Remove existing bar if found
			var bar = document.querySelector('.usi_upsell_div');
			if (bar) bar.parentNode.removeChild(bar);
		};
		usi_app.add_loading_graphic = function (message) {
			try {
				usi_app.remove_loading_graphic();
				var txt = '';
				var usi_loading_container = document.createElement('div');
				var wrapper_dynamic_styles = 'top: 0%; left: 0%; width: 100%; height: 100%;';
				var circle_bg = '<svg style="width: 100px;position: absolute;top: 50%;left: 50%;margin-top: -50px;margin-left: -50px;" class="css-13o7eu2" viewBox="22 22 44 44"><circle style="stroke: #d1d1d1;" class="css-1pw0iqb" cx="44" cy="44" r="20.2" fill="none" stroke-width="1.6" style="stroke-dasharray: 126.92; stroke-dashoffset: 0px;"></circle></svg>';
				var circle_p1 = '<svg style="width: 100px;position: absolute;top: 50%;left: 50%;margin-top: -50px;margin-left: -50px;" class="css-13o7eu2" viewBox="22 22 44 44"><circle style="stroke: #333; stroke-dasharray: 80px, 200px; stroke-dashoffset: 0; animation: 1500ms ease-in-out 0s infinite normal none running MuiCircularProgress-keyframes-circular-dash;" class="css-cuwlx0" cx="44" cy="44" r="20.2" fill="none" stroke-width="1.6"></circle></svg>'; //This is a classname taken from the client site, ignore bug
				var gif = [circle_bg, circle_p1].join('');
				usi_loading_container.innerHTML =
						[
							'<div id="usi_loading_graphic" style="position: fixed; ' + wrapper_dynamic_styles + ' background: rgba(228,228,228,0.5); z-index: 100000;">',
							txt,
							gif,
							'</div>'
						].join('');
				var css = document.createElement("style");
				css.textContent = "@keyframes MuiCircularProgress-keyframes-circular-dash{" +
						"0% { stroke-dasharray: 1px,200px;  stroke-dashoffset: 0px; }" +
						"50% { stroke-dasharray: 100px,200px;  stroke-dashoffset: -15px; }" +
						"100% { stroke-dasharray: 100px,200px;  stroke-dashoffset: -125px; }" +
						"}";
				document.body.appendChild(css);
				document.body.appendChild(usi_loading_container);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.remove_loading_graphic = function () {
			try {
				var loading_el = document.getElementById('usi_loading_graphic');
				if (loading_el != null) loading_el.parentNode.removeChild(loading_el);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.link = function (options) {
			try {
				if (typeof(usi_autoload) !== "undefined") {
					usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
				}
				usi_commons.log("[USI] usi_app.link")
				var internal = usi_commons.domain + "/autolink.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + usi_app.locale;
				var aff = options.aff + (options.destination ? encodeURIComponent(options.destination) : "");
				window.location = internal + "&uselink=" + encodeURIComponent(aff);
			} catch (err) {
				usi_commons.report_error(err);
			}
		}
		usi_app.place_css = function (css) {
			var usi_css = document.createElement("style");
			usi_css.type = "text/css";
			if (usi_css.styleSheet) usi_css.styleSheet.cssText = css;
			else usi_css.innerHTML = css;
			document.getElementsByTagName('head')[0].appendChild(usi_css);
		};
		usi_app.check_collections_upgrade = function () {
			//Only live for US only. Launches when 2 or 3 specific items are in cart
			try {
				if (usi_app.locale !== 'en-US' || usi_app.plcs_in_cart.length == 0) return;
				usi_commons.log('[ check_collections_upgrade ] Check collections eligibility for:', usi_app.plcs_in_cart);

				// Check collection eligibility
				var check_arr = [
					{
						name: 'AEC Collection',
						collection: 'AECCOL',
						products: ['CIV3D', 'ACDIST', 'RVT', 'IW360P', 'NAVMAN', 'BM36DP'],
						pid: 'OD-000052',
						terms: {
							'1Y': 'A01',
							'3Y': 'A06',
							'1M': 'A02'
						},
						billingFreq: {
							'1Y': 'B05',
							'3Y': 'B05',
							'1M': 'B03'
						}
					},
					{
						name: 'M&E Collection',
						collection: 'MECOLL',
						products: ['3DSMAX', 'MAYA', 'ARNOL', 'MOBPRO', 'MBXPRO'],
						pid: 'OD-000195',
						terms: {
							'1Y': 'A01',
							'3Y': 'A06',
							'1M': 'A02'
						},
						billingFreq: {
							'1Y': 'B05',
							'3Y': 'B05',
							'1M': 'B03'
						}
					}
				];

				var count = 0, collection;
				for (var i = 0; i < check_arr.length; i++) {
					var check_obj = check_arr[i];
					count = 0;
					usi_app.plcs_in_cart.forEach(function (plc) {
						var idx = check_obj.products.indexOf(plc);
						if (idx !== -1) {
							check_obj.products.splice(idx, 1);
							count++;
						}
					});
					if (count >= 2) {
						collection = check_obj;
						break;
					}
				}
				usi_commons.log('[ check_collections_upgrade ] count:', count);
				usi_commons.log('[ check_collections_upgrade ] collection:', collection);

				// Process collection
				if (collection) {

					// Get visitor id
					var visitor_id;
					if (utag_data) visitor_id = utag_data['qp.visitorid'] || utag_data['event_id'];

					// Set dynamic term based on cart item
					var term = '1Y';
					if (usi_app.products && usi_app.products.length > 0 && usi_app.products[0].type) {
						if (usi_app.products[0].type == '3-year') term = "3Y";
						else if (usi_app.products[0].type == '1-month') term = "1M";
					}

					// Build destination link
					dest_link = usi_app.checkout_url + '/en-US/cart?offers=[country:US;currency:USD;priceRegionCode:A0;quantity:1;offeringName:' + encodeURIComponent(collection.name) + ';offeringId:' + collection.pid + ';offeringCode:' + collection.collection + ';accessModelCode:S;termCode:' + collection.terms[term] + ';intendedUsageCode:COM;connectivityCode:C100;connectivityIntervalCode:C04;billingFrequencyCode:' + collection.billingFreq[term] + ';billingTypeCode:B100;billingBehaviorCode:A200;servicePlanIdCode:STND]';
					usi_app.collection_dest_link = usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(dest_link);
					usi_commons.log('[ check_collections_upgrade ] collection_dest_link:', usi_app.collection_dest_link);

					// Return config key
					return usi_app.locale + '_' + collection.collection + '_' + term + '_' + usi_commons.device;
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.remove_odm_cart_item = function (pid, cb) {
			//
			try {
				/*
				// 'pid' is item to be removed (Ex: OD-000249)
				var old_cart = localStorage.getItem('cart');
				var new_cart = JSON.parse(old_cart);
				var offers;
				if (usi_app.get_locale() == "en-UK") {
					offers = JSON.parse(old_cart)["en-GB"]['offers'];
				} else {
					offers = JSON.parse(old_cart)[usi_app.get_locale()]['offers'];
				}
				var locale = usi_app.get_locale();
				if (locale == "en-UK") locale = "en-GB";

				if (offers.filter(function (o) {
							return o['offeringId'] == pid;
						}).length == 0) {
					usi_commons.log('PID Not found!');
					cb();
				}

				usi_app.offer_qty = offers.filter(function (o) {
					return o['offeringId'] == pid;
				})[0]['quantity'];
				usi_app.offer_term = offers.filter(function (o) {
					return o['offeringId'] == pid;
				})[0]['termCode'];

				offers = offers.filter(function (o) {
					return o['offeringId'] != pid;
				});
				new_cart[locale]['offers'] = offers;
				console.log("New Cart: ", new_cart);
				new_cart = JSON.stringify(new_cart);
				localStorage.setItem('cart', new_cart);
				cb();
				*/

				if (document.querySelector("div[data-testid=odm-accordion-cart] button[data-wat-val=edit]") != null) {
					// go back to step 1 "cart" if the user is on a different step
					document.querySelector("div[data-testid=odm-accordion-cart] button[data-wat-val=edit]").click();
					setTimeout(function () {
						usi_app.bundle_options.node.querySelector("button[data-testid*='remove-line-item']").click();
						setTimeout(cb, 1000);
					}, 2000);
				} else {
					usi_app.bundle_options.node.querySelector("button[data-testid*='remove-line-item']").click();
					setTimeout(cb, 1000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.remove_item = function (pid, hide_loading) {
			try {
				if (pid) {
					var selector = document.querySelector('[data-line-item="' + pid + '"] button[data-testid="close-button"]');
					if (!selector) selector = document.querySelector('[data-line-item="' + pid + '"] button[data-testid="modal-close-button"]');
					if (selector) {
						selector.disabled = false;
						selector.click();
						if (!hide_loading) usi_app.add_loading_graphic("");
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.link_switch_item = function (options) {
			try {
				// Set cookies
				usi_cookies.set("usi_suppress_upsell", "1");
				// Remove item
				usi_app.remove_item(options.pid);
				// Add promo item
				usi_app.check_for_empty_cart(function () {
					setTimeout(function () {
						// Add promo item to cart
						if (typeof(usi_autoload) !== "undefined") {
							usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
						}
						usi_commons.log("[USI] link_switch_item")
						var internal = usi_commons.domain + "/autolink.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + usi_app.locale + usi_app.upsell_key;
						var aff = options.aff + (options.destination ? encodeURIComponent(options.destination) : "");
						window.location = internal + "&uselink=" + encodeURIComponent(aff);
					}, 1000);
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.check_for_empty_cart = function (cb) {
			try {
				var empty_cart_el = document.querySelector('#checkout .checkout--empty-cart--text');
				if (empty_cart_el && empty_cart_el.textContent) {
					cb();
				} else {
					setTimeout(function () {
						usi_app.check_for_empty_cart(cb);
					}, 1000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.switch_items_guac = function (pid_from, pid_to) {
			try {
				var selector = document.querySelector('[data-line-item="' + pid_from + '"] select');
				var option_3;
				selector.querySelectorAll("option").forEach(function (opt) {
					if (opt.textContent.indexOf("3") != -1) option_3 = opt;
				});
				if (selector && option_3) {
					selector.value = option_3.value;
					var event = new Event("change", {bubbles: true});
					selector.dispatchEvent(event);
				}
				usi_app.switch_to = pid_to;
				usi_app.switch_from = pid_from;
				usi_cookies.set("usi_suppress_upsell", '1');
				usi_app.upsell_key = "";
				usi_app.add_prod_guac();
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.switch_items_guac_monthly = function (pid_from, pid_to) {
			try {
				var selector = document.querySelector('div[data-line-item="' + pid_from + '"] #product-term');
				var yearly_option;
				selector.querySelectorAll("option").forEach(function (opt) {
					if (opt.value == pid_to) yearly_option = opt;
				});
				if (selector && yearly_option) {
					selector.value = yearly_option.value;
					var event = new Event("change", {bubbles: true});
					selector.dispatchEvent(event);
				}
				usi_app.switch_to = pid_to;
				usi_app.switch_from = pid_from;
				usi_cookies.set("usi_suppress_upsell", '1');
				usi_app.upsell_key = "_monthly";
				usi_app.add_prod_guac();
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.add_prod_guac = function () {
			try {
				if (usi_app.upsell_inpage.hash && usi_app.upsell_inpage.siteID) {
					var aff = usi_app.aff_links[usi_app.locale];
					var locale = (usi_app.locale == "en-UK") ? "en-GB" : usi_app.locale;
					var mvar = usi_app.get_mvar(usi_app.switch_from) || ("afc_" + usi_app.locale + "_" + usi_app.plc.toLowerCase() + "_usi_my3");
					var usi_pid_link = location.protocol + '//' + location.host + "/" + locale + "?mktvar004=" + mvar + usi_app.append_upsell_link;
					if (typeof (usi_js) != "undefined" && usi_cookies.get("usi_banner_click") != null) {
						usi_js.deep_link(usi_pid_link.replace("_my3", "_3yearbanner"));
					} else {
						if (typeof(usi_autoload) !== "undefined") {
							usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
						}
						usi_commons.log("[USI] add_prod_guac")
						var link = usi_commons.domain + "/autolink.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + usi_app.locale + usi_app.upsell_key + "&uselink=" + encodeURIComponent(aff + "?url=" + encodeURIComponent(usi_pid_link));
						usi_cookies.set('usi_force_redirect', link);
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.check_cloud_upsells = function () {
			try {
				// We are in one of the targeted locales, check for target products
				usi_app.usi_cloud_upsell_options = null;
				var list = usi_company_json.cloud_products_upsell_matrix[usi_app.locale];
				for (var i = 0; i < list.length; i++) {
					if (list[i].targets.indexOf(usi_app.plc) !== -1) {
						// Target item found in cart
						usi_commons.log('[ check_cloud_upsells ] Target PLC found in cart:', usi_app.plc);
						usi_app.usi_cloud_upsell_options = {
							text: list[i].text,
							cta: list[i].cta,
							upsell: list[i].upsell,
							region: list[i].region,
							func: 'usi_app.add_cloud_upsell_item();'
						}
						break;
					}
				}
				if (usi_app.usi_cloud_upsell_options) {
					usi_app.process_cloud_upsells();
					return true;
				} else {
					return false;
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.process_cloud_upsells = function () {
			try {
				if (usi_app.usi_cloud_upsell_options) {
					usi_commons.log('[ process_cloud_upsells ] ---------------------');
					usi_commons.log('[ process_cloud_upsells ] ---------------------');
					// Set term and node based on products in cart
					usi_app.products.forEach(function (prod, i) {
						//Set node where upsell banner will be placed
						if (document.getElementsByClassName("checkout--product-bar").length > 0) {
							usi_app.usi_cloud_upsell_options.node = document.getElementsByClassName("checkout--product-bar")[i];
						} else if (document.querySelectorAll('div[data-testid*="product-line-item"]').length > 0) {
							usi_app.usi_cloud_upsell_options.node = document.querySelectorAll('div[data-testid*="product-line-item"]')[i];
						} else if (document.querySelectorAll('div.mobile-container div.product-row').length > 0) {
							usi_app.usi_cloud_upsell_options.node = document.querySelectorAll('div.mobile-container div.product-row')[i];
						}

						if (prod.type) {
							var encoded = encodeURIComponent(prod.type);
							usi_app.usi_cloud_upsell_options.term = encoded.toUpperCase().replace('%20', '-');
							usi_commons.log('[ upsells_guac ] type: ' + prod.type + ' encoded: ' + encoded);
							if (encoded === '1%20%E5%B9%B4' || encoded === '1%20%EB%85%84') {
								usi_app.usi_cloud_upsell_options.term = "1-YEAR";
							} else if (encoded === '1%20%E3%83%B5%E6%9C%88' || encoded === '%EC%9B%94%EB%B3%84') {
								usi_app.usi_cloud_upsell_options.term = "1-MONTH";
							} else if (encoded === '3%20%E5%B9%B4' || encoded === '3%20%EB%85%84') {
								usi_app.usi_cloud_upsell_options.term = "3-YEAR";
							}
						}
					});

					// Special node location for India & Korea carts
					if (usi_app.locale === "en-IN" || usi_app.locale === "en-SE" || usi_app.locale == "en-SG") {
						usi_app.usi_cloud_upsell_options.node = document.querySelector('.summary .mobile-container');
					} else if (usi_app.locale === "ko-KR") {
						usi_app.usi_cloud_upsell_options.node = document.querySelector('#dr_QuickBuyCart .responsive-cart-container .product-row');
					} else if (usi_app.locale === "en-MY") {
						usi_app.usi_cloud_upsell_options.node = document.querySelector('#dr_QuickBuyCart .responsive-cart-container .product-row');
					}

					// Set key, hash, & site
					usi_app.usi_cloud_upsell_options.key = usi_app.locale + "_" + usi_app.usi_cloud_upsell_options.upsell;
					if (usi_app.usi_cloud_upsell_options.region === 'APAC' && !usi_cookies.value_exists("usi_aff_suppress")) {
						usi_app.usi_cloud_upsell_options.hash = "kFDO5dFehbzXRKfpQ6htniL";
						usi_app.usi_cloud_upsell_options.siteID = "42318";
					} else if (usi_app.usi_cloud_upsell_options.region === 'ANZ' && !usi_cookies.value_exists("usi_aff_suppress")) {
						usi_app.usi_cloud_upsell_options.hash = "XNypi88ekzudVKvrDXUv3bU";
						usi_app.usi_cloud_upsell_options.siteID = "42334";
					} else if (usi_app.usi_cloud_upsell_options.region === 'AMERICAS' && !usi_cookies.value_exists("usi_aff_suppress")) {
						usi_app.usi_cloud_upsell_options.hash = "jqmv097zIE07e5woq22KKq6";
						usi_app.usi_cloud_upsell_options.siteID = "42630";
					} else if (usi_app.usi_cloud_upsell_options.region === 'EMEA' && !usi_cookies.value_exists("usi_aff_suppress")) {
						usi_app.usi_cloud_upsell_options.hash = "JmMrUwld4jBNlrKqS3kzmAZ";
						usi_app.usi_cloud_upsell_options.siteID = "42632";
					} else if (usi_app.usi_cloud_upsell_options.region === 'UK' && !usi_cookies.value_exists("usi_aff_suppress")) {
						usi_app.usi_cloud_upsell_options.hash = "TDsp2c0Ytmn6JbFBeAZOuTn";
						usi_app.usi_cloud_upsell_options.siteID = "42634";
					}

					// Load upsell banner
					usi_commons.log('[ upsells_guac ] Cloud upsell options:');
					usi_commons.log(usi_app.usi_cloud_upsell_options);

					// Unable to add 1yr to 3yr for en-SE
					if (usi_app.locale === 'en-SE' && usi_app.usi_cloud_upsell_options.term === "3-YEAR") {
						return;
					}

					if (usi_app.usi_cloud_upsell_options.node) {
						usi_app.load_cloud_upsell();
					} else {
						usi_commons.log_error('[ process_cloud_upsells ] ERROR: node is undefined');
					}

				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.load_cloud_upsell = function () {
			try {
				if (usi_app.usi_cloud_upsell_options.hash && usi_app.usi_cloud_upsell_options.siteID) {
					var usi_upsell_div = document.createElement("div");
					usi_upsell_div.setAttribute("class", "usi_upsell_div");

					// Remove existing bar if found
					var bar = usi_app.usi_cloud_upsell_options.node.querySelector('.usi_upsell_div');
					if (bar) bar.parentNode.removeChild(bar);

					// Load inpage banner
					if (usi_app.usi_load_compat) {
						usi_commons.load(usi_app.usi_cloud_upsell_options.hash, usi_app.usi_cloud_upsell_options.siteID, usi_app.usi_cloud_upsell_options.key);
					} else {
						//legacy loading. phasing out as of 9/25/22
						// Special styles for KR
						if (usi_app.locale === "ko-KR" && document.querySelector('.prod-img img.dr_productThumbnail')) {
							document.querySelector('.prod-img img.dr_productThumbnail').style.marginBottom = '5px';
						}
						usi_commons.load_script(usi_commons.domain + "/autoload.jsp?hash=" + usi_app.usi_cloud_upsell_options.hash + "&siteID=" + usi_app.usi_cloud_upsell_options.siteID + "&keys=" + usi_app.usi_cloud_upsell_options.key, function () {
							if (typeof usi_autoload === "undefined" && usi_app.loading !== 63857) return;
							usi_app.place_css([
								'.usi_inpage_upsell { position: relative; background: #333333 !important; width: 100%; color: #fff !important; padding: 5px 10px 4px 10px; clear: both; margin-top: 4px; padding-left: 2em; }',
								'.usi_inpage_upsell span { text-decoration: underline; cursor: pointer; font-weight: bold; color: #fff !important;}',
								'.usi_inpage_upsell .usi_tos { text-decoration: underline; cursor: pointer; float: right; color: white !important; }',
								'.usi_promo_icon { enable-background: new 0 0 27.9 28; display: table-cell; height: 15px; width: 15px; vertical-align: top; float: left; fill: #fff !important; position: absolute; left: 0.5em; top: 0; bottom: 0; margin: auto; }',
								'.cart-widget .item .usi_upsell_div { margin: 0 20px 20px 20px; }',
								'.cart-widget .item:last-of-type .usi_upsell_div { margin: 20px 0 0 0; }'
							].join(""));
							var promo_icon = '<svg  viewBox="0 0 27.9 28" x="0px" y="0px" class="usi_promo_icon" xml:space="preserve" width="100%" height="100%"><path d="M13.6,0h-8L0,5.8v8l14.3,13.8l13.3-13.2L13.6,0z M6,8.1c-1.2,0-2.2-1-2.2-2.2s1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2S7.2,8.1,6,8.1z"></path></svg>';
							usi_upsell_div.innerHTML = "<div class=\"usi_inpage_upsell\">" + promo_icon + " " + usi_app.usi_cloud_upsell_options.text + " <br /><span onclick='" + usi_app.usi_cloud_upsell_options.func + "'>" + usi_app.usi_cloud_upsell_options.cta + "</span></div>";
							if (usi_app.usi_cloud_upsell_options.node.getElementsByClassName("usi_upsell_div").length == 0) {
								usi_app.usi_cloud_upsell_options.node.appendChild(usi_upsell_div);
							}

							if (["42318", "42334"].indexOf(usi_app.usi_cloud_upsell_options.siteID) != -1) {
								// Adobe Analytics View
								if (typeof usi_app.push_analytics_event_view === "function") {
									usi_app.push_analytics_event_view(
											"Upsellit In-Page",
											"Cloud Products"
									);
								}
							}

						});
					}
				} else {
					usi_commons.log('[ load_cloud_upsell ] ERROR: Missing hash or key!');
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.add_cloud_upsell_item = function () {
			try {
				var hash = usi_app.usi_cloud_upsell_options.hash;
				var site = usi_app.usi_cloud_upsell_options.siteID;
				var key = usi_app.usi_cloud_upsell_options.key;
				var plc = usi_app.usi_cloud_upsell_options.upsell;
				var term = usi_app.usi_cloud_upsell_options.term;
				var visitor_id;
				if (utag_data) visitor_id = utag_data['qp.visitorid'] || utag_data['event_id'];
				if (visitor_id && usi_app.aff_links[usi_app.locale] && hash && site && key && term) {
					// Build add url
					var add_url = 'https://commerce.autodesk.com/' + usi_app.locale + '?plc=' + plc + '&quantity=1&term=' + term + '&visitorId=' + visitor_id;
					// -----------------------
					// -------- en-AU --------
					// -----------------------
					if (usi_app.locale === 'en-AU') {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'FPT') {
							offeringId = "OD-000291";
							offeringName = "Flow Production Tracking";
						} else if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						}

						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/en-AU/cart?offers=" +
								"[country:AU;currency:AUD;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AH;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// -----------------------
					// -------- ja-JP --------
					// -----------------------
					else if (usi_app.locale === "ja-JP") {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						} else if (plc === 'SGSUB') {
							offeringId = "OD-000291";
							offeringName = "ShotGrid - Subscription";
						} else if (plc === 'FPT') {
							offeringId = "OD-000291";
							offeringName = "Flow Production Tracking";
						}
						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/ja-JP/cart?offers=" +
								"[country:JP;currency:JPY;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AI;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// -----------------------
					// -------- en-IN --------
					// -----------------------
					else if (usi_app.locale === 'en-IN') {
						var productID;
						if (plc === 'SGSUB') {
							if (term === '1-YEAR') {
								productID = '5518873800';
							} else if (term === '3-YEAR') {
								productID = '5518873900';
							} else if (term === 'MONTH') {
								productID = '5518872800';
							}
						} else if (plc === 'COLLRP') {
							if (term === '1-YEAR') {
								productID = '5322807000';
							} else if (term === '3-YEAR') {
								productID = '5322807100';
							} else if (term === 'MONTH') {
								productID = '5114914600';
							}
						} else if (plc === 'FPT') {
							if (term === '1-YEAR') {
								productID = '5518873800';
							} else if (term === '3-YEAR') {
								productID = '5518873900';
							} else if (term === 'MONTH') {
								productID = '5518872800';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						if (term === 'MONTH') {
							add_url = 'https://store.autodesk.com/store/adsk/en_IN/buy/productID.' + productID + '/quantity.1/Currency.INR&visitorId=' + visitor_id;
						} else {
							add_url = 'https://store.autodesk.com/store/adskin/en_IN/buy/productID.' + productID + '/quantity.1/Currency.INR&visitorId=' + visitor_id;
						}
					}
					// -----------------------
					// -------- ko_KR --------
					// -----------------------
					else if (usi_app.locale === 'ko-KR') {
						var productID;
						if (plc === 'SGSUB') {
							if (term === '1-YEAR') {
								productID = '5518792600';
							} else if (term === '3-YEAR') {
								productID = '5518792800';
							} else if (term === '1-MONTH') {
								productID = '5518792900';
							}
						} else if (plc === 'COLLRP') {
							if (term === '1-YEAR') {
								productID = '332902900';
							} else if (term === '3-YEAR') {
								productID = '332903100';
							} else if (term === '1-MONTH') {
								productID = '332903300';
							}
						} else if (plc === 'FPT') {
							if (term === '1-YEAR') {
								productID = '5518792600';
							} else if (term === '3-YEAR') {
								productID = '5518792800';
							} else if (term === '1-MONTH') {
								productID = '5518792900';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = 'https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID.' + productID + '/quantity.1/Currency.KRW&visitorId=' + visitor_id;
					}
					// -----------------------
					// ------- en-MY ---------
					// -----------------------
					else if (usi_app.locale === 'en-MY') {
						var productID;
						if (plc === 'SGSUB') {
							if (term === '1-YEAR') {
								productID = '5766924300';
							} else if (term === '3-YEAR') {
								productID = '5766924400';
							} else if (term === '1-MONTH') {
								productID = '5766924200';
							}
						} else if (plc === 'COLLRP') {
							if (term === '1-YEAR') {
								productID = '5763030300';
							} else if (term === '3-YEAR') {
								productID = '5763030400';
							} else if (term === '1-MONTH') {
								productID = '5763030200';
							}
						} else if (plc === 'FPT') {
							if (term === '1-YEAR') {
								productID = '5766924300';
							} else if (term === '3-YEAR') {
								productID = '5766924400';
							} else if (term === '1-MONTH') {
								productID = '5766924200';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = 'https://store.autodesk.com/store/adskjp/en_MY/buy/productID.' + productID + '/quantity.1/Currency.' + ((window['ADSK_A'] != 'undefined' && typeof window['ADSK_A']['Currency'] != 'undefined') ? window['ADSK_A']['Currency'] : "MYR") + '&visitorId=' + visitor_id;
					}
					// -----------------------
					// ------- en-NZ ---------
					// -----------------------
					else if (usi_app.locale === 'en-NZ') {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'FPT') {
							offeringId = "OD-000291";
							offeringName = "Flow Production Tracking";
						} else if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						}

						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/en-NZ/cart?offers=" +
								"[country:NZ;currency:NZD;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AH;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// -----------------------
					// ------- en-SG ---------
					// -----------------------
					else if (usi_app.locale === 'en-SG') {
						var productID;
						if (plc === 'SGSUB') {
							if (term === '1-YEAR') {
								productID = "5776051000";
							} else if (term === '3-YEAR') {
								productID = "5776051100";
							} else if (term === '1-MONTH') {
								productID = "5776050900";
							}
						} else if (plc === 'COLLRP') {
							if (term === '1-YEAR') {
								productID = "332592400";
							} else if (term === '3-YEAR') {
								productID = "332592600";
							} else if (term === '1-MONTH') {
								productID = "332592700";
							}
						} else if (plc === 'FPT') {
							if (term === '1-YEAR') {
								productID = "5776051000";
							} else if (term === '3-YEAR') {
								productID = "5776051100";
							} else if (term === '1-MONTH') {
								productID = "5776050900";
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = 'https://store.autodesk.com/store/adsk/en_SG/buy/productID.' + productID + '/quantity.1/Currency.SGD&visitorId=' + visitor_id;
					}
					// -----------------------
					// -------- en-US --------
					// -----------------------
					else if (usi_app.locale === 'en-US') {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'SGSUB') {
							offeringId = "OD-000291";
							offeringName = "ShotGrid - Subscription";
						} else if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						}

						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/en-US/cart?offers=" +
								"[country:US;currency:USD;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AH;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// ------------------------------
					// ------------ en-CA -----------
					// ------------------------------
					else if (usi_app.locale === 'en-CA') {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'SGSUB') {
							offeringId = "OD-000291";
							offeringName = "ShotGrid - Subscription";
						} else if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						}

						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/en-CA/cart?offers=" +
								"[country:CA;currency:CAD;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AH;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// ------------------------------
					// --------- fr-CA --------------
					// ------------------------------
					else if (usi_app.locale === 'fr-CA') {
						var offeringId, frequency, termCode, offeringName;
						if (term === '1-MONTH') {
							frequency = 'B03';
							termCode = "A02";
						} else if (term === '1-YEAR') {
							frequency = 'B05';
							termCode = "A01";
						} else if (term === '3-YEAR') {
							frequency = 'B05';
							termCode = "A06";
						}
						if (plc === 'SGSUB') {
							offeringId = "OD-000291";
							offeringName = "ShotGrid - Subscription";
						} else if (plc === 'COLLRP') {
							offeringId = "OD-000125";
							offeringName = "BIM Collaborate Pro";
						}

						if (!offeringId) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: priceIds is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + "/fr-CA/cart?offers=" +
								"[country:CA;currency:CAD;offeringCode:" + plc + ";offeringId:" + offeringId + ";offeringName:" + offeringName + ";priceRegionCode:AH;" +
								"quantity:1;intendedUsageCode:COM;accessModelCode:S;termCode:" + termCode + ";connectivityCode:C100;connectivityIntervalCode:C04;servicePlanIdCode:STND;" +
								"billingBehaviorCode:A200;billingTypeCode:B100;billingFrequencyCode:" + frequency + "]";
					}
					// -----------------------
					// -------- de-DE --------
					// -----------------------
					else if (usi_app.locale === 'de-DE') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1-JAHR' || term === '3-JAHRE') {
								productID = '27882';
							} else if (term === '1-MONAT') {
								productID = '27867';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + '/' + usi_app.locale + '/fusion-360-extension-cart?priceIds=' + productID + '&plc=' + plc + '&visitorId=' + visitor_id;
						// https://checkout.autodesk.com/de-DE/fusion-360-extension-cart?priceIds=27882&plc=F36MEIA
					}
					// -----------------------
					// -------- en-EU --------
					// -----------------------
					else if (usi_app.locale === 'en-EU') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1-YEAR' || term === '3-YEAR') {
								productID = '27879';
							} else if (term === '1-MONTH') {
								productID = '27824';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + '/' + usi_app.locale + '/fusion-360-extension-cart?priceIds=' + productID + '&plc=' + plc + '&visitorId=' + visitor_id;
						// https://checkout.autodesk.com/en-NL/fusion-360-extension-cart?priceIds=27879&plc=F36MEIA
					}
					// -----------------------
					// -------- it-IT --------
					// -----------------------
					else if (usi_app.locale === 'it-IT') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1-ANNO' || term === '3-ANNI') {
								productID = '27881';
							} else if (term === '1-MESE') {
								productID = '27866';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + '/' + usi_app.locale + '/fusion-360-extension-cart?priceIds=' + productID + '&plc=' + plc + '&visitorId=' + visitor_id;
						// https://checkout.autodesk.com/de-DE/fusion-360-extension-cart?priceIds=27882&plc=F36MEIA
					}
					// -----------------------
					// -------- fr-FR --------
					// -----------------------
					else if (usi_app.locale === 'fr-FR') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1%C2%A0AN' || term === '3%C2%A0ANS') {
								productID = '27880';
							} else if (term === '1%C2%A0MOIS') {
								productID = '27865';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + '/' + usi_app.locale + '/fusion-360-extension-cart?priceIds=' + productID + '&plc=' + plc + '&visitorId=' + visitor_id;
						// https://checkout.autodesk.com/fr-FR/fusion-360-extension-cart?priceIds=27880&plc=F36MEIA
					}
					// -----------------------
					// -------- en-UK --------
					// -----------------------
					else if (usi_app.locale === 'en-UK') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1-YEAR' || term === '3-YEAR') {
								productID = '27391';
							} else if (term === '1-MONTH') {
								productID = '27388';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = usi_app.checkout_url + '/en-GB/fusion-360-extension-cart?priceIds=' + productID + '&plc=' + plc + '&visitorId=' + visitor_id;
						// https://checkout.autodesk.com/en-GB/fusion-360-extension-cart?priceIds=27391&plc=F36MEIA
					}
					// -----------------------
					// -------- en-SE --------
					// -----------------------
					else if (usi_app.locale === 'en-SE') {
						var productID;
						if (plc === 'F36MEIA') {
							if (term === '1-YEAR' || term === '3-YEAR') {
								productID = '5519802400';
							} else if (term === 'MONTH') {
								productID = '5519802300';
							}
						}
						if (!productID) {
							usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: productID is undefined!');
							return;
						}
						add_url = 'https://store.autodesk.com/store/adsk/en_SE/buy/productID.' + productID + '/quantity.1/Currency.USD&visitorId=' + visitor_id;
					}

					if (["42318", "42334"].indexOf(usi_app.usi_cloud_upsell_options.siteID) != -1) {
						// Adobe Analytics Click
						if (typeof usi_app.push_analytics_event_click === "function") {
							usi_app.push_analytics_event_click(
									".usi_inpage_upsell span",
									"Upsellit In-Page",
									"Cloud Products",
									add_url
							);
						}
					}

					// Build aff link url
					var aff_url = usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(add_url);
					usi_commons.log('[ add_cloud_upsell_item ] aff_url:', aff_url);

					// Set suppression cookies
					usi_cookies.set("usi_suppress_cloud_upsell", "1");
					usi_cookies.set("usi_suppress_upsell", "1");

					// Remove existing bar
					var bar = usi_app.usi_cloud_upsell_options.node.querySelector('.usi_upsell_div');
					if (bar) bar.parentNode.removeChild(bar);

					// Show loading graphic
					usi_app.add_loading_graphic("");

					// Go to final link
					if (typeof(usi_autoload) !== "undefined") {
						usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
					}
					var dest = usi_commons.domain + "/autolink.jsp?hash=" + hash + "&siteID=" + site + "&keys=" + key + "&uselink=" + encodeURIComponent(aff_url);
					usi_commons.log('[ add_cloud_upsell_item ] dest:', dest);
					window.location = dest;

				} else {
					usi_commons.log_error('[ add_cloud_upsell_item ] ERROR: Missing required params!');
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.apply_bundle_guac = function (url, key, pid, sid) {
			try {
				if (usi_app.usi_load_compat) {
					usi_commons.log("[USI] Testing New Guac Bundle")
					usi_app.remove_item(pid);
					if (!usi_app.el_searching) {
						usi_app.el_searching = setInterval(search_el, 500);
						function search_el() {
							usi_commons.log("[USI] Looking For Element");
							if (document.querySelector("#checkout .checkout--empty-cart--text") != null) {
								clearInterval(usi_app.el_searching);
								usi_app["link_" + sid](url);
							}
						}
					}
				}
				else {
					var aff = usi_app.aff_links[usi_app.locale];
					if (usi_app.upsell_inpage.hash && usi_app.upsell_inpage.siteID && aff && url && key && pid) {
						usi_app.remove_item(pid);
						// Add promo item
						usi_app.check_for_empty_cart(function () {
							setTimeout(function () {
								usi_cookies.set("usi_suppress_upsell", '1');
								if (typeof (usi_autoload) !== "undefined") {
									usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
								}
								usi_commons.log("[USI] apply bundle guac");
								usi_commons.log("[USI] URL:", url)
								usi_commons.log("[USI] KEY:", key)
								usi_commons.log("[USI] AFF:", aff)
								usi_app.load_js('https://prod.upsellit.com/link.jsp?id=0&cid=3614&sid=' + usi_app.upsell_inpage.siteID + '&duration=2592000&ajax=1');
								window.location = aff + "?url=" + encodeURIComponent(url);
								//window.location = usi_commons.domain + "/autolink.jsp?hash=" + usi_app.upsell_inpage.hash + "&siteID=" + usi_app.upsell_inpage.siteID + "&keys=" + key + "&uselink=" + encodeURIComponent(aff + "?url=" + encodeURIComponent(url));
							}, 1000);
						});
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.load_js = function (js_url) {
			try {
				var USI_headID = document.getElementsByTagName("head")[0];
				var USI_dynScript = document.createElement("script");
				USI_dynScript.setAttribute("id", "usi_AJAXScript");
				USI_dynScript.setAttribute("type", "text/javascript");
				USI_dynScript.setAttribute("src", js_url);
				USI_headID.appendChild(USI_dynScript);
			} catch (err) {
				if (typeof(usi_commons) !== "undefined") usi_commons.report_error(err);
			}
		}
		usi_app.switch_items_store_cart_domain = function (pid) {
			//Only used for tr-TR and en-SE upsells (Completely different cart than others)
			console.log(usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(usi_app.bundle_offers[pid].url));
			var usi_http_request = new XMLHttpRequest();
			usi_http_request.onreadystatechange = function () {
				if (usi_http_request.readyState == 4 && usi_http_request.status == 200) {
					location.href = usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(usi_app.bundle_offers[pid].url);
				}
			};
			usi_http_request.open('GET', usi_app.delete_link, true);
			usi_http_request.setRequestHeader('Content-Type', 'application/json');
			usi_http_request.send();
		};
		usi_app.switch_items_dr = function (pid_from, pid_to, pid_qty, lightning, callback) {
			try {
				usi_app.set_rescrape = function () {
				}
				usi_app.campaign_persist_callback = function () {
				}
				usi_cookies.set("usi_suppress_upsell", "1", usi_cookies.expire_time.week);
				usi_app.add_loading_graphic("");
				var upsell_div = document.querySelector('.usi_inpage_upsell');
				if (upsell_div) upsell_div.parentNode.removeChild(upsell_div);
				var usi_http_request = new XMLHttpRequest();
				usi_http_request.onreadystatechange = function () {
					if (usi_http_request.readyState == 4 && usi_http_request.status == 200) {
						usi_app.switch_to = pid_to;
						usi_app.switch_from = pid_from;
						usi_app.switch_qty = pid_qty || "1";
						setTimeout(function () {
							usi_app.add_prod_dr(callback);
						}, 1000);
					}
				};
				try {
					window['analytics']['callback']['setInternalCampaign'](usi_app.get_mvar(pid_from));
				} catch (err) {
					usi_commons.log_error(err);
				}
				usi_http_request.open('GET', usi_app.delete_link, true);
				usi_http_request.setRequestHeader('Content-Type', 'application/json');
				usi_http_request.send();
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.add_prod_dr = function (callback) {
			try {
				//if (usi_app.upsell_inpage.hash && usi_app.upsell_inpage.siteID) {
				var aff = usi_app.aff_links[usi_app.locale] + "?url=";
				var usi_pid_link = "https://" + document.domain + "/store/" + usi_commons.gup("SiteID") + "/" + usi_app.locale + "/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + usi_app.append_upsell_link;
				if (usi_app.locale == "en-SG") usi_pid_link = "https://store.autodesk.com/store/adsk/en_SG/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency.SGD" + usi_app.append_upsell_link;
				else if (usi_app.locale == "en-IN") usi_pid_link = "https://store.autodesk.com/store/adskin/en_IN/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency.MRP" + usi_app.append_upsell_link;
				else if (usi_app.locale == "ko-KR") usi_pid_link = "https://store.autodesk.co.kr/store/adskkr/ko_KR/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency.KRW" + usi_app.append_upsell_link;
				else if (usi_app.locale == "zh-CN") usi_pid_link = "https://store.autodesk.com.cn/store/adskcn/zh_CN/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency.CNY" + usi_app.append_upsell_link;
				else if (usi_app.locale == "en-NZ") usi_pid_link = "https://store.autodesk.com/store/adsk/en_NZ/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency.NZD" + usi_app.append_upsell_link;
				else if (usi_app.locale == "en-MY") usi_pid_link = "https://store.autodesk.com/store/adskjp/en_MY/buy/productID." + usi_app.switch_to + "/quantity." + usi_app.switch_qty + "/Currency." + ((typeof window['ADSK_A'] != 'undefined' && typeof window['ADSK_A']['Currency'] != 'undefined') ? window['ADSK_A']['Currency'] : "MYR") + usi_app.append_upsell_link; //MYR uses more than one currency

				var plc = usi_app.get_plc(usi_app.switch_from) || usi_app.plc;
				if (plc) usi_pid_link += "&plc=" + plc;
				if (typeof callback == "function") {
					callback(usi_pid_link);
				} else if (typeof (usi_js) != "undefined" && usi_cookies.get("usi_banner_click") != null) {
					usi_js.deep_link(usi_pid_link.replace("_my3", "_3yearbanner"));
				} else {
					if (typeof(usi_autoload) !== "undefined") {
						usi_cookies.set("usi_click_id", usi_autoload.id, 30 * 24 * 60 * 60, true);
					}
					usi_commons.log(usi_pid_link);
					if (typeof callback != "undefined" && typeof callback != "function" && callback.indexOf("url=") != -1) window.location = usi_pid_link;
					else window.location = aff + encodeURIComponent(usi_pid_link);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.upsell_text_setter_monthly = function (options) {
			try {
				var english = usi_app.locale == "EU" || usi_app.locale == "GB" || usi_app.locale.indexOf("en_") == 0 || usi_app.locale.indexOf("en-") == 0;
				if (english) {
					options.text = "Upgrade to an annual subscription and save up to 33% - ";
					options.cta = "UPGRADE NOW";
				} else if (usi_app.locale.indexOf("fr") != -1) {
					options.text = "Passez \u00E0 un abonnement annuel et \u00E9conomisez jusqu\u2019\u00E0 33% - ";
					options.cta = "ACTUALISEZ VOTRE ABONNEMENT";
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
			return options;
		};
		usi_app.upsell_text_setter = function () {
			var options = {
				text: "",
				cta: ""
			};
			try {
				var english = usi_app.locale == "EU" || usi_app.locale == "GB" || usi_app.locale.indexOf("en_") == 0 || usi_app.locale.indexOf("en-") == 0;
				//copy for campaign 31847
				if (["en-NZ", "en-AU"].indexOf(usi_app.locale) != -1) {
					options.text = "Lock in your price for 3 years.";
					options.cta = "Upgrade now";
				} else if (english) {
					options.text = "Lock in your price for 3 years.";
					options.cta = "Upgrade now";
				} else if (usi_app.locale.indexOf("de") != -1) {
					options.text = "Sofort 5% sparen \u2013 verl\u00E4ngern Sie Ihr Abonnement auf 3 Jahre.";
					options.cta = "Jetzt upgraden";
				} else if (usi_app.locale.indexOf("it") != -1) {
					options.text = "Risparmia subito il 5% - prolunga l'abbonamento a 3 anni.";
					options.cta = "Fai l\u2019upgrade ora";
				} else if (usi_app.locale.indexOf("es") != -1) {
					options.text = "Ahorra un 5% inmediatamente: extiende tu suscripci\u00F3n durante 3 a\u00F1os.";
					options.cta = "Ampl\u00EDala ahora mismo";
				} else if (usi_app.locale.indexOf("fr") != -1) {
					options.text = "Economisez 5% tout de suite : prolongez votre abonnement sur 3 ans.";
					options.cta = "Mettre \u00E0 jour maintenant";
				} else if (usi_app.locale == "cs-CZ") {
					options.text = "Okam\u017Eit\u011B u\u0161et\u0159ete 5 % - prodlu\u017Ete sv\u00E9 p\u0159edplatn\u00E9 na 3 roky.";
					options.cta = "Prove\u010Fte ihned";
				} else if (usi_app.locale == "da-DK") {
					options.text = "Spar 5% med det samme - forl\u00E6ng dit abonnement til 3 \u00E5r.";
					options.cta = "Opgrader nu";
				} else if (usi_app.locale == "FI") {
					options.text = "S\u00E4\u00E4st\u00E4 5 % v\u00E4litt\u00F6m\u00E4sti \u2013 pidenn\u00E4 tilauksesi 3-vuotiseksi.";
					options.cta = "P\u00E4ivit\u00E4 nyt";
				} else if (usi_app.locale == "HU") {
					options.text = "5% azonnali megtakar\u00EDt\u00E1s \u2013 hosszabb\u00EDtsa meg el\u0151fizet\u00E9s\u00E9t 3 \u00E9vre.";
					options.cta = "Friss\u00EDt\u00E9s most";
				} else if (usi_app.locale == "NL" || usi_app.locale == "nl-NL" || usi_app.locale.indexOf("nl-") == 0) {
					options.text = "Bespaar direct 5%: verleng je abonnement tot 3 jaar.";
					options.cta = "Waardeer nu op";
				} else if (usi_app.locale == "no-NO") {
					options.text = "Spar 5 % med en gang - utvid abonnementet ditt til 3 \u00E5r.";
					options.cta = "Oppgrader n\u00E5";
				} else if (usi_app.locale == "pl-PL") {
					options.text = "Zaoszcz\u0119d\u017A b\u0142yskawicznie 5% \u2014 przed\u0142u\u017C subskrypcj\u0119 do 3 lat ju\u017C teraz.";
					options.cta = "Rozszerz us\u0142ug\u0119 teraz";
				} else if (usi_app.locale == "pt-BR" || usi_app.locale == "pt-BR") {
					options.text = "Economize instantaneamente 5% - Prolongue sua assinatura para 3 anos.";
					options.cta = "D\u00EA Upgrade agora";
				} else if (usi_app.locale == "pt-SP") {
					options.text = "Poupe 5% automaticamente \u2014 prolongue a sua subscri\u00E7\u00E3o para 3 anos.";
					options.cta = "Atualize agora";
				} else if (usi_app.locale == "PT" || usi_app.locale == "pt-PT") {
					options.text = "Poupe 5% de imediato e prolongue a sua subscri\u00E7\u00E3o para 3 anos.";
					options.cta = "Atualizar j\u00E1";
				} else if (usi_app.locale == "ru-RU") {
					options.text = "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u0441\u043A\u0438\u0434\u043A\u0430 10\u00A0%. \u0423\u0432\u0435\u043B\u0438\u0447\u044C\u0442\u0435 \u0441\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438 \u0434\u043E \u0442\u0440\u0435\u0445 \u043B\u0435\u0442.";
					options.cta = "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441";
				} else if (usi_app.locale == "sv-SE") {
					options.text = "Spara 5% direkt - f\u00F6rl\u00E4ng din prenumeration till 3 \u00E5r.";
					options.cta = "Uppgradera nu";
				} else if (usi_app.locale == "tr-TR") {
					options.text = "Aboneli\u011Fini 3 y\u0131la uzatmak isteyenlere an\u0131nda %5 indirim.";
					options.cta = "\u015Eimdi y\u00FCkseltin";
				} else if (usi_app.locale == "ja-JP") {
					options.text = "3 \u5E74\u9593\u30B5\u30D6\u30B9\u30AF\u30EA\u30D7\u30B7\u30E7\u30F3\u306A\u3089\u3001\u8CFC\u5165\u6642\u306E\u4FA1\u683C\u3092\u3088\u308A\u9577\u304F\u7DAD\u6301\u3067\u304D\u307E\u3059";
					options.cta = "\u4ECA\u3059\u3050\u8CFC\u5165";
				} else if (usi_app.locale == "hu-HU") {
					options.text = "5% azonnali megtakar\u00EDt\u00E1s - fizessen el\u0151 m\u00E9g 3 \u00E9vre.";
					options.cta = "V\u00E1ltson most";
				} else if (usi_app.locale == "fi-FI") {
					options.text = "S\u00E4\u00E4st\u00E4 v\u00E4litt\u00F6m\u00E4sti 5 % \u2013 pidenn\u00E4 tilaustasi 3 vuoteen.";
					options.cta = "P\u00E4ivit\u00E4 nyt";
				} else if (usi_app.locale == "ko-KR") {
					options.text = "3\uB144 \uC11C\uBE0C\uC2A4\uD06C\uB9BD\uC158\uC73C\uB85C \uBCC0\uACBD\uD558\uC2DC\uACE0, 3\uB144\uAC04 \uD604\uC7AC \uAC00\uACA9\uC73C\uB85C \uACE0\uC815\uD558\uC138\uC694.";
					options.cta = "\uC9C0\uAE08 \uBCC0\uACBD\uD558\uAE30";
				} else if (usi_app.locale == "zh-CN") {
					options.text = "\u8BA2\u8D2D\u4E09\u5E74\u671F\u8BB8\u53EF\uFF0C\u4E09\u5E74\u5185\u6301\u7EED\u4EAB\u53D7\u5F53\u524D\u9501\u5B9A\u4EF7\u683C*";
					options.cta = "\u70B9\u51FB\u66F4\u65B0\u8D2D\u7269\u8F66\uFF01";
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
			return options;
		};
		usi_app.get_mvar = function (id) {
			try {
				var plc;
				for (plc in usi_company_json.upsell_list) {
					if (usi_company_json.upsell_list.hasOwnProperty(plc) && id in usi_company_json.upsell_list[plc]) {
						var locale = usi_app.locale.replace(/-/g, "_").toLowerCase();
						return "afc_" + locale + "_" + plc.toLowerCase() + "_usi_my3";
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_plc = function (id) {
			try {
				var plc;
				for (plc in usi_company_json.upsell_list) {
					if (usi_company_json.upsell_list.hasOwnProperty(plc) && id in usi_company_json.upsell_list[plc]) {
						return plc;
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_first_plc_from_cart = function () {
			try {
				if (usi_app.products && usi_app.products.length > 0 && typeof usi_app.products[0].plc !== "undefined") {
					return usi_app.products[0].plc;
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.has_monthly = function () {
			try {
				if (usi_app.products && usi_app.products.length > 0) {
					for (var i = 0; i < usi_app.products.length; i++) {
						var type = usi_app.products[i].type;
						usi_commons.log('[ has_monthly ] type:', type);
						if (type && usi_app.has_monthly_keyword(type)) {
							return true;
						}
					}
				}
				return false;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.count_monthly_subscriptions = function () {
			try {
				var monthly_subscriptions = 0;
				if (usi_app.products && usi_app.products.length > 0) {
					for (var i = 0; i < usi_app.products.length; i++) {
						var type = usi_app.products[i].type;
						if (type && usi_app.has_monthly_keyword(type)) {
							monthly_subscriptions++;
						}
					}
				}
				usi_commons.log('[ count_monthly_subscriptions ] count:', monthly_subscriptions);
				return monthly_subscriptions;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.has_monthly_keyword = function (type) {
			var encoded = encodeURIComponent(type);
			try {
				return type.indexOf('month') !== -1 ||					   // en-US, en-CA
						type.indexOf('Month') !== -1 ||					   // en-US, en-CA
						type.indexOf('mois') !== -1 ||					   // fr-CA
						type.indexOf('mes') !== -1 ||						// es-MX
						type.indexOf('mensual') !== -1 ||					// es-AR
						type.indexOf('Mensual') !== -1 ||					// es-MX new
						type.indexOf('mensal') !== -1 ||					 // pt-BR
						type.indexOf('Mensal') !== -1 ||					 // pt-BR
						type.indexOf('monat') !== -1 ||					  // de-DE
						type.indexOf('maand') !== -1 ||					  // nl-NL
						type.indexOf('miesi') !== -1 ||					  // pl-PL
						encoded.indexOf('1%20m%C4%9Bs%C3%ADc') !== -1 ||	 // cs-CZ
						type.indexOf('miesi') !== -1 ||					  // pl-PL
						encoded.indexOf('1%20h%C3%B3nap') !== -1 ||		  // hu-HU
						type.indexOf('\uC6D4\uBCC4') !== -1 ||			 // ko-KR
						type.indexOf('kuukausi') !== -1;					 // fi-FI
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_locale_redirect_key = function () {
			var key = '';
			try {
				var redirect_url = usi_cookies.get("usi_locale_redirect_url");
				var redirect_copy = usi_cookies.get("usi_locale_redirect_copy");
				if (redirect_url && redirect_copy && usi_app.locale.toLowerCase().indexOf(usi_app.country) === -1) {
					key = '_redirect';
				} else {
					usi_cookies.del("usi_locale_redirect_url");
					usi_cookies.del("usi_locale_redirect_copy");
				}
				usi_commons.log('[ get_locale_redirect_key ] key:', key);
			} catch (err) {
				usi_commons.report_error(err);
			}
			return key;
		};
		usi_app.get_promo_text = function () {
			//used in campaign 32829
			try {
				if (typeof usi_app.products == "undefined") return false;
				return usi_app.products.filter(function (item) {
					return !!item.promo;
				})[0].promo;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.cart_has_promo = function () {
			//used in campaign 30141 & 32829
			try {
				if (typeof usi_app.products == "undefined") return false;
				return usi_app.products.filter(function (item) {
							return !!item.promo;
						}).length > 0;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.set_mk_vars = function () {
			if (usi_commons.gup("usi_var002") != "") {
				try {
					window['analytics']['callback']['setExternalCampaign'](usi_commons.gup("usi_var002"));
				} catch (err) {
					usi_commons.report_error(err);
				}
			}
		};
		usi_app.rebuild_dr_cart = function () {
			try {
				usi_app.add_loading_graphic("");
				usi_cookies.set("usi_redirect_happened", "1", 5 * 60);
				var usi_currency = "";
				try {
					usi_currency = ADSK_A.Currency
					if (usi_commons.gup('usi_currency') != '') {
						usi_currency = usi_commons.gup('usi_currency'); //Some locales will soon support more than one currency (Ex: en-MY). See extra JS in 42496 for scraping
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
				var usi_pids = decodeURIComponent(usi_commons.gup("usi_pids"));
				var usi_pids_str = "";
				for (var i = 0; i < usi_pids.split(",").length; i++) {
					usi_pids_str += "productID." + usi_pids.split(",")[i] + "/quantity.1/";
				}
				if (usi_commons.gup("Locale") == "en-SE") {
					window.location = "https://" + document.domain + "/store/" + usi_commons.gup("SiteID") + "/" + usi_commons.gup("Locale").replace("-", "_") + "/buy/" + usi_pids_str + "Currency." + usi_currency;
				} else {
					window.location = "https://" + document.domain + "/store/" + usi_commons.gup("SiteID") + "/" + usi_commons.gup("Locale") + "/buy/" + usi_pids_str + "Currency." + usi_currency;
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.rebuild_guac_cart = function () {
			try {
				usi_cookies.set("usi_redirect_happened", "1", 5 * 60);
				var locale = (usi_app.locale == "en-UK") ? "en-GB" : usi_app.locale;
				window.location = "https://" + document.domain + "/" + locale + "?priceIds=" + usi_commons.gup("usi_pids");
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.rebuild_cb_cart = function () {
			try {
				usi_cookies.set("usi_redirect_happened", "1", 5 * 60);
				window.location = decodeURIComponent(usi_commons.gup("usi_cb_reload"))
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_cb_homepage = function () {
			try {
				// write code here
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_locale = function () {
			try {
				var temp_locale = "";
				if (document.getElementById("cartLink") != null) {
					var locale = document.getElementById("cartLink").href;
					if (locale.indexOf("commerce") != -1 || locale.indexOf("checkout") != -1) {
						locale = locale.substring(locale.lastIndexOf("/") + 1, locale.indexOf("?"));
					} else {
						locale = locale.substring(0, locale.indexOf("/buy"));
						locale = locale.substring(locale.lastIndexOf("/") + 1);
					}
					temp_locale = locale;
				} else if (usi_app.guac_cart) {
					temp_locale = utag_data.locale;
				} else if (sessionStorage.getItem("locale") != null) {
					var usi_locale = sessionStorage.getItem("locale");
					var usi_language = sessionStorage.getItem("language");
					if (usi_locale == "en-CA" || (usi_locale == "undefined" && sessionStorage.getItem("currency") == "CAD")) {
						usi_locale = "en-CA";
					} else if (usi_locale == "EU" && ["pt-PT", "hu-HU", "nl-NL", "fi-FI"].indexOf(usi_language) != -1) {
						usi_locale = usi_language.split("-")[1];
					}
					if (usi_locale == "NAMER") usi_locale = "en-US";
					else if (["IT", "ES", "FR", "DE"].indexOf(usi_locale) != -1) usi_locale = usi_locale.toLowerCase() + "-" + usi_locale;
					temp_locale = usi_locale;
				} else if (window['utag_data'] && window['utag_data']['locale']) {
					temp_locale = window['utag_data']['locale'];
				} else if (usi_commons.gup("Locale") != "") {
					temp_locale = usi_commons.gup("Locale");
				} else if (window['locale']) {
					temp_locale = window['locale'];
				} else if (location.href.indexOf('https://www.autodesk.ae/') !== -1) {
					temp_locale = "en-SE";
				} else if (location.href.indexOf('https://www.autodesk.co.kr/') !== -1) {
					temp_locale = "ko-KR";
				} else if (location.href.indexOf('https://www.autodesk.co.jp/') !== -1) {
					temp_locale = "ja-JP";
				} else if (location.href.indexOf('https://www.autodesk.com.sg/') !== -1) {
					temp_locale = "en-SG";
				}
				if (temp_locale == "es-LATAM") {
					temp_locale = "es-AR";
				} else if (temp_locale == "en-MENA" || temp_locale == "en_MENA" || temp_locale == "en-AE") {
					temp_locale = "en-SE";
				}
				return temp_locale.replace("_", "-");
			} catch (err) {
				usi_commons.report_error(err);
			}
			return "";
		};
		usi_app.find_cart_reference = function () {
			try {
				usi_app.cart_reference = usi_cookies.get("cartReference");
				if (usi_app.cart_reference != null) usi_app.cart_reference = decodeURIComponent(usi_app.cart_reference);
				if (usi_app.cart_reference != null && (usi_app.cart_reference.indexOf(";") != -1 || usi_app.cart_reference.indexOf("|") != usi_app.cart_reference.lastIndexOf("|"))) {
					// Found
				} else {
					setTimeout(usi_app.find_cart_reference, 1000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.set_rescrape = function (func, first) {
			try {
				if (usi_app.clear_cart_in_progress) return;
				var products = func();
				if (!first && ((usi_app.guac_cart && JSON.stringify(products) !== JSON.stringify(usi_app.products)) || ((usi_app.dr_cart || usi_app.is_odm_cart) && products.length !== usi_app.products.length))) {
					usi_commons.log("[ set_rescrape ] Products changed", products);
					usi_app.save_cart_data_after_injection = true;
					// Remove existing upsell banner if found
					if (usi_app.is_odm_cart) {
						var bar = document.querySelector('.usi_upsell_div');
						// check if 'products.length' and 'usi_app.products.length' are greater than 0, it's needed to avoid banner flickering
						if (bar && products.length > 0 && usi_app.products.length > 0) bar.parentNode.removeChild(bar);
					}
					usi_app.products = products;
					usi_app.extract_plcs();
					usi_app.upsell_loaded = undefined;
					usi_app.options = undefined;
					
					if (usi_cookies.value_exists('usi_force_redirect')) {
						var url = usi_cookies.get('usi_force_redirect');
						usi_cookies.del('usi_force_redirect');
						window.location = url;
					} else {
						usi_app.load();
					}
				}
				setTimeout(function () {
					usi_app.set_rescrape(func);
				}, 3000);
				return products;
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.report_locale = function () {
			try {
				if (usi_app.emea_uk.indexOf(usi_app.locale) != -1) {
					usi_commons.load_script("https://www.upsellit.com/active/autodeskemeauk.jsp");
				} else if (usi_app.anz.indexOf(usi_app.locale) != -1 || usi_app.apac.indexOf(usi_app.locale) != -1) {
					usi_commons.load_script("https://www.upsellit.com/active/autodeskapacanz.jsp");
				} else if (usi_app.americas.indexOf(usi_app.locale) != -1) {
					usi_commons.load_script("https://www.upsellit.com/active/autodeskamericas.jsp");
				} else {
					usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?audoesk_non_recognized_locale=" + usi_app.locale);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.save_sale_notes = function () {
			try {
				if (usi_app.products == undefined) return;
				var usi_sale_notes = usi_app.products.map(function (p) {
					return p.name + "|" + p.type;
				}).join(",");
				if (usi_sale_notes == "") return;
				usi_cookies.set("usi_sale_notes", usi_sale_notes, usi_cookies.expire_time.month, true);
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.suppress = function () {
			usi_cookies.set("usi_suppress", "1", usi_cookies.expire_time.day);
		};
		usi_app.check_url_suppressions = function () {
			try {
				var pidNumbers = [
					'8893445', '8890613', '8880927', '8842542', '8886404', '8860130', '8880856', '8861616',
					'8861693', '8882190', '8863947', '8882999', '8749940', '8863381', '8866677', '8866630',
					'8860033', '8860104', '8846724', '8442273', '8475898', '8817986', '8846242', '8848999',
					'8855374', '8858119', '8858221', '8859430', '8859541', '7803497', '8142680', '8341671',
					'8343167', '8343485', '8350241', '8351753', '8354768', '8355758', '8358074', '8365102',
					'8376097', '8378891', '8753226', '8753338', '8755861', '8769452', '8810802', '8842002', '8843095'
				];
				var idNumbers = [
					'49507', '50107', '50183', '50185', '50181', '49421'
				];
				var aid_suppress = idNumbers.filter(function (id) {
							return location.href.toLowerCase().indexOf('aid=' + id) !== -1;
						}).length > 0;
				var pid_suppress = pidNumbers.filter(function (id) {
							return location.href.toLowerCase().indexOf('pid=' + id) !== -1;
						}).length > 0;
				if (aid_suppress || pid_suppress) {
					usi_app.suppress();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.init_renewal_cart = function () {
			try {
				usi_app.locale = "";
				if (window['utag_data'] && window['utag_data']['locale']) {
					usi_app.locale = window['utag_data']['locale'];
				}
				if (usi_app.locale === "en-US") {
					// Load TT on US renewal page
					usi_app.scrape_renewal_cart_items();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_renewal_cart_items = function () {
			try {
				usi_app.products = [];
				var prod = {};

				// Check cookie
				var usi_renewal_prod = usi_cookies.get_json('usi_renewal_prod');
				if (usi_renewal_prod) {
					usi_commons.log('[ scrape_renewal_cart_item ] Setting data from cookie:', usi_renewal_prod);
					usi_app.products.push(usi_renewal_prod);
				} else if (usi_app.products.length == 0 && window['utag_data'] && window['utag_data']['product_id'] && window['utag_data']['product_id'].length > 0) {
					for (var i = 0; i < window['utag_data']['product_id'].length; i++) {
						prod = {};
						prod['pic'] = "https://www.upsellit.com/chatskins/3614/autodesk_icon.png"
						prod['type'] = window['utag_data']['products_type'][i];
						prod['name'] = document.querySelector('.responsive-cart-container .product-name').textContent.trim().split(/\r?\n/)[0];
						prod['product_id'] = window['utag_data']['product_id'][i];
						prod['qty'] = window['utag_data']['product_quantity'][i];
						prod['old_price'] = "$" + window['utag_data']['product_unit_price'][i];
						prod['price'] = "$" + (Number(window['utag_data']['product_unit_price'][i]) - Number(window['utag_data']['product_discount'][i])).toFixed(2);
						usi_cookies.set_json("usi_renewal_prod", prod, usi_cookies.expire_time.day);
						usi_app.products.push(prod);
					}
					usi_commons.log(usi_app.products);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		
		// noinspection JSUnusedGlobalSymbols
		var usi_custom_monitor = {
			get_locale: function () {
				return usi_app.locale;
			},
			send_data: function (value, name) {
				usi_js_monitor.USI_LoadDynamics(value, name, usi_js_monitor.USI_getASession());
			},
			send_utf8: function (value, name) {
				usi_js_monitor.USI_LoadDynamics(encodeURIComponent(encodeURIComponent(encodeURIComponent(value))), "utf8_" + name, usi_js_monitor.USI_getASession());
			},
			send_cart_type: function () {
				if (typeof usi_app.dr_cart == "undefined") return;
				if (usi_app.dr_cart && !usi_app.efulfilment) {
					usi_custom_monitor.send_data('1', 'usi_drcart');
					usi_custom_monitor.send_data('null', 'usi_bicestore');
				} else {
					usi_custom_monitor.send_data('1', 'usi_bicestore');
					usi_custom_monitor.send_data('null', 'usi_drcart');
				}
			},
			send_products: function () {
				try {
					if (typeof usi_app.products == "undefined") return;
					var item_num, usi_product, prop;
					var products = usi_app.products;
					for (item_num = 0; products[item_num] != undefined && item_num < 3; item_num++) {
						usi_product = products[item_num];

						// Assign priceline
						var priceline_sent = '';
						var price = '';
						try {
							var priceline = usi_product.price;
							if (usi_product.old_price != undefined && usi_product.old_price != "") {
								priceline = '<span style="text-decoration:line-through;">' + usi_product.old_price + '</span> <span style="color:#d02f35;">' + usi_product.price + '</span>';
							}
							var clean_price = usi_product.price.split(" ")[0];
							if (clean_price) {
								clean_price = clean_price.replace(/[^0-9.]+/g, "");
							} else {
								clean_price = usi_product.price.replace(/[^0-9.]+/g, "");
								if (clean_price.split(".").length > 2) {
									clean_price = clean_price.split(".")[0];
								}
							}
							if (Number(clean_price) > 0) {
								priceline_sent = priceline;
								usi_custom_monitor.send_utf8(priceline, "priceline" + (item_num + 1));
							}
						} catch (e) {
							usi_commons.log_error(e);
						}

						for (prop in usi_product) {
							if (usi_product.hasOwnProperty(prop) && usi_product[prop] != null) {
								var value = usi_product[prop];
								if (typeof(value) === "string") {
									if (prop.indexOf("price") != -1 && Number(decodeURIComponent(value).replace(/[^0-9.]+/g, "")) === 0) {
										
										value = "<b></b>";
									}
									if (prop.indexOf("pic") == 0) {
										if (value.indexOf("https://emsfs.autodesk.com") == 0) {
											usi_custom_monitor.send_data("https://www2.upsellit.com/admin/custom/proxy.jsp?url=" + value, prop + (item_num + 1));
										} else {
											usi_custom_monitor.send_data(value, prop + (item_num + 1));
										}
									} else if (prop.indexOf("qty") != -1) {
										// Check that qty is no more than 3 digits
										usi_commons.log('[ send_products ] qty:', value);
										if (value && value.length > 3) {
											// Suppress this pc (this is likely a renewal product and scraping is broken)
											usi_commons.log('[ send_products ] Suppressing PC!');
										} else {
											usi_custom_monitor.send_utf8(value, prop + (item_num + 1));
										}
									} else {
										if (prop === "price") price = value;
										usi_custom_monitor.send_utf8(value, prop + (item_num + 1));
									}

									// Display separate copy for monthly subscribers
									if (prop === "type") {
										usi_app.has_monthly_keyword(usi_product[prop]) ? usi_custom_monitor.send_data('1', 'usi_monthly') : usi_custom_monitor.send_data('null', 'usi_monthly');
									}
								}
							}
						}

						// Priceline fallback
						if (!priceline_sent) {
							usi_custom_monitor.send_utf8(price, "priceline" + (item_num + 1));
						}

					}
					if (typeof (usi_app.pids_in_cart) !== "undefined" && usi_app.pids_in_cart != "") {
						usi_custom_monitor.send_data(usi_app.pids_in_cart, "usi_pids");
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
			},
			send_locale_data: function (info) {
				try {
					for (var i in info) {
						if (info.hasOwnProperty(i) && i.indexOf("optin_") == -1) {
							if (i.indexOf('link') !== -1) usi_custom_monitor.send_data(info[i], i);
							else usi_custom_monitor.send_utf8(info[i], i);
						}
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
			},
			send_odm_cart_links: function () {
				if (usi_commons.gup('cartId') != '') {
					// Easier way of saving ODM cart rebuilder link via cart ID
					var link = usi_app.aff_links[usi_app.locale] + "?url=" + encodeURIComponent(encodeURIComponent(location.href.split("?")[0] + "?cartId=" + usi_commons.gup('cartId')));
					usi_js_monitor.USI_LoadDynamics(link, "link", usi_js_monitor.USI_getASession());
				} else {
					setTimeout(usi_custom_monitor.send_odm_cart_links, 1000);
				}
			},
			delete_session: function () {
				usi_js_monitor.USI_siteID = -1; // attempt to nullify session
				usi_custom_monitor.send_data("-", "usi_email");
				usi_custom_monitor.send_data("-", "EMAILemail");
				usi_custom_monitor.send_data("-", "EMAILconfirmEmail");
				usi_custom_monitor = {};
				usi_commons.log_error("User opted out");
			},
			monitor_user_opt_in: function () {
				// Hide emails from client reporting if user did not opt in (APAC/ANZ only)
				var optin = document.getElementById('usi_optin_div')
				if (optin != null && optin.style.display == 'none' && typeof usi_app.optedin == 'undefined') {
					usi_custom_monitor.delete_session();
				} else {
					setTimeout(usi_custom_monitor.monitor_user_opt_in, 2000);
				}
			},
			show_opt_in: function (info) {
				try {
					var place_css = function (css) {
						var css_element = document.createElement("style");
						css_element.type = "text/css";
						if (css_element.styleSheet) {
							css_element.styleSheet.cssText = css;
						} else {
							css_element.innerHTML = css;
						}
						document.getElementsByTagName('head')[0].appendChild(css_element);
					};
					var place_html = function (html, place_where) {
						var html_element = document.createElement('div');
						html_element.setAttribute('id', 'usi_optin_div');
						html_element.innerHTML = html;
						place_where.appendChild(html_element);
					};
					this.remove_optin = function () {
						var optin = document.getElementById('usi_optin_div');
						if (optin != null) {
							optin.style.display = "none";
						}
					};
					this.opt_in = function () {
						usi_custom_monitor.remove_optin();
						var optin = document.getElementById('usi_optin');
						if (optin == null || optin.checked == false) return;
						usi_app.optedin = true;
						usi_js_monitor.USI_LoadDynamics("1", 'optedin', usi_js_monitor.USI_getASession());
						usi_js_monitor.USI_LoadDynamics(usi_app.email, 'usi_email', usi_js_monitor.USI_getASession());
						if (typeof usi_js_monitor['send_all_info'] === "function") {
							usi_js_monitor['send_all_info']();
						}
					};
					var html = [
						'<div id="usi_optin_contain">',
						'<span id="usi_closebutton">&', 'times;</span>',
						'<div id="usi_text">', info.optin_head, '</div>',
						'<div id="usi_input"><input type="checkbox" id="usi_optin" checked><label for="usi_optin">', info.optin_desc, '</label></div>',
						'<div id="usi_ok">', info.optin_ok, '</div>',
						'</div>'
					].join('');

					var usi_position = 'position:absolute;left:200px;top:50px;';
					var usi_arrow_things = ['#usi_optin_contain:after,#usi_optin_contain:before {right: 100%;top: 90%;border: solid transparent;content: " ";height: 0;width: 0;position: absolute;pointer-events: none;}',
						'#usi_optin_contain:after {border-color: rgba(255, 255, 255, 0);border-right-color: #f5f5f5;border-width: 20px;margin-top: -74px;}',
						'#usi_optin_contain:before {border-color: rgba(21, 136, 179, 0);border-right-color: #ccc;border-width: 22px;margin-top: -76px;}'].join('');

					if (document.getElementById("dr_emailInfo") != null) {
						html = "<div style='position:relative;top:25px;left:0;width:1px;height:1px'>" + html + "</div>";
						place_html(html, document.getElementById("dr_emailInfo"));
						if (usi_app.locale == "en-IN" || usi_app.locale == "es-AR") {
							usi_position = 'position:absolute;left:527px;top:-400px;';
						} else if (usi_app.locale == "pt-BR" || usi_app.locale == "en-SG") {
							usi_position = 'position:absolute;left:527px;top:-370px;';
						} else if (usi_app.locale == "ko-KR") {
							usi_position = 'position:absolute;left:620px;top:-346px;';
						} else if (usi_app.locale == "tr-TR") {
							usi_position = 'position:absolute;left: 529px;top: -394px;';
						} else if (usi_app.locale == "es-MX") {
							usi_position = 'position:absolute;left: 529px;top: -394px;';
						} else if (usi_app.locale == "en-MY") {
							usi_position = 'position:absolute;left:350px; top: -370px;';
						} else {
							usi_position = 'position:absolute;left:300px;top:-137px;';
						}
					} else if (document.getElementsByClassName("signin-actions").length > 0) {
						// signin-actions
						if (window.usi_which_iframe == "login-iframe") {
							if (usi_app.locale == "NL") {
								usi_position = 'position:absolute;left:380px;top:115px;';
							} else {
								usi_position = 'position:absolute;left:380px;top:95px;';
							}
						} else {
							if (usi_app.locale == "NL") {
								usi_position = 'position:absolute;left:90px;top:200px;';
							} else {
								usi_position = 'position:absolute;left:110px;top:182px;';
							}
							usi_arrow_things = ['#usi_optin_contain:after,#usi_optin_contain:before {left: 100%;top: 80%;border: solid transparent;content: " ";height: 0;width: 0;position: absolute;pointer-events: none;}',
								'#usi_optin_contain:after {border-color: rgba(255, 255, 255, 0);border-left-color: #f5f5f5;border-width: 20px;margin-top: -74px;}',
								'#usi_optin_contain:before {border-color: rgba(21, 136, 179, 0);border-left-color: #ccc;border-width: 22px;margin-top: -76px;}'].join('');
						}
						place_html(html, document.getElementsByClassName("signin-actions")[0]);
					} else if (document.getElementById("O2-iframe-container") != null) {
						usi_position = 'position:absolute;left:450px;top:266px;';
						if (usi_app.locale == "en-AU") {
							usi_position = 'position:absolute;left:486px;top:171px;';
						} else if (usi_app.locale == "en-CA" || usi_app.locale == "fr-CA") {
							usi_position = 'position:absolute;left:486px;top:173px;';
						}
						place_html(html, document.getElementById("O2-iframe-container"));
					} else if (document.querySelector(".container-odm-accordion-payment-mfe-MuiAccordionDetails-root div.form-container") != null) {
						if (typeof window.screen != "undefined" && window.screen.width != "undefined" && window.screen.width < 1230 && usi_app.locale === 'ja-JP') {
							usi_position = 'position:absolute;left:577px;top:520px;';
						} else {
							usi_position = 'position:absolute;left:577px;top:450px;';
						}
						if(usi_app.is_staging && usi_app.emea_uk.indexOf(usi_app.locale) != -1){
							usi_position = 'position:absolute;left:577px;top:500px;';
						}
						place_html(html, document.querySelector(".container-odm-accordion-payment-mfe-MuiAccordionDetails-root div.form-container"));
					} else if (document.getElementById("deliveryContactEmailInput") != null) {
						usi_position = 'position:absolute;left:280px; top: 0px;';
						if (typeof window.screen != "undefined" && window.screen.width != "undefined" && window.screen.width < 500) {
							usi_position = 'position:absolute;top:0px;';
						}
						place_html(html, document.getElementById("deliveryContactEmailInput"));
					} else if (document.querySelector(".mfe-checkout-customer-details-MuiFormControl-root") != null) {
						usi_position = 'position:absolute;top:-35px;left: 266px;';
						place_html(html, document.querySelector(".mfe-checkout-customer-details-MuiFormControl-root"));
					}

					var optin_svg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6.15' id='small-checkmark'><path fill='%23ffffff' d='M3.52 6.15a.65.65 0 01-.43-.17L0 3.11l.86-.93L3.5 4.64 8.1 0l.9.89-5.03 5.07c-.12.13-.28.19-.45.19z'></path></svg>";
					var usi_input_styles = '#usi_input {font-size:14px;color:#000000; padding: 5px 0 5px 24px; position: relative;}';
					var usi_dr_styles = '';
					if (document.querySelector('#dr_QuickBuyCart #dr_accountInformation')) {
						usi_input_styles = '#usi_input {font-size:14px;color:#000000; padding: 0 0 45px 0; position: relative;}';
						usi_dr_styles = '#usi_input label {padding-left: 25px;}';
					}
					var css = [
						'#usi_optin_contain {background:#f5f5f5; border:1px solid #ccc; width:280px; padding:15px;', usi_position, 'box-shadow: 1px 1px 10px rgba(0, 0, 0, 0.25);z-index:9999999; box-sizing: border-box;}',
						'#usi_optin {opacity: 0; position: absolute; margin: 0; filter: unset !important; height: 18px; width: 18px;}',
						'#usi_optin:focus + label::before {outline: 0;}',
						'#usi_optin + label::before {border: 1px solid #000; box-sizing: border-box; content: ""; height: 18px; width: 18px; left: 0; position: absolute; top: 7px; background: #fff; border-radius: 2px;}',
						'#usi_optin + label::after {background-image: url("' + optin_svg + '"); content: ""; height: 18px; width: 18px; border: 2px solid transparent; position: absolute; box-sizing: content-box; top: 4px; left: -2px; opacity: 1 !important; display: block; border-radius: 2px; background-repeat: no-repeat; background-size: 12px 11px; background-position: center;}',
						'#usi_optin:checked + label::before {background: #000;}',
						usi_arrow_things,
						'#usi_closebutton {text-align: center; position: absolute; top: 5px; right: 4px; font-size: 30px; cursor: pointer; height: 20px; width: 20px; line-height: 20px;color:#666;}',
						'#usi_text {font-size:18px;color:#222;margin-bottom:6px;}',
						usi_input_styles,
						usi_dr_styles,
						'#usi_input input {position: absolute;left: 0;}',
						'#usi_ok {font-size:14px;color:#fff;background:#000000;padding:10px; display:block; cursor:pointer;margin-top:10px; line-height: 1;border-radius: 2px;}',
						'#usi_ok:after { content: "\\203a"; float: right; font-size:30px; margin-top:-9px;}'
					].join('');

					if (!usi_app.dr_cart) {
						css += [
							'@media screen and (max-width: 768px) {',
							'#usi_optin_contain {width:100%;top:inherit;top: 450px !important;position:fixed;left:0;}',
							'#usi_optin_contain:after, #usi_optin_contain:before { left: 50%; top: 32px; transform: translateX(-50%); }',
							'#usi_optin_contain:before { border-bottom-color: #ccc; border-right-color:transparent;border-width: 24px; margin-top: -80px; }',
							'#usi_optin_contain:after { border-bottom-color: #f5f5f5;border-right-color:transparent; border-width: 24px; margin-top: -77px; }',
							'#usi_closebutton {top:8%;right:3%;font-size:40px;height:20px;width:20px;}',
							'#usi_text{display:block;}',
							'}'
						].join('');
					}

					css += [
						'@media screen and (max-width: 768px) {',
						'#usi_optin_contain {background: #f5f5f5;border: 1px solid #ccc;width: 280px;padding: 15px;position: absolute;left: 75px;top: -467px;box-shadow: 1px 1px 10px rgb(0 0 0 / 25%);z-index: 9999999;box-sizing: border-box;}',
						'#usi_optin_contain:after,#usi_optin_contain:before {bottom: 0;right: 82%;border: solid transparent;content: " ";height: 0;width: 0;position: absolute;pointer-events: none;margin-bottom: -8%;margin-top: 0;top: 100%;}',
						'#usi_optin_contain:after {border-left: 20px solid transparent;border-right: 20px solid transparent;border-top: 20px solid #f5f5f5;}',
						'#usi_optin_contain:before {border-left: 20px solid transparent;border-right: 20px solid transparent;border-top: 20px solid #ccc;}',
						'}'
					].join('');

					// JP specific styles
					if (usi_app.locale === 'ja-JP') {
						css += [
							'#usi_optin_contain {width: 335px;}',
							'#usi_input label {line-height: 21px;}'
						].join('');
					} else if (document.getElementById("deliveryContactEmailInput") != null && typeof window.screen != "undefined" && window.screen.width != "undefined" && window.screen.width < 500) {
						// Mobile CB cart pages adjustments
						css += [
							'#usi_optin_contain {top: 110px !important; left: 50px;}',
						].join('');
					} else if (document.querySelector(".mfe-checkout-customer-details-MuiFormControl-root") != null && typeof window.screen != "undefined" && window.screen.width != "undefined" && window.screen.width < 500) {
						// Mobile CB 1st cart page adjustments
						css += [
							'#usi_optin_contain {position:absolute;top:-144px !important;left:0 !important;}',
						].join('');
					}

					place_css(css);

					var usi_closebutton = document.getElementById('usi_closebutton');
					var ok = document.getElementById('usi_ok');
					if (usi_closebutton) usi_closebutton.addEventListener('click', usi_custom_monitor.remove_optin, false);
					if (ok) ok.addEventListener('click', usi_custom_monitor.opt_in, false);

					// monitor for optin (clear emails in client reporting if not)
					if (usi_app.emea_uk.indexOf(usi_app.locale) != -1 || usi_app.apac.indexOf(usi_app.locale) != -1 || usi_app.anz.indexOf(usi_app.locale) != -1) {
						setTimeout(usi_custom_monitor.monitor_user_opt_in, 500);
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
			},
			init: function () {
				// Special stuff for bic iframes
				try {
					if (!usi_app.dr_cart) {
						var usi_all_items_reported = 0;
						var usi_last_email_post = "";
						window.usi_which_iframe = "login-iframe";

						usi_custom_monitor.find_register = function () {
							var usi_found_email = "";
							if (document.getElementsByClassName(window.usi_which_iframe).length > 0) {
								document.getElementsByClassName(window.usi_which_iframe)[0].contentWindow.postMessage(JSON.stringify({
									action: 'get_email'
								}), "*");
								if (window.usi_which_iframe == "login-iframe") window.usi_which_iframe = "create-account-iframe";
								else window.usi_which_iframe = "login-iframe";
							} else if (document.getElementById("O2-iframe-container") != null && document.getElementById("O2-iframe-container").getElementsByTagName("iframe").length > 0) {
								document.getElementById("O2-iframe-container").getElementsByTagName("iframe")[0].contentWindow.postMessage(JSON.stringify({
									action: 'get_email'
								}), "*");
							}
							if (typeof (window.obj) != "undefined" && typeof (window.obj.email) != "undefined" && window.obj.email.indexOf("@") != -1) {
								usi_found_email = window.obj.email;
								if (typeof (window.obj.firstName) != "undefined") usi_js_monitor.USI_LoadDynamics(window.obj.firstName, 'firstName', usi_js_monitor.USI_getASession());
							} else if (typeof (window['usi_email_from_iframe']) != "undefined" && window['usi_email_from_iframe'].indexOf("@") != -1 && usi_last_email_post != window['usi_email_from_iframe']) {
								usi_found_email = window['usi_email_from_iframe'];
							} else if (usi_app.is_odm_cart && document.querySelector("[name='customerEmail']") != null && document.querySelector("[name='customerEmail']").value != "" && document.querySelector("[name='customerEmail']").value.indexOf("@") != -1) {
								usi_found_email = document.querySelector("[name='customerEmail']").value;
							} else if (usi_app.is_cb_cart && document.querySelector(".deliveryEmail .interactField .readonlyInputValue") != null && document.querySelector(".deliveryEmail .interactField .readonlyInputValue").textContent != "") {
								usi_found_email = document.querySelector(".deliveryEmail .interactField .readonlyInputValue").textContent;
							}
							if (usi_found_email != "") {
								usi_app.email = usi_found_email;
								if (usi_all_items_reported == 0) {
									usi_all_items_reported = 1;
									usi_js_monitor.USI_reportAllItems();
								}
							}
						}
						var usi_find_registerID = setInterval(usi_custom_monitor.find_register, 1500);
						if (usi_find_registerID) {
							usi_commons.log('[ usi_custom_monitor.init ] usi_find_registerID interval set');
						}
						usi_js_monitor.USI_checkAllForChange = function () {
							for (var i = 0; i < usi_js_monitor.USI_onlyRecordFields.length; i++) {
								var usi_fieldName = usi_js_monitor.USI_onlyRecordFields[i];
								var usi_field = null;
								if (document.getElementsByName(usi_js_monitor.USI_onlyRecordFields[i]) != null && document.getElementsByName(usi_js_monitor.USI_onlyRecordFields[i]).length > 0) {
									usi_field = document.getElementsByName(usi_js_monitor.USI_onlyRecordFields[i])[1];
								} else if (document.getElementById(usi_js_monitor.USI_onlyRecordFields[i]) != null) {
									usi_field = document.getElementById(usi_js_monitor.USI_onlyRecordFields[i]);
								}
								if (usi_field != null) {
									var usi_fieldValue = usi_field.value;
									if (usi_fieldValue != null && usi_fieldValue != "" && usi_fieldValue != usi_js_monitor.USI_PreviousFieldValues[usi_fieldName]) {
										usi_js_monitor.USI_PreviousFieldValues[usi_fieldName] = usi_fieldValue;
										usi_js_monitor.USI_LoadDynamics(usi_fieldValue, usi_fieldName, USI_getASession());
									}
								}
							}
						}
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
			}
		};
		usi_app.encode_unicode = function (str) {
			try {
				function dec2hex4(textString) {
					var hexequiv = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
					return hexequiv[(textString >> 12) & 0xF] + hexequiv[(textString >> 8) & 0xF] +
							hexequiv[(textString >> 4) & 0xF] + hexequiv[textString & 0xF];
				}

				function convertCharStr2jEsc(str) {
					// Converts a string of characters to JavaScript escapes
					// str: sequence of Unicode characters
					var highsurrogate = 0;
					var suppCP;
					var pad;
					var outputString = '';
					for (var i = 0; i < str.length; i++) {
						var cc = str.charCodeAt(i);
						if (cc < 0 || cc > 0xFFFF) {
							outputString += '!Error in convertCharStr2UTF16: unexpected charCodeAt result, cc=' + cc + '!';
						}
						if (highsurrogate != 0) { // this is a supp char, and cc contains the low surrogate
							if (0xDC00 <= cc && cc <= 0xDFFF) {
								suppCP = 0x10000 + ((highsurrogate - 0xD800) << 10) + (cc - 0xDC00);
								suppCP -= 0x10000;
								outputString += '\\u' + dec2hex4(0xD800 | (suppCP >> 10)) + '\\u' + dec2hex4(0xDC00 | (suppCP & 0x3FF));
								highsurrogate = 0;
								continue;
							} else {
								outputString += 'Error in convertCharStr2UTF16: low surrogate expected, cc=' + cc + '!';
								highsurrogate = 0;
							}
						}
						if (0xD800 <= cc && cc <= 0xDBFF) { // start of supplementary character
							highsurrogate = cc;
						} else { // this is a BMP character
							//outputString += dec2hex(cc) + ' ';
							switch (cc) {
								case 0:
									outputString += '\\0';
									break;
								case 8:
									outputString += '\\b';
									break;
								case 9:
									outputString += '\t';
									break;
								case 10:
									outputString += '\n';
									break;
								case 13:
									outputString += '\\r';
									break;
								case 11:
									outputString += '\\v';
									break;
								case 12:
									outputString += '\\f';
									break;
								case 34:
									outputString += '"';
									break;
								case 39:
									outputString += '\'';
									break;
								case 92:
									outputString += '\\\\';
									break;
								default:
									if (cc > 0x1f && cc < 0x7F) {
										outputString += String.fromCharCode(cc)
									} else {
										pad = cc.toString(16).toUpperCase();
										while (pad.length < 4) {
											pad = '0' + pad;
										}
										outputString += '\\u' + pad
									}
							}
						}
					}
					return outputString;
				}

				return convertCharStr2jEsc(str);
			} catch (err) {
				usi_commons.log_error(err);
			}
		};
		usi_app.clear_cart = function (cb) {
			try {
				var delete_btn = document.querySelector('.checkout--cart-section .checkout--product-bar button');
				if (usi_app.is_odm_cart) delete_btn = document.querySelector('button[data-testid*="remove-line-item-"]');
				if (delete_btn && typeof delete_btn.click === "function") {
					if (!usi_app.clear_cart_in_progress) {
						usi_app.clear_cart_in_progress = true;
						//usi_app.add_loading_graphic("");
					}
					delete_btn.click();
					setTimeout(function () {
						usi_app.clear_cart(cb);
					}, 3000);
				} else if (typeof cb === "function") {
					usi_app.remove_loading_graphic();
					cb();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_page_visits = function (page_visited) {
			try {
				usi_commons.log("usi_app.get_page_visits()");
				var page_visits_cookie_name;
				if (page_visited == "autocad") {
					page_visits_cookie_name = "usi_page_visits_autocad";
				} else if (page_visited == "autocadlt") {
					page_visits_cookie_name = "usi_page_visits_autocadlt";
				} else if (page_visited == "acadcompare") {
					page_visits_cookie_name = "usi_page_visits_acadcompare";
				}

				var page_visits = Number(usi_cookies.get(page_visits_cookie_name)) + 1;
				usi_cookies.set(page_visits_cookie_name, page_visits, usi_cookies.expire_time.week);
				usi_commons.log("Page visit: " + page_visits);
				return page_visits;
			} catch(err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.monitor_for_aff_pixels = function () {
			try {
				var cj1 = "";
				try {
					var usi_imgs = document.getElementsByTagName("img");
					for (var i = 0; i < usi_imgs.length; i++) {
						if (usi_imgs[i].src.indexOf("emjcd.com") != -1) {
							cj1 = usi_imgs[i].src;
						}
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
				var cfjump = "";
				try {
					var usi_scripts = document.getElementsByTagName("script");
					for (var i = 0; i < usi_scripts.length; i++) {
						if (usi_scripts[i].src.indexOf("https://cfjump.autodesk.com/track") == 0) {
							cfjump = usi_scripts[i].src;
						}
					}
				} catch (err) {
					usi_commons.report_error(err);
				}
				if (cj1 != "" || cfjump != "") {
					if (cj1 != "") {
						usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?autodesk_cj=" + encodeURIComponent(cj1) + "&url=" + encodeURIComponent(location.href));
					} else {
						usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?cfjump=" + encodeURIComponent(cfjump) + "&url=" + encodeURIComponent(location.href));
					}
					usi_commons.load_script("https://www.upsellit.com/active/autodesk_new_pixel.jsp");
				} else {
					setTimeout(usi_app.monitor_for_aff_pixels, 2000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.save_cb_cart = function(){
			try {
				usi_commons.log("usi_app.save_cb_cart()");
				var cart_prefix = "usi_prod_";
				usi_cookies.flush(cart_prefix);
				usi_app.cart = {
					items: usi_app.scrape_cb_cart(),
				}
				// our code uses usi_app.products
				usi_app.products = usi_app.cart.items;
				usi_commons.log(usi_app.cart);
				if (typeof usi_app.cart.items != "undefined") {
					usi_cookies.set('usi_num_items', usi_app.cart.items.length, usi_cookies.expire_time.week);
					usi_app.cart.items.forEach(function(product, index){
						var prop;
						if (index >= 3) return;
						for (prop in product) {
							if (product.hasOwnProperty(prop)) {
								usi_cookies.set(cart_prefix + prop + "_" + (index + 1), product[prop], usi_cookies.expire_time.week);
							}
						}
					});
				}
			} catch(err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_cb_cart = function() {
			try {
				return usi_dom.get_elements('.cbCartItem').map(function(container){
					var product = {};
					// fixing 'ko-KR' missing prod image
					if (usi_app.locale == "ko-KR" && container.querySelector(".cbProductImage img") == null && usi_cookies.get("usi_prod_image_1") != null && usi_cookies.get("usi_prod_name_1") != null) {
						product.pic = usi_cookies.get("usi_prod_image_1");
						product.image = usi_cookies.get("usi_prod_image_1");
						product.name = usi_cookies.get("usi_prod_name_1");
					} else {
						product.pic = container.querySelector(".cbProductImage img").src;
						product.image = container.querySelector(".cbProductImage img").src;
						product.name = container.querySelector(".cbProductImage img").alt.trim();
					}
					product.price = container.querySelector(".cbProductTotalPrice .cbItotal").textContent.trim();
					product.qty = container.querySelector(".cbProductQuantity span").textContent.trim();
					product.term = container.querySelector(".cbProductNameExtension").textContent.trim();
					product.type = container.querySelector(".cbProductNameExtension").textContent.trim();
					product.type_full = container.querySelector(".cbProductNameExtension").textContent.trim();
					return product;
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.scrape_minicart_or_cart_cookie = function() {
			try {
				if (["en-US", "en-UK", "en-EU", "en-CA", "fr-CA", "en-AU", "en-NZ", "ja-JP", "fr-FR", "de-DE", "it-CH", "es-ES", "fi-FI", "nl-NL", "hu-HU", "pt-PT", "sv-SE", "pl-PL", "da-DK", "cs-CZ", "no-NO", "fr-BE", "nl-BE", "de-CH", "it-IT", "fr-CH"].indexOf(usi_app.locale_lc) != -1 && !usi_app.is_checkout_page) {
					// minicart
					if (!usi_app.cart_timeout) usi_app.start_minicart_monitor();
					usi_app.rebuild_cart_using_cart_cookie();
				} else if (usi_app.cb_checkout_countries.indexOf(usi_app.locale) != -1) {
					usi_app.rebuild_cart_using_cart_cookie();
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};

		usi_app.rebuild_cart_using_cart_cookie = function() {
			try {
				if (usi_cookies.value_exists("usi_app_products")) {
					var cart_prefix = "usi_prod_";
					usi_cookies.flush(cart_prefix);
					usi_app.cart = {};
					usi_app.cart.items = usi_cookies.get_json("usi_app_products");
					usi_commons.log(usi_app.cart);
					var usi_pids = usi_app.cart.items.map(function(item) {
						return item.product_id;
					});
					usi_cookies.set("usi_pids", usi_pids.join(","), usi_cookies.expire_time.week);
					usi_cookies.set('usi_num_items', usi_app.cart.items.length, usi_cookies.expire_time.week);
					usi_app.cart.items.forEach(function(product, index){
						var prop;
						var prop_modifier;
						if (index >= 3) return;
						for (prop in product) {
							if (product.hasOwnProperty(prop)) {
								prop_modifier = prop;
								// update pop name if needed
								if (prop == "pic") prop_modifier = "image";
								usi_cookies.set(cart_prefix + prop_modifier + "_" + (index + 1), product[prop], usi_cookies.expire_time.week);
							}
						}
					});
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.link_injection = function (src, callback) {
			try {
				var iframe = document.createElement("iframe");
				iframe.src = src;
				iframe.style.width = "1px";
				iframe.style.height = "1px";
				if (callback != null) iframe.onload = callback;
				document.getElementsByTagName('body')[0].appendChild(iframe);
				usi_commons.log("[ link_injection ] Link Injection Success");
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_session_count = function() {
			try {
				usi_commons.log("usi_app.get_session_count()");
				var visit_test = usi_commons.gup("usi_visits");
				if (usi_cookies.value_exists("usi_session") == false || visit_test) {
					// record number of sessions
					var session_count = visit_test || Number(usi_cookies.get("usi_visits")) + 1;
					usi_cookies.set("usi_visits", session_count, usi_cookies.expire_time.never, true);
					// note session is recorded
					usi_cookies.set("usi_session", "ok");
				}
				return Number(usi_cookies.get("usi_visits"));
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.get_us_acad_page_visits = function () {
			try {
				usi_commons.log("usi_app.get_us_acad_page_visits()");
				var page_visits = parseInt(usi_cookies.get("usi_us_acad_page_visits"), 10) || 0;

				if (["en-US"].indexOf(usi_app.locale) != -1 && location.href.indexOf("autodesk.com/products/autocad/overview") != -1) {
					page_visits += 1;
					usi_cookies.set("usi_us_acad_page_visits", page_visits, usi_cookies.expire_time.month);
				}

				if (usi_commons.gup("usi_us_acad_page_visits")) page_visits = usi_commons.gup("usi_us_acad_page_visits");
				usi_commons.log("usi_us_acad_page_visits: " + page_visits);
				return page_visits;
			} catch(err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.push_analytics_event_view = function (containerType, containerName) {
			try {
				usi_commons.log("usi_app.push_analytics_event_view()");
				window.__analyticsChangeContext = window.__analyticsChangeContext || [];
				window.__analyticsChangeContext.push({
					eventData: {
						eventName: "content-viewed",
						values: {
							contentContainer: [{
								containerType: containerType,
								containerName: containerName
							}]
						}
					}
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.push_analytics_event_click = function (cssSelector, linkSection, linkTitle, linkDestinationUrl) {
			try {
				usi_commons.log("usi_app.push_analytics_event_click()");
				window.__analyticsChangeContext = window.__analyticsChangeContext || [];
				window.__analyticsChangeContext.push({
					eventData: {
						eventName: "link_click",
						values: {
							cssSelector: cssSelector
						}
					},
					link: {
						linkSection: linkSection,
						linkTitle: linkTitle,
						linkDestinationUrl: linkDestinationUrl
					}
				});
			} catch (err) {
				usi_commons.report_error(err);
			}
		};
		usi_app.session_data_callback = function () {
			usi_app.country = usi_app.session_data.country;
			usi_app.main();
		};
		usi_app.monitor_for_aff_pixels();
		usi_dom.ready(function () {
			try {
				if (location.href.toLowerCase().indexOf("/cart") != -1 || location.href.toLowerCase().indexOf("action=displaypage") != -1) {
					usi_commons.load_session_data();
				} else {
					setTimeout(usi_commons.load_session_data, 2000);
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
		});

		usi_app.utm_logger = function() {
			try {
				if (typeof(usi_app.last_url) === "undefined" || usi_app.last_url != location.href) {
					usi_app.last_url = location.href;
					if (location.href.indexOf("utm") != -1) {
						usi_commons.load_script("https://www.upsellit.com/launch/blank.jsp?utm=" + encodeURIComponent(location.href));
					}
				}
			} catch (err) {
				usi_commons.report_error(err);
			}
			setTimeout(usi_app.utm_logger, 2000);
		};

		usi_app.utm_logger();

	} catch (err) {
		usi_commons.report_error(err);
	}
}
