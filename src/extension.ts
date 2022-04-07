import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidChangeTextDocument(event => {
		insertAutoCloseTag(event);
	});
}

export function deactivate() {}

function insertAutoCloseTag(event: vscode.TextDocumentChangeEvent): void {
	if (!event.contentChanges[0]) {
        return;
    }

	let isRightAngleBracket = checkRightAngleBracket(event.contentChanges[0]);
    if (!isRightAngleBracket && event.contentChanges[0].text !== "/") {
        return;
    }

	let editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

	let selection = editor.selection;
    let originalPosition = selection.start.translate(0, 1);

	let excludedTags: string[] = [];

	let textLine = editor.document.lineAt(selection.start);
	let text = textLine.text.substring(0, selection.start.character + 1);
	let result = /<([_a-zA-Z][a-zA-Z0-9:\-_.]*)(?:\s+[^<>]*?[^\s/<>=]+?)*?\s?(\/|>)$/.exec(text);

	let selectedLine = selection.start.line;
	let multilineText = "";
	while(result === null) {
		selectedLine --;
		multilineText = editor.document.getText(
			new vscode.Range(
				new vscode.Position(selectedLine, 0), 
				new vscode.Position(selection.start.line, selection.start.character + 1)));

		multilineText = multilineText.trim();
		multilineText = multilineText.replace("\t", "");
		multilineText = multilineText.replace("\r\n", "");

		result = /<([_a-zA-Z][a-zA-Z0-9:\-_.]*)(?:\s+[^<>]*?[^\s/<>=]+?)*?\s?(\/|>)$/.exec(multilineText);
	}

	if (
		result !== null && 
		((occurrenceCount(result[0], "'") % 2 === 0) && 
		(occurrenceCount(result[0], "\"") % 2 === 0) && 
		(occurrenceCount(result[0], "`") % 2 === 0))) {

		if (result[2] === ">") {
			if (excludedTags.indexOf(result[1].toLowerCase()) === -1) {
				editor.edit((editBuilder) => {
					if (result !== null) {
						editBuilder.insert(originalPosition, "</" + result[1] + ">");							
					}

				}).then(() => {
					if (editor !== undefined) {
						editor.selection = new vscode.Selection(originalPosition, originalPosition);
					}
				});
			}
		} 
		else {
			if (textLine.text.length <= selection.start.character + 1 || textLine.text[selection.start.character + 1] !== '>') { // if not typing "/" just before ">", add the ">" after "/"
				
				if (textLine.text[selection.start.character - 1] !== " ")
				{
					editor.edit((editBuilder) => {
						const spacePosition = originalPosition.translate(0, -1);
						editBuilder.insert(spacePosition, " ");
						editBuilder.insert(originalPosition, ">");
					});
				}
				else
				{
					editor.edit((editBuilder) => {
						const spacePosition = originalPosition.translate(0, -1);
						editBuilder.insert(originalPosition, ">");
					});
				}
			}
		}
	}

}

function checkRightAngleBracket(contentChange: vscode.TextDocumentContentChangeEvent): boolean {
    return contentChange.text === ">" || checkRightAngleBracketInVSCode_1_8(contentChange);
}

function checkRightAngleBracketInVSCode_1_8(contentChange: vscode.TextDocumentContentChangeEvent): boolean {
    return contentChange.text.endsWith(">") && contentChange.range.start.character === 0
        && contentChange.range.start.line === contentChange.range.end.line
        && !contentChange.range.end.isEqual(new vscode.Position(0, 0));
}

function getNextChar(editor: vscode.TextEditor, position: vscode.Position): string {
    let nextPosition = position.translate(0, 1);
    let text = editor.document.getText(new vscode.Range(position, nextPosition));
    return text;
}

function getCloseTag(text: string, excludedTags: string[]): string {
    let regex = /<(\/?[_a-zA-Z][a-zA-Z0-9:\-_.]*)(?:\s+[^<>]*?[^\s/<>=]+?)*?\s?>/g;
    let result = null;
    let stack = [];
    while ((result = regex.exec(text)) !== null) {
        let isStartTag = result[1].substr(0, 1) !== "/";
        let tag = isStartTag ? result[1] : result[1].substr(1);
        if (excludedTags.indexOf(tag.toLowerCase()) === -1) {
            if (isStartTag) {
                stack.push(tag);
            } else if (stack.length > 0) {
                let lastTag = stack[stack.length - 1];
                if (lastTag === tag) {
                    stack.pop();
                }
            }
        }
    }
    if (stack.length > 0) {
        let closeTag = stack[stack.length - 1];
        if (text.substr(text.length - 2) === "</") {
            return closeTag + ">";
        }
        if (text.substr(text.length - 1) === "<") {
            return "/" + closeTag + ">";
        }
        return "</" + closeTag + ">";
    } else {
        return "";
    }
}

function moveSelectionRight(selection: vscode.Selection, shift: number): vscode.Selection {
    let newPosition = selection.active.translate(0, shift);
    let newSelection = new vscode.Selection(newPosition, newPosition);
    return newSelection;
}

function occurrenceCount(source: string, find: string): number {
    return source.split(find).length - 1;
}