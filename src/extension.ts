import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('verilog');
  const homeDir = process.env.HOME || process.env.USERPROFILE || 'C:/temp';
  const unixHome = homeDir.replace(/\\/g, '/');
  const workDir = `${unixHome}/work`;

  const getSlangExecutablePath = (): string => {
    const platform = os.platform();
    const binaryName =
      platform === 'win32' ? 'slang.exe' :
      platform === 'darwin' ? 'slang-mac' :
      'slang-linux';

    return context.asAbsolutePath(path.join('bin', binaryName));
  };


  
const toggleWarnings = async () => {
  const config = vscode.workspace.getConfiguration('verilogLinter');
  const current = config.get<boolean>('showWarnings', true);
  await config.update('showWarnings', !current, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(`Warnings are now ${!current ? 'enabled' : 'disabled'}.`);

  // Run linter again on all open Verilog documents
  vscode.workspace.textDocuments.forEach(doc => {
    const ext = path.extname(doc.fileName);
    if (['.v', '.sv', '.svh', '.vhd'].includes(ext)) {
      runLinter(doc);
    }
  });
};





  const selectCompileFile = async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("Please open a folder first.");
      return;
    }


    const fileUri = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select Compile File (.do)',
      filters: {
        'Compile Files': ['do'],
        'All Files': ['*']
      }
    });

    if (!fileUri || fileUri.length === 0) return;

    const selectedPath = fileUri[0].fsPath;
    const workspaceRoot = folders[0].uri.fsPath;
    const relativePath = path.relative(workspaceRoot, selectedPath);

    const vscodeDir = path.join(workspaceRoot, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir);
    }

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        vscode.window.showErrorMessage('Failed to parse existing settings.json.');
      }
    }

    settings['verilogLinter.compileFile'] = relativePath;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    vscode.window.showInformationMessage(`Saved compile file: ${relativePath}`);
  };

  const getUserConfig = (): { tool: string; questaPath: string } => {
    const configPath = path.join(os.homedir(), '.verilog-linter-config.json');
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { tool: 'slang', questaPath: '' };
    }
  };

  const getQuestaExecutable = (basePath: string): string => {
    const folder = path.basename(basePath).toLowerCase();
    if (folder === 'bin') {
      return path.join(basePath, 'vsim');
    } else if (folder === 'win64' || folder === 'win32') {
      return path.join(basePath, 'vsim.exe');
    } else {
      vscode.window.showErrorMessage('Unknown Questa folder structure. Expected folder to end with bin, win64 or win32.');
      return '';
    }
  };

  const selectLinterTool = async () => {
    const options = ['slang', 'questa', 'modelsim'];
    const choice = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select Verilog Linter Tool'
    });
    if (!choice) return;

    const platformHint = os.platform().startsWith('win') ? 'C:/questasim2025/win64' : '/opt/questa/bin';
    const input = (choice === 'slang') ? '' : await vscode.window.showInputBox({
      prompt: `Enter path to ${choice} installation folder (e.g. ${platformHint})`
    });

    const configPath = path.join(os.homedir(), '.verilog-linter-config.json');
    const config = {
      tool: choice,
      questaPath: input ?? ''
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    vscode.window.showInformationMessage(`Linter set to ${choice}`);
  };







