/* global document */

const process = require('process');

const { app, session, BrowserWindow } = require('electron');

const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

if (app.isPackaged) {
	process.env.NODE_ENV = 'production';
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';

const {
	NODE_ENV,
	YOUTUBE_TV_USER_AGENT = DEFAULT_USER_AGENT,
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
				'user-agent': YOUTUBE_TV_USER_AGENT,
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
