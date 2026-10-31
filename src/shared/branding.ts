/**
 * The product's visible name, in one place. Window titles, the tray menu and the sidebar
 * wordmark read it; the page title follows it too, so the OS window list agrees.
 *
 * The installer name, app id and executable name live in package.json ("build.productName",
 * "build.appId", "build.nsis.artifactName") and the icons come from `npm run icons`.
 *
 * Note: Electron derives the folder it keeps user data in from the packaged product name, so a
 * rename after release starts the app with an empty store. Export sessions before changing it.
 */
export const APP_NAME = 'Rehearse'
export const APP_TAGLINE = 'Interview practice coach'
