/*- ***** BEGIN LICENSE BLOCK *****
  - Version: MPL 1.1/GPL 2.0/LGPL 2.1
  -
  - The contents of this file are subject to the Mozilla Public License Version
  - 1.1 (the "License"); you may not use this file except in compliance with
  - the License. You may obtain a copy of the License at
  - http://www.mozilla.org/MPL/
  -
  - Software distributed under the License is distributed on an "AS IS" basis,
  - WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
  - for the specific language governing rights and limitations under the
  - License.
  -
  - The Original Code is INRIA.
  -
  - The Initial Developer of the Original Code is INRIA.
  - Portions created by the Initial Developer are Copyright (C) 2010-2011
  - the Initial Developer. All Rights Reserved.
  -
  - Contributor(s):
  -    Fabien Cazenave <fabien@cazenave.cc>
  -
  - Alternatively, the contents of this file may be used under the terms of
  - either the GNU General Public License Version 2 or later (the "GPL"), or
  - the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
  - in which case the provisions of the GPL or the LGPL are applicable instead
  - of those above. If you wish to allow use of your version of this file only
  - under the terms of either the GPL or the LGPL, and not to allow others to
  - use your version of this file under the terms of the MPL, indicate your
  - decision by deleting the provisions above and replace them with the notice
  - and other provisions required by the LGPL or the GPL. If you do not delete
  - the provisions above, a recipient may use your version of this file under
  - the terms of any one of the MPL, the GPL or the LGPL.
  -
  - ***** END LICENSE BLOCK *****/

// hide location bar, requires Gecko 2+ (Firefox 4+)
// https://developer.mozilla.org/en/Hiding_browser_chrome
try {
  var prevFunc = XULBrowserWindow.hideChromeForLocation;
  XULBrowserWindow.hideChromeForLocation = function(aLocation) {
    return (/^chrome:\/\/timesheets\//i.test(aLocation)) || prevFunc.apply(XULBrowserWindow, [aLocation]);
  }
} catch(e) {}

// open chrome://timesheets/content/ in a new tab, or reuse existing tab
// https://developer.mozilla.org/en/Code_snippets/Tabbed_browser#Reusing_tabs
function openAndReuseOneTabPerURL(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var browserEnumerator = wm.getEnumerator("navigator:browser");
 
  // Check each browser instance for our URL
  var found = false;
  while (!found && browserEnumerator.hasMoreElements()) {
    var browserWin = browserEnumerator.getNext();
    var tabbrowser = browserWin.gBrowser;
 
    // Check each tab of this browser instance
    var numTabs = tabbrowser.browsers.length;
    for (var index = 0; index < numTabs; index++) {
      var currentBrowser = tabbrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec) {
 
        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
 
        // Focus *this* browser-window
        browserWin.focus();
 
        found = true;
        break;
      }
    }
  }
 
  // Our URL isn't open. Open it now.
  if (!found) {
    var recentWindow = wm.getMostRecentWindow("navigator:browser");
    if (recentWindow) {
      // Use an existing browser window
      recentWindow.delayedOpenTab(url, null, null, null, null);
    }
    else {
      // No browser windows are open, so open a new one.
      window.open(url);
    }
  }
}

function openTimesheetComposer() {
  openAndReuseOneTabPerURL("chrome://timesheets/content/timesheets.xul");
}
