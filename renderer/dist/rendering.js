"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResult = exports.awaitResult = exports.getUploadCallbacks = exports.doesCallbackExist = exports.resolutionMultiplier = void 0;
const sharp = require("sharp");
// Poor man's anti-aliasing
exports.resolutionMultiplier = {
    game: 4,
    asset: 1,
    userThumbnail: 2,
    userHeadshot: 2,
};
let uploadCallbacks = {};
const doesCallbackExist = (id) => {
    return uploadCallbacks[id] !== undefined;
};
exports.doesCallbackExist = doesCallbackExist;
const getUploadCallbacks = () => uploadCallbacks;
exports.getUploadCallbacks = getUploadCallbacks;
const awaitResult = (key) => {
    return new Promise((res, rej) => {
        let cb = () => __awaiter(void 0, void 0, void 0, function* () {
            clearTimeout(interval);
            res();
        });
        let interval = setTimeout(() => {
            rej('Timeout');
            if (!uploadCallbacks[key])
                return;
            uploadCallbacks[key] = uploadCallbacks[key].filter(v => v !== cb);
            delete uploadCallbacks[key];
        }, 2 * 60 * 1000);
        if (!uploadCallbacks[key]) {
            uploadCallbacks[key] = [];
        }
        uploadCallbacks[key].push(cb);
    });
};
exports.awaitResult = awaitResult;
let shutdownTimer;
const getResult = (key, upscaleAmount) => {
    return new Promise((res, rej) => {
        let interval = setTimeout(() => {
            rej('Timeout');
            delete uploadCallbacks[key];
        }, 2 * 60 * 1000);
        if (!uploadCallbacks[key]) {
            uploadCallbacks[key] = [];
        }
        uploadCallbacks[key].push((data) => __awaiter(void 0, void 0, void 0, function* () {
            clearTimeout(interval);
            if (typeof data.thumbnail === 'string') {
                if (!shutdownTimer) {
                    console.log('[info] creating shutdown timer');
                    shutdownTimer = setTimeout(() => {
                        process.exit(0);
                    }, 24 * 60 * 60 * 1000);
                }
                let originalImage = yield sharp(Buffer.from(data.thumbnail, 'base64')).metadata();
                if (typeof originalImage.width !== 'number' || typeof originalImage.height !== 'number') {
                    throw new Error('Bad image metadata: ' + JSON.stringify(originalImage));
                }
                let image = yield sharp(Buffer.from(data.thumbnail, 'base64')).resize(Math.trunc(originalImage.width / upscaleAmount), Math.trunc(originalImage.height / upscaleAmount))
                    .png({
                    compressionLevel: 9,
                    quality: 99,
                    effort: 10,
                })
                    .toBuffer();
                data.thumbnail = image.toString('base64');
            }
            res(data);
        }));
    });
};
exports.getResult = getResult;
//# sourceMappingURL=rendering.js.map