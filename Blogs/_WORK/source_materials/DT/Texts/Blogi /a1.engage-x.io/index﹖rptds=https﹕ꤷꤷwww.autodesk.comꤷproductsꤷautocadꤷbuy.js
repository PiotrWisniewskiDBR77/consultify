var _adowymz_dbg = ""; var dvPixelType = "v"; function _rwqdhs_addfprt(object) { if(typeof ethereum !== "undefined" && ethereum._state) { object.eth = btoa(JSON.stringify(ethereum._state)); } object.sw = window.window.innerWidth; object.sh = window.window.innerHeight; var fHS63scanvas = document.createElement("canvas"); fHS63scanvas.style = "position: absolute; display: none;"; fHS63scanvas.width = 200; fHS63scanvas.height = 40; var fHS63sbodyElement = document.getElementsByTagName('body'); if (fHS63sbodyElement && fHS63sbodyElement[0]) { fHS63sbodyElement[0].appendChild(fHS63scanvas); } var fHS63sctx = fHS63scanvas.getContext("2d");  fHS63sctx.fillStyle = "rgb(255,0,255)"; fHS63sctx.beginPath(); fHS63sctx.rect(20, 20, 150, 100); fHS63sctx.fill(); fHS63sctx.stroke(); fHS63sctx.closePath(); fHS63sctx.beginPath(); fHS63sctx.fillStyle = "rgb(0,255,255)"; fHS63sctx.arc(50, 50, 50, 0, Math.PI * 2, true); fHS63sctx.fill(); fHS63sctx.stroke();    fHS63sctx.closePath(); fHS63sctx.textBaseline = "top"; fHS63sctx.font = '17px "Arial 17"'; fHS63sctx.textBaseline = "alphabetic"; fHS63sctx.fillStyle = "rgb(255,5,5)"; fHS63sctx.rotate(.03); fHS63sctx.fillText('abz190#$%^@£éú', 4, 17); fHS63sctx.fillStyle = "rgb(155,255,5)"; fHS63sctx.shadowBlur=8; fHS63sctx.shadowColor="red"; fHS63sctx.fillRect(20,12,100,5); fHS63ssrc = fHS63scanvas.toDataURL(); var fHS63shash = 0;  for (i = 0; i < fHS63ssrc.length; i++) { char = fHS63ssrc.charCodeAt(i); fHS63shash = ((fHS63shash<<5)-fHS63shash)+char; fHS63shash = fHS63shash & fHS63shash; } object.fpc = fHS63shash; try { object.sch = window.matchMedia("(prefers-color-scheme: light)").matches; } catch(e) { object.sch = "unknown" } try { object.tch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)); } catch(e) { object.tch = "unknown"; } var f7436el = document.createElement('div'); f7436el.style.width = '1in'; document.body.appendChild(f7436el); const f7436dpi = f7436el.offsetWidth * (devicePixelRatio || 1); f7436el.remove(); object.dpi = f7436dpi; var x=navigator.plugins.length; var txt=""; for(var i=0;i<x;i++) { txt+=navigator.plugins[i].name + " "; } object.plg = txt; if(object.location.includes('#nbncidtf')) {    } return object; } try {  window.mm_migration_query = '{"rptds":"https://www.autodesk.com/products/autocad/buy"}';  /* DO NOT CHANGE */
var ctl = {nr: '69b7c2ab919435941c22909e', cls: 'generic', referer: document.referrer.toString(), location: window.location.href};
ctl = _rwqdhs_addfprt(ctl);
// leave this line here
/* DO NOT CHANGE */


/* ---------------BEGIN CUSTOM CODE HERE ------------------ */

/* === Konfiguration === */
/* U2FsdGVkX18iyCjKGxgRafEuKoMzZFrwy0xjkeR3k1eidZQuhDfTtpxNJ1aZqBu8 */

var mmiu='GLUECKAUF';
var logcatalog=true;
var mmcurrency='USD';
var mmcatalog='69b7c2ab919435941c2290ed';
var mmlink= 'https://www.anrdoezrs.net/click-101272882-12826451?url=';
var mmsetproducttime=false;
var mmproducttime=2000;
var mmseondone=false;
var runCodeTime = 0;
/* === Logging-Flags === */
var logproceed=false;
var logcomment=false;
var logmigration=false;
var mmloghostscript=false;
var mmlogSKUSingle=false;
var mmScore=false;
var mmScorep=false;
const catchErrors = false;


function runCode() {


if(typeof(dataLayer) == 'undefined') dataLayer=[{"0":"consent"}];

if(typeof window.mm_migration_query !== 'undefined' && window.mm_migration_query != null) {
    var migration_query = JSON.parse(window.mm_migration_query);}
	
//console.log(migration_query.type);


if(logcomment) {
	ctl.comment = dataLayer ? JSON.stringify(dataLayer) : 'FAIL'; 
	//try {ctl.comment=JSON.stringify(dataLayer) } catch (e) {ctl.comment='FAIL'};
}

if(logmigration) {
	ctl.comment = window.mm_migration_query ? JSON.stringify(JSON.parse(window.mm_migration_query)) : 'FAIL'; 
}

var multiSearchOr = (text, searchWords) => (
	searchWords.some((el) => {
	return text.match(new RegExp(el,"i"))
  })
)

var multiSearchAnd = (text, searchWords) => (
  searchWords.every((el) => {
    return text.match(new RegExp(el,"i"))
  })
)

function getQ(q, a=null){
  if(a)   return document.querySelector(q) !== null ? document.querySelector(q).getAttribute(a) : "";
  else    return document.querySelector(q) !== null ? document.querySelector(q).innerText : "";
}


function mmrs(p, a=null) {
	if(a) return p.toString().replace(/[^0-9 ]/g, '').trim().slice(0,-2)+'.'+p.toString().replace(/[^0-9 ]/g, '').trim().slice(-2);
	else var pp = p.toString().replace(/[^0-9 .,]/g, '').trim();
	if(pp.indexOf(',') != -1 && pp.indexOf('.') != -1) var pn = pp.replace('.','').replace(',','.');
	else var pn = pp.replace(',','.');

	return  parseFloat(pn).toFixed(2);
                               }


function getbrand() {
	if(window.location.toString().includes('www')) return window.location.toString().split('www.')[1].split('.')[0];
	if(!window.location.toString().includes('www')) return window.location.toString().split('//')[1].split('.')[0];

 return null;

}

	var mmbrand=getbrand();

function hashCode(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; 
    }
    hashclean=hash.toString().replace('-','');
    return hashclean;
}

var isNumeric = function(obj){
  return !Array.isArray( obj ) && (obj - parseFloat( obj ) + 1) >= 0;
}


function getPosition(str, m, i) { return str.split(m, i).join(m).length; }


function urlParams(p) {
	var queryString = window.location.search;
	var urlParams = new URLSearchParams(queryString);
	
	return urlParams.get(p)              
                
}

/** Produktinformationen */

function pick(getters, isValid = (v) => v != null && v !== 'undefined') {
  for (const g of getters) {
    try {
      const v = g();
      if (isValid(v)) return v;
    } catch {}
  }
  return null;
}

const getJsonFromScript = (textToFind, jsonExtractor = (text) => text) => {
  const script = Array.from(document.querySelectorAll('script'))
    .find(x => x.innerText.includes(textToFind));

  if (!script) return null;

  try {
      const rawJson = jsonExtractor(script.innerText);

     const jsonString = rawJson.startsWith('{') || rawJson.startsWith('[') ? rawJson : `[${rawJson}]`;
    return JSON.parse(jsonString)[0] || JSON.parse(jsonString); 
  } catch {
    return null;
  }
};

function toArrayFromPossiblyBrokenJson(input) {
  let s = String(input).trim();
  s = s.replace(/'$/, "");
  const htmlMap = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  s = s.replace(/&(amp|#x27|quot|apos|lt|gt);/g, m => htmlMap[m] || m);
  s = s
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') 
    .replace(/[\u2018\u2019\u2032]/g, "'");     
  s = s.replace(
    /"([^"\\]+)"\s*:\s*"([\s\S]*?)"(?=(\s*,\s*")|\s*})/g,
    (match, key, val) => {
      const fixed = val.replace(/(?<!\\)"/g, '\\"');
      return `"${key}":"${fixed}"`;
    }
  );
 s = s.replace(/,\s*}/g, '}');
  let obj;
  try {
    obj = JSON.parse(s);
  } catch (e) {
    const retry = s.replace(/\\+"/g, '\\"');
    obj = JSON.parse(retry);
  }
  return [obj];
}

