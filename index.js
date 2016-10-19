/*************** DECLARATIONS ***************/
var {Cc, Ci, Cu} = require("chrome");
var tabs = require("sdk/tabs");
var simplePrefs = require("sdk/simple-prefs");
var prefs = require("sdk/preferences/service");
var panels = require("sdk/panel");
var system = require("sdk/system");
var { ToggleButton } = require('sdk/ui/button/toggle');

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
var passwordManager = Cc["@mozilla.org/login-manager;1"]
	.getService(Ci.nsILoginManager);


var dataPath = "/home/blink/profile/data.json";
var passwordStorage = false;
simplePrefs.prefs.passwordStorage = passwordStorage;
var passwordEncryption = false;
simplePrefs.prefs.passwordEncryption = passwordEncryption;
var proxy = false;
simplePrefs.prefs.proxy = proxy;
var refresh = false;
var exportJSONData;
var importJSONData;
var write = true;

let action = {
  observe : function(aSubject, aTopic, aData) {
	 if (aTopic == "passwordmgr-storage-changed") {
		 writeJSONFile();
	 } else if (aTopic == "quit-application-requested") {
		write = false;
	 }
  }
};

/*************** PANEL ***************/
var panel = panels.Panel({
	height: 400,
	width: 370,
	contentURL: "./panel.html",
	contentScriptFile:  [
		"./dependencies/jquery-2.2.0.min.js",
		"./dependencies/materialize.min.js",
		"./panel.js"
	],
	contentStyleFile: [
		"./dependencies/materialize.min.css",
		"./panel.css"
	],
	contentScriptOptions: {
		"proxy" : simplePrefs.prefs.proxy
	},
	onHide: handleHide
});

var button = ToggleButton({
	id: "blink-button",
	label: "Blink dashboard",
	icon: {
		"16": "./imgs/icon-square.png",
		"32": "./imgs/icon-square.png",
		"64": "./imgs/icon-square.png"
	},
	onChange: handleChange
});

function handleChange(state) {
	if (state.checked) {
		panel.show({
			position: button
		});
	}
}

function handleHide() {
	button.state('window', {checked: false});
}

function activateTorProxy(){
	//Redirect to the Tor proxy
	prefs.set("network.proxy.type", 1);
	prefs.set("network.proxy.socks", "localhost");
	prefs.set("network.proxy.socks_port", 9050);
	prefs.set("network.proxy.no_proxies_on", "localhost, 127.0.0.1");
	prefs.set("network.proxy.socks_version", 5);
	prefs.set("network.proxy.socks_remote_dns", true);

	panel.port.emit("verifyTor",{});
}

function deactivateTorProxy(){
	//Remove the redirection to the Tor proxy
	prefs.set("network.proxy.socks", "");
	prefs.set("network.proxy.socks_port", 0);
	prefs.set("network.proxy.no_proxies_on", "");
	prefs.set("network.proxy.socks_remote_dns", false);

	proxy = false;
	simplePrefs.prefs.proxy = false;
}

function refreshFingerprint(){
	refresh = true;
	writeJSONFile();

	var windows = require("sdk/windows").browserWindows;
	for (let window of windows) {
		window.close();
	}
}

function viewFingerprint(){
	tabs.open("https://amiunique.org/viewFP");
}

function connectedState(){
	proxy = true;
	simplePrefs.prefs.proxy = true;
}

panel.port.on("activateTorProxy", activateTorProxy);
panel.port.on("deactivateTorProxy", deactivateTorProxy);
panel.port.on("refreshFingerprint",refreshFingerprint);
panel.port.on("viewFingerprint",viewFingerprint);
panel.port.on("connected",connectedState);

/*************** PREFERENCES ***************/ 

function onPasswordStorageChange(){
	passwordStorage =  simplePrefs.prefs.passwordStorage;
}

function onPasswordEncryptionChange(){
	passwordEncryption =  simplePrefs.prefs.passwordEncryption;
}

simplePrefs.on("passwordStorage", onPasswordStorageChange);
simplePrefs.on("passwordEncryption", onPasswordEncryptionChange);

function importPreferences(){
	passwordStorage = importJSONData.passwordStorage;
	simplePrefs.prefs.passwordStorage = passwordStorage;
	passwordEncryption = importJSONData.passwordEncryption;
	simplePrefs.prefs.passwordEncryption = passwordEncryption;
	proxy = importJSONData.proxy;
	simplePrefs.prefs.proxy = proxy;

	if(proxy) activateTorProxy();
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
	for(var i=0 ; i<importJSONData.passwords.length ; i++){
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

		let str = {};
		let read = 0;
		do {
		    read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
		    data += str.value;
		} while (read != 0);

		cstream.close(); // this closes fstream
	}
	return data;
}

function writeJSONFile(){
	if(write){
		 exportJSONData = {"bookmarks": [],"openTabs": [], "passwords":[], "passwordStorage" : passwordStorage,
			 "passwordEncryption" : passwordEncryption, "browser":"Firefox",
			 "proxy" : proxy, "refresh" : refresh
		 };
		 exportOpenTabsToJSON();
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
		importOpenTabsFromJSON();
		if(passwordStorage){
			importPasswordsFromJSON();
		}
	}
}

/*************** MAIN ***************/
clearTemporaryDataOnStartup();
clearPasswordsOnStartup();
readJSONFile();

//Defining observer for Firefox shutdown and password changes
let observerService = Cc["@mozilla.org/observer-service;1"].
	getService(Ci.nsIObserverService);
observerService.addObserver(action, "passwordmgr-storage-changed", false);
observerService.addObserver(action, "quit-application-requested", false);

//Defining observer for open tabs changes
tabs.on('ready', writeJSONFile);
tabs.on('close', writeJSONFile);

//Defining observer for prefs changes
simplePrefs.on("", writeJSONFile);
