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
		 console.log("Let's dance 4! Dancinator returns!");
		 writeJSONFile();
	 }
  }
}

let observerService = Cc["@mozilla.org/observer-service;1"].
	getService(Ci.nsIObserverService);

/*************** BOOKMARKS ***************/ 
function importBookmarksFromJSON(){
	console.log("Let's dance 3! Armaged-DANCE!");
	
	/*
	var i;
	for(i=0; i<importJSONData.bookmarks.length; i++){
		var bookmarkURI = Cc["@mozilla.org/network/io-service;1"]
		.getService(Ci.nsIIOService)
			.newURI(importJSONData.bookmarks[i].uri, null, null);
		bookmarks.insertBookmark(bookmarks.toolbarFolder,
				bookmarkURI,
				bookmarks.DEFAULT_INDEX,
				importJSONData.bookmarks[i].title);
		//console.log("BOOKMARK : "+importJSONData.bookmarks[i].uri
		//		+" *** "+importJSONData.bookmarks[i].title);
	}*/
	
	exploreAndImportTree(importJSONData.bookmarks[0].children,Application.bookmarks.toolbar);
	exploreAndImportTree(importJSONData.bookmarks[1].children,Application.bookmarks.menu);
	exploreAndImportTree(importJSONData.bookmarks[2].children,Application.bookmarks.unfiled);
}

function exploreAndImportTree(JSONNode,folderNode){
	console.log("INDIANA JONES EXPLORATION - "+JSONNode.title+" "+JSONNode.length);
	for(i=0; i<JSONNode.length ; i++){
		if(typeof JSONNode[i].children == "undefined"){
			var bookmarkURI = Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService)
				.newURI(JSONNode[i].url, null, null);
			folderNode.addBookmark(JSONNode[i].title, bookmarkURI);
		} else {
			var childrenNode = folderNode.addFolder(JSONNode[i].title);
			exploreAndImportTree(JSONNode[i].children,childrenNode);
		}
	}
}

function exportBookmarksToJSON(){
	console.log("Let's dance 2! The comeback!");
	
	/*
	var query = history.getNewQuery();
	
	//Specify folders to be searched
	var folders = [bookmarks.toolbarFolder, bookmarks.bookmarksMenuFolder,
	   bookmarks.unfiledBookmarksFolder];
	query.setFolders(folders, folders.length);
	
	var options = history.getNewQueryOptions();
	options.queryType = options.QUERY_TYPE_BOOKMARKS;
	var result = history.executeQuery(query, options);
	
	//The root property of a query result is an object representing the folder you specified above.
	var resultContainerNode = result.root;
	
	//Open the folder, and iterate over its contents.
	resultContainerNode.containerOpen = true;
	
	console.log(resultContainerNode.childCount);
	for (var i=0; i < resultContainerNode.childCount; ++i) {
		var childNode = resultContainerNode.getChild(i);
		
		// Accessing properties of matching bookmarks
		var title = childNode.title;
		var uri = childNode.uri;
		
		//console.log(title+","+uri);
		exportJSONData.bookmarks.push({title: childNode.title, uri: childNode.uri});
	}*/
	/*
	var tab1 = Application.bookmarks.toolbar.children;
	for(i=0; i< tab1.length; i++){
		console.log("TYPE: "+tab1[i].type);
	}
	
	var tab2 = Application.bookmarks.menu.children;
	for(i=0; i< tab2.length; i++){
		console.log("TYPE: "+tab2[i].type);
	}
	var tab3 = Application.bookmarks.unfiled.children;
	*/
	console.log("TESTTTTTTTTTTTTTTTTTTTTTTTTT");
	var toolbarData = exploreAndExportTree(Application.bookmarks.toolbar);
	exportJSONData.bookmarks.push(toolbarData);
	var menuData = exploreAndExportTree(Application.bookmarks.menu);
	exportJSONData.bookmarks.push(menuData);
	var unfilteredData = exploreAndExportTree(Application.bookmarks.unfiled);
	exportJSONData.bookmarks.push(unfilteredData);
	
	/*
	for(i=0; i< tab3.length; i++){
		console.log("TYPE: "+tab3[i].type);
		if(tab3[i].type == "folder"){
			console.log("I'M A FOLDERRRRRRRRRRR!");
		} else {
			console.log("I'M A BOOKMARKKKKKKKKKKK!");
		}
	}*/
	
}