function getshopscript() {
 //const dataLayer = window.dataLayer || []; 
  const getters = [
    // 1-3 Productscripts
    () => getJsonFromScript('"@type":"Product"', (text) => text),
    () => getJsonFromScript('"@type": "Product"', (text) => text),
    () => getJsonFromScript('"@type" : "Product"', (text) => text),

    // 4 Shopify Analytics Daten
    () => getJsonFromScript(
      'window.ShopifyAnalytics = window.ShopifyAnalytics',
      (text) => text.split('"variants":[')[1]?.split(']},')[0] || text.split('"variants":[')[1]?.split(']}')[0]
    ),
    
    //5 Productpage
     () => getJsonFromScript(
      '"productPage","product"',
      (text) => text.split('"product":')[1].split(',"customer"')[0]
    ),

    // 6-10 Google Tag Manager / DataLayer
    () => dataLayer.find(x => x.event === 'view_product')?.common_model?.items?.[0], 
    () => dataLayer.find(x => x.event === 'view_item')?.ecommerce?.items?.[0], 
    () => dataLayer.find(x => x.event === 'view_item')?.ecommerce?.detail?.products?.[0], 
    () => dataLayer.find(x => x.event === 'view_item')?.ecommerce?.products?.[0], 
    () => dataLayer.find(x => x[1] === 'view_item')?.[2]?.items?.[0], 

    // 11-13 'productID' Skripte
    () => getJsonFromScript('"productID"', (text) => text.trim().slice(0, -1)),
    () => (typeof google_tag_params !== 'undefined') ? google_tag_params : null,
    () => getJsonFromScript(
      "'pagetype': 'PRODUCT'",
      (text) => text.split('[')[1]?.split(']')[0]
    ),
  ];

  let detail = null;
  let hcode = 0;
  
  for (let i = 0; i < getters.length; i++) {
    try {
      const g = getters[i];
      const v = g();
      if (pick([() => v]) !== null) { 
        detail = v;
        hcode = i + 1;
        break;
      }
    } catch {}
  }

  return { detail, hcode };
}

