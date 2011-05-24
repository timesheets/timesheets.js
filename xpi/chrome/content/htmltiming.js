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

const htmlNS  = "http://www.w3.org/1999/xhtml";
const xulNS   = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
const SCENARI = false;
const DEBUG   = false;

var gDialog = {};       // UI elements
var gMediaPlayer;       // <audio|video> element
var gTimeCursor;        // div#timePos|div#timeSpan elements and methods
var gWaveform;          // <canvas> element and methods
var gTimeSegments = []; // time segment array

function startup() {
  gDialog.waveformZoom     = document.getElementById("waveformZoom");
  gDialog.waveformGraph    = document.getElementById("waveformGraph");
  //gDialog.waveformZoom     = document.getElementsByTagNameNS(htmlNS, "canvas").item(0);
  //gDialog.waveformGraph    = document.getElementsByTagNameNS(htmlNS, "canvas").item(1);
  gDialog.timePos          = document.getElementById("timePos");
  gDialog.timeSpan         = document.getElementById("timeSpan");

  //gDialog.audioPlayer      = document.getElementById("audioPlayer");
  gDialog.audioPlayer      = document.getElementsByTagNameNS(htmlNS, "audio").item(0);
  gDialog.videoPlayer      = document.getElementsByTagNameNS(htmlNS, "video").item(0);
  gMediaPlayer = gDialog.audioPlayer; // XXX use the <deck> properties here

  // media
  gDialog.mediaBaseURI     = document.getElementById("mediaBaseURI");
  gDialog.mediaSource      = document.getElementById("mediaSource");
  gDialog.mediaWaveform    = document.getElementById("mediaWaveform");

  // params
  //gDialog.waveformFilePath = document.getElementById("waveformFilePath");
  //gDialog.mediaFilePath    = document.getElementById("mediaFilePath");
  gDialog.chunkDuration    = document.getElementById("chunkDuration");
  gDialog.zoomDelay        = document.getElementById("zoomDelay");
  gDialog.downloadButton   = document.getElementById("downloadButton");
  gDialog.downloadProgress = document.getElementById("downloadProgress");

  // outputs
  gDialog.elapsedTime      = document.getElementById("elapsedTime");
  gDialog.canvasWidth      = document.getElementById("canvasWidth");
  gDialog.console          = document.getElementById("console");

  // content
  gDialog.content          = document.getElementById("content");
  gDialog.segmentTemplate  = document.getElementById("segmentTemplate");
  gDialog.timeSegments     = document.getElementById("timeSegments");
  gDialog.timeContainer    = document.getElementById("timeContainer");

  // thumbnails
  gDialog.sidebarLeft      = document.getElementById("sidebar-left");

  consoleLog("startup");

  // disable right-click on all HTML elements
  // XXX I can't believe there's no better way to do that
  if (!DEBUG) {
    var elements = document.getElementsByTagNameNS(htmlNS, "*");
    for (var i = 0; i < elements.length; i++) {
      //elements[i].setAttribute("oncontextmenu", "return false;");
      elements[i].addEventListener("contextmenu", function(event) {
        if (/^html/i.test(event.target.nodeName))
          event.preventDefault();
      }, true);
    }
  }

  // create the waveform graph when the media player is ready
  gMediaPlayer.addEventListener("loadedmetadata", function() {
    gWaveform = new pcmWaveformGraph(gDialog.waveformGraph, gMediaPlayer.duration);
    gWaveform.clear();
    // Audio API: update waveform graph as the media is played
    gMediaPlayer.addEventListener("MozAudioAvailable", gWaveform.drawFrameBuffer, false);
    //gMediaPlayer.mozFrameBufferLength = 16384; // max = 16384, default = 1024 * nbChannels
  }, false);

  // canvas event handlers
  gTimeCursor = new timeCursor(
    gDialog.timePos,
    gDialog.timeSpan,
    gDialog.waveformGraph,
    gMediaPlayer
  );

  // Load default media files
  loadMediaFiles();
}

function consoleLog(message) {
  gDialog.console.value += message + "\n" ;
}

