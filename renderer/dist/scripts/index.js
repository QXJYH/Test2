"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// services/game-server/src/scripts/index.ts
const fs = require("fs");
const path = require("path");
// Debugging setup
const DEBUG = true;
function debugLog(...args) {
    if (DEBUG)
        console.log('[ScriptLoader]', ...args);
}
function getScripts() {
    try {
        // 1. Determine the correct base path
        const baseDir = path.join(__dirname, '..', 'scripts', 'asset');
        debugLog('Base scripts directory:', baseDir);
        debugLog('Current __dirname:', __dirname);
        // 2. Verify directory exists
        if (!fs.existsSync(baseDir)) {
            throw new Error(`Scripts directory not found at: ${baseDir}`);
        }
        debugLog('Directory exists:', true);
        // 3. List all available files
        const files = fs.readdirSync(baseDir);
        debugLog('Files in directory:', files);
        // 4. Script mapping with validation
        const scriptMap = {
            assetThumbnail: 'asset.lua',
            gameThumbnail: 'game.lua',
            headThumbnail: 'head.lua',
            imageTexture: 'image.lua',
            meshThumbnail: 'mesh.lua',
            playerHeadshot: 'player-head.lua',
            playerThumbnail: 'player.lua'
        };
        const loadedScripts = {};
        // 5. Load each script with validation
        for (const [key, filename] of Object.entries(scriptMap)) {
            const filePath = path.join(baseDir, filename);
            debugLog(`Loading ${key} from:`, filePath);
            if (!fs.existsSync(filePath)) {
                debugLog(`File not found: ${filename}`);
                continue;
            }
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                if (!content.trim()) {
                    debugLog(`File is empty: ${filename}`);
                    continue;
                }
                loadedScripts[key] = content;
                debugLog(`Successfully loaded: ${filename} (${content.length} chars)`);
            }
            catch (error) {
                debugLog(`Error loading ${filename}:`, error);
            }
        }
        // 6. Validate essential scripts
        const requiredScripts = ['headThumbnail', 'assetThumbnail'];
        for (const script of requiredScripts) {
            if (!loadedScripts[script]) {
                throw new Error(`Required script missing: ${script}`);
            }
        }
        debugLog('Successfully loaded scripts:', Object.keys(loadedScripts));
        return loadedScripts;
    }
    catch (error) {
        console.error('CRITICAL ERROR LOADING SCRIPTS:');
        console.error(error);
        throw new Error(`Script loading failed: ${error.message}`);
    }
}
exports.default = getScripts;
// Immediate debug check when imported
if (DEBUG) {
    debugLog('Script loader initialized');
    try {
        const scripts = getScripts();
        debugLog('Initial load successful. Scripts available:', Object.keys(scripts));
    }
    catch (error) {
        debugLog('Initial load failed:', error);
    }
}
//# sourceMappingURL=index.js.map