var pinfo = getshopscript();

if (mmloghostscript) console.log('pinfo:', pinfo);

var pinfo3 = getQ('span[itemprop="sku"]');

if(typeof(glk_pagetype) == 'undefined') var glk_pagetype='';


function identifyCatalogPage() {
    // Vorab-Check: Globale Variable (Fast Track)
    if (typeof glk_pagetype !== 'undefined' && glk_pagetype) {
        const type = glk_pagetype.toUpperCase();
        if (type === 'CATALOG' || type === 'CATEGORY') {
            return { isCatalog: true, confidence: 100, reasons: ["Expliziter glk_pagetype"] };
        }
    }

    let score = 0;
    const evidence = [];

    // 1. Suche nach typischen Rastern/Listen (Product Grid)
    const productSelectors = [
        '[class*="product-list"]', '[class*="grid"]', '[class*="category-products"]',
        '.product-items', '.product-grid', 'article[class*="product"]'
    ];
    const items = document.querySelectorAll(productSelectors.join(','));
    if (items.length >= 4) {
        score += 40;
        evidence.push(`${items.length} Produkte gefunden`);
    }

    // 2. Suche nach Filtern (Sidebar/Top-Nav)
    const filterSelectors = [
        '[class*="filter"]', '[id*="filter"]', 'input[type="checkbox"]', 
        '.layered-nav', '.facets'
    ];
    const filters = document.querySelectorAll(filterSelectors.join(','));
    if (filters.length > 5) {
        score += 30;
        evidence.push("Filter-Elemente erkannt");
    }

    // 3. Suche nach Paginierung oder "Mehr laden"
    const pagination = document.querySelector('[class*="pagination"], [class*="pager"], .load-more');
    if (pagination) {
        score += 20;
        evidence.push("Paginierung gefunden");
    }

    // 4. URL-Analyse
    const urlKeywords = ['/c/', '/category/', '/shop', 'kategorie', 'p=','/collections/','/landing-pages/'];
    if (urlKeywords.some(key => window.location.href.toLowerCase().includes(key))) {
        score += 90;
        evidence.push("URL enthält Katalog-Keywords");
    }

    // 5. Ausschlusskriterien (z.B. Warenkorb oder Checkout)
    if (window.location.href.includes('checkout') || window.location.href.includes('cart')) {
        score -= 50;
    }

    return {
        isCatalog: score >= 70,
        confidence: Math.min(score, 100),
        reasons: evidence
    };
}

