// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// import Papa from "papaparse";
// documentation: https://www.npmjs.com/package/papaparse

if (figma.currentPage.selection.length != 1) {
	figma.closePlugin("🛑 A single node must be selected");
  } else if (figma.currentPage.selection[0].type !== 'INSTANCE') {
	figma.closePlugin("🛑 Selected node must be an instance of a component");
  } else {
	// This shows the HTML page in "ui.html".
	figma.showUI(__html__, { width: 300, height: 366, title: "Table Builder" });
  }
  
  figma.ui.onmessage = msg => {
	console.log(msg);
	
	if (msg.type === 'build-table') {
	  
	  var textNode = getFirstChildOfTypeText(figma.currentPage.selection[0])
	  if (textNode === undefined) {
		figma.closePlugin("🛑 Selected node has to child of type TEXT");
	  }
  
	  var fontName: FontName = textNode.fontName as FontName
	  Promise.all([
		figma.loadFontAsync({family: fontName['family'], style: fontName["style"]}),
	  ]).then(() => { 
		  var headerCells = createTable(
			figma.currentPage.selection[0] as FrameNode, 
			msg.wrap_in_autolayout,
			msg.right_align_numbers,
			msg.data)
		  figma.currentPage.selection = headerCells;
		  figma.closePlugin();
		}
	  )
	  
	} else {
	  // user did cancel
	  figma.closePlugin();
	}
  };
  
  function createTable(
	original: FrameNode, 
	wrapInAutoLayout: boolean, 
	right_align_numbers: boolean,
	data: String,
  ) {
	var columnAutoLayouts: FrameNode[]; 
	columnAutoLayouts = []
	var headerCells: FrameNode[] = [];

	if (wrapInAutoLayout) {
	  var table = figma.createFrame()
	  table.name = 'Table'
	  table.layoutMode = 'HORIZONTAL'
	  table.x = original.x + original.width
	  table.y = original.y + original.height
	  table.counterAxisSizingMode = 'AUTO' // hug contents vertically
	  original.parent.appendChild(table) // add to same parent frame
	}
  
	var lines = data.split("\n")
	for (var i = 0; i < lines.length; i++) {
	  var line = lines[i];
	  var columns = line.split("\t")
	  for (var j = 0; j < columns.length; j++) {
		if (wrapInAutoLayout && i == 0) {
		  var columnAutoLayout = figma.createFrame()
		  columnAutoLayout.layoutMode = 'VERTICAL'
		  columnAutoLayouts.push(columnAutoLayout)
		  columnAutoLayout.name = 'Column ' + j
		  table.appendChild(columnAutoLayout)
		}
		
		var newNode: FrameNode = original.clone()
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
  
  function getFirstChildOfTypeText(sceneNode: SceneNode) {
	if ("children" in sceneNode) {
	  return sceneNode.children.find(node => node.type === "TEXT") as TextNode
	} else {
	  return undefined
	}
  }
  