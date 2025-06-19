"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('verilog');
    const getSlangExecutablePath = () => {
        const platform = os.platform();
        const binaryName = platform === 'win32' ? 'slang.exe' :
            platform === 'darwin' ? 'slang-mac' :
                'slang-linux';
        return context.asAbsolutePath(path.join('bin', binaryName));
    };
    const toggleWarnings = () => __awaiter(this, void 0, void 0, function* () {
        const config = vscode.workspace.getConfiguration('verilogLinter');
        const current = config.get('showWarnings', true);
        yield config.update('showWarnings', !current, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Warnings are now ${!current ? 'enabled' : 'disabled'}.`);
        // Run linter again on all open Verilog documents
        vscode.workspace.textDocuments.forEach(doc => {
            const ext = path.extname(doc.fileName);
            if (['.v', '.sv', '.svh', '.vhd'].includes(ext)) {
                runLinter(doc);
            }
        });
    });
    const selectCompileFile = () => __awaiter(this, void 0, void 0, function* () {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage("Please open a folder first.");
            return;
        }
        const fileUri = yield vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Compile File (.do)',
            filters: {
                'Compile Files': ['do'],
                'All Files': ['*']
            }
        });
        if (!fileUri || fileUri.length === 0)
            return;
        const selectedPath = fileUri[0].fsPath;
        const workspaceRoot = folders[0].uri.fsPath;
        const relativePath = path.relative(workspaceRoot, selectedPath);
        const vscodeDir = path.join(workspaceRoot, '.vscode');
        const settingsPath = path.join(vscodeDir, 'settings.json');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            }
            catch (e) {
                vscode.window.showErrorMessage('Failed to parse existing settings.json.');
            }
        }
        settings['verilogLinter.compileFile'] = relativePath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        vscode.window.showInformationMessage(`Saved compile file: ${relativePath}`);
    });
    const getUserConfig = () => {
        const configPath = path.join(os.homedir(), '.verilog-linter-config.json');
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        }
        catch (_a) {
            return { tool: 'slang', questaPath: '' };
        }
    };
    const getQuestaExecutable = (basePath) => {
        const folder = path.basename(basePath).toLowerCase();
        if (folder === 'bin') {
            return path.join(basePath, 'vsim');
        }
        else if (folder === 'win64' || folder === 'win32') {
            return path.join(basePath, 'vsim.exe');
        }
        else {
            vscode.window.showErrorMessage('Unknown Questa folder structure. Expected folder to end with bin, win64 or win32.');
            return '';
        }
    };
    const selectLinterTool = () => __awaiter(this, void 0, void 0, function* () {
        const options = ['slang', 'questa', 'modelsim'];
        const choice = yield vscode.window.showQuickPick(options, {
            placeHolder: 'Select Verilog Linter Tool'
        });
        if (!choice)
            return;
        const platformHint = os.platform().startsWith('win') ? 'C:/questasim2025/win64' : '/opt/questa/bin';
        const input = (choice === 'slang') ? '' : yield vscode.window.showInputBox({
            prompt: `Enter path to ${choice} installation folder (e.g. ${platformHint})`
        });
        const configPath = path.join(os.homedir(), '.verilog-linter-config.json');
        const config = {
            tool: choice,
            questaPath: input !== null && input !== void 0 ? input : ''
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        vscode.window.showInformationMessage(`Linter set to ${choice}`);
    });
    const runLinter = (document) => {
        var _a, _b, _c, _d, _e, _f;
        const filePath = document.fileName;
        const ext = path.extname(filePath);
        if (!['.v', '.sv', '.svh', '.vhd'].includes(ext))
            return;
        const userConfig = getUserConfig();
        const selectedTool = userConfig.tool;
        const questaBasePath = userConfig.questaPath;
        const config = vscode.workspace.getConfiguration('verilogLinter');
        const compileFile = config.get('compileFile');
        let exePath;
        let args;
        let cwd = '';
        vscode.window.showInformationMessage(`[Linter] Using tool: ${selectedTool}`);
        if (selectedTool === 'slang') {
            exePath = getSlangExecutablePath();
            if (compileFile) {
                const workspaceFolder = (_c = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) !== null && _c !== void 0 ? _c : '';
                const fullCompilePath = path.isAbsolute(compileFile)
                    ? compileFile
                    : path.join(workspaceFolder, compileFile);
                args = ['--lint-only', '--diag-json', '-', '-f', fullCompilePath];
            }
            else {
                args = ['--lint-only', '--diag-json', '-', filePath];
            }
        }
        else {
            exePath = getQuestaExecutable(questaBasePath);
            if (!exePath)
                return;
            if (compileFile) {
                const workspaceFolder = (_f = (_e = (_d = vscode.workspace.workspaceFolders) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.uri.fsPath) !== null && _f !== void 0 ? _f : '';
                const fullCompilePath = path.isAbsolute(compileFile)
                    ? compileFile
                    : path.join(workspaceFolder, compileFile);
                const normalizedPath = fullCompilePath.replace(/\\/g, '/');
                cwd = path.dirname(fullCompilePath);
                args = ['-c', ' -do', ' "', 'set env_src ../src', '"', ' -do', ' "', 'do', normalizedPath, '"', ' -do', ' "', 'quit', '"'];
                exePath = path.resolve(cwd, exePath);
            }
            else {
                vscode.window.showErrorMessage('No compile file selected for Questa/ModelSim.');
                return;
            }
        }
        vscode.window.showInformationMessage(`[Linter] Running: ${exePath} ${args.join(' ')}`);
        const maxAttempts = 8;
        let attempts = 0;
        const tryRun = () => {
            attempts++;
            const cmd = `cd "${cwd}" && "${exePath}" ${args.join(' ')}`;
            cp.exec(cmd, (err, stdout, stderr) => {
                var _a, _b, _c;
                const output = stdout + stderr;
                // שמירה ל-logs
                const workspaceFolder = (_c = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) !== null && _c !== void 0 ? _c : '';
                fs.writeFileSync(path.join(workspaceFolder, 'raw_output.log'), output);
                // ---- דרישה 1: לבדוק license error ----
                if (output.includes("Error: Invalid license environment")) {
                    vscode.window.showErrorMessage(`[Linter ${selectedTool}] Invalid license environment detected.`);
                    return;
                }
                if (err && err.code !== 1 && err.code !== 2) {
                    if (attempts < maxAttempts) {
                        setTimeout(tryRun, 100);
                    }
                    else {
                        vscode.window.showErrorMessage(`${selectedTool} failed after ${maxAttempts} attempts: ${err.message}`);
                    }
                    return;
                }
                try {
                    const fileDiagnosticsMap = new Map();
                    const diagnosticsInOrder = [];
                    const showWarnings = vscode.workspace.getConfiguration('verilogLinter').get('showWarnings', true);
                    diagnosticCollection.clear();
                    if (selectedTool === 'slang') {
                        // future support
                    }
                    else if (compileFile) {
                        const baseDir = path.dirname(path.isAbsolute(compileFile)
                            ? compileFile
                            : path.join(workspaceFolder, compileFile));
                        const lines = output.split(/\r?\n/);
                        const data = [];
                        let currentGroup = [];
                        const flushGroup = (group) => {
                            if (group.length === 0)
                                return;
                            const message = group.join('\n').trim();
                            const severity = /# \*\* Warning:/.test(group[0]) ? "Warning" : "Error";
                            if (/Note:/.test(group[0]))
                                return; // ignore notes
                            if (!showWarnings && severity === 'Warning')
                                return;
                            let file;
                            let line;
                            let code = "";
                            let match = group[0].match(/([^\s:()]+\.sv)\((\d+)\)/);
                            if (match) {
                                file = match[1].replace(/\\/g, '/');
                                line = parseInt(match[2]);
                                const codeMatch = group[0].match(/\((vlog-\d+)\)/);
                                if (codeMatch)
                                    code = codeMatch[1];
                            }
                            for (const l of group) {
                                const atMatch = l.match(/# \*\* at ([^\s:()]+\.sv)\((\d+)\):/);
                                if (atMatch) {
                                    file = atMatch[1].replace(/\\/g, '/');
                                    line = parseInt(atMatch[2]);
                                    const codeMatch = l.match(/\((vlog-\d+)\)/);
                                    if (codeMatch)
                                        code = codeMatch[1];
                                    break;
                                }
                            }
                            if (!file || !line)
                                return;
                            if (!showWarnings && severity === 'Warning')
                                return;
                            data.push({ severity, file, line, code, message });
                        };
                        for (const line of lines) {
                            if (/^# \*\* (Error|Warning):/.test(line)) {
                                flushGroup(currentGroup);
                                currentGroup = [line];
                            }
                            else if (/^# \*\*/.test(line)) {
                                currentGroup.push(line);
                            }
                        }
                        flushGroup(currentGroup);
                        // ---- convert data into VSCode diagnostics ----
                        for (const entry of data) {
                            const absFilePath = path.resolve(baseDir, entry.file);
                            if (!fs.existsSync(absFilePath))
                                continue;
                            const fileUri = vscode.Uri.file(absFilePath);
                            const fileLines = fs.readFileSync(absFilePath, 'utf8').split(/\r?\n/);
                            const realLineText = fileLines[entry.line - 1] || '';
                            // דרישה 2 - למצוא token בתוך גרשיים
                            const tokenMatches = Array.from(entry.message.matchAll(/['"]([^'"]+)['"]/g));
                            let index = realLineText.search(/\S|$/); // fallback
                            let tokenLength = 1;
                            for (const tokenMatch of tokenMatches) {
                                const token = tokenMatch[1];
                                const tokenPos = realLineText.indexOf(token);
                                if (tokenPos >= 0) {
                                    index = tokenPos;
                                    tokenLength = token.length;
                                    break; // take first match found in line
                                }
                            }
                            const range = new vscode.Range(entry.line - 1, index, entry.line - 1, index + tokenLength);
                            const severity = entry.severity === 'Error'
                                ? vscode.DiagnosticSeverity.Error
                                : vscode.DiagnosticSeverity.Warning;
                            const diagnostic = new vscode.Diagnostic(range, entry.message, severity);
                            if (entry.code)
                                diagnostic.code = entry.code;
                            if (!fileDiagnosticsMap.has(fileUri.fsPath)) {
                                fileDiagnosticsMap.set(fileUri.fsPath, []);
                            }
                            fileDiagnosticsMap.get(fileUri.fsPath).push(diagnostic);
                            diagnosticsInOrder.push({ uri: fileUri, diagnostic });
                        }
                        for (const [filePath, diags] of fileDiagnosticsMap) {
                            const uri = vscode.Uri.file(filePath);
                            diagnosticCollection.set(uri, diags);
                        }
                        const parsedLines = diagnosticsInOrder.map(({ uri, diagnostic }) => {
                            const pos = `Line ${diagnostic.range.start.line + 1}`;
                            const sevStr = diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING';
                            return `[${sevStr}] ${uri.fsPath} ${pos}: ${diagnostic.message}`;
                        });
                        fs.writeFileSync(path.join(workspaceFolder, 'parsed_errors.log'), parsedLines.join('\n'));
                    }
                    else {
                        // fallback - slang not implemented
                    }
                }
                catch (e) {
                    if (attempts < maxAttempts) {
                        setTimeout(tryRun, 100);
                    }
                    else {
                        vscode.window.showErrorMessage(`Failed to parse ${selectedTool} output after ${maxAttempts} attempts: ${e}`);
                    }
                }
            });
        };
        tryRun();
    };
    '';
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(runLinter), vscode.workspace.onDidOpenTextDocument(runLinter), vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri)), vscode.commands.registerCommand('verilogLinter.selectCompileFile', selectCompileFile), vscode.commands.registerCommand('verilogLinter.selectLinterTool', selectLinterTool), vscode.commands.registerCommand('verilogLinter.toggleWarnings', toggleWarnings));
    if (vscode.window.activeTextEditor) {
        runLinter(vscode.window.activeTextEditor.document);
    }
}
//# sourceMappingURL=extension.js.map