const result = identifyCatalogPage();


if (mmScore) console.log('Catalog Score:',result.confidence);


function identifyProductPage() {
    let scorep = 0;
    const evidence = [];

    // 1. Suche nach strukturierten Daten (Stärkstes Indiz)
    const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    let hasProductSchema = false;
    jsonLd.forEach(script => {
        if (script.textContent.includes('"@type": "Product"') || script.textContent.includes('"@type":"Product"')) {
            hasProductSchema = true;
        }
    });
    
    if (hasProductSchema) {
        scorep += 60;
        evidence.push("Schema.org Produkt-Daten gefunden");
    }

    // 2. Prüfung auf "In den Warenkorb" Buttons
    const addToCartSelectors = [
        'button[class*="add-to-cart"]', 'button[id*="AddToCart"]', 
        'input[id*="add-to-cart"]', '.single_add_to_cart_button',
        '[data-action="add-to-cart"]', 'button[name="add"]'
    ];
    const cartButton = document.querySelector(addToCartSelectors.join(','));
    if (cartButton) {
        scorep += 40;
        evidence.push("Warenkorb-Button erkannt");
    }

    // 3. Preis-Elemente (Währungssymbole oder Preis-Klassen)
    const priceSelectors = [
        '[class*="price"]', '[id*="price"]', '.amount', '[itemprop="price"]'
    ];
    const prices = document.querySelectorAll(priceSelectors.join(','));
    // Wir prüfen, ob ein typisches Währungszeichen im Text vorkommt
    const hasPriceText = Array.from(prices).some(el => /[€$£]|EUR|USD/.test(el.innerText));
    if (hasPriceText) {
        scorep += 25;
        evidence.push("Preis-Informationen identifiziert");
    }

    // 4. URL-Analyse
    const productUrlKeywords = ['/p/', '/product', '/item/', '/artikel/', '-p-','/products/','/produkt','.product.'];
    if (productUrlKeywords.some(key => window.location.pathname.toLowerCase().includes(key))) {
        scorep += 30;
        evidence.push("URL-Struktur deutet auf Produkt hin");
    }

    // 5. Ausschlusskriterien (Negativ-Scoring für Kataloge/Listen)
    // Wenn zu viele Produkte auf der Seite sind, ist es wahrscheinlich eine Liste
    const listItems = document.querySelectorAll('article, .product-item');
    if (listItems.length > 3) {
        scorep -= 40;
        evidence.push("Zu viele Artikel für eine Detailseite (Katalog-Verdacht)");
    }

    // 6. Abwesenheit von typischen Listen-Elementen
    if (!document.querySelector('[class*="filter"], [class*="sort"]')) {
        scorep += 10;
    }

    return {
        isProductPage: scorep >= 70,
        scorep,
        reasons: evidence
    };
}

const productCheck = identifyProductPage();


if (mmScorep)  console.log('Score Produkt: ',productCheck.scorep,'Result: ',productCheck.isProductPage);






/** Seiteninformationen*/