/* testing: get the document folder and the default audio track+waveform
function getFilePicker(aTitle, aFileExt, aFallback) {
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, aTitle, nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    aFallback(fp);
  }
}
function getMediaFile() {
  getFilePicker("Choose media file", "", function(fp) {
    gDialog.mediaFilePath.value = fp.file.leafName;
    try {
      console.log(fp.file.path);
      console.log(fp.fileURL.spec);
      gDialog.audioPlayer.src = fp.fileURL.spec;
    } catch(e) {
      console.log(e);
    }
  });
}
function getWaveformFile() {
  getFilePicker("Choose waveform file", "", function(fp) {
    gDialog.waveformFilePath.value = fp.file.path;
    console.log(fp.file.path);
    drawWaveform();
  });
} */

function loadMediaFiles(aForceReload) {
  // get media URLs
  var baseURL = gDialog.mediaBaseURI.value;
  var mediaSource   = baseURL + gDialog.mediaSource.value;
  var mediaWaveform = baseURL + gDialog.mediaWaveform.value;

  // get a temp file for the local waveform data
  var waveformFile = Components.classes["@mozilla.org/file/directory_service;1"]
                               .getService(Components.interfaces.nsIProperties)
                               .get("TmpD", Components.interfaces.nsIFile);
  waveformFile.append(gDialog.mediaWaveform.value);

  // load the remote media source in the HTML5 media player
  gMediaPlayer.src = mediaSource;

  // draw as soon as the media's metadata is ready
  function draw() {
    setTimeout(function() { // XXX why do we need a delay here?
      drawWaveform(waveformFile);
    }, 500);
  }

  // if a temp file is already available, use it and exit
  if (waveformFile.exists() && !aForceReload) {
    consoleLog(waveformFile.path + " already cached.");
    draw();
    return;
  }
   
  // get a URI for the remote waveform data
  var mediaWaveformURI = Components.classes["@mozilla.org/network/io-service;1"]
                                   .getService(Components.interfaces.nsIIOService)
                                   .newURI(mediaWaveform, null, null);

  // download waveform data with nsIWebBrowserPersist
  // https://developer.mozilla.org/en/Code_snippets/Downloading_Files
  // XXX (nsIDownloadManager might be simpler for this)
  const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
  var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                          .createInstance(nsIWBP);
  persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES
                       | nsIWBP.PERSIST_FLAGS_FROM_CACHE;
  persist.progressListener = {
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      gDialog.downloadProgress.value = 100 * aCurTotalProgress / aMaxTotalProgress;
    },
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (aStateFlags & 0x10) { // finished, failed or canceled
        gDialog.downloadProgress.style.visibility = "hidden";
        consoleLog(waveformFile.path + " downloaded.");
        draw();
      }
    }
  }
  gDialog.downloadProgress.style.visibility = "visible";
  persist.saveURI(mediaWaveformURI, null, null, null, "", waveformFile);
}

// time segments
function newSegment() {
  var begin = Math.round(gTimeCursor.begin * 100) / 100;
  var end   = Math.round(gTimeCursor.end   * 100) / 100;
  if (begin == end)
    end = Infinity;
  gTimeSegments.push(new timeSegment(begin, end));
}
function delSegment(timeSegment) {
  var i = gTimeSegments.indexOf(timeSegment);
  if (i >= 0) {
    var ctrl = gTimeSegments[i].controls;
    var blck = gTimeSegments[i].block;
    ctrl.main.parentNode.removeChild(ctrl.main);
    blck.main.parentNode.removeChild(blck.main);
    gTimeSegments.splice(i, 1);
  }
}
function sortSegments() {
  var swap, data1, data2;
  do { // there are few items, we can do a lazy bubble sort
    swap = false;
    for (var i = 0; i < gTimeSegments.length - 1; i++) {
      //consoleLog("order #" + i);
      var curr = gTimeSegments[i];
      var next = gTimeSegments[i+1];
      if (curr.begin > next.begin) { // swap these two items
        consoleLog("swap #" + i);
        data1 = curr.controls.data.value;
        data2 = next.controls.data.value;
        gDialog.content.insertBefore(next.controls.main, curr.controls.main);
        gDialog.timeSegments.insertBefore(next.block.main, curr.block.main);
        curr.controls.data.value = data1;
        next.controls.data.value = data2;
        gTimeSegments[i]   = next;
        gTimeSegments[i+1] = curr;
        swap = true;
      }
    }
  } while(swap);
}

