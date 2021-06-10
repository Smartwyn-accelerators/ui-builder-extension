import * as vscode from 'vscode';

export default class TargetTreeProvider implements vscode.TreeDataProvider<object> {
    private _onDidChangeTreeData: vscode.EventEmitter<object | undefined> = new vscode.EventEmitter<object | undefined>();
    readonly onDidChangeTreeData: vscode.Event<object | undefined> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire(Object);
    }

    getTreeItem(element: object): vscode.TreeItem {
        return element;
    }

    getChildren(element?: object): Thenable<object[]> {
        vscode.commands.executeCommand('uibuilder-webview.openWebview');
        vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
        this._onDidChangeTreeData.fire(Object); // Make sure collection is not cached.
        return Promise.reject([]);
    }
}