const runLinter = async (document: vscode.TextDocument) => {
  const filePath = document.fileName;
  const ext = path.extname(filePath);
  if (!['.v', '.sv', '.svh', '.vhd'].includes(ext)) return;

  const userConfig = getUserConfig();
  let selectedTool = context.globalState.get('verilogLinter.selectedTool', 'questa');
  const questaBasePath = userConfig.questaPath;
  const config = vscode.workspace.getConfiguration('verilogLinter');
  const compileFile: string | undefined = config.get('compileFile');


  let effectiveCompileFile = compileFile;

  if (!effectiveCompileFile && (selectedTool === 'questa' || selectedTool === 'modelsim')) {
    const verificationFiles = await vscode.workspace.findFiles('**/verification/**/sim/compile_env.do', '**/node_modules/**', 1);
    if (verificationFiles.length > 0) {
      effectiveCompileFile = vscode.workspace.asRelativePath(verificationFiles[0].fsPath);
      vscode.window.showInformationMessage(`Auto-detected compile file: ${effectiveCompileFile}`);
    } else {
      const simFiles = await vscode.workspace.findFiles('**/sim/compile_env.do', '**/node_modules/**', 1);
      if (simFiles.length > 0) {
        effectiveCompileFile = vscode.workspace.asRelativePath(simFiles[0].fsPath);
        vscode.window.showInformationMessage(`Auto-detected compile file: ${effectiveCompileFile}`);
      }
    }
  }

  let exePath: string;
  let args: string[];
  let cwd = '';

  // vscode.window.showInformationMessage(`[Linter] Using tool: ${selectedTool}`);

  if (selectedTool === 'slang') {
    exePath = getSlangExecutablePath();
    if (compileFile) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const fullCompilePath = path.isAbsolute(compileFile)
        ? compileFile
        : path.join(workspaceFolder, compileFile);
      args = ['--lint-only', '--diag-json', '-', '-f', fullCompilePath];
    } else {
      args = ['--lint-only', '--diag-json', '-', filePath];
    }
  } else {
    exePath = getQuestaExecutable(questaBasePath);
    if (!exePath) return;

    if (effectiveCompileFile) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const fullCompilePath = path.isAbsolute(effectiveCompileFile)
        ? effectiveCompileFile
        : path.join(workspaceFolder, effectiveCompileFile);
      
      const normalizedPath = fullCompilePath.replace(/\\/g, '/');
      cwd = path.dirname(fullCompilePath);

      args = [
        '-c',
        ` -do "vlib ${workDir}"`,
        ` -do "vmap work ${workDir}"`,
        ` -do "set env_src ../src"`,
        ` -do "do ${normalizedPath}"`,
        ' -do "quit"'
      ];

      
      exePath = path.resolve(cwd, exePath);
    } else {
      vscode.window.showErrorMessage('No compile file selected for Questa/ModelSim.');
      return;
    }
  }

  // vscode.window.showInformationMessage(`[Linter] Running: ${exePath} ${args.join(' ')}`);

  const maxAttempts = 8;
  let attempts = 0;

  const tryRun = () => {
    attempts++;
    const cmd = `cd "${cwd}" && "${exePath}" ${args.join(' ')}`;
    cp.exec(cmd, (err, stdout, stderr) => {
      const output = stdout + stderr;

      // שמירה ל-logs
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      fs.writeFileSync(path.join(workspaceFolder, 'raw_output.log'), output);

      // ---- דרישה 1: לבדוק license error ----
      if (output.includes("Error: Invalid license environment")) {
        vscode.window.showErrorMessage(`[Linter ${selectedTool}] Invalid license environment detected.`);
        return;
      }

      if (err && (err as any).code !== 1 && (err as any).code !== 2) {
        if (attempts < maxAttempts) {
          setTimeout(tryRun, 100);
        } else {
          vscode.window.showErrorMessage(`${selectedTool} failed after ${maxAttempts} attempts: ${err.message}`);
        }
        return;
      }

      try {
        const fileDiagnosticsMap = new Map<string, vscode.Diagnostic[]>();
        const diagnosticsInOrder: { uri: vscode.Uri, diagnostic: vscode.Diagnostic }[] = [];
        const showWarnings: boolean = vscode.workspace.getConfiguration('verilogLinter').get('showWarnings', true);

        diagnosticCollection.clear();

        if (selectedTool === 'slang') {
          // future support
        } else if (compileFile) {
          const baseDir = path.dirname(path.isAbsolute(compileFile)
            ? compileFile
            : path.join(workspaceFolder, compileFile));

          const lines = output.split(/\r?\n/);
          const data: {
            severity: string,
            file: string,
            line: number,
            code: string,
            message: string
          }[] = [];

          let currentGroup: string[] = [];

          const flushGroup = (group: string[]) => {
            if (group.length === 0) return;

            const message = group.join('\n').trim();
            const severity = /# \*\* Warning:/.test(group[0]) ? "Warning" : "Error";

            if (/Note:/.test(group[0])) return;  // ignore notes
            if (!showWarnings && severity === 'Warning') return;

            let file: string | undefined;
            let line: number | undefined;
            let code = "";

            let match = group[0].match(/([^\s:()]+\.sv)\((\d+)\)/);
            if (match) {
              file = match[1].replace(/\\/g, '/');
              line = parseInt(match[2]);
              const codeMatch = group[0].match(/\((vlog-\d+)\)/);
              if (codeMatch) code = codeMatch[1];
            }

            for (const l of group) {
              const atMatch = l.match(/# \*\* at ([^\s:()]+\.sv)\((\d+)\):/);
              if (atMatch) {
                file = atMatch[1].replace(/\\/g, '/');
                line = parseInt(atMatch[2]);
                const codeMatch = l.match(/\((vlog-\d+)\)/);
                if (codeMatch) code = codeMatch[1];
                break;
              }
            }

            if (!file || !line) return;
            if (!showWarnings && severity === 'Warning') return;

            data.push({ severity, file, line, code, message });
          };

          for (const line of lines) {
            if (/^# \*\* (Error|Warning):/.test(line)) {
              flushGroup(currentGroup);
              currentGroup = [line];
            } else if (/^# \*\*/.test(line)) {
              currentGroup.push(line);
            }
          }
          flushGroup(currentGroup);

          // ---- convert data into VSCode diagnostics ----
          for (const entry of data) {
            const absFilePath = path.resolve(baseDir, entry.file);
            if (!fs.existsSync(absFilePath)) continue;

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
                break;  // take first match found in line
              }
            }

            const range = new vscode.Range(entry.line - 1, index, entry.line - 1, index + tokenLength);
            const severity = entry.severity === 'Error'
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning;
            const diagnostic = new vscode.Diagnostic(range, entry.message, severity);
            if (entry.code) diagnostic.code = entry.code;

            if (!fileDiagnosticsMap.has(fileUri.fsPath)) {
              fileDiagnosticsMap.set(fileUri.fsPath, []);
            }
            fileDiagnosticsMap.get(fileUri.fsPath)!.push(diagnostic);
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
        } else {
          // fallback - slang not implemented
        }
      } catch (e) {
        if (attempts < maxAttempts) {
          setTimeout(tryRun, 100);
        } else {
          vscode.window.showErrorMessage(`Failed to parse ${selectedTool} output after ${maxAttempts} attempts: ${e}`);
        }
      }
    });
  };

  tryRun();
};''












  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(runLinter),
    vscode.workspace.onDidOpenTextDocument(runLinter),
    vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri)),
    vscode.commands.registerCommand('verilogLinter.selectCompileFile', selectCompileFile),
    vscode.commands.registerCommand('verilogLinter.selectLinterTool', selectLinterTool),
    vscode.commands.registerCommand('verilogLinter.toggleWarnings', toggleWarnings)
  );

  if (vscode.window.activeTextEditor) {
    runLinter(vscode.window.activeTextEditor.document);
  }
}
