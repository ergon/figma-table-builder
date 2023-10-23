// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// import Papa from "papaparse";
// documentation: https://www.npmjs.com/package/papaparse

figma.skipInvisibleInstanceChildren = true

let selection = figma.currentPage.selection
let textNode = getFirstChildOfTypeText(selection[0])

if (figma.command == "generate-table") {
	if (selection.length != 1) {
		figma.closePlugin("🛑 A single node must be selected");
	} else if (textNode == null) {
		figma.closePlugin("🛑 Selected node must have a child of type TEXT");
	} else if (selection[0].type !== 'INSTANCE') {
		figma.closePlugin("🛑 Selected node must be an instance of a component");
	} else {
		// This shows the HTML page in "ui.html".
		figma.showUI(__html__, { width: 300, height: 366, title: "Table Builder" });
	}

	figma.ui.onmessage = msg => {
		console.log(msg);
		if (msg.type === 'run') {
			let fontName: FontName = textNode.fontName as FontName
			Promise.all([
				figma.loadFontAsync({ family: fontName['family'], style: fontName["style"] }),
			]).then(() => {
				let headerCells = createTable(
					selection[0] as FrameNode,
					msg.wrap_in_autolayout,
					msg.right_align_numbers,
					msg.data)
				figma.currentPage.selection = headerCells;
				figma.closePlugin();
			})
		} else {
			// user did cancel
			figma.closePlugin();
		}
	};

} else if (figma.command == "update-table") {
	let checksArray = tableCharacteristicsCheck(selection[0] as FrameNode)

	if (selection.length != 1) {
		figma.closePlugin("🛑 A single node must be selected");
	} else if (textNode == null) {
		// No text to update was found
		figma.closePlugin("🛑 Your selected node needs to have text");
	} else if (checksArray[0]) {
		// checks for alignment of autolayout frames. Allowed selected frames are: a single column or a table
	} else {
		figma.showUI(__html__, { width: 300, height: 366, title: "Table Builder" });
		figma.ui.postMessage(null)
	}

	figma.ui.onmessage = msg => {
		if (msg.type === 'run') {
			let fontNames = new Set<FontName>()
			fontNames.add(textNode.fontName as FontName)

			// Gather all selected TextNodes
			let textNodes: TextNode[] = []
			for (const element of selection) {
				let frameNode = element as FrameNode
				let textNodeList = frameNode.findAll(n => (n.type == "TEXT"))
				for (const element of textNodeList) {
					textNodes.push(element as TextNode)
				}
			}

			// Gather all fonts from the TextNodes
			for (const element of textNodes) {
				if (!fontNames.has(element.fontName as FontName)) {
					fontNames.add(element.fontName as FontName)
				}
			}

			// Get allowance to use fonts
			const loadFonts = async () => {
				for (let fontName of fontNames) {
					await figma.loadFontAsync({ family: fontName['family'], style: fontName["style"] })
				}
			}

			// Start to update table
			loadFonts().then(() => {
				updateTable(selection, msg.data, msg.right_align_numbers, checksArray[1])
				figma.closePlugin();
			})

		} else {
			figma.closePlugin();
		}
	};
}

function createTable(
	original: FrameNode,
	wrapInAutoLayout: boolean,
	right_align_numbers: boolean,
	data: string,
) {
	let columnAutoLayouts: FrameNode[];
	columnAutoLayouts = []
	let headerCells: FrameNode[] = [];

	if (figma.currentPage.selection[0].type !== 'INSTANCE') {
		figma.closePlugin("🛑 Selected node must be an instance of a component");
		return null
	} else {
		if (wrapInAutoLayout) {
			var table = figma.createFrame()
			table.name = 'Table'
			table.layoutMode = 'HORIZONTAL'
			table.x = original.x
			table.y = original.y
			table.counterAxisSizingMode = 'AUTO' // hug contents vertically
			table.fills = []
			original.parent.appendChild(table) // add to same parent frame
		}

		let lines = data.split("\n")
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let columns = line.split("\t")
			for (let j = 0; j < columns.length; j++) {
				if (wrapInAutoLayout && i == 0) {
					let columnAutoLayout = figma.createFrame()
					columnAutoLayout.fills = []
					columnAutoLayout.layoutMode = 'VERTICAL'
					columnAutoLayouts.push(columnAutoLayout)
					columnAutoLayout.name = 'Column ' + j
					table.appendChild(columnAutoLayout)
				}

				let newNode: FrameNode = original.clone()
				newNode.primaryAxisSizingMode = 'FIXED'
				newNode.layoutAlign = 'STRETCH'
				let textNode = getFirstChildOfTypeText(newNode)
				textNode.characters = columns[j].trim();

				if (right_align_numbers && !isNaN(Number(columns[j].replaceAll("'", "").trim()))) {

					// right-align text with fixed horizontal size
					textNode.textAlignHorizontal = 'RIGHT'

					// right-align in autolayouts
					if (newNode.layoutMode == 'HORIZONTAL') {
						newNode.primaryAxisAlignItems = 'MAX'
					} else if (newNode.layoutMode == 'VERTICAL') {
						newNode.counterAxisAlignItems = 'MAX'
					}

				} else {
					textNode.textAlignHorizontal = 'LEFT' // fails on "'" character
				}

				if (wrapInAutoLayout) {
					textNode.layoutSizingVertical = 'FIXED'
					textNode.layoutSizingHorizontal = 'FIXED'
					textNode.layoutSizingHorizontal = 'HUG'
					columnAutoLayouts[j].appendChild(newNode)
					columnAutoLayouts[j].counterAxisSizingMode = 'AUTO'
				} else {
					newNode.x = original.x + original.width * (j + 1)
					newNode.y = original.y + original.height * (i + 1)
				}

				if (i == 0) {
					headerCells.push(newNode)
				}
			}
		}
		original.remove();
		return headerCells;
	}
}

