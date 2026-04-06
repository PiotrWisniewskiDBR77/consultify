/**
 * Embed Careers Page
 * BambooHR Version 1.0.0
 */

(function() {
	var rootId = 'BambooHR-ATS';
	var el = document.getElementById('BambooHR');

	if(!el) {
		console.error('BambooHR-ATS: Hmm, Looks like we are missing something, Double check the code snippet.');
		return;
	}

	var departmentId = el.getAttribute('data-departmentId');
	var domain = el.getAttribute('data-domain');
	var version = el.getAttribute('data-version') || '1.0.0';
	var noPudgy = el.hasAttribute('data-noPudgy');

	if(!domain) {
		console.error('BambooHR-ATS: We are unable to retrieve the domain, Double check the code snippet.');
		return;
	}

	var root = document.createElement('div');
	root.id = rootId;
	el.appendChild(root);

	var footer =  document.createElement('div');
	footer.style =
    'font-family: "Lato", sans-serif; font-size: 12px; color: #777270; text-align: right; margin: 9px 9px 0px 0px;';
	var poweredBy = document.createTextNode('Powered by');
	var logo = document.createElement('img');
		logo.src = 'https://resources.bamboohr.com/images/footer-logo.png';
		logo.alt = 'BambooHR - HR software';
		logo.style = 'display:inline;'
	var link = document.createElement('a')
		link.href = 'http://www.bamboohr.com';
		link.target = '_blank';
		link.rel = 'external'

	link.appendChild(logo);
	footer.appendChild(poweredBy);
	footer.appendChild(link);

	el.appendChild(footer);

	var embedUrl = 'https://' + domain + '/jobs/embed2.php?version=' + encodeURIComponent(version) + '';

	if (departmentId) {
		embedUrl += '&departmentId=' + encodeURIComponent(departmentId);
	}

	var xmlhttp = new XMLHttpRequest();
	document.addEventListener('readystatechange', function(event) {
		if (event.target.readyState === 'complete') {
			xmlhttp.onreadystatechange=function() {
				if(xmlhttp.readyState == 4 && xmlhttp.status == 200) {

					var content = xmlhttp.responseText;
					if(root) root.innerHTML = content;
					if(!noPudgy) {
						showPudgy();
					}
				}
			}
			xmlhttp.open('GET', embedUrl, true);
			xmlhttp.send();
		}
	});

	function showPudgy() {
		var ASCI_MAP = [null,["██████   █████  ███    ███ ██████   ██████   ██████  ██   ██ ██████ "],null,["██   ██ ██   ██ ████  ████ ██   ██ ██    ██ ██    ██ ██   ██ ██   ██ "],null,["██████  ███████ ██ ████ ██ ██████  ██    ██ ██    ██ ███████ ██████ "],null,["██   ██ ██   ██ ██  ██  ██ ██   ██ ██    ██ ██    ██ ██   ██ ██   ██ "],null,["██████  ██   ██ ██      ██ ██████   ██████   ██████  ██   ██ ██   ██ "],null,[" "],null, ['Pudgy the Panda says Hello!'], null, null, [10], ["▄▄▄▄"], [17], [".▄▄▄▄"],  null, [8], ["▓██▀╙'"], [19], ["└▀██▄"],  null, [7], ["j█▀"], [26], ["└▀"],  null, [7], ["."],  null, [6], [";"], [7], ["▄m╖"], [10], ["▄m,"],  null, [1],  ["███▌Æ▄"], [6], ["╚█▄▓"], [3],  ["]▓▌"], [3], ["╟█▄█"],  null, ["███▓▓██▄"], [7], ["'"], [13], ["'"],  null, ["▐████████,"], [14], [".▄═²"],  null, [1], ["██████████▓▄▄▄▄▄╓,,,,,,,,,,,,,╓▄▄▄▄▄▓█████▌"],  null, [1], ["╙██████████████████████████████████████████"],  null, [3], ["██████▀▀▀▀╙╙╙└└─'''"], [4], ["'''─└└╙██████████"],  null, [3], ["╙╙┘"], [27], ["╫████████'"],  null, [3], ["▐░"], [28], ["^████████"],  null, [3], ["'."], [28], ["░▐██████⌐"],  null, [4], ["░│"], [27], ["^░└███▌╙"],  null, [4], ["]░││"],  null, [5], ["░░░││"],  null, [6], ["░░░░░││"],  null, [7], ["░░░░░░░░││"], [21], ["│"],  null, [8], ["░░░░░░░░░░░░││"], [9], ["│││░░░"],  null, [10], ["▄░░░░░░░░░░░░░░░░░░░░░░░░░│Γ"],  null, [10], ["╟█▄▄░░░░░░░░░░░░░░░░░░░░▄▓█"] ];
		var hello_from_BambooHR = ASCI_MAP.reduce((agg, val) => {
			if (val === null) return agg + '\n';
			agg = agg += '%c';

			if(typeof val[0] === 'number') {
				for (var i = 0; i < val[0]; i++) {
					agg = agg += ' ';
				}
			} else {
				agg += val[0];
			}
			return agg;
		}, '');

		var color = ASCI_MAP
			.filter(x => x !== null)
			.map(
				val => `color:#527a00; font-family: monospace, font-weight: bold`
		);
		// To remove Pudgy, add data-noPudgy to the snippet
		console.log(hello_from_BambooHR, ...color);
	}

}) ();
