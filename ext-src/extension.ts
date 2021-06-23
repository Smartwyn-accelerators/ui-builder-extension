import * as path from 'path';
import * as vscode from 'vscode';
const fs = require("fs")

import TargetTreeProvider from './targetTreeProvider';

import { readFiles } from './readFiles';
import { parseFile } from './file-parser';
import { Module, parseStruct } from 'ts-file-parser';

interface componentData {
  name: string,
  cssContent: string,
  scriptContent: string,
  htmlContent: string
}

/**
 * Manages webview panels
 */
class WebPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: WebPanel | undefined;

  private static readonly viewType = 'angular';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionPath: string;
  private readonly builtAppFolder: string;
  private disposables: vscode.Disposable[] = [];
  
  public static createOrShow(extensionPath: string) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If we already have a panel, show it.
    // Otherwise, create angular panel.
    if (WebPanel.currentPanel) {
      WebPanel.currentPanel.panel.reveal(column);
    } else {
      WebPanel.currentPanel = new WebPanel(extensionPath, column || vscode.ViewColumn.One);
    }
    return WebPanel.currentPanel;
  }

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this.extensionPath = extensionPath;
    this.builtAppFolder = 'dist';

    // Create and show a new webview panel
    this.panel = vscode.window.createWebviewPanel(WebPanel.viewType, 'Ui Builder', column, {
      // Enable javascript in the webview
      enableScripts: true,
      retainContextWhenHidden: true,
      enableCommandUris: true,
      enableFindWidget: true,
      // And restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, this.builtAppFolder))]
    });

    // Set the webview's initial html content
    this.panel.webview.html = this._getHtmlForWebview();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
          case 'publishCode':
            this.generateFiles(message.data);
            return;
          case 'getServiceFiles':
            this.getListOfServiceFiles();
            return;
          case 'getServiceData':
            console.log('getservicedata vscode')
            this.getServiceData(message.data);
            return;
        }
      },
      null,
      this.disposables
    );
  }

  private generateFiles(data: componentData) {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false
    };
    vscode.window.showOpenDialog(options).then(fileUri => {
      if (fileUri && fileUri[0]) {
        const dirPath = `${fileUri[0].path}/${data.name}`
        vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
        
        const htmlFilePath = `${dirPath}/${data.name}.html`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(htmlFilePath), Buffer.from(data.htmlContent));
        
        const scriptFilePath = `${dirPath}/${data.name}.ts`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(scriptFilePath), Buffer.from(data.scriptContent));
        
        const cssFilePath = `${dirPath}/${data.name}.scss`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(cssFilePath), Buffer.from(data.cssContent));

        vscode.window.showInformationMessage('component generated in ' + dirPath);
      }
    });
  }

  getListOfServiceFiles() {
    var serviceFiles: any[] = [];
    if(vscode.workspace.rootPath) {

      readFiles(vscode.workspace.rootPath.concat('/src/app'), {
        match: /.ts$/,
        exclude: /^\./
      }, function(err: any, content: string, file:string, next: any) {
        if (err) throw err;
        if(content.includes('@Injectable')) {
          serviceFiles.push(file)
        }
        // console.log('content:', content);
        // console.log('file:', file);
        next();
      },
      (err: any, files: any) => {
        let data = serviceFiles;
        if (err) {
          data = null;
        }
        this.panel.webview.postMessage({ 
          command: 'serviceFilesFetched',
          data,
          err
        });
      });
    }
  }

  getServiceData(filePath: string) {
    let data;
    let err;
    try{
      const decls = fs.readFileSync(filePath).toString();
      const jsonStructure: Module = parseStruct(decls, {}, "");
      data = jsonStructure;
    } catch (e) {
      err = e;
    }
    this.panel.webview.postMessage({ 
      command: 'serviceDataFetched',
      data,
      err
    });
  }

  public dispose() {
    WebPanel.currentPanel = undefined;

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Returns html of the start page (index.html)
   */
  private _getHtmlForWebview() {
    return `
    <html>
      <head></head>
      <body>
        <button onclick="getServiceFiles()">btn</button>
        <iframe src="http://localhost:4900" style="height: 600px; width: 100%;" id="ui-builder-iframe"></iframe>
      <script>
      const vscode = acquireVsCodeApi();
      function getServiceFiles() {
        vscode.postMessage({
          command: 'getServiceFiles'
        })
      }
      
      window.addEventListener('message', event => {
        const message = event.data; // The JSON data our extension sent
        switch (message.command) {
          case 'getServiceFiles':
            vscode.postMessage({
              command: 'getServiceFiles',
              data: message.data
            })
            break;
          case 'serviceFilesFetched':
            var frame = document.getElementById("ui-builder-iframe");/*the iframe DOM object*/;
            frame.contentWindow.postMessage({
              command: 'serviceFilesFetchedUI',
              data: message.data,
              err: message.err
            }, "*");
            break;
          case 'getServiceData':
            console.log('getservice data iframe')
            vscode.postMessage({
              command: 'getServiceData',
              data: message.data
            })
            break;
          case 'serviceDataFetched':
            var frame = document.getElementById("ui-builder-iframe");/*the iframe DOM object*/;
            frame.contentWindow.postMessage({
              command: 'serviceDataFetchedUI',
              data: message.data,
              err: message.err
            }, "*");
            break;
          case 'publishCode':
            vscode.postMessage({
              command: 'publishCode',
              data: message.data,
              err: message.err
            })
            break;
        }
      });

      // (function() {
      //   window.onmessage = function(e){
      //     vscode.postMessage({
      //       command: 'publishCode',
      //       data: e.data
      //     })
      //   };
      // }())
      </script>
      </body>

    </html>`
  }
}

/**
 * Activates extension
 * @param context vscode extension context
 */
export function activate(context: vscode.ExtensionContext) {
  vscode.window.registerTreeDataProvider('uibuilder-webview', new TargetTreeProvider());

  context.subscriptions.push(
    vscode.commands.registerCommand('uibuilder-webview.openWebview', () => {
      WebPanel.createOrShow(context.extensionPath);
    })
  );
}