function getFirstChildOfTypeText(sceneNode: SceneNode) {
	if ("children" in sceneNode) {

		let textNodes = sceneNode.findAll(node => node.type === "TEXT")
		return textNodes[0] as TextNode
	}
	return null

}

function tableCharacteristicsCheck(selectedFrame: FrameNode) {
	// First element is to check for a table like structure. Second element to checks if a column is selected.
	let checksArray: boolean[] = [true, true]

	// Check for columns == frames inside selected frame
	if (!("children" in selectedFrame)) {
		figma.closePlugin("🛑 There are no columns in your table");
		return checksArray
	}

	// Check for column selection: look at autolayout alignment
	if (selectedFrame.layoutMode != "VERTICAL") {
		checksArray[1] = false
	}

	// Check for column selection: look for instances inside selected frame
	for (let i = 0; i < selectedFrame.children.length; i++) {
		if (selectedFrame.children[i].type != "INSTANCE") {
			checksArray[1] = false
			i = selectedFrame.children.length
		}
	}

	if (checksArray[1] == false) {
		if (selectedFrame.layoutMode != "HORIZONTAL") {
			figma.closePlugin("🛑 Your selection needs to be a table or a column");
			return checksArray
		}

		// Check for cells inside columns == frames inside frames inside the selected frame
		for (const element of selectedFrame.children) {
			let child = element as FrameNode
			if (!("children" in element)) {
				figma.closePlugin("🛑 There is a column with no cells");
				return checksArray
			} else if (child.layoutMode != "VERTICAL") {
				figma.closePlugin("🛑 Your selection does not have a table structure");
			}
		}
	}

	// selection has table characteristics
	checksArray[0] = false
	return checksArray
}

function updateTable(selection: readonly SceneNode[], data: string, right_align_numbers: boolean, isColumn: boolean) {
	let textNodes = [] as TextNode[]
	// Calculating row and column count of given data
	let lines = data.split("\n")
	let rowLengthData = lines.length
	let columnLengthData = lines[0].split("\t").length
	for (let i = 0; i < rowLengthData; i++) {
		if (columnLengthData < lines[i].split("\t").length) {
			columnLengthData = lines[i].split("\t").length
		}
	}

	// Create data table
	let dataTable: string[][] = [];
	for (let i = 0; i < rowLengthData; i++) {
		dataTable[i] = []
		let line = lines[i];
		var columnsData = line.split("\t")
		for (let j = 0; j < columnsData.length; j++) {
			dataTable[i][j] = columnsData[j]
		}
	}

	// Inverse data table
	let cellsData: string[] = [];
	for (let i = 0; i < columnsData.length; i++) {
		for (let j = 0; j < rowLengthData; j++) {
			cellsData.push(dataTable[j][i])
		}
	}

	let resizable = true
	let selectedFrame = selection[0] as FrameNode

	if (isColumn || selection[0].type == "INSTANCE") {
		resizable = false
	}

	// Check for columns that are instances
	for (let i = 0; i < selectedFrame.children.length; i++) {
		if (selectedFrame.children[i].type == "INSTANCE") {
			resizable = false
			i = selectedFrame.children.length
		}
	}

	if (resizable) {
		// All cells inside the columns need to be instances
		for (let i = 0; i < selectedFrame.children.length; i++) {
			let column = selectedFrame.children[i] as FrameNode
			if ("children" in column) {
				for (let j = 0; j < column.children.length; j++) {
					if (column.children[i].type != "INSTANCE") {
						resizable = false
						j = column.children.length
						i = selectedFrame.children.length
					}
				}
			} else {
				figma.closePlugin("🛑 There is a column with no cells");
			}

		}
	}

	// Getting the numbers of columns of the selected table and comparing it to the data
	let columnLength = 0
	for (const element of selectedFrame.children) {
		if (element.visible) {
			columnLength++
		}
	}
	if (columnLength != columnLengthData) {
		if (resizable) {
			addOrRemoveColumns(selectedFrame, columnLength, columnLengthData)
			columnLength = columnLengthData
		} else if (isColumn) {
			// Column selected
			for (const element of selectedFrame.children) {
				let textNode = getFirstChildOfTypeText(element)
				if (textNode != null) {
					textNodes.push(textNode)
				}
			}

			if (columnLengthData == 1 && rowLengthData == textNodes.length) {
				insertData(textNodes, cellsData, right_align_numbers)
			} else {
				figma.closePlugin("🛑 This seems to be a column with a different cell count than given by your data");
			}
			return
		} else {
			figma.closePlugin("🛑 The column count from your selected node is different than your given data column count");
			return
		}
	}

	// Comparing the row length of the selected table with the data
	let rowLength = getTextNodes(selectedFrame, textNodes)
	if (rowLength != rowLengthData) {
		if (resizable) {
			addOrRemoveRows(selectedFrame, columnLength, rowLength, rowLengthData)
			textNodes = []
			getTextNodes(selectedFrame, textNodes)
		} else {
			figma.closePlugin("🛑 Your given data has not the same row count as your selected table");
			return
		}
	}

	// Copy text from data cell into table
	insertData(textNodes, cellsData, right_align_numbers)
}