// redraw time blocks
function redrawSegmentBlocks(aBegin, aEnd) {
  consoleLog("redraw");
  for (var i = 0; i < gTimeSegments.length; i++) {
    gTimeSegments[i].block.draw(aBegin, aEnd);
  }
}
function computeTimeNodes() { // XXX
  sortSegments();
  if (!gDialog.timeContainer) return;
  var timeContainer = gDialog.timeContainer.value;
  consoleLog(timeContainer);
  for (var i = 0; i < gTimeSegments.length - 1; i++) {
    var out;
    var end = gTimeSegments[i].end;
    //if (!end.length) end = Infinity;
    //consoleLog("end = " + end);
    if ((timeContainer == "par") || (end < gTimeSegments[i+1].begin))
      out = gTimeSegments[i].end;
    else
      out = gTimeSegments[i+1].begin;
    gTimeSegments[i].time_in = gTimeSegments[i].begin;
    gTimeSegments[i].time_out = out;
    gTimeSegments[i].block.update();
  }
  redrawSegmentBlocks(gWaveform.begin, gWaveform.end);
}

// main 'timeSegment' object
function timeSegment(begin, end) {
  consoleLog(begin + " → " + end);
  const self = this;

  this.begin = begin;
  this.end   = end;

  this.time_in  = begin;
  this.time_out = end;

  // append a XUL groupbox in #content
  var controls = new segmentControls(this, begin, end);
  gDialog.content.appendChild(controls.main);

  // append an HTML segment in #timeSegments
  var block = new segmentBlock(this, begin, end);
  gDialog.timeSegments.appendChild(block.main);

  // append a thumbnail in #sidebar-left
  var thumb = new segmentThumb(this, begin, end);
  gDialog.sidebarLeft.appendChild(thumb.main);

  this.update = function(aBegin, aEnd) {
    self.begin = aBegin;
    self.end   = aEnd;
    block.update();
    computeTimeNodes();
    updateCursor();
  };

  // event handlers
  function updateCursor() {
    //gTimeCursor.setBegin(self.begin);
    //gTimeCursor.setEnd(self.end);
    //gMediaPlayer.currentTime = self.begin;
    gTimeCursor.setBegin(self.time_in);
    gTimeCursor.setEnd(self.time_out);
    gMediaPlayer.currentTime = self.time_in;
  }

  // event handlers :: segmentBlock
  block.begin.onclick = function() {
    // TODO
  };
  block.end.onclick = function() {
    // TODO
  };
  block.main.addEventListener("mouseup", function(event) {
    switch (event.button) {
      case 0:
        controls.focus();
        thumb.focus();
        updateCursor();
        break;
      case 1:
        consoleLog("delete current time node");
        delSegment(self);
        break;
    }
  }, false);
  block.main.addEventListener("dblclick", function(event) {
    consoleLog("select current time node");
    updateCursor();
    gTimeCursor.zoomIn();
  }, false);

  // event handlers :: segmentControls
  controls.begin.oninput = function() {
    var value = hms2time(this.value);
    consoleLog("update: " + value);
    self.update(value, self.end);
  };
  controls.end.oninput = function() {
    var value = hms2time(this.value);
    consoleLog("update: " + value);
    self.update(self.begin, value);
  };
  controls.data.onfocus = function() {
    block.focus();
    updateCursor();
  };
  controls.data.onblur = function() {
    block.blur();
  };

  // focus the new time node
  controls.data.focus();
  controls.data.select();

  // expose 'controls' and 'block'
  this.controls = controls;
  this.block    = block;
}

