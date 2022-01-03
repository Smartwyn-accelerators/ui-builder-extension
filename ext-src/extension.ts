import * as path from 'path';
import * as vscode from 'vscode';
const fs = require("fs")

import TargetTreeProvider from './targetTreeProvider';

import { readFiles } from './readFiles';
import { parseFile } from './file-parser';
import { Module, parseStruct } from 'ts-file-parser';
import { resolve } from 'ts-file-parser/src/fsUtils';

interface componentData {
  name: string,
  cssContent: string,
  scriptContent: string,
  htmlContent: string,
  serviceVariables: any;

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
  private serviceFileList: any[] = [];
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
  private generateServiceMethod(element){
    let str1='';
    if(element.apiMethod==='get'){
    str1=str1+`${element.methodName}(requestParams,requestHeaders){
      return this.httpclient.get('${element.apiURL}', { params: requestParams , headers:requestHeaders }).pipe(catchError());
    }`;
    }
    else if(element.apiMethod==='post'){
      str1=str1+`${element.methodName}(requestParams,requestHeaders,body){
        return this.httpclient.post('${element.apiURL}', body , { params: requestParams , headers:requestHeaders }).pipe(catchError());
      }`;
    }
    return str1;
  }
  private readFile(serviceFilePath){
    return new Promise((resolve, reject) => {
    fs.readFile(serviceFilePath, 'utf8', function (err,data1) {
      if (err) {
        return console.log(err);
      }
      console.log(data1);
      resolve(data1);
       //generate string
    
    });
  });
  }
  private async addServiceMethod(variables:any[]){
    //get service name from the script //get variable names from variables array
    let filedata;
    for (let index = 0; index < variables.length; index++) {
      const element = variables[index];
      if(element.serviceName){
      const serviceFilePath = element.serviceName;
      await this.readFile(serviceFilePath).then(async res=>{
        filedata=res;
        if(filedata!==''){
          let str= this.generateServiceMethod(element);
          let result;
          if(!filedata.includes(str)){
           result =  filedata.replace('\r\n}\r\n','\n'+str+'\r\n}\r\n');
           if(result.indexOf(`import { catchError} from 'rxjs/operators';`)<0){
           result = result.replace(`import { Injectable } from '@angular/core';`,`import { Injectable } from '@angular/core';
           import { catchError} from 'rxjs/operators';`);
           }
           await fs.writeFile(serviceFilePath, result , 'utf8', function (err) {
            if (err) return console.log(err);
          });
          }
            
          }
      })
      
      
      }

    }

  }

  private generateFiles(data: componentData) {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false
    };
    const testFileData: any=`import { ComponentFixture, TestBed } from '@angular/core/testing';\nimport { ${data.name}Component } from './${data.name}.component';\ndescribe('${data.name}Component', () => {\n\tlet component: ${data.name}Component;\n\tlet fixture: ComponentFixture<${data.name}Component>;\n\tbeforeEach(async () => {\n\t\tawait TestBed.configureTestingModule({\n\t\tdeclarations: [ ${data.name}Component ]\n\t})\n\t\t.compileComponents();\n\t});\n\n\tbeforeEach(() => {\n\t\tfixture = TestBed.createComponent(${data.name}Component);\n\t\tcomponent = fixture.componentInstance;\n\t\tfixture.detectChanges();\n\t});\n\n\tit('should create', () => {\n\t\texpect(component).toBeTruthy();\n\t});\n});`;
    vscode.window.showOpenDialog(options).then(fileUri => {
      if (fileUri && fileUri[0]) {
        const dirPath = `${fileUri[0].path}/${data.name}`
        vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
        
        const htmlFilePath = `${dirPath}/${data.name}.component.html`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(htmlFilePath), Buffer.from(data.htmlContent));
        
        const scriptFilePath = `${dirPath}/${data.name}.component.ts`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(scriptFilePath), Buffer.from(data.scriptContent));
        
        const cssFilePath = `${dirPath}/${data.name}.component.scss`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(cssFilePath), Buffer.from(data.cssContent));

        const testFilePath = `${dirPath}/${data.name}.component.spec.ts`;
        vscode.workspace.fs.writeFile(vscode.Uri.file(testFilePath), Buffer.from(testFileData));
        

        this.addServiceMethod(data.serviceVariables);

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
          serviceFiles.push(file);
        }
        // this.serviceFileList=serviceFiles;

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
  async getServiceData(filePath: string) {
    let data;
    let err;
    try{
      // const decls = fs.readFileSync(filePath).toString().replace(/'/g, "\"");
      const decls = fs.readFileSync(filePath)
                      .toString()
                      .replace("root',", "root'")
      const jsonStructure: Module = parseStruct(decls, {}, "");
      data = jsonStructure;
      //classes-> extends --> extended class name -->
      // let extendedClassName = '';
      // extendedClassName = data.classes[0].extends[0].basicName;
      //find in service list and push them in data 
      // let list;
      // await this.getMethodsForExtendedClass(extendedClassName).then(
      //   res=>{list=res;}
      // );
      
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
        <!-- <button onclick="getServiceFiles()">btn</button> -->
        <iframe src="http://localhost:4900" style="height: 100vh; width: 100%;" id="ui-builder-iframe"></iframe>
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

