/*************** DECLARATIONS ***************/ 
var {Cc, Ci, Cu} = require("chrome");
var tabs = require("sdk/tabs");
var simplePrefs = require("sdk/simple-prefs");
var prefs = require("sdk/preferences/service");
var { ActionButton } = require("sdk/ui/button/action");
var pageWorkers = require("sdk/page-worker");
var self = require("sdk/self");

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

var Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
var bookmarks = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
	.getService(Ci.nsINavBookmarksService);
var passwordManager = Cc["@mozilla.org/login-manager;1"]
	.getService(Ci.nsILoginManager);


var dataPath = "/home/blink/profile/data.json";
var passwordStorage = false;
simplePrefs.prefs.passwordStorage = passwordStorage;
var passwordEncryption = false;
simplePrefs.prefs.passwordEncryption = passwordEncryption;
var importJSONData;
var exportJSONData = {"bookmarks": [],"openTabs": [], "passwords":[], "passwordStorage" : false, "passwordEncryption" : false, "browser":"Firefox"};
var write = true;
var expID;

let action = {
  observe : function(aSubject, aTopic, aData) {
	 if (aTopic == "passwordmgr-storage-changed") {
		 writeJSONFile();
	 } else if (aTopic == "quit-application-requested") {
		write = false;
	 }
  }
};

/*************** TOR BUTTON ***************/
const disabledState = {
	"label": "Tor disabled",
	"icon": {
		"16": "./tor-disabled-16.png",
		"32": "./tor-disabled-24.png"
	}
};

const enabledState = {
	"label": "Tor enabled",
	"icon": {
		"16": "./tor-enabled-16.png",
		"32": "./tor-enabled-24.png"
	}
};

//Default State is the disabled state
var torButton = ActionButton({
	id: "tor-button",
	label: "Tor disabled",
	icon: {
		"16": "./tor-disabled-16.png",
		"32": "./tor-disabled-24.png"
	},
	onClick: function(state){
		if (torButton.label == "Tor disabled") {
			console.log("Disabling Tor proxy");
			//Redirect to the Tor proxy
			prefs.set("network.proxy.type", 1);
			prefs.set("network.proxy.socks", "localhost");
			prefs.set("network.proxy.socks_port", 9050);
			prefs.set("network.proxy.no_proxies_on", "localhost, 127.0.0.1");
			prefs.set("network.proxy.socks_version", 5);
			prefs.set("network.proxy.socks_remote_dns", true);

			//Change the state of the button
			torButton.state(torButton, enabledState);
		}
		else {
            console.log("Enabling Tor proxy");
			//Remove the redirection to the Tor proxy
			prefs.set("network.proxy.socks", "");
			prefs.set("network.proxy.socks_port", 0);
			prefs.set("network.proxy.no_proxies_on", "");
			prefs.set("network.proxy.socks_remote_dns", false);

			//Change the state of the button
			torButton.state(torButton, disabledState);
		}
	}
});


/*************** PREFERENCES ***************/ 

function onPasswordStorageChange(){
	passwordStorage =  require("sdk/simple-prefs").prefs.passwordStorage;
}

function onPasswordEncryptionChange(){
	passwordEncryption =  require("sdk/simple-prefs").prefs.passwordEncryption;
}

require("sdk/simple-prefs").on("passwordStorage", onPasswordStorageChange);
require("sdk/simple-prefs").on("passwordEncryption", onPasswordEncryptionChange);

function importPreferences(){
	passwordStorage = importJSONData.passwordStorage;
	require("sdk/simple-prefs").prefs.passwordStorage = passwordStorage;
	passwordEncryption = importJSONData.passwordEncryption;
	require("sdk/simple-prefs").prefs.passwordEncryption = passwordEncryption;
}

function exportPreferences(){
	exportJSONData.passwordStorage = passwordStorage;
	exportJSONData.passwordEncryption = passwordEncryption;
}

/*************** BOOKMARKS ***************/ 
function importBookmarksFromJSON(){
	exploreAndImportTree(importJSONData.bookmarks[0].children,Application.bookmarks.toolbar);
	exploreAndImportTree(importJSONData.bookmarks[1].children,Application.bookmarks.menu);
	exploreAndImportTree(importJSONData.bookmarks[2].children,Application.bookmarks.unfiled);
}

