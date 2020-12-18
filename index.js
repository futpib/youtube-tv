
const os = require('os');

const { app, session, BrowserWindow } = require('electron');

const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

const outdent = require('outdent');

if (app.isPackaged) {
	process.env.NODE_ENV = 'production';
}

const {
	NODE_ENV,
} = process.env;

function executeJavaScriptFunction(webContents, f, args = []) {
	const js = [
		'(',
		f.toString(),
		')(',
		...(
			args
				.map(argument => JSON.stringify(argument))
				.join(',')
		),
		');',
	].join('');

	return webContents.executeJavaScript(js);
}

async function main() {
	const [ electronBlocker ] = await Promise.all([
		ElectronBlocker.fromPrebuiltAdsAndTracking(fetch),
		app.whenReady(),
	]);

	electronBlocker.enableBlockingInSession(session.defaultSession);

	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		callback({
			requestHeaders: {
				...details.requestHeaders,
				'user-agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 NativeTVAds Safari/538.1',
			},
		});
	});

	const browserWindow = new BrowserWindow({
		fullscreen: true,
		webPreferences: {
			enableRemoteModule: false,
			contextIsolation: true,
			worldSafeExecuteJavaScript: true,
		},
	});

	if (NODE_ENV === 'production') {
		browserWindow.setAutoHideMenuBar(true);
		browserWindow.setMenuBarVisibility(false);
	}

	const { webContents } = browserWindow;

	webContents.on('did-start-loading', () => {
		executeJavaScriptFunction(webContents, deviceLabel => {
			window.tectonicConfig = window.tectonicConfig || {};
			window.tectonicConfig.featureSwitches = window.tectonicConfig.featureSwitches || {};
			window.tectonicConfig.featureSwitches.mdxDeviceLabel = deviceLabel;
		}, [
			'YouTube TV on ' + os.hostname(),
		]);
	});

	webContents.on('did-start-loading', () => {
		executeJavaScriptFunction(webContents, () => {
			let hideCursorTimeout;
			const onMouseMove = () => {
				document.body.style.setProperty('cursor', '');
				clearTimeout(hideCursorTimeout);
				hideCursorTimeout = setTimeout(() => {
					document.body.style.setProperty('cursor', 'none', 'important');
				}, 2000);
			};
			document.addEventListener('mousemove', onMouseMove);
			onMouseMove();
		});
	});

	webContents.on('before-input-event', (event, { type, key, shift, control, alt, meta }) => {
		if (type === 'keyDown' && key === 'F11' && !shift && !control && !alt && !meta) {
			browserWindow.fullScreen = !browserWindow.fullScreen;
			event.preventDefault();
		}
	});

	browserWindow.on('closed', () => {
		app.quit();
	});

	browserWindow.loadURL('https://youtube.com/tv');
}

main();