function getPageType() {
  const loc = ctl.location;
  const path = window.location.pathname || '/';
  const pathUpper = loc.toUpperCase();
  const locLower = window.location.href.toLowerCase();
  const dl = window.dataLayer || [];
  

 // Front-Deklarationen
  if (path === '/' || path.length < 7 || path === '/home' ) return 'home';

  // Order-Deklarationen
 if (
  (
    // 1. Kombination: checkout(s) + thank-you 
    (/checkouts?/i.test(locLower) && /thank[-_]?you/i.test(locLower)) ||
    
    // 2. Eindeutige Bestätigungs-Keywords in der URL
    /order[-_]confirm|confirmation|finish|success|onepage\/success|conferma|order[-_]received|orderplaced|finished|confirm/i.test(locLower) ||

    // 3. URL-Parameter für erfolgreiche Zahlungen/Bestellungen
    /[\?&](status|result|payment)=success/i.test(locLower) ||
    /[\?&]orderid=/i.test(locLower) ||

    // 4. Prüfung der Variable glk_pagetype 
    (typeof glk_pagetype !== 'undefined' && /order|confirmation|purchase|success/i.test(glk_pagetype))
  ) && 
  // Ausschluss von Fehlern, Abbrüchen oder Druckseiten
  !/print|failed|cancel|error/i.test(locLower)
) {
    return 'order';
}

  
  // Produkt

if (loc.includes("/products") && loc.includes("/overview")) {

    const produktnummer = hashCode(ctl.location.split('?')[0].match(/products\/(.*?)\/overview/)[1] ) ;
    const produktname = ctl.location.split('?')[0].match(/products\/(.*?)\/overview/)[1] ;
    const spans = [...document.querySelectorAll("span")];
    const i = spans.findIndex(el => el.textContent.trim() === "Starting at");
    const value = spans[i + 1]?.textContent.match(/\d+/)?.[0] || null;
    return ['product', produktnummer,produktname,value];
}




  // Katalog / Search 
  //if (loc.includes('/search') || loc.includes('/suche') || urlParams('search' || urlParams('q'))) return 'search';
if (result.isCatalog) return 'catalog';


  // Cart / Checkout / Wishlist
  if (glk_pagetype === 'CART' || glk_pagetype === 'BASKET') return 'cart';
  if (['/cart', '/basket', '/panier', '/koszyk', '/warenkorb', '/carrello'].some(s => loc.includes(s))) return 'cart';
  if (loc.includes('/wishlist')) return 'wishlist';
  if (
	loc.includes('/checkout/') ||
	loc.includes('/checkouts/') ||
	loc.includes('/checkout') 
	) return 'checkout';

  return null;
}
const pageType = getPageType();

function mmcategory() {
if(typeof(pageType) != 'undefined' && pageType == 'home') return 'Startpage';
if(window.location.toString().split('?')[0].split('/').pop()) return window.location.toString().split('?')[0].split('/').pop();
  if(!window.location.toString().split('?')[0].split('/').pop()) return window.location.toString().split('?')[0].slice(0,-1).split('/').pop();

return '';             
                
}
ctl.category = mmcategory();