function exploreAndImportTree(JSONNode,currentNode){
	var i;
	for(i=0; i<JSONNode.length ; i++){
		if(typeof JSONNode[i].children == "undefined"){
			var bookmarkURI = Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService)
				.newURI(JSONNode[i].url, null, null);
			currentNode.addBookmark(JSONNode[i].name, bookmarkURI);
		} else {
			var childrenNode = currentNode.addFolder(JSONNode[i].name);
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
			var i;
			for(i=0; i<children.length ; i++){
				tab.push(exploreAndExportTree(children[i]));
			}
		}
		return {name: currentNode.title, children: tab, type:"folder"};
	} else {
		return {name: currentNode.title, url: currentNode.uri.spec, type:"url"};
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
	var j = 1;
	while(j < tabs.length){
		tabs[j].close();
	}
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


/*************** PASSWORDS ***************/
function importPasswordsFromJSON(){
	for(i=0 ; i<importJSONData.passwords.length ; i++){
		var hostname = importJSONData.passwords[i].hostname;
		var formSubmitURL = importJSONData.passwords[i].formSubmitURL;
		var username = importJSONData.passwords[i].username;
		var password = importJSONData.passwords[i].password;
		var logins = passwordManager.findLogins({},hostname,"","");
		if(logins.length != 0){
			passwordManager.removeLogin(logins[0]);
		}
		var loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
			.createInstance(Ci.nsILoginInfo);
		loginInfo.init(hostname,formSubmitURL,null,	username,password,"username","password");
		passwordManager.addLogin(loginInfo);
	}
}

function exportPasswordsToJSON(){
	var logins = passwordManager.getAllLogins({});	
	
	for (var i = 0; i < logins.length; i++) {
		exportJSONData.passwords.push(
				{hostname : logins[i].hostname, 
				 username : logins[i].username, 
				 password : logins[i].password,
				 formSubmitURL : logins[i].formSubmitURL}
		);
	}
}

function clearPasswordsOnStartup(){
    var count = passwordManager.countLogins("", "", ""); // count all logins
    if(count > 0) {
        passwordManager.removeAllLogins();
    }
}


/*********** Experience ID ************/
function importExpIDFromJSON(){
	expID = importJSONData.expID;
}

/*********** TEMPORARY DATA ***********/
function clearTemporaryDataOnStartup(){
    var cookieManager = Cc["@mozilla.org/cookiemanager;1"]
        .getService(Ci.nsICookieManager);
    var cache = Cc["@mozilla.org/netwerk/cache-storage-service;1"].
        getService(Ci.nsICacheStorageService);
    var imageCache = Cc["@mozilla.org/image/tools;1"].
        getService(Ci.imgITools).getImgCacheForDocument(null);
    var sdr = Cc["@mozilla.org/security/sdr;1"]
        .getService(Ci.nsISecretDecoderRing);


    //Clearing cookies
    cookieManager.removeAll();

    //Clearing cache
    cache.clear();

    //Clearing image cache
    imageCache.clearCache(false);

    //Clearing authentication tokens
    sdr.logoutAndTeardown();
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

function readFromFile(){
	var data = "";
	var fstream = Cc["@mozilla.org/network/file-input-stream;1"].
	              createInstance(Ci.nsIFileInputStream);
	var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
	              createInstance(Ci.nsIConverterInputStream);
	var file = Cc["@mozilla.org/file/local;1"]
    	.createInstance(Ci.nsILocalFile);
	file.initWithPath(dataPath);
	if(file.exists()){
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
	}
	return data;
}

function writeJSONFile(){
	if(write){
		 exportJSONData = {"bookmarks": [],"openTabs": [], "passwords":[], "passwordStorage" : passwordStorage,
			 "passwordEncryption" : passwordEncryption, "browser":"Firefox", expID: expID};
		 exportPreferences();
		 exportOpenTabsToJSON();
		 exportBookmarksToJSON();
		 if(passwordStorage){
			 exportPasswordsToJSON();
		 }
		var dataText = JSON.stringify(exportJSONData);
		var dataFile = Cc["@mozilla.org/file/local;1"]
			.createInstance(Ci.nsILocalFile);
		dataFile.initWithPath(dataPath);
		writeToFile(dataFile,dataText);
	}
}

function readJSONFile(){
	var dataText = readFromFile();
	if(dataText != ""){
		importJSONData = JSON.parse(dataText);
		importPreferences();
		importBookmarksFromJSON();
		importOpenTabsFromJSON();
		importExpIDFromJSON();
		if(passwordStorage){
			importPasswordsFromJSON();
		}

	}
}

/*************** MAIN ***************/
clearTemporaryDataOnStartup();
clearPasswordsOnStartup();
clearBookmarksOnStartup();
readJSONFile();

var pageWorker = pageWorkers.Page({
	contentURL: self.data.url("page.html"),
	contentScriptFile: self.data.url("page-script.js"),
	contentScriptOptions: {"uuid":expID}
});

//Defining observer for Firefox shutdown and password changes
let observerService = Cc["@mozilla.org/observer-service;1"].
	getService(Ci.nsIObserverService);
observerService.addObserver(action, "passwordmgr-storage-changed", false);
observerService.addObserver(action, "quit-application-requested", false);

//Defining observer for bookmark changes
var bookmarkObserver = {
  onItemAdded: function(aItemId, aFolder, aIndex) {
    writeJSONFile();
  },
  onItemChanged: function(aItemId, aProperty, aIsAnnotationProperty, aNewValue, aLastModified, aItemType, aParentId, aGUID, aParentGUID) {
    writeJSONFile();
  },
  onItemMoved: function(aItemId, aOldParentId, aOldIndex, aNewParentId, aNewIndex, aItemType, aGUID, aOldParentGUID, aNewParentGUID) {
    writeJSONFile();
  },
  onItemRemoved: function(aItemId, aParentId, aIndex, aItemType, aURI, aGUID, aParentGUID) {
    writeJSONFile();
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsINavBookmarkObserver])
};
bookmarks.addObserver(bookmarkObserver, false); 
 
//Defining observer for open tabs changes
tabs.on('ready', writeJSONFile);
tabs.on('close', writeJSONFile);

//Defining observer for prefs changes
simplePrefs.on("", writeJSONFile);
