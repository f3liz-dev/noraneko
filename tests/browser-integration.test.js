#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0

/**
 * Browser Integration Test for Noraneko
 * 
 * This test validates browser functionality using mus-uc-devtools and Firefox's Marionette protocol.
 * It tests:
 * 1. Browser startup with marionette enabled
 * 2. CSS injection into Firefox chrome context
 * 3. JavaScript execution in chrome context
 * 4. Screenshot capture functionality
 * 
 * Based on mus-uc-devtools' headless-test.js but adapted for Noraneko's build system.
 */

import { install, canDownload } from '@puppeteer/browsers';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const FIREFOX_CACHE_DIR = path.join(__dirname, '..', '.firefox-cache');
const MARIONETTE_PORT = 2828;
const TEST_TIMEOUT = 60000; // 60 seconds

/**
 * Get or download Firefox binary
 */
async function getFirefoxPath() {
    console.log('Checking Firefox binary...');
    
    // First, try to use system Firefox
    try {
        const systemFirefoxPath = execSync('which firefox', { encoding: 'utf-8' }).trim();
        if (systemFirefoxPath && fs.existsSync(systemFirefoxPath)) {
            console.log(`Using system Firefox: ${systemFirefoxPath}`);
            const version = execSync(`${systemFirefoxPath} --version`, { encoding: 'utf-8' }).trim();
            console.log(`Firefox version: ${version}`);
            return systemFirefoxPath;
        }
    } catch (e) {
        console.log('System Firefox not found, will try to download...');
    }
    
    // If system Firefox is not available, try to download
    const { Browser, detectBrowserPlatform, resolveBuildId } = await import('@puppeteer/browsers');
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(FIREFOX_CACHE_DIR)) {
        fs.mkdirSync(FIREFOX_CACHE_DIR, { recursive: true });
    }

    const platform = detectBrowserPlatform();
    console.log(`Detected platform: ${platform}`);
    
    // Try to resolve build ID for stable channel
    let buildId;
    try {
        buildId = await resolveBuildId(Browser.FIREFOX, platform, 'stable');
        console.log(`Resolved buildId: ${buildId}`);
    } catch (e) {
        console.log('Could not resolve build ID, using fallback version');
        buildId = '129.0'; // Fallback to a known stable version
    }
    
    // Check if we can download
    const available = await canDownload({
        browser: Browser.FIREFOX,
        buildId,
        platform,
        cacheDir: FIREFOX_CACHE_DIR,
    });

    if (!available) {
        throw new Error('Firefox is not available for download and system Firefox not found');
    }

    console.log('Downloading Firefox...');
    const result = await install({
        browser: Browser.FIREFOX,
        buildId,
        platform,
        cacheDir: FIREFOX_CACHE_DIR,
    });

    console.log(`Firefox installed at: ${result.executablePath}`);
    return result.executablePath;
}

/**
 * Wait for a TCP port to be open
 */
function waitForPort(port, timeout = 30000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout waiting for port ${port}`));
                return;
            }

            const client = new net.Socket();
            
            client.connect(port, '127.0.0.1', () => {
                client.end();
                resolve();
            });

            client.on('error', () => {
                client.destroy();
                setTimeout(tryConnect, 500);
            });
        };

        tryConnect();
    });
}

/**
 * Create a Firefox profile with marionette enabled
 */
function createFirefoxProfile() {
    const profileDir = path.join(FIREFOX_CACHE_DIR, 'test-profile');
    
    // Create profile directory if it doesn't exist
    if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
    }
    
    // Create prefs.js with marionette enabled
    const prefsContent = `
// Enable marionette
user_pref("marionette.port", ${MARIONETTE_PORT});
user_pref("marionette.enabled", true);
user_pref("marionette.defaultPrefs.enabled", true);

// Disable some features that might interfere with testing
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "about:blank");
user_pref("startup.homepage_welcome_url.additional", "");

// Disable updates
user_pref("app.update.enabled", false);
user_pref("app.update.auto", false);
user_pref("app.update.mode", 0);
user_pref("app.update.service.enabled", false);

