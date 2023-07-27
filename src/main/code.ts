// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// import Papa from "papaparse";
// documentation: https://www.npmjs.com/package/papaparse

var selection = figma.currentPage.selection
var textNode = getFirstChildOfTypeText(selection[0])

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
		if (msg.type === 'build-table') {
			var fontName: FontName = textNode.fontName as FontName
			Promise.all([
				figma.loadFontAsync({ family: fontName['family'], style: fontName["style"] }),
			]).then(() => {
				var headerCells = createTable(
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
	var checksArray = tableCharacteristicsCheck(selection[0] as FrameNode)

	if (selection.length != 1) {
		figma.closePlugin("🛑 A single node must be selected");
	} else if (textNode == null) {
		// No text to update was found
		figma.closePlugin("🛑 Your selected node needs to have text");
	} else if (checksArray[0]) {
		// checks for alignment of autolayout frames. Allowed selected frames are: a single column or a table
	} else {
		figma.showUI(__html__, { width: 300, height: 366, title: "Table Builder" });
	}

	figma.ui.onmessage = msg => {
		if (msg.type === 'build-table') {
			let fontNames = new Set<FontName>()
			fontNames.add(textNode.fontName as FontName)

			// Gather all selected TextNodes
			var textNodes: TextNode[] = []
			for (var i = 0; i < selection.length; i++) {
				var frameNode = selection[i] as FrameNode
				var textNodeList = frameNode.findAll(n => (n.type == "TEXT"))
				for (var j = 0; j < textNodeList.length; j++) {
					textNodes.push(textNodeList[j] as TextNode)
				}
			}

			// Gather all fonts from the TextNodes
			for (var i = 0; i < textNodes.length; i++) {
				if (!fontNames.has(textNodes[i].fontName as FontName)) {
					fontNames.add(textNodes[i].fontName as FontName)
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
				updateTable(selection, textNodes, msg.data, msg.right_align_numbers, checksArray[1])
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
	data: String,
) {
	var columnAutoLayouts: FrameNode[];
	columnAutoLayouts = []
	var headerCells: FrameNode[] = [];

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

		var lines = data.split("\n")
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var columns = line.split("\t")
			for (var j = 0; j < columns.length; j++) {
				if (wrapInAutoLayout && i == 0) {
					var columnAutoLayout = figma.createFrame()
					columnAutoLayout.fills = []
					columnAutoLayout.layoutMode = 'VERTICAL'
					columnAutoLayouts.push(columnAutoLayout)
					columnAutoLayout.name = 'Column ' + j
					table.appendChild(columnAutoLayout)
				}

				var newNode: FrameNode = original.clone()
				newNode.primaryAxisSizingMode = 'FIXED'
				newNode.layoutAlign = 'STRETCH'
				getFirstChildOfTypeText(newNode).characters = columns[j].trim();

				if (right_align_numbers && !isNaN(Number(columns[j].replaceAll("'", "").trim()))) {

					// right-align text with fixed horizontal size
					getFirstChildOfTypeText(newNode).textAlignHorizontal = 'RIGHT'

					// right-align in autolayouts
					if (newNode.layoutMode == 'HORIZONTAL') {
						newNode.primaryAxisAlignItems = 'MAX'
					} else if (newNode.layoutMode == 'VERTICAL') {
						newNode.counterAxisAlignItems = 'MAX'
					}

				} else {
					getFirstChildOfTypeText(newNode).textAlignHorizontal = 'LEFT' // fails on "'" character
				}

				if (wrapInAutoLayout) {
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
		return sceneNode.findOne(node => node.type === "TEXT") as TextNode
	} else {
		return null
	}
}

function tableCharacteristicsCheck(selectedFrame: FrameNode) {
	// First element is to check for a table like structure. Second element to checks if a column is selected.
	var checksArray: boolean[] = [true, true]

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
	for (var i = 0; i < selectedFrame.children.length; i++) {
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
		for (var i = 0; i < selectedFrame.children.length; i++) {
			var child = selectedFrame.children[i] as FrameNode
			if (!("children" in selectedFrame.children[i])) {
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

function updateTable(selection: readonly SceneNode[], textNodes: TextNode[], data: String, right_align_numbers: boolean, isColumn: boolean) {
	textNodes = []
	// Calculating row and column count of given data
	var lines = data.split("\n")
	var rowLengthData = lines.length
	var columnLengthData = lines[0].split("\t").length
	for (var i = 0; i < rowLengthData; i++) {
		if (columnLengthData < lines[i].split("\t").length) {
			columnLengthData = lines[i].split("\t").length
		}
	}

	// Create data table
	var dataTable: String[][] = [];
	for (var i = 0; i < rowLengthData; i++) {
		dataTable[i] = []
		var line = lines[i];
		var columnsData = line.split("\t")
		for (var j = 0; j < columnsData.length; j++) {
			dataTable[i][j] = columnsData[j]
		}
	}

	// Inverse data table
	var cellsData: String[] = [];
	for (var i = 0; i < columnsData.length; i++) {
		for (var j = 0; j < rowLengthData; j++) {
			cellsData.push(dataTable[j][i])
		}
	}

	var resizable = true
	var selectedFrame = selection[0] as FrameNode

	if (isColumn || selection[0].type == "INSTANCE") {
		resizable = false
	}

	// Check for columns that are instances
	for (var i = 0; i < selectedFrame.children.length; i++) {
		if (selectedFrame.children[i].type == "INSTANCE") {
			resizable = false
			i = selectedFrame.children.length
		}
	}

	if (resizable) {
		// All cells inside the columns need to be instances
		for (var i = 0; i < selectedFrame.children.length; i++) {
			var column = selectedFrame.children[i] as FrameNode
			if ("children" in column) {
				for (var j = 0; j < column.children.length; j++) {
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
	var columnLength = selectedFrame.children.length
	if (columnLength != columnLengthData) {
		if (resizable) {
			addOrRemoveColumns(selectedFrame, columnLength, columnLengthData)
			columnLength = columnLengthData
		} else if (isColumn) {
			// Column selected
			for (var i = 0; i < selectedFrame.children.length; i++) {
				var textNode = getFirstChildOfTypeText(selectedFrame.children[i] as SceneNode)
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
	var rowLength = getTextNodes(selectedFrame, textNodes, columnLength)
	if (rowLength != rowLengthData) {
		if (resizable) {
			addOrRemoveRows(selectedFrame, columnLength, rowLength, rowLengthData)
			textNodes = []
			rowLength = getTextNodes(selectedFrame, textNodes, columnLength)
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
 * It only works after knowing the column count because cells are inside columns which are inside the table.
 *
 * @param selectedFrame - The selected parent node as a Frame
 * @param textFrames - An empty array to fill all found text frames into
 * @param columnCount - The column count of the table (must be calculated before calling this method)
 * @returns Returns the maximal number of rows found in any column
 */
function getTextNodes(selectedFrame: FrameNode, textFrames: TextNode[], columnCount: number) {
	var maxRowCount = 0

	if ("children" in selectedFrame) {
		for (var i = 0; i < columnCount; i++) {
			var column = selectedFrame.children[i] as FrameNode
			var columnChildren = column.children
			for (var j = 0; j < columnChildren.length; j++) {
				if (maxRowCount < columnChildren.length) {
					maxRowCount = columnChildren.length /* Getting the max row length */
				}
				var textFrame = getFirstChildOfTypeText(columnChildren[j])
				if (textFrame != null && textFrame.type == 'TEXT') {
					textFrames.push(textFrame)
				}
			}
		}
	}
	return maxRowCount
}

function addOrRemoveColumns(selectedFrame: FrameNode, columnLength: number, columnLengthData: number) {
	if ("children" in selectedFrame) {
		if (columnLength > columnLengthData) {
			// delete columns
			for (var i = columnLengthData; i < columnLength; i++) {
				selectedFrame.children[columnLengthData].remove()
			}

		} else if (columnLength < columnLengthData) {
			// add columns
			for (var i = columnLength; i < columnLengthData; i++) {
				var copy = selectedFrame.children[columnLength - 1].clone()
				selectedFrame.appendChild(copy)
			}
		}
	}
}

function addOrRemoveRows(selectedFrame: FrameNode, columnLength: number, rowLength: number, rowLengthData: number) {
	if ("children" in selectedFrame) {
		if (rowLength > rowLengthData) {
			// delete rows
			for (var i = 0; i < columnLength; i++) {
				var column = selectedFrame.children[i] as FrameNode
				for (var j = rowLengthData; j < rowLength; j++) {
					column.children[rowLengthData].remove()
				}
			}

		} else if (rowLength < rowLengthData) {
			// add rows
			for (var i = 0; i < columnLength; i++) {
				var column = selectedFrame.children[i] as FrameNode
				for (var j = rowLength; j < rowLengthData; j++) {
					var copy = column.children[rowLength - 1].clone()
					column.appendChild(copy)
				}
			}

		}
	}
}

function insertData(textNodes: TextNode[], cellsData: String[], right_align_numbers: boolean) {
	// Copy text from data cell into table
	var arrayLength = Math.min(textNodes.length, cellsData.length)
	for (var i = 0; i < arrayLength; i++) {
		var textNode = textNodes[i]
		textNode.characters = cellsData[i].trim()
		updateAlignment(textNode, right_align_numbers)
	}
}

function updateAlignment(textNode: TextNode, right_align_numbers: boolean) {
	var FrameNode = textNode.parent as FrameNode
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
