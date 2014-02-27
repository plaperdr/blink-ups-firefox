/*************** DECLARATIONS ***************/ 
var {components, Cc, Ci, Cu} = require("chrome");
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
	
	//Creation of an nsIURI object
	var bookmarkURI = Cc["@mozilla.org/network/io-service;1"]
    					.getService(Ci.nsIIOService)
   						.newURI("http://www.mozilla.com", null, null);
	
	bookmarks.insertBookmark(bookmarks.toolbarFolder,bookmarkURI,
							 bookmarks.DEFAULT_INDEX,"MOZILLA");
}


function exportBookmarksToJSON(){
	console.log("Let's dance 2! The comeback!");
	
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
	
	console.log(resultContainerNode.childCount)
	for (var i=0; i < resultContainerNode.childCount; ++i) {
		var childNode = resultContainerNode.getChild(i);
		
		// Accessing properties of matching bookmarks
		var title = childNode.title;
		var uri = childNode.uri;
		
		console.log(title+","+uri);
		exportJSONData.bookmarks.push({title: childNode.title, uri: childNode.uri});
	}
}

/*************** OPEN TABS ***************/ 
function importOpenTabsFromJSON(){
	// open an input stream from file
	var istream = Cc["@mozilla.org/network/file-input-stream;1"].
	              createInstance(Ci.nsIFileInputStream);
	istream.init(openTabsFile, 0x01, 0444, 0);
	istream.QueryInterface(Ci.nsILineInputStream);

	// read lines into array
	var line = {}, openTabs = [], hasmore;
	do {
	  hasmore = istream.readLine(line);
	  openTabs.push(line.value); 
	} while(hasmore);

	istream.close();
	
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
	/*
	var ostream = FileUtils.openSafeFileOutputStream(file)
	var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
	                createInstance(Ci.nsIScriptableUnicodeConverter);
	converter.charset = "UTF-8";
	var istream = converter.convertToInputStream(data);

	// The last argument (the callback) is optional.
	NetUtil.asyncCopy(istream, ostream, function(status) {
	  if (!components.isSuccessCode(status)) {
	    // Handle error!
	    return;
	  }
	  // Data has been written to the file.
	});*/
	
	// file is nsIFile, data is a string
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
	               createInstance(Ci.nsIFileOutputStream);

	// use 0x02 | 0x10 to open file for appending.
	foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
	// write, create, truncate
	// In a c file operation, we have no need to set file mode with or operation,
	// directly using "r" or "w" usually.

	// if you are sure there will never ever be any non-ascii text in data you can 
	// also call foStream.write(data, data.length) directly
	var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
	                createInstance(Ci.nsIConverterOutputStream);
	converter.init(foStream, "UTF-8", 0, 0);
	converter.writeString(data);
	converter.close(); // this closes foStream
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
readJSONFile();