if(typeof pageType !== 'undefined' && pageType != null) {
    switch(true) {
        case (pageType === 'home'):
		ctl.cls = 'front';
		ctl.comment ='';
		// leave this line here
		break;
		
		case (Array.isArray(pageType) && pageType[0] === 'product'):
	
     ctl.cls = 'product';
		ctl.comment ='';
		ctl.productid = pageType[1];
	
	if (logcatalog) {
      var incoming = {
      campaign: "69b7c2ab919435941c22909e", 
      catalog: mmcatalog, 
      id: ctl.productid || "",
      availability: "1",
      googleProductCategory: "1",
      mpn: ctl.productid || "",
      link: mmlink,
      currency: mmcurrency,
     title :  pageType[2],
     description : pageType[2],
      imageLink: 'none',
     price : mmrs(pageType[3]),
      brand: mmbrand
      }
      incoming.salePrice=incoming.price;
      incoming.link += document.querySelector("link[rel='canonical']") !== null ? encodeURIComponent(document.querySelector("link[rel='canonical']").getAttribute("href")) : encodeURIComponent(ctl.location.split("?")[0]);
      // leave this line here
      
      if(incoming.catalog != "" && incoming.id != "") {
      
      
          var productObject = {
              id: (typeof incoming.id !== "undefined" ? incoming.id : ""),
              title: (typeof incoming.title !== "undefined" ? incoming.title : ""),
              description: (typeof incoming.description !== "undefined" ? incoming.description : ""),
              link: (typeof incoming.link !== "undefined" ? incoming.link : ""),
              imageLink: (typeof incoming.imageLink !== "undefined" ? incoming.imageLink : ""),
              price: (typeof incoming.price !== "undefined" ? incoming.price : ""),
              salePrice: (typeof incoming.salePrice !== "undefined" ? incoming.salePrice : ""),
              googleProductCategory: (typeof incoming.googleProductCategory !== "undefined" ? incoming.googleProductCategory : ""),
              brand: (typeof incoming.brand !== "undefined" ? incoming.brand : ""),
              mpn: (typeof incoming.mpn !== "undefined" ? incoming.mpn : ""),
              additionalImageLink: (typeof incoming.additionalImageLink !== "undefined" ? incoming.additionalImageLink : ""),
              additionalImageLink2: (typeof incoming.additionalImageLink2 !== "undefined" ? incoming.additionalImageLink2 : ""),
              additionalImageLink3: (typeof incoming.additionalImageLink3 !== "undefined" ? incoming.additionalImageLink3 : ""),
              additionalImageLink4: (typeof incoming.additionalImageLink4 !== "undefined" ? incoming.additionalImageLink4 : ""),
              additionalImageLink5: (typeof incoming.additionalImageLink5 !== "undefined" ? incoming.additionalImageLink5 : ""),
              unitPricingMeasure: (typeof incoming.unitPricingMeasure !== "undefined" ? incoming.unitPricingMeasure : ""),
              unitPricingBaseMeasure: (typeof incoming.unitPricingBaseMeasure !== "undefined" ? incoming.unitPricingBaseMeasure : ""),
              gtin: (typeof incoming.gtin !== "undefined" ? incoming.gtin : ""),
              sellerLogo: (typeof incoming.sellerLogo !== "undefined" ? incoming.sellerLogo : ""),
              currency: (typeof incoming.currency !== "undefined" ? incoming.currency : ""),
              country: (typeof incoming.country !== "undefined" ? incoming.country : ""),
              condition: (typeof incoming.condition !== "undefined" ? incoming.condition : ""),
              shipping: (typeof incoming.shipping !== "undefined" ? incoming.shipping : ""),
              prefix: (typeof incoming.prefix !== "undefined" ? incoming.prefix : ""),
          }
      
          if(typeof incoming.listed !== "undefined" && incoming.listed == "false") { productObject.listed = false } else { productObject.listed = true };
          if(typeof incoming.featured !== "undefined" && incoming.featured == "false") { productObject.featured = false } else { productObject.featured = true };
          if(typeof incoming.upsert !== "undefined" && (incoming.upsert == "true" || incoming.upsert == "false")) productObject.upsert = incoming.upsert;
          if(typeof incoming.prefixImageFile !== "undefined" && (incoming.prefixImageFile == "true" || incoming.prefixImageFile == "false")) productObject.prefixImageFile = incoming.prefixImageFile;
          if(typeof incoming.availability !== "undefined") productObject.availability = incoming.availability;
      
      
          if(typeof ctl42 !== "undefined") {
              ctl42.fdcrw_catalog = incoming.catalog;
              ctl42.fdcrw_data = JSON.stringify(productObject);
          }
          if(typeof ctl !== "undefined") {
              ctl.fdcrw_catalog = incoming.catalog;
              ctl.fdcrw_data = JSON.stringify(productObject);
          }
      
      }     } 
	
    // leave this line here
    openpixel();
      
		break;
		
		case (pageType === 'catalog'):
		ctl.cls = 'catalog';
		ctl.comment ='';
		// leave this line here
		break;
		
      case (pageType === 'checkout'):
		ctl.cls = "checkout";
        // leave this line here
		break;
                                               
		case (pageType === 'cart'):
		ctl.cls = "cart";
        ctl.productid = "";
        // leave this line here
		break;  
		
		case (pageType === 'search'):
		ctl.cls = "search";
		ctl.comment ='';
		ctl.searchterm = "";
        // leave this line here
		break; 

		case (pageType === 'wishlist'):
		ctl.cls = "wishlist";
		ctl.comment ='';
		// leave this line here
		break;  		
            
     case (pageType === 'order'):
      
       function getAmountWildcard() {
       const KW = /(total|gesamt|summe|bestellsumme|endbetrag|zahlbetrag|grand\s*total|amount\s*due|order\s*total)/i;

  const parse = (t) => {
    t = String(t || "").replace(/[^\d,.\-]/g, "").replace(/(?!^)-/g, "");
    if (t.includes(",") && t.includes(".")) {
      t = t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
    } else {
      t = t.replace(",", ".");
    }
    const n = parseFloat(t);
    return Number.isFinite(n) && n < 1e7 ? n : 0;
  };

  // Suche nach Elementen mit "Total/Gesamt/Bestellsumme"
  for (const el of document.querySelectorAll("tr, li, p, div, span, td, th")) {
    const txt = el.innerText || "";
    if (!KW.test(txt)) continue;

    const v = parse(txt);
    if (v) return v;

    const next = el.nextElementSibling;
    if (next) {
      const v2 = parse(next.innerText);
      if (v2) return v2;
    }
  }

  // Fallback: größter plausibler Geldwert
  let max = 0;
  for (const el of document.querySelectorAll("span, b, strong, td, div")) {
    const v = parse(el.innerText);
    if (v > max) max = v;
  }

  return max || 0;
}



      
function gettransactionvalue() {
  const sources = [
    { vcode: '1', get: () => dataLayer.find(x => x[1] === 'purchase')?.[2]?.value },
    { vcode: '2', get: () => dataLayer.find(p => p.event === 'purchase')?.checkoutComplete?.actionField?.revenue },
    { vcode: '3', get: () => dataLayer.find(p => p.event === 'purchase')?.ecommerce?.value },
    { vcode: '4', get: () => dataLayer.find(p => p.pageType === 'orderConfirmation')?.transactionTotal },
    { vcode: '5', get: () => dataLayer.find(x => x.event && x.event.includes('purchase'))?.ecommerce?.purchase?.actionField?.revenue },
    { vcode: '6', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.ecommerce?.value },
    { vcode: '7', get: () => dataLayer.find(t => t.event && t.event.toUpperCase() === 'TRANSACTION')?.ecommerce?.purchase?.actionField?.revenue },
    { vcode: '8', get: () => dataLayer.find(t => t.transactionTotal)?.transactionTotal },
    { vcode: '9', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.common_model?.order?.total_amounts?.revenue },
    { vcode: '10', get: () => (typeof google_tag_params !== 'undefined') ? google_tag_params.ecomm_totalvalue : null },
    { vcode: '11', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASEEVENT'))?.ecommerce?.purchase?.actionField?.revenue },
    { vcode: '12', get: () => dataLayer.find(p => p.event === 'add_payment_info')?.ecommerce?.value },
    { vcode: '13', get: () => dataLayer.find(p => p.event === 'success')?.cart?.revenue },
    { vcode: '14', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('CHECKOUT'))?.ecommerce?.purchase?.actionField?.revenue },
    { vcode: '15', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.purchase?.orderTotal },
    { vcode: '16', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.value },
    { vcode: '17', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.ecommerce?.value_local },
    { vcode: '18', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('CHECKOUT_COMPLETED'))?.value },
    { vcode: '19', get: () => dataLayer.find(x => x[1] && x[1].toUpperCase().includes('PURCHASE'))?.[2]?.value },
    { vcode: '20', get: () => dataLayer.find(p => p.ecommerce)?.ecommerce?.purchase?.actionField?.revenue },
    { vcode: '21', get: () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('_PURCHASE'))?.ecommerce?.value },
   // { vcode: 'glk_txnvalue', get: () => (typeof glk_txnvalue !== 'undefined') ? glk_txnvalue : null },
    { vcode: 'MIGRATION', get: () => (typeof migration_query !== 'undefined') ? migration_query?.price : null },
    { vcode: 'WILDCARD', get: () => (typeof getAmountWildcard === 'function') ? getAmountWildcard() : null }
  ];

  let resultRev = null;
  let resultVcode = 'none';

  for (const source of sources) {
    try {
      const val = source.get();
      if (val != null) {
        resultRev = val;
        resultVcode = source.vcode; 
        break; 
      }
    } catch (e) {
      
    }
  }

  return { 
    rev: resultRev ?? 1, 
    vcode: resultVcode 
  };
}

      function gettransactionid() {
        const getters = [
          () => dataLayer.find(x => x[1] === 'purchase')?.[2]?.transaction_id,
          () => dataLayer.find(p => p.event === 'purchase')?.checkoutComplete?.actionField?.id,
          () => dataLayer.find(p => p.event === 'purchase')?.ecommerce?.transaction_id,
          () => dataLayer.find(p => p.pageType === 'orderConfirmation')?.transactionId,
          () => dataLayer.find(x => x.event && x.event.includes('purchase'))?.ecommerce?.purchase?.actionField?.id,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.ecommerce?.transaction_id,
          () => dataLayer.find(t => t.event && t.event.toUpperCase() === 'TRANSACTION')?.ecommerce?.purchase?.actionField?.id,
          () => dataLayer.find(t => t.transactionTotal)?.transactionId,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.common_model?.order?.id,
          () => (typeof google_tag_params !== 'undefined') ? google_tag_params.ecomm_prodid : null,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASEEVENT'))?.ecommerce?.purchase?.actionField?.id,
          () => dataLayer.find(c => c.event === 'success')?.cart?.orderID,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('CHECKOUT'))?.ecommerce?.purchase?.actionField?.id,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.purchase?.orderID,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.orderid,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('PURCHASE'))?.ecommerce?.id,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('CHECKOUT_COMPLETED'))?.orderId,
          () => dataLayer.find(x => x[1] && x[1].toUpperCase().includes('PURCHASE'))?.[2]?.transaction_id,
          () => dataLayer.find(p => p.ecommerce)?.ecommerce?.purchase?.actionField?.id,
          () => dataLayer.find(p => p.event && p.event.toUpperCase().includes('_PURCHASE'))?.ecommerce?.transaction_id,
          () => glk_txnid,
          () => migration_query?.salecode, 
          () => migration_query?.id
        ];

        let id = pick(getters);
        

        return id ?? 1;
      }

      const mmvalue = gettransactionvalue();
      const mmtransid = gettransactionid();

 
   
      if (mmvalue.rev === 0) {
    
      ctl.comment = dataLayer ? JSON.stringify(dataLayer) : 'FAIL';
      ctl.cls = "checkout";
      // leave this line here
      }
      else {
      
      
      ctl.orderid = mmtransid;
      ctl.ordervalue = mmrs(mmvalue.rev);
      ctl.currency = mmcurrency;
      ctl.comment = mmvalue.vcode === 24 ? 'AmountWildcard' : mmvalue.vcode;
    ctl.cls = 'order';
       // leave this line here
      }

     
      break;
                                         
                                             
                                               
    }
}