function exploreAndExportTree(currentPath){
	console.log("LET'S PARSE GENTLEMEN!");
	
	if(currentPath.type == "folder"){
		var tab = [];
		var children = currentPath.children;
		if(typeof children != "undefined"){
			console.log("Children count : "+children.length);
			for(i=0; i<children.length ; i++){
				tab.push(exploreAndExportTree(children[i]));
			}
		}
		console.log("FOLDER RETURNED - "+currentPath.title);
		return {title: currentPath.title, children: tab};
	} else {
		console.log("BOOKMARK RETURNED - "+currentPath.title);
		return {title: currentPath.title, url: currentPath.uri.spec};
	}
	
	/*
	var tab = currentFolder.children;
	if (typeof tab != "undefined"){
		currentJSONFolder.push({title:currentFolder.title , children: []});
		for(i=0; i<tab.length ; i++){
			if(tab[i].type == "folder"){
				console.log("I'M A FOLDERRRRRRRRRRR!");
				currentJSFONFolder.children.push({title:tab[i].title});
				exportFolder(tab[i],currentJSONFolder.children[i]);
			} else {
				console.log("I'M A BOOKMARKKKKKKKKKKK! "+tab[i].title+" *** "+tab[i].uri);
				currentJSONFolder.children.push({title:tab[i].title, url: tab[i].url});
			}
		}
	}*/

}


function clearBookmarksOnStartup(){
	console.log("EVERYTHING must be DESTROYED!");
	/*
	var query = history.getNewQuery();
	var folders = [bookmarks.toolbarFolder, bookmarks.bookmarksMenuFolder,
	   bookmarks.unfiledBookmarksFolder];
	query.setFolders(folders, folders.length);
	var options = history.getNewQueryOptions();
	options.queryType = options.QUERY_TYPE_BOOKMARKS;
	var result = history.executeQuery(query, options);
	var resultContainerNode = result.root;
	resultContainerNode.containerOpen = true;
	console.log("BOOKMARS TO BE DESTROYED : "+resultContainerNode.childCount);
	
	for (var i=0; i < resultContainerNode.childCount; ++i) {
		var childNode = resultContainerNode.getChild(i);
		console.log("REMOVE n°"+i+": "+childNode.title+" ***** "+childNode.uri+" **** "+childNode.itemId+"\nRESTANTS: "+(resultContainerNode.childCount-i-1));
		bookmarks.removeItem(childNode.itemId);
	}*/
	
	/*while(resultContainerNode.childCount>0){
		bookmarks.removeItem(resultContainerNode.getChild(0).itemId);
		
	}*/
	/*
	var i;
	var tab = Application.bookmarks.toolbar.children;
	tab.push(Application.bookmarks.menu.children);
	tab.push(Application.bookmarks.unfiled.children);
	console.log("TAB : "+tab.length);
	for(i=0; i< tab.length; i++){
		console.log(tab[i].title);
		tab[i].remove();
	}*/
	
	
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
	console.log("i="+i+" OpenTabs length: "+openTabs.length+"\n");
	while(i < openTabs.length){
		console.log("i = "+i+"\n")
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
	console.log(dataText);
	writeToFile(dataFile,dataText);
}

function readJSONFile(){
	var dataText = readFromFile(dataFile);
	importJSONData = JSON.parse(dataText);
	console.log("IMPORTATOR IS BACK! \n"+dataText);
	importBookmarksFromJSON();
	importOpenTabsFromJSON();
}

/*************** MAIN ***************/ 
//observerService.addObserver(testObserver, "quit-application-granted", false);
observerService.addObserver(testObserver, "quit-application-requested", false);
clearBookmarksOnStartup();
readJSONFile();