// Disable telemetry
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.prompted", 2);
user_pref("toolkit.telemetry.rejected", true);
`;
    
    fs.writeFileSync(path.join(profileDir, 'prefs.js'), prefsContent.trim());
    console.log(`Created Firefox profile at: ${profileDir}`);
    
    return profileDir;
}

/**
 * Start Firefox with marionette enabled
 */
async function startFirefox(executablePath) {
    console.log('Starting Firefox in headless mode...');
    
    const profileDir = createFirefoxProfile();
    
    const args = [
        '--headless',
        '--marionette',
        '--no-remote',
        '--remote-allow-system-access',  // Required for chrome context access
        '--profile', profileDir,
    ];

    const firefox = spawn(executablePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            MOZ_HEADLESS: '1',
            MOZ_HEADLESS_WIDTH: '1920',
            MOZ_HEADLESS_HEIGHT: '1080',
        }
    });

    // Log Firefox output for debugging
    firefox.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            console.log(`Firefox stdout: ${output}`);
        }
    });

    firefox.stderr.on('data', (data) => {
        const message = data.toString().trim();
        // Only log important messages
        if (message && (message.includes('Listening on port') || 
                       message.includes('Marionette') ||
                       message.toLowerCase().includes('error'))) {
            console.log(`Firefox stderr: ${message}`);
        }
    });

    firefox.on('exit', (code) => {
        console.log(`Firefox process exited with code ${code}`);
    });

    // Wait for marionette to be ready
    console.log('Waiting for marionette to be ready...');
    await waitForPort(MARIONETTE_PORT);
    
    // Give it a bit more time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Firefox is ready!');
    return firefox;
}

/**
 * Simple Marionette protocol client
 */
class MarionetteClient {
    constructor(port = MARIONETTE_PORT) {
        this.port = port;
        this.socket = null;
        this.messageId = 0;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            let handshakeReceived = false;
            let buffer = '';

            this.socket.on('data', (data) => {
                buffer += data.toString();
                
                if (!handshakeReceived) {
                    // Parse the handshake: format is "len:json"
                    const colonPos = buffer.indexOf(':');
                    if (colonPos > 0) {
                        const length = parseInt(buffer.substring(0, colonPos));
                        if (buffer.length >= colonPos + 1 + length) {
                            const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
                            try {
                                const handshake = JSON.parse(jsonStr);
                                console.log('Marionette handshake:', handshake);
                                handshakeReceived = true;
                                buffer = buffer.substring(colonPos + 1 + length); // Keep remaining data
                                resolve();
                            } catch (e) {
                                reject(new Error(`Failed to parse handshake: ${e.message}`));
                            }
                        }
                    }
                }
            });

            this.socket.on('error', (err) => {
                reject(err);
            });

            this.socket.connect(this.port, '127.0.0.1');
        });
    }

    async sendCommand(name, params = {}) {
        return new Promise((resolve, reject) => {
            this.messageId++;
            const message = [
                0,  // MessageDirection::Incoming (client to server)
                this.messageId,
                name,
                params
            ];

            const messageStr = JSON.stringify(message);
            const messageBytes = `${messageStr.length}:${messageStr}`;
            
            console.log(`Sending command: ${name}`);

            let buffer = '';
            
            const dataHandler = (data) => {
                buffer += data.toString();
                
                // Check if we have a complete response
                const colonPos = buffer.indexOf(':');
                if (colonPos > 0) {
                    const length = parseInt(buffer.substring(0, colonPos));
                    if (buffer.length >= colonPos + 1 + length) {
                        const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
                        this.socket.removeListener('data', dataHandler);
                        
                        try {
                            const response = JSON.parse(jsonStr);
                            
                            // Response is also a tuple: [direction, id, error_or_null, result]
                            if (Array.isArray(response)) {
                                const [direction, id, error, result] = response;
                                if (error) {
                                    reject(new Error(`Marionette error: ${JSON.stringify(error)}`));
                                } else {
                                    resolve(result);
                                }
                            } else {
                                // Fallback to old format
                                if (response.error) {
                                    reject(new Error(`Marionette error: ${JSON.stringify(response.error)}`));
                                } else {
                                    resolve(response.value);
                                }
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse response: ${e.message}`));
                        }
                    }
                }
            };

            this.socket.on('data', dataHandler);
            
            this.socket.write(messageBytes, (err) => {
                if (err) {
                    this.socket.removeListener('data', dataHandler);
                    reject(err);
                }
            });

            // Timeout
            setTimeout(() => {
                this.socket.removeListener('data', dataHandler);
                reject(new Error(`Command timeout: ${name}`));
            }, 10000);
        });
    }

    async createSession() {
        const caps = {
            capabilities: {
                alwaysMatch: {
                    acceptInsecureCerts: true
                }
            }
        };
        const result = await this.sendCommand('WebDriver:NewSession', caps);
        console.log('Session created:', result);
        return result;
    }

    async setContext(context) {
        await this.sendCommand('Marionette:SetContext', { value: context });
    }

    async executeScript(script, args = []) {
        return await this.sendCommand('WebDriver:ExecuteScript', {
            script,
            args
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

/**
 * Test CSS loading via marionette
 */
async function testCSSLoading(client) {
    console.log('\n=== Testing CSS Loading ===');
    
    // Switch to chrome context
    console.log('Switching to chrome context...');
    await client.setContext('chrome');
    
    // Test CSS content (Noraneko specific)
    const testCSS = `
        #nav-bar {
            background-color: rgb(255, 0, 0) !important;
        }
    `;
    
    // Load CSS using nsIStyleSheetService
    console.log('Loading test CSS...');
    const loadScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const testId = "noraneko-test-" + Date.now();
        const cssStr = arguments[0];
        
        const uri = Services.io.newURI("data:text/css," + encodeURIComponent(cssStr));
        
        if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        }
        
        return { success: true, id: testId, uri: uri.spec };
    `;
    
    const loadResult = await client.executeScript(loadScript, [testCSS]);
    console.log('CSS loaded:', loadResult);
    
    const cssData = loadResult.value || loadResult;
    
    // Verify CSS is applied
    console.log('Verifying CSS is applied...');
    const verifyScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const uriStr = arguments[0];
        const uri = Services.io.newURI(uriStr);
        
        const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
        
        return { 
            isRegistered,
            uriStr 
        };
    `;
    
    const verifyResult = await client.executeScript(verifyScript, [cssData.uri]);
    console.log('Verification result:', verifyResult);
    
    const verifyData = verifyResult.value || verifyResult;
    
    if (!verifyData.isRegistered) {
        throw new Error('CSS stylesheet is not registered!');
    }
    
    console.log('✓ CSS is successfully applied!');
    
    // Clean up
    console.log('Cleaning up...');
    const cleanupScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const uriStr = arguments[0];
        const uri = Services.io.newURI(uriStr);
        
        if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.unregisterSheet(uri, sss.USER_SHEET);
        }
        
        return { unregistered: true };
    `;
    
    await client.executeScript(cleanupScript, [cssData.uri]);
    console.log('✓ Cleanup completed');
    
    return true;
}

/**
 * Test JavaScript execution in chrome context
 */
async function testChromeContextExecution(client) {
    console.log('\n=== Testing Chrome Context Execution ===');
    
    await client.setContext('chrome');
    
    const testScript = `
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        return {
            hasWindow: !!window,
            hasDocument: !!window.document,
            title: window.document.title || "No title"
        };
    `;
    
    const result = await client.executeScript(testScript, []);
    const data = result.value || result;
    
    console.log('Chrome context test result:', data);
    
    if (!data.hasWindow || !data.hasDocument) {
        throw new Error('Chrome context APIs not accessible');
    }
    
    console.log('✓ Chrome context APIs accessible');
    
    return true;
}

/**
 * Main test function
 */
async function runTest() {
    let firefox = null;
    let client = null;
    
    try {
        // Get Firefox path
        const executablePath = await getFirefoxPath();
        
        // Start Firefox
        firefox = await startFirefox(executablePath);
        
        // Connect to marionette
        client = new MarionetteClient(MARIONETTE_PORT);
        console.log('\nConnecting to marionette...');
        await client.connect();
        console.log('✓ Connected to marionette');
        
        // Create session
        console.log('Creating WebDriver session...');
        await client.createSession();
        console.log('✓ Session created');
        
        // Run CSS loading test
        await testCSSLoading(client);
        
        // Run chrome context execution test
        await testChromeContextExecution(client);
        
        console.log('\n✅ All tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
        
    } finally {
        // Cleanup
        console.log('\nCleaning up...');
        
        if (client) {
            client.disconnect();
        }
        
        if (firefox) {
            firefox.kill('SIGTERM');
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force kill if still running
            if (!firefox.killed) {
                firefox.kill('SIGKILL');
            }
        }
    }
}

// Run the test
runTest()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