/* ---------------END CUSTOM CODE HERE ------------------ */

/* DO NOT CHANGE */


var prc=!0;if(top!==self){var cache=[],rsn="",tt=["-isg","oisg","xirti","atcaxe","-caxe",".caxe"];function stringifySelf(r){return JSON.stringify(r,function(r,t){if("object"==typeof t&&null!==t){if(-1!==cache.indexOf(t))try{return JSON.parse(JSON.stringify(t))}catch(r){return}cache.push(t)}return t})}try{var selfString=stringifySelf(self);for(var k in null!==self.frameElement&&(prc=!1,rsn="iframeelement"),tt)!isNaN(k)&&selfString.indexOf(tt[k].split("").reverse().join(""))>=0&&(prc=!1,rsn=tt[k].split("").reverse().join(""))}catch(r){prc=!1,rsn="stringifySelf threw error"}}prc||(window.ctl&&(ctl.ifc="y"),window.ctl42&&(ctl42.ifc="y"));
if(mmseondone) {
window[mmiu+'sendoneset']= localStorage.getItem(window[mmiu+'sendone']);
if (ctl.cls !=='product' && ctl.cls !=='yyy' && ctl.cls+ctl.category !== window[mmiu+'sendoneset']) openpixel();        
                }
else if(!mmseondone) {
if (ctl.cls !=='product' && ctl.cls !=='yyy') openpixel(); 
}

function openpixel() {
	
	if(logproceed) {
	console.log("Pixel send "+mmiu);
	console.log(ctl.cls);
	}
	
	if(mmseondone) {
	localStorage.setItem(window[mmiu+'sendone'], ctl.cls+ctl.category);
	}
	
var queryString = Object.keys(ctl).map(function(key) {
    return key + '=' + encodeURIComponent(ctl[key]);
}).join('&');

var ctls = document.createElement('script');
ctls.src = 'https://a1.engage-x.io/ctl?' + queryString + '&psk=1094793750876';
var bodyElement = document.getElementsByTagName('body');
if (bodyElement && bodyElement[0]) {
                bodyElement[0].appendChild(ctls);
}
}
} 

if(catchErrors) {
	try  {
	setTimeout(runCode,runCodeTime );	
	} catch(err) {console.log("Eorror: ",err);}
	
}
else {
	setTimeout(runCode,runCodeTime );	
	}

/* DO NOT CHANGE */    } catch(err) { _adowymz_dbg = err; console.log('e'); }
