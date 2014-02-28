/*************** DECLARATIONS ***************/ 
var {components, Cc, Ci, Cu} = require("chrome");
var Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
var bookmarks = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
.getService(Ci.nsINavBookmarksService);
var history = Cc["@mozilla.org/browser/nav-history-service;1"]
  .getService(Ci.nsINavHistoryService);
var tabs = require("sdk/tabs");

var dataFile = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
			get("Home", Ci.nsIFile);
dataFile.append("data.json");
var exportJSONData = {"bookmarks": [],"openTabs": []};
var importJSONData;

let testObserver = {
  observe : function(aSubject, aTopic, aData) {
	 if (aTopic == "quit-application-requested") {
		 writeJSONFile();
	 }
  }
}

let observerService = Cc["@mozilla.org/observer-service;1"].
	getService(Ci.nsIObserverService);

/*************** BOOKMARKS ***************/ 
function importBookmarksFromJSON(){
	exploreAndImportTree(importJSONData.bookmarks[0].children,Application.bookmarks.toolbar);
	exploreAndImportTree(importJSONData.bookmarks[1].children,Application.bookmarks.menu);
	exploreAndImportTree(importJSONData.bookmarks[2].children,Application.bookmarks.unfiled);
}

function exploreAndImportTree(JSONNode,currentNode){
	for(i=0; i<JSONNode.length ; i++){
		if(typeof JSONNode[i].children == "undefined"){
			var bookmarkURI = Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService)
				.newURI(JSONNode[i].url, null, null);
			currentNode.addBookmark(JSONNode[i].title, bookmarkURI);
		} else {
			var childrenNode = currentNode.addFolder(JSONNode[i].title);
			exploreAndImportTree(JSONNode[i].children,childrenNode);
		}
	}
}

function exportBookmarksToJSON(){
	var toolbarData = exploreAndExportTree(Application.bookmarks.toolbar);
	exportJSONData.bookmarks.push(toolbarData);
	var menuData = exploreAndExportTree(Application.bookmarks.menu);
	exportJSONData.bookmarks.push(menuData);
	var unfilteredData = exploreAndExportTree(Application.bookmarks.unfiled);
	exportJSONData.bookmarks.push(unfilteredData);
}

function exploreAndExportTree(currentNode){
	if(currentNode.type == "folder"){
		var tab = [];
		var children = currentNode.children;
		if(typeof children != "undefined"){
			for(i=0; i<children.length ; i++){
				tab.push(exploreAndExportTree(children[i]));
			}
		}
		return {title: currentNode.title, children: tab};
	} else {
		return {title: currentNode.title, url: currentNode.uri.spec};
	}
}


function clearBookmarksOnStartup(){
	var tab1 = Application.bookmarks.toolbar.children;
	for(i=0; i< tab1.length; i++){
		tab1[i].remove();
	}
	var tab2 = Application.bookmarks.menu.children;
	for(i=0; i< tab2.length; i++){
		tab2[i].remove();
	}
	var tab3 = Application.bookmarks.unfiled.children;
	for(i=0; i< tab3.length; i++){
		tab3[i].remove();
	}
}

/*************** OPEN TABS ***************/ 
function importOpenTabsFromJSON(){
	var i;
	var openTabs = [];
	for(i=0; i<importJSONData.openTabs.length; i++){
		openTabs.push(importJSONData.openTabs[i].url)
	}
	restorePreviousSession(openTabs);
}

function restorePreviousSession(openTabs){
	if(openTabs.length != 0){
		tabs[0].url = openTabs[0];
	}
	var i = 1;
	while(i < openTabs.length){
		tabs.open(openTabs[i]);
		i++;
	}
}

function exportOpenTabsToJSON(){
	for (var i=0; i < tabs.length; i++){
		exportJSONData.openTabs.push({url: tabs[i].url});
	}
}


/*************** UTILS ***************/ 
function writeToFile(file,data){
	// file is nsIFile, data is a string
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
	               createInstance(Ci.nsIFileOutputStream);

	// use 0x02 | 0x10 to open file for appending.
	foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 

	var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
	                createInstance(Ci.nsIConverterOutputStream);
	converter.init(foStream, "UTF-8", 0, 0);
	converter.writeString(data);
	converter.close();
}

function readFromFile(file){
	var data = "";
	var fstream = Cc["@mozilla.org/network/file-input-stream;1"].
	              createInstance(Ci.nsIFileInputStream);
	var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
	              createInstance(Ci.nsIConverterInputStream);
	fstream.init(file, -1, 0, 0);
	cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish

	let (str = {}) {
	  let read = 0;
	  do { 
	    read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
	    data += str.value;
	  } while (read != 0);
	}
	cstream.close(); // this closes fstream
	return data;
}

function writeJSONFile(){
	 exportOpenTabsToJSON();
	 exportBookmarksToJSON();
	var dataText = JSON.stringify(exportJSONData);
	writeToFile(dataFile,dataText);
}

function readJSONFile(){
	var dataText = readFromFile(dataFile);
	importJSONData = JSON.parse(dataText);
	importBookmarksFromJSON();
	importOpenTabsFromJSON();
}

/*************** MAIN ***************/ 
observerService.addObserver(testObserver, "quit-application-requested", false);
clearBookmarksOnStartup();
readJSONFile();