/**
 * This function determines the  row count of the table looking into the cell amount of each column.
 * At the same time it adds all text frames that it finds on the way into the given array "textFrames".
 * @param selectedFrame - The selected parent node as a frame
 * @param textFrames - An empty array to fill all found text frames into
 * @returns Returns the number of rows found in any column or an error of -1
 */
function getTextNodes(selectedFrame: FrameNode, textFrames: TextNode[]) {
	let rowCount = 0

	if ("children" in selectedFrame) {
		for (let i = 0; i < selectedFrame.children.length; i++) {
			let column = selectedFrame.children[i] as FrameNode
			if (column.visible) {
				let localRowCount = 0
				let columnChildren = column.children
				
				for (const element of columnChildren) {
					if (columnChildren[i].visible){
						localRowCount++
					}
					let textFrame = getFirstChildOfTypeText(element)
					if (textFrame != null && textFrame.type == 'TEXT') {
						textFrames.push(textFrame)
					}
				}
				if (rowCount == 0) {
					rowCount = localRowCount
				} else if (rowCount != localRowCount) {
					return -1
				}

			}
			
		}
	}
	return rowCount
}

function addOrRemoveColumns(selectedFrame: FrameNode, columnLength: number, columnLengthData: number) {
	if ("children" in selectedFrame) {
		if (columnLength > columnLengthData) {
			// delete columns
			for (let i = columnLengthData; i < columnLength; i++) {
				selectedFrame.children[columnLengthData].remove()
			}

		} else if (columnLength < columnLengthData) {
			// add columns
			for (let i = columnLength; i < columnLengthData; i++) {
				let copy = selectedFrame.children[columnLength - 1].clone()
				selectedFrame.appendChild(copy)
			}
		}
	}
}

function addOrRemoveRows(selectedFrame: FrameNode, columnLength: number, rowLength: number, rowLengthData: number) {
	if ("children" in selectedFrame) {
		if (rowLength > rowLengthData) {
			// delete rows
			for (let i = 0; i < columnLength; i++) {
				let column = selectedFrame.children[i] as FrameNode
				for (let j = rowLengthData; j < rowLength; j++) {
					column.children[rowLengthData].remove()
				}
			}

		} else if (rowLength < rowLengthData) {
			// add rows
			for (let i = 0; i < columnLength; i++) {
				let column = selectedFrame.children[i] as FrameNode
				for (let j = rowLength; j < rowLengthData; j++) {
					let copy = column.children[rowLength - 1].clone()
					column.appendChild(copy)
				}
			}

		}
	}
}

function insertData(textNodes: TextNode[], cellsData: string[], right_align_numbers: boolean) {
	// Copy text from data cell into table
	let arrayLength = Math.min(textNodes.length, cellsData.length)
	for (let i = 0; i < arrayLength; i++) {
		let textNode = textNodes[i]
		textNode.characters = cellsData[i].trim()
		updateAlignment(textNode, right_align_numbers)
	}
}

function updateAlignment(textNode: TextNode, right_align_numbers: boolean) {
	let FrameNode = textNode.parent as FrameNode
	// Align as asked
	if (right_align_numbers) {
		if (!isNaN(Number(textNode.characters.replaceAll("'", "").trim()))) {
			textNode.textAlignHorizontal = 'RIGHT'
			if (FrameNode.layoutMode == 'HORIZONTAL') {
				FrameNode.primaryAxisAlignItems = 'MAX'
			} else if (FrameNode.layoutMode == 'VERTICAL') {
				FrameNode.counterAxisAlignItems = 'MAX'
			}
		} else {
			textNode.textAlignHorizontal = 'LEFT'
			if (FrameNode.layoutMode == 'HORIZONTAL') {
				FrameNode.primaryAxisAlignItems = 'MIN'
			} else if (FrameNode.layoutMode == 'VERTICAL') {
				FrameNode.counterAxisAlignItems = 'MIN'
			}
		}
	}
}