// <hbox> block for the #timeSegments container
function segmentBlock(parent, begin, end) {
  var self = this;

  // note: the 'main' element could be an <html:div> block
  // but the contextual menu wouldn't work (see 'context' attribute)
  this.main  = document.createElementNS(xulNS, "hbox"); // main block
  this.begin = document.createElementNS(htmlNS, "div"); // left handle
  this.end   = document.createElementNS(htmlNS, "div"); // right handle

  this.begin.className = "handle-left";
  this.end.className   = "handle-right";
  this.main.appendChild(this.begin);
  this.main.appendChild(this.end);
  if (!SCENARI)
    this.main.setAttribute("context", "transition");

  this.draw = function (aWaveformBegin, aWaveformEnd) {
    var left  = Math.max(parent.time_in,  aWaveformBegin);
    var right = Math.min(parent.time_out, aWaveformEnd);

    if (left >= right) {
      self.main.style.display = "none";
    } else {
      var duration = aWaveformEnd - aWaveformBegin;
      var ratio = (right - left) / duration;
      var offset = (left - aWaveformBegin) / duration;
      //self.main.style.left  = (offset * gTimeCursor.width) + "px";
      //self.main.style.width = (ratio  * gTimeCursor.width) + "px";
      self.main.style.left  = (offset * 100) + "%";
      self.main.style.width = (ratio  * 100) + "%";
      self.main.style.display = "block";
    }
  };
  this.update = function () {
    self.draw(gWaveform.begin, gWaveform.end);
  };
  this.update();

  this.focus = function () {
    self.main.className = "active";
  };
  this.blur = function () {
    self.main.removeAttribute("class");
  };

  // Event listeners: begin/end drag
  function onClick(event) {
  }
  function onResize(event) {
    return; // XXX
    if (event.button) return;
    var begin = mediaPlayer.currentTime;
    var end = getTimePosition(event);
    //self.setDur(end - begin);
    if (end > begin)
      self.setEnd(end);
    else
      self.setBegin(end);
  }
  this.begin.addEventListener("mousedown", function(event) {
    onClick(event);
    self.begin.addEventListener("mousemove", onResize, false);
  }, false);
}

// <groupbox> control for the #content container
function segmentControls(parent, begin, end) {
  var self = this;

  // TODO design an XBL instead of this ugly thing
  this.main  = gDialog.segmentTemplate.cloneNode(true);
  this.begin = this.main.getElementsByTagName("textbox").item(0);
  this.end   = this.main.getElementsByTagName("textbox").item(1);
  this.data  = this.main.getElementsByTagName("textbox").item(2);

  this.main.removeAttribute("id");
  this.main.removeAttribute("hidden");
  this.begin.setAttribute("value", time2hms(begin));
  this.end.setAttribute("value", time2hms(end));

  function hmsFormat() {
    if (/^[0-9]*[\.]{0,1}[0-9]*$/.test(this.value))
      this.value = time2hms(this.value);
  }
  this.begin.onchange = hmsFormat;
  this.end.onchange   = hmsFormat;

  this.focus = function () {
    consoleLog(self.data.value);
    self.data.focus();
  };
  this.blur = function () {
    self.data.blur();
  };
}

// thumbnails
function segmentThumb(parent, begin, end) {
  var self = this;

  // TODO fill with <canvas> and transition class
  this.main  = document.createElementNS(xulNS, "hbox"); // main block

  this.focus = function () {
    self.main.className = "active";
  };
  this.blur = function () {
    self.main.removeAttribute("class");
  };
}

// convert seconds (float) to a time string (0:00 or 0:00:00)
function time2hms(time) {
  if (isNaN(time) || time >= Infinity || time == 0)
    return "";
  seconds = Math.round(time * 100) / 100;
  var sec = seconds % 60;
  sec = Math.round(sec * 100) / 100;
  var str = sec;
  if (sec < 10)
    str = "0" + str;
  var minutes = Math.floor(seconds / 60);
  min = minutes % 60;
  str = min + ":" + str;
  if (!gMediaPlayer || (gMediaPlayer.duration < 3600)) return str;
  if (min < 10)
    str = "0" + str;
  var h = Math.floor(minutes / 60);
  str = h + ":" + str;
  return str;
}
function hms2time(hms) {
  var seconds = 0;
  var tmp = hms.split(":");
  for (var i = 0; i < tmp.length; i++)
    seconds = (seconds * 60) + parseFloat(tmp[i]);
  return seconds;
}

