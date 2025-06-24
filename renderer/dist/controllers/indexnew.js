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
// TODO: This is garbage. RCC managment, image resize/compression, and everything else should be split into their own files
const Exceptions_1 = require("../helpers/Exceptions");
const fs = require("fs");
const path = require("path");
const util = require("util");
const cp = require("child_process");
const sleep = util.promisify(setTimeout);
const os = require("os");
const Config_1 = require("../helpers/Config");
const sharp = require("sharp");
const uuid = require("uuid");
const http = require("http");
let myIp = 'UNKNOWN';
const dockerEnabled = !Config_1.default.dockerDisabled;
console.log('[info] dockerEnabled:', dockerEnabled);
const rccPort = Config_1.default.rccPort || 63914; // default: 64989
const textureThumbnailPort = 54989; // Specific port for texture thumbnails
const isPortAvailable = (port) => {
    return new Promise((res, rej) => {
        let didAnything = false;
        let timer = setTimeout(() => {
            if (didAnything)
                return;
            console.log('[info] isPortAvailable timeout for', port);
            res(false);
            try {
                server.close();
            }
            catch (e) { }
            // @ts-ignore
            timer = undefined;
        }, 5 * 1000);
        const server = http.createServer();
        server.on('error', () => {
            if (didAnything)
                return;
            if (timer) {
                clearTimeout(timer);
            }
            didAnything = true;
            res(false);
        });
        server.on('listening', () => {
            server.close();
            if (didAnything)
                return;
            console.log('[info] isPortAvailable', port);
            if (timer) {
                clearTimeout(timer);
            }
            didAnything = true;
            sleep(1000).then(() => {
                res(true);
            });
        });
        server.listen(port);
    });
};
const getFreeRccPort = () => __awaiter(void 0, void 0, void 0, function* () {
    for (let i = 64989; i < 64990; i++) {
        let avail = yield isPortAvailable(i);
        console.log('[info] port available?', i, avail);
        if (avail) {
            return i;
        }
    }
    throw new Error('No ports available');
});
const scripts_1 = require("../scripts");
const scripts = (0, scripts_1.default)();
const axios_1 = require("axios");
const rendering_1 = require("../rendering");
const axiosClient = axios_1.default.create({
    headers: {
        'user-agent': 'GameServer/1.0',
    }
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    let result = yield axiosClient.get('http://ipv4.icanhazip.com');
    myIp = result.data;
    console.log('[info] server ip:', myIp);
}))().catch(e => {
    console.error('[error] could not fetch ip:', e);
});
const maxRendersBeforeRestart = 100;
const maxJobQueueRunningCount = (() => {
    if (!dockerEnabled)
        return Math.max(1, Math.trunc(os.cpus().length / 2));
    return Math.max(1, Math.trunc(os.cpus().length / 2));
})();
console.log('[info] system thread count', maxJobQueueRunningCount);
const truncateForDiscordMessage = (msg) => {
    msg = msg.replace(/\*/g, '\\*').replace(/\_/g, '\\_').replace(/\~/g, '\\~').replace(/\`/g, '\\`');
    const maxLen = 500;
    if (msg.length < maxLen)
        return msg;
    return msg.substring(msg.length - maxLen) + '...';
};
/**
 * Handle incoming WS commands
 */
class CommandHandler extends Exceptions_1.default {
    constructor() {
        super();
        this.executorStatus = {
            games: [],
        };
        this.reservedPorts = [];
        this.JobQueue = [];
        this.RunningJobIds = [];
        this.JobQueueRunningCount = 0;
        this.RenderRcc = [];
        this.bgBuffer = undefined;
        this.onStartup();
    }
    randomId() {
        // use UUID for consistency
        return uuid.v4();
        // return require('crypto').randomBytes(32).toString('hex');
    }
    onStartup() {
        const rccStopPath = path.join(__dirname, '../../stop-all-rcc.sh');
        // On startup, we need to kill any running RCC instances - they're probably leftover from a server crash or something.
        try {
            let stopRequest = cp.spawnSync('/usr/bin/sudo', [
                rccStopPath
            ]);
            console.log('[info] result for stopping rcc', stopRequest.stdout.toString(), stopRequest.status, stopRequest.stderr.toString());
        }
        catch (e) {
            console.log('[error] error in OnStartup - could not shut down existing RCC instances (probably not fatal):', e);
        }
    }
    startRcc(game) {
        return __awaiter(this, void 0, void 0, function* () {
            // isRccReady call is to check if a dev is already running rcc e.g. for debugging.
            if (game.rccReference || (yield this.isRccReady(rccPort))) {
                console.log('[info] rcc already running');
                if (!game.rccReference) {
                    game.rccReference = {
                        close: () => { },
                        port: rccPort,
                        id: this.randomId(),
                    };
                }
                return;
            }
            console.log('[info] looking for port...');
            // res port timeout = 1m
            let start = Date.now();
            let portToRunOn = yield getFreeRccPort();
            let lastRecPort = portToRunOn;
            while (this.reservedPorts.includes(portToRunOn)) {
                console.log('[info] port is already in use', portToRunOn);
                yield sleep(1000);
                portToRunOn = yield getFreeRccPort();
                let cur = Date.now();
                // reset timer if getFreeRccPort returns a new port
                if (lastRecPort !== portToRunOn) {
                    start = Date.now();
                    lastRecPort = portToRunOn;
                }
                let diff = cur - start;
                if (diff > 60 * 1000) {
                    console.log('[info] port has been reserved for over 1m despite being available, will use it');
                    break;
                }
            }
            this.reservedPorts.push(portToRunOn);
            console.log('[info] found port for rcc!', portToRunOn);
            let rcc;
            const dockerPidFileLocation = path.join(__dirname, '../../rcccid-' + portToRunOn);
            let rccCid;
            if (!dockerEnabled) {
                const rccPath = 'C:\\Users\\Admin\\Desktop\\Revival\\ecsr\\ecsrev-main\\services\\RCCService\\';
                const rccExecutable = path.join(rccPath, 'RCCService.exe');
                rcc = cp.spawn(rccExecutable, ['-Console', '-Verbose', '-port 64989'], {
                    cwd: rccPath,
                    stdio: 'pipe',
                });
            }
            else {
                try {
                    fs.unlinkSync(dockerPidFileLocation);
                }
                catch (e) { }
                rcc = cp.spawn('/usr/bin/sudo', [path.join(__dirname, '../../start-rcc.sh'), portToRunOn.toString()]);
            }
            game.rccClosed = false;
            rcc.on('message', (msg) => {
                console.log(msg);
            });
            rcc.stdout.on('data', function (data) {
                game.stdout += data.toString();
                if (!game.stdout.endsWith('\n')) {
                    game.stdout += '\n';
                }
                console.log('stdout: ' + data.toString());
            });
            rcc.stderr.on('data', function (data) {
                game.stderr += data.toString();
                if (!game.stderr.endsWith('\n')) {
                    game.stderr += '\n';
                }
                console.log('stderr: ' + data.toString());
            });
            rcc.stdout.resume();
            rcc.stderr.resume();
            rcc.on('exit', (code) => {
                this.reservedPorts = this.reservedPorts.filter(v => v !== portToRunOn);
                console.log('[info] rcc child process exited with code ', code);
                if (code !== 0 && code !== null) {
                    const lastedMilliseconds = ((Date.now() - game.createdAt) / 1000).toFixed(2);
                    const msg = `**RCC exited with code ${code}**\nSTDOUT=${truncateForDiscordMessage(game.stdout)}\nSTDERR=${truncateForDiscordMessage(game.stderr)}\nplaceId=${game.placeId}\nserverId=${game.serverId}\ndurationSeconds=${lastedMilliseconds}\nip=${myIp}`;
                }
                setTimeout(() => {
                    if (!game.rccClosed) {
                        this.executorStatus.games.forEach(v => {
                            if (v.rccReference && game.rccReference && v.rccReference.id === game.rccReference.id) {
                                // Kill any running game servers
                                this.closeGame(v.serverId);
                            }
                        });
                        game.rccClosed = true;
                    }
                }, 1000);
            });
            game.rccReference = {
                id: this.randomId(),
                port: portToRunOn,
                close: () => {
                    try {
                        rcc.kill('SIGINT');
                        game.rccReference = null;
                    }
                    catch (e) { }
                    if (dockerEnabled) {
                        // ID is passed to docker, do regex to prevent arbitrary command execution
                        let match = fs.readFileSync(dockerPidFileLocation).toString('utf-8').trim().match(/[a-z0-9]+/g);
                        if (!match) {
                            console.error('[warning] rcc id does not exist, container will not be deleted');
                            return;
                        }
                        rccCid = match[0];
                        console.log('[info] rcc running on docker container:', rccCid);
                        if (rccCid) {
                            try {
                                const rccStopPath = path.join(__dirname, '../../stop-rcc.sh');
                                console.log('trying to kill rcc...', rccStopPath, rccCid);
                                // cp.execSync('docker kill ' + rccCid);
                                let proc = cp.spawn('/usr/bin/sudo', [
                                    rccStopPath,
                                    rccCid,
                                ], {
                                    stdio: 'inherit',
                                });
                                proc.on('exit', (c) => {
                                    console.log('rcc killed with exit code', c);
                                });
                                console.log('rcc killed');
                            }
                            catch (e) {
                                console.error('[error] could not kill rcc container', e);
                            }
                        }
                    }
                }
            };
            console.log('[info] waiting for rcc...');
            try {
                yield this.waitForRcc(game, portToRunOn);
            }
            catch (e) {
                if (game.rccReference) {
                    game.rccReference.close();
                }
                game.rccReference = null;
                throw e;
            }
            console.log('[info] RCC ok');
        });
    }
    isRccReady(port) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield axiosClient.request({
                    method: 'GET',
                    url: 'http://127.0.0.1:' + port + '/',
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    },
                    validateStatus: () => true,
                    timeout: 1000,
                });
                yield sleep(1500); // rcc requires a second before it actually replies to commands, even if it responds to our ping
                return true;
            }
            catch (e) {
                return false;
            }
        });
    }
    waitForRcc(game, port) {
        return __awaiter(this, void 0, void 0, function* () {
            let start = Date.now();
            do {
                let elapsedSeconds = (Date.now() - start) / 1000;
                if (elapsedSeconds > 10) {
                    throw new Error('Waited over 10 seconds for rcc, give up');
                }
                if (game.rccClosed) {
                    throw new Error('RCC was closed');
                }
                try {
                    const result = yield axiosClient.request({
                        method: 'GET',
                        url: '127.0.0.1' + port + '/',
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                        },
                        validateStatus: () => true,
                        timeout: 1000,
                    });
                    yield sleep(1500);
                    console.log('[info] rcc ok');
                    return;
                }
                catch (e) {
                    console.log('[info] rcc not ok', e.message);
                    yield sleep(250);
                }
            } while (true);
        });
    }
    runJob(game, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!game.rccReference) {
                throw new Error('RCC is not configured');
            }
            // send request
            const result = yield axiosClient.request({
                method: 'POST',
                url: 'http://127.0.0.1:' + game.rccReference.port + '/',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                },
                data: job.request,
                timeout: 2 * 60 * 1000,
            });
            // wait until over
            // await getResult(job.jobId);
            console.log('[info] got rcc job', job.jobId);
        });
    }
    /**
     * Get the status of the web server
     */
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                status: 'OK',
            };
        });
    }
    createSoapRequest(script, jobId) {
        const scriptToSend = script
            .replace(/InsertJobIdHere/g, jobId);
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <OpenJobEx xmlns="http://roblox.com/">
        <job>
            <id>${jobId}</id>
            <category>0</category>
            <cores>1</cores>
            <expirationInSeconds>43200</expirationInSeconds>
        </job>
        <script>
            <name>GameStart</name>
            <script>
			<![CDATA[
			${scriptToSend}
			]]>
			</script>
        </script>
    </OpenJobEx>
  </soap:Body>
</soap:Envelope>`;
        return {
            request: xml,
            jobId,
            createdAt: Date.now(),
        };
    }
    createShutdownRequest(jobId) {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CloseJob xmlns="http://roblox.com/" jobID="${jobId}">
		<jobID>${jobId}</jobID>
        <job>
            <id>${jobId}</id>
        </job>
    </CloseJob>
  </soap:Body>
</soap:Envelope>`;
        return {
            request: xml,
            jobId,
        };
    }
    openJob(game, timeout, port, jobRequest) {
        if (!game.rccReference) {
            throw new Error('RCC is not configured');
        }
        let didTimeout = false;
        return new Promise((res, rej) => {
            const timeoutTimer = setTimeout(() => {
                didTimeout = true;
                rej(new Error('Request timeout'));
            }, timeout);
            axiosClient.request({
                method: 'POST',
                url: 'http://127.0.0.1:' + port + '/',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                },
                data: jobRequest.request,
                timeout: timeout,
            }).then(result => {
                if (didTimeout)
                    return;
                clearTimeout(timeoutTimer);
                // todo: parse response, then check for lua error?
                console.log('RPC Result:', result.data);
                res();
            }).catch(e => {
                if (didTimeout)
                    return;
                clearTimeout(timeoutTimer);
                rej(e);
            });
        });
    }
    getStatus() {
        const status = this.executorStatus.games.map(v => {
            return {
                id: v.serverId,
                placeId: v.placeId,
                playerCount: v.players.length,
                port: v.port,
                isFull: v.players.length >= v.maxPlayerCount,
            };
        });
        console.log('[info] GS status:', status);
        return {
            data: status,
        };
    }
    createGameScript(placeId, gameId, port) {
        // todo: we still need to edit other vars in gameserver.lua
        return scripts.gameServer
            .replace(/local port = 123/g, `local port = ${port}`)
            .replace(/local placeId = 123/g, `local placeId = ${placeId}`);
    }
    startGame(placeId, id, port) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.executorStatus.games.length >= 5) {
                throw new Error('Already running max games');
            }
            console.log('[info] startGame called with', placeId, id, port);
            try {
                const game = {
                    rccClosed: false,
                    rccReference: null,
                    createdAt: Date.now(),
                    runningGames: 0,
                    renderCount: 0,
                    maxPlayerCount: 10,
                    placeId: placeId,
                    players: [],
                    serverId: id,
                    port: port,
                    stdout: '',
                    stderr: '',
                    exitCode: '',
                    interval: {
                        onEnd: () => {
                            console.log('[info] server died or timed out');
                            this.closeGame(id);
                        },
                        latest: setInterval(() => {
                            this.isServerAlive(id).then(isAlive => {
                                if (isAlive) {
                                    console.log('[info] server OK');
                                }
                                else {
                                    console.log('[info] server is not alive, killing it...');
                                    const game = this.executorStatus.games.find(v => v.serverId === id);
                                    if (game && game.interval) {
                                        game.interval.onEnd();
                                    }
                                }
                            });
                        }, 30 * 1000),
                    },
                };
                this.executorStatus.games.push(game);
                yield this.startRcc(game);
                const req = this.createSoapRequest(this.createGameScript(placeId, id, port), id);
                if (!game.rccReference) {
                    throw new Error('No RCC Reference after calling startRcc');
                }
                console.log('open job...');
                yield this.openJob(game, 30 * 1000, game.rccReference.port, req);
                console.log('job opened');
                // wait a second before saying we're OK - rcc takes a second to open the network
                yield sleep(1500);
            }
            catch (e) {
                yield this.closeGame(id);
                throw e;
            }
            return {};
        });
    }
    closeGame(serverId) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let game = this.executorStatus.games.find(v => v.serverId === serverId);
            if (!game)
                return;
            if (game.players.length > 0) {
                // todo: iterate over players and inform web that these people left the game?
            }
            if (!game.serverId)
                return;
            try {
                clearInterval(game.interval.latest);
            }
            catch (e) {
                console.error(e);
            }
            try {
                yield axiosClient.post(Config_1.default.baseUrl + '/gs/delete', {
                    serverId: game.serverId,
                    authorization: Config_1.default.authorization,
                });
            }
            catch (e) {
                console.error('[error] could not close server (double)', e.message, (_a = e.response) === null || _a === void 0 ? void 0 : _a.data);
            }
            try {
                if (game.rccReference) {
                    yield this.openJob(game, 10 * 1000, game.rccReference.port, this.createShutdownRequest(serverId));
                }
            }
            catch (e) {
                console.error('[error] could not request rcc to shut down. will ignore.', e.response, e.message);
            }
            // Remove our game entry
            this.executorStatus.games = this.executorStatus.games.filter(v => v.serverId !== serverId);
            console.log('[info] successfully shut down', serverId, 'there are now', this.executorStatus.games.length, 'game instances running');
            // Check for anyone else using our RCC instance.
            // Currently this is useless - we have it setup as one RCC for each game, but this is done to make it easier
            // to expand to multiple games per rcc in the future.
            const gamesRunningOnThisRcc = this.executorStatus.games.filter(v => {
                if (v.rccReference && game && game.rccReference && v.rccReference.id === game.rccReference.id) {
                    return true;
                }
                return false;
            });
            if (gamesRunningOnThisRcc.length === 0 && game.rccReference) {
                // RIP Rcc :(
                console.log('[info] There are no game servers left. RCC is being shut down.');
                game.rccReference.close();
            }
        });
    }
    isServerAlive(serverId) {
        return __awaiter(this, void 0, void 0, function* () {
            let status = this.executorStatus.games.find(v => v.serverId === serverId);
            if (!status) {
                return false;
            }
            try {
                const resp = yield axiosClient.post(Config_1.default.baseUrl + '/gs/activity', {
                    serverId: status.serverId,
                    authorization: Config_1.default.authorization,
                });
                return resp.data.isAlive;
            }
            catch (e) {
                // rip
                console.error('[error] could not get gs activity for serverId', status.serverId, e);
                return false;
            }
        });
    }
    shutdown(serverId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[info] call shutdown for', serverId);
            yield this.closeGame(serverId);
            return {};
        });
    }
    addToQueue(item) {
        this.JobQueue.push(item);
        console.log('[info] addToQueue. queue length =', this.JobQueue.length, 'rcc runner count =', this.JobQueueRunningCount, 'rcc instance count =', this.RenderRcc.length);
        if (this.JobQueueRunningCount < maxJobQueueRunningCount) {
            console.log('[info] start job queue because it is not running');
            this.runJobQueue();
        }
    }
    GetRccForRender() {
        return __awaiter(this, void 0, void 0, function* () {
            let applicable = this.RenderRcc.filter(v => !v.rccClosed && v.rccReference).sort((a, b) => {
                return a.runningGames > b.runningGames ? 1 : a.runningGames === b.runningGames ? (a.renderCount > b.renderCount ? 1 : a.renderCount === b.renderCount ? 0 : -1) : -1;
            });
            if (applicable && applicable.length) {
                let i = 0;
                for (const rcc of applicable) {
                    console.log('[info] picked RCC instance data: running =', rcc.runningGames, 'renders =', rcc.renderCount, 'created =', rcc.createdAt, 'idx =', i);
                    i++;
                    if (rcc.renderCount >= maxRendersBeforeRestart) {
                        console.log('[info] RCC picked has too many renders, requesting a shutdown', rcc.renderCount, 'vs', maxRendersBeforeRestart);
                        yield this.requestRccThumbnailerClose(rcc);
                    }
                    else {
                        return rcc;
                    }
                }
            }
            console.log('[info] no applicable RCC instances for render, will create one');
            const id = this.randomId();
            const port = 0;
            // ugly hack to use a fake game to start rcc :(
            // rcc should be startable WITHOUT a game...
            const game = {
                rccClosed: false,
                rccReference: null,
                createdAt: Date.now(),
                runningGames: 0,
                renderCount: 0,
                maxPlayerCount: 0,
                placeId: 0,
                players: [],
                serverId: id,
                port: port,
                stdout: '',
                stderr: '',
                exitCode: '',
                interval: {
                    onEnd: () => {
                        console.log('[info] server died or timed out (render)');
                        this.closeGame(id);
                    },
                    latest: setInterval(() => {
                    }, 30 * 1000),
                },
            };
            let start = Date.now();
            yield this.startRcc(game);
            if (!game.rccReference) {
                console.error('undefined RCC reference');
                process.exit(1);
            }
            this.RenderRcc.push(game);
            console.log('[info] started a new RCC instance for renders. time =', (Date.now() - start), 'ms');
            return game;
        });
    }
    removeFromRunningJobs(jobId) {
        this.RunningJobIds = this.RunningJobIds.filter(v => v !== jobId);
    }
    runJobQueueTask(rcc, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!rcc || !rcc.rccReference) {
                // fatal error
                console.error('fatal', 'RCC reference is not available - it was probably closed', new Error().stack);
                process.exit(1);
            }
            // send request
            const result = yield axiosClient.request({
                method: 'POST',
                url: 'http://127.0.0.1:' + rcc.rccReference.port + '/',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                },
                data: job.request,
                timeout: 2 * 60 * 1000,
            });
            // wait until over
            yield (0, rendering_1.awaitResult)(job.jobId);
        });
    }
    requestRccThumbnailerClose(rcc) {
        return __awaiter(this, void 0, void 0, function* () {
            if (rcc.rccReference && !rcc.rccClosed) {
                rcc.rccReference.close();
            }
            // remove dead rcc after killing it
            this.RenderRcc = this.RenderRcc.filter(v => v !== rcc);
        });
    }
    runJobQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            this.JobQueueRunningCount++;
            try {
                while (true) {
                    // get our job
                    let item = this.JobQueue[0];
                    if (!item) {
                        console.log('[info] runJobQueue empty, no more jobs left');
                        return;
                    }
                    // remove from queue, add to running queue
                    if (this.RunningJobIds.includes(item.jobId)) {
                        console.log('[info] this job is already running. will skip. id =', item.jobId);
                        continue;
                    }
                    this.JobQueue = this.JobQueue.filter(v => v.jobId !== item.jobId);
                    this.RunningJobIds.push(item.jobId);
                    let rcc = yield this.GetRccForRender();
                    let msSinceCreation = Date.now() - item.createdAt;
                    // because we are an async function, we should be able to guarantee that doesCallbackExist will only ever return false if 2 minutes has passed, not if the callback was never created in the first place.
                    if (!(0, rendering_1.doesCallbackExist)(item.jobId)) {
                        if (msSinceCreation >= 60 * 1000) {
                            console.log('[warn] skipping job', item.jobId, 'because a callback for it does not exist and it was created over 1m ago');
                            this.RunningJobIds = this.RunningJobIds.filter(v => v !== item.jobId);
                            continue;
                        }
                        else {
                            console.log('[info] doesCallbackExist returned false, but job was created', msSinceCreation, 'ms ago, so run it anyway');
                        }
                    }
                    console.log('[info] [jq] run', item.jobId);
                    rcc.runningGames++;
                    try {
                        // start the task
                        yield this.runJobQueueTask(rcc, item);
                        rcc.renderCount++;
                    }
                    catch (e) {
                        // timeout error or rcc is not responding to our calls, so it must be killed
                        if (e && e.isAxiosError && !e.response) {
                            yield this.requestRccThumbnailerClose(rcc);
                        }
                        // runJobQueueTask removes us from job queue, so re-add and try again.
                        // if the jobId is removed from RunningJobIds, it means that either the
                        // render was cancelled or the render was finished before erroring.
                        if (this.RunningJobIds.includes(item.jobId)) {
                            this.JobQueue = [item, ...this.JobQueue];
                            this.RunningJobIds = this.RunningJobIds.filter(v => v !== item.jobId);
                        }
                        console.error('[error] [jq]', item.jobId, e);
                    }
                    finally {
                        rcc.runningGames--;
                    }
                    console.log('[info] [jq] task', item.jobId, 'finished');
                }
            }
            catch (e) {
                throw e;
            }
            finally {
                this.JobQueueRunningCount--;
            }
        });
    }
    Cancel(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.JobQueue.find(v => v.jobId === jobId)) {
                this.JobQueue = this.JobQueue.filter(v => v.jobId !== jobId);
            }
            else {
                // Already ran or currently running?
                this.removeFromRunningJobs(jobId);
            }
            return null;
        });
    }
    GenerateThumbnailAsset(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const job = this.createSoapRequest(scripts.assetThumbnail
                .replace(/\{1234\}/g, `{${assetId}}`)
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString()), uuid.v4());
            this.addToQueue(job);
            return (yield (0, rendering_1.getResult)(job.jobId, rendering_1.resolutionMultiplier.asset)).thumbnail;
        });
    }
    GetTeeShirtThumb(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            // https://example.com
            const result = yield axiosClient.get(`${Config_1.default.baseUrl}/asset/?id=${assetId}`, {
                responseType: 'arraybuffer',
                headers: {
                    // bot-auth is used to bypass moderation status and encryption
                    'bot-auth': Config_1.default.websiteBotAuth,
                }
            });
            return Buffer.from(result.data, 'binary');
        });
    }
    GenerateThumbnailTeeShirt(assetId, contentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bgBuffer) {
                this.bgBuffer = fs.readFileSync(path.join(__dirname, '../../TeeShirtTemplate.png'));
                console.log('[info] read teeShirtBgBuffer into memory. size =', this.bgBuffer.length, 'bytes');
            }
            const bg = yield sharp(this.bgBuffer);
            const content = yield this.GetTeeShirtThumb(contentId);
            const image = yield sharp(content).resize(250, 250, {
                fit: 'contain',
            }).png().toBuffer();
            bg.composite([
                {
                    top: 85,
                    left: 85,
                    input: image,
                }
            ]);
            const buff = yield bg.png().toBuffer();
            return buff.toString('base64');
        });
    }
    GenerateThumbnailMesh(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const job = this.createSoapRequest(scripts.meshThumbnail
                .replace(/\{1234\}/g, `{${assetId}}`)
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString()), uuid.v4());
            this.addToQueue(job);
            return (yield (0, rendering_1.getResult)(job.jobId, rendering_1.resolutionMultiplier.asset)).thumbnail;
        });
    }
    GenerateThumbnailHead(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const job = this.createSoapRequest(scripts.headThumbnail
                .replace(/\{1234\}/g, `{${assetId}}`)
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString()), uuid.v4());
            this.addToQueue(job);
            return (yield (0, rendering_1.getResult)(job.jobId, rendering_1.resolutionMultiplier.asset)).thumbnail;
        });
    }
    GenerateThumbnailGame(assetId, x = 640, y = 360) {
        return __awaiter(this, void 0, void 0, function* () {
            const job = this.createSoapRequest(scripts.gameThumbnail
                .replace(/\{1234\}/g, `{${assetId}}`)
                .replace(/_X_RES_/g, (x * rendering_1.resolutionMultiplier.game).toString())
                .replace(/_Y_RES_/g, (y * rendering_1.resolutionMultiplier.game).toString()), uuid.v4());
            this.addToQueue(job);
            return (yield (0, rendering_1.getResult)(job.jobId, rendering_1.resolutionMultiplier.game)).thumbnail;
        });
    }
    /**
     * Generate a thumbnail for a texture (such as a Decal or Texture)
     * @param assetId
     * @returns
     */
    GenerateThumbnailTexture(assetId, assetTypeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = this.randomId();
            const job = this.createSoapRequest(scripts.imageTexture
                .replace(/65789275746246/g, assetId.toString())
                .replace(/358843/g, assetTypeId.toString())
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.asset).toString()), id);
            // Create a dedicated RCC instance for this texture thumbnail
            const game = {
                rccClosed: false,
                rccReference: null,
                createdAt: Date.now(),
                runningGames: 0,
                renderCount: 0,
                maxPlayerCount: 0,
                placeId: 0,
                players: [],
                serverId: id,
                port: textureThumbnailPort,
                stdout: '',
                stderr: '',
                exitCode: '',
                interval: {
                    onEnd: () => {
                        console.log('[info] texture thumbnail RCC died or timed out');
                        this.closeGame(id);
                    },
                    latest: setInterval(() => { }, 30 * 1000),
                },
            };
            try {
                // Start RCC
                yield this.startRcc(game);
                if (!game.rccReference) {
                    throw new Error('Failed to create RCC instance');
                }
                // Run the job directly (bypassing queue)
                yield this.openJob(game, 30 * 1000, game.rccReference.port, job);
                // Wait for result
                const result = yield (0, rendering_1.getResult)(job.jobId, rendering_1.resolutionMultiplier.asset);
                return result.thumbnail;
            }
            finally {
                // Clean up RCC
                if (game.rccReference) {
                    game.rccReference.close();
                }
            }
        });
    }
    /**
     * Generate a user avatar headshot
     * @param user
     */
    GenerateThumbnailHeadshot(user) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[info] thumbnail requested`, user);
            const jobRequest = this.createSoapRequest(scripts.playerHeadshot
                // set user id
                .replace(/65789275746246/g, user.userId.toString())
                // set user avatar json
                .replace(/JSON_AVATAR/g, JSON.stringify(user).replace(`'`, `\\'`))
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.userHeadshot).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.userHeadshot).toString()), uuid.v4());
            // create the job
            this.addToQueue(jobRequest);
            // await job
            const result = yield (0, rendering_1.getResult)(jobRequest.jobId, rendering_1.resolutionMultiplier.userHeadshot);
            // return base64 value
            return result.thumbnail;
        });
    }
    /**
     * Generate a user avatar thumbnail
     * @param user
     */
    GenerateThumbnail(user) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[info] thumbnail requested`, user);
            const jobRequest = this.createSoapRequest(scripts.playerThumbnail
                // set user id
                .replace(/65789275746246/g, user.userId.toString())
                // set user avatar json
                .replace(/JSON_AVATAR/g, JSON.stringify(user).replace(`'`, `\\'`))
                .replace(/_X_RES_/g, (420 * rendering_1.resolutionMultiplier.userThumbnail).toString())
                .replace(/_Y_RES_/g, (420 * rendering_1.resolutionMultiplier.userThumbnail).toString()), uuid.v4());
            // create the job
            this.addToQueue(jobRequest);
            // await job
            const result = yield (0, rendering_1.getResult)(jobRequest.jobId, rendering_1.resolutionMultiplier.userThumbnail);
            // return base64 value
            return result.thumbnail;
        });
    }
    ConvertGeneric(mode, base64EncodedFile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (mode !== "convertgame" && mode !== "converthat")
                throw new Error("Bad mode");
            if (dockerEnabled) {
                const scriptPath = path.join(__dirname, '../../start-place-convert.sh');
                // const mode = 'convertgame';
                const dirPath = path.join(__dirname, '../../place-conversion-data');
                if (!fs.existsSync(dirPath)) {
                    yield fs.promises.mkdir(dirPath);
                }
                // remove anything leftover
                for (const file of yield fs.promises.readdir(dirPath)) {
                    fs.rmSync(dirPath + '/' + file);
                }
                // write in file
                const inLocation = path.join(dirPath, './in.rbxl');
                const outLocation = path.join(dirPath, './out.rbxl');
                yield fs.promises.writeFile(inLocation, Buffer.from(base64EncodedFile, 'base64'));
                // now exec script
                return new Promise((res, rej) => {
                    let exec = cp.spawn('/usr/bin/sudo', [scriptPath, mode], {
                        stdio: 'inherit',
                    });
                    exec.on('message', (msg) => {
                        console.log('[PlaceConvert]', msg);
                    });
                    exec.on('exit', (code) => {
                        if (code === 0) {
                            // read the output
                            fs.readFile(outLocation, (err, data) => {
                                if (err) {
                                    return rej(err);
                                }
                                // delete files
                                fs.rmSync(inLocation);
                                fs.rmSync(outLocation);
                                // return the place as a base64 string
                                res(data.toString('base64'));
                            });
                        }
                        else {
                            rej(new Error('Failed with exit code ' + code));
                        }
                    });
                });
            }
            else {
                // write to disk
                const p = path.join(__dirname, '../../tmp_place_file.rbxl');
                const out = path.join(__dirname, '../../tmp_place_file_out.rbxl');
                // delete if exists
                try {
                    fs.unlinkSync(p);
                }
                catch (e) { }
                try {
                    fs.unlinkSync(out);
                }
                catch (e) { }
                // Write the base64 place to disk for placeconverter to read...
                yield fs.promises.writeFile(p, Buffer.from(base64EncodedFile, 'base64'));
                // confusing argument order: first is output, second is input
                const cmd = `./RobloxPlaceConverter.exe ${mode === "convertgame" ? "game" : "hat"} "${out}" "${p}"`;
                return new Promise((res, rej) => {
                    cp.exec(cmd, (err) => {
                        if (err) {
                            return rej(err);
                        }
                        // read the output
                        fs.readFile(out, (err, data) => {
                            if (err) {
                                return rej(err);
                            }
                            // return the place as a base64 string
                            res(data.toString('base64'));
                        });
                    });
                });
            }
        });
    }
    ConvertRobloxPlace(placeBase64Encoded) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ConvertGeneric('convertgame', placeBase64Encoded);
        });
    }
    ConvertHat(hatBase64Encoded) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ConvertGeneric('converthat', hatBase64Encoded);
        });
    }
}
exports.default = CommandHandler;
//# sourceMappingURL=indexnew.js.map