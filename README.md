# Light Force

**May the Light Force Drop the Darkness.**

***English*** | [简体中文](./README_CN.md)

---

Light Force is a lightweight, simple Chrome extension designed with a single, noble purpose: to bring the light side back. It cuts through forced dark mode CSS and forcefully illuminates the websites you visit, instantly switching their appearance back to a readable, bright, and clean light theme.

## 🌟 Why Use Light Force?

*   **Better Readability for Astigmatism:** For many users with astigmatism, reading white text on a black background causes an effect called "halation" (where words blur and bleed into the background). Light Force instantly fixes this by flipping the contrast back to comfortable dark text on a light background.
*   **Reclaim Your Visual Space:** Don't let websites dictate your viewing experience. If your OS is set to dark mode but you want your browser tabs to be light, websites will often override your browser and serve you a dark page anyway. Light Force overrides the override.
*   **Perfect for Daytime Browsing:** Dark mode is great for a pitch-black room, but when you are working in a brightly lit office, working outside, or sitting by a window, a white background massively reduces screen glare and reflection. 

## ⚡ Key Features

*   **Jedi-Level Precision:** Light Force is smart. It targets websites that are actively trying to render in dark mode using CSS media queries. If a website is already light-themed, Light Force leaves it untouched.
*   **One-Click Switch:** Toggle the extension on or off instantly with the beautifully designed popup.
*   **Instant Visual Feedback:** The extension icon features a helpful "ON" badge that lights up when the force is active, so you always know your current status.
*   **Lightweight & Fast:** Engineered to run seamlessly in the background using Manifest V3 Service Workers. It respects your privacy and works purely locally.

## 🛠️ Installation

### Chrome Extension (Developer Mode)

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click the **Load unpacked** button and select the `light-force` directory.
5. The extension is now installed! Don't forget to pin it for easy access.

### Userscript (Tampermonkey / Violentmonkey)

1. Ensure you have a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) installed.
2. Open the [light-force.user.js](./light-force.user.js) file in this repository.
3. Your userscript manager should automatically detect it and offer to install it.
4. If not, copy the entire content of `light-force.user.js`, open your userscript manager dashboard, create a new script, and paste the content.
5. Save the script, and the Light Force will be with you on all websites!

## 💻 Technical Details

Light Force utilizes the latest Chrome Extension API (**Manifest V3**). It operates by injecting a content script at `document_start` to intercept and override CSS `prefers-color-scheme: dark` media queries, forcing the browser to render the light theme variant instead.

Permissions used:
- `storage`: To remember your toggle preference (on/off).
- `activeTab`: To allow the popup to interact with the currently active page.
- `<all_urls>` (Content Script): To inject the light-force CSS override on all sites.

## 🔒 Privacy

Light Force strictly manipulates the CSS styles of websites locally in your browser to improve readability. It **does not** collect, track, or transmit any of your personal data, keystrokes, or browsing history.

---

*Ignite your lightsaber and banish the darkness. Reclaim your bright, readable web with **Light Force** today!*
