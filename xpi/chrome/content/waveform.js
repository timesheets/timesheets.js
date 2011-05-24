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

//
// Waveform: cursor, file I/O, canvas
//

function timeCursor(timePos, timeSpan, canvas, mediaPlayer) {
  const self = this;

  // should be called whenever the canvas is resized
  this.getBoundingBox = function() {
    var rect = canvas.getBoundingClientRect();
    self.top    = rect.top;
    self.right  = rect.right;
    self.bottom = rect.bottom;
    self.left   = rect.left;
    self.height = rect.height;
    self.width  = rect.width;
  };
  this.getBoundingBox();


  // private methods
  function checkTime(time) {
    time = Math.max(time, gWaveform.begin);
    time = Math.min(time, gWaveform.end);
    return time;
  }
  function checkDuration(dur) {
    dur = Math.max(dur, 0);
    dur = Math.min(dur, (gWaveform.end - gWaveform.begin));
    return dur;
  }
  function getTimePosition(event) {
    // FIXME: doesn't work when the left sidebar is open
    //self.getBoundingBox(); // XXX
    var x = event.clientX - self.left;
    return px2time(x);
    //return percent2time(x);
  }
  function updateTimeCursor() {
    self.dur = checkDuration(self.end - self.begin);
    var left = time2percent(self.begin);
    var width = dur2percent(self.dur);
    if (!isNaN(left) && !isNaN(width)) {
      timeSpan.style.left  = left  + "%";
      timeSpan.style.width = width + "%";
    }
  };

  // unit = px (ugly)
  function dur2px(dur) {
    var duration = gWaveform.end - gWaveform.begin;
    return (canvas.width * dur / duration);
  }
  function time2px(time) {
    var duration = gWaveform.end - gWaveform.begin;
    return (canvas.width * (time - gWaveform.begin) / duration);
  }
  function px2time(x) {
    var duration = gWaveform.end - gWaveform.begin;
    //var width = canvas.width;
    //var width = parseInt(getComputedStyle(canvas, null).width);
    var width = self.width;
    return gWaveform.begin + (x * duration / width);
  }

  // unit = % (preferred)
  function dur2percent(dur) {
    var duration = gWaveform.end - gWaveform.begin;
    return (100 * dur / duration);
  }
  function time2percent(time) {
    var duration = gWaveform.end - gWaveform.begin;
    return (100 * (time - gWaveform.begin) / duration);
  }
  function percent2time(x) {
    var duration = gWaveform.end - gWaveform.begin;
    return gWaveform.begin + (x * duration / 100);
  }

  // public properties
  this.currentTime = 0;
  this.setCurrentTime = function(time) {
    self.currentTime = checkTime(time);
    //timePos.style.left = time2px(self.currentTime) + "px";
    var left = time2percent(self.currentTime);
    if (!isNaN(left))
      timePos.style.left = left + "%";
  };
  this.begin = 0;
  this.setBegin = function(time) {
    self.begin = checkTime(time);
    updateTimeCursor();
  };
  this.end = 0;
  this.setEnd = function(time) {
    self.end = checkTime(time);
    updateTimeCursor();
  };
  this.dur = 0;
  /* this.setDur = function(time) {
    self.dur = checkTime(time);
    //self.dur = Math.min(self.begin + self.dur, mediaPlayer.duration);
    console.log(self.dur);
    width = time2px(self.dur);
    timeSpan.style.width = width + "px";
  }; */
  this.clear = function(time) {
    self.setCurrentTime(time);
    self.begin = checkTime(time);
    self.end   = checkTime(time);
    updateTimeCursor();
  };
  this.zoomIn = function() {
    var offset, ratio;
    if (self.dur <= 0) {
      var duration = (gWaveform.end - gWaveform.begin) / 2;
      var begin = Math.max(self.begin - (duration / 2), 0);
      self.setBegin(begin);
      self.setEnd(begin + duration);
    }
    offset = time2px(self.begin);
    ratio  = (gWaveform.end - gWaveform.begin) / self.dur;
    //consoleLog("zoom: " + offset + " % " + ratio);
    gWaveform.zoomImage(offset, ratio);
  };
  this.zoomOut = function() {
    gWaveform.unzoomImage();
    //gDialog.timeSegments.style.MozTransform = "";
  };

  // canvas/mediaPlayer event handlers
  function onClick(event) {
    //if (event.button) return;
    switch (event.button) {
      case 0:
        var time = getTimePosition(event);
        self.setBegin(time);
        self.setEnd(time);
        //self.setDur(0);
        mediaPlayer.currentTime = time;
        break;
      /*
      case 1: // middle-click: zoom/unzoom
        if (self.dur <= 0)
          self.zoomOut();
        else
          self.zoomIn();
        break;
      */
      case 1: // middle-click: new segment
        newSegment();
        break;
      default:
        break;
    }
  }
  function onDrag(event) {
    if (event.button) return;
    var begin = mediaPlayer.currentTime;
    var end = getTimePosition(event);
    //self.setDur(end - begin);
    if (end > begin)
      self.setEnd(end);
    else
      self.setBegin(end);
  }
  function onTimeUpdate(event) {
    var time = mediaPlayer.currentTime;
    self.setCurrentTime(time);
    if ((time > gWaveform.end)
        || ((self.dur > 0.1) && (time > self.end))) {
      mediaPlayer.pause();
      mediaPlayer.currentTime = self.begin;
    }
  }
  canvas.addEventListener("mousedown", function(event) {
    onClick(event);
    canvas.addEventListener("mousemove", onDrag, false);
  }, false);
  canvas.addEventListener("mouseup", function(event) {
    canvas.removeEventListener("mousemove", onDrag, false);
    mediaPlayer.currentTime = Math.min(self.begin, self.end);
  }, false);
  mediaPlayer.addEventListener("timeupdate", onTimeUpdate, false);
}

function pcmFile(wavFile, duration, chunkDuration) {
  var iStream; // input stream handler
  var bStream; // binary stream handler
  var header;  // WAV header

  /* We're expecting a PCM/8 file here, i.e. an 8-bit encoded WAV file.
   * SoX can be used to get such a file from an OGG source:
   *   sox audio.ogg -b 8 audio.wav
   * to mix all channels into a mono file: (both commands are equivalent)
   *   sox audio.ogg -b 8 audio.wav channels 1
   *   sox audio.ogg -b 8 audio.wav remix -
   * to reduce the sample rate:
   *   sox audio.ogg -b 8 audio.wav rate 16k
   */

  this.draw = function(context, begin, end) {
    //consoleLog("drawPCM: " + begin + " → " + end);
    var height = context.canvas.height;
    var width  = context.canvas.width;
    var canvasWidth = parseInt(getComputedStyle(context.canvas, null).width, 10);
    gDialog.canvasWidth.value = canvasWidth;

    /* open WAV file
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
    var wavFile = Components.classes["@mozilla.org/file/local;1"]
                            .createInstance(Components.interfaces.nsILocalFile);
    wavFile.initWithPath(filePath);
    */

    // get a binary stream for the WAV file
    iStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                        .createInstance(Components.interfaces.nsIFileInputStream);
    bStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                        .createInstance(Components.interfaces.nsIBinaryInputStream);
    iStream.init(wavFile, -1, -1, false);
    bStream.setInputStream(iStream);

    /* about nsISeekableStream, see:
     * http://mxr.mozilla.org/mozilla-central/source/xpcom/io/nsISeekableStream.idl
     * http://mxr.mozilla.org/mozilla-central/source/netwerk/test/unit/test_file_partial_inputstream.js
     */
    iStream.QueryInterface(Components.interfaces.nsISeekableStream);

    // read the 44-byte header and compute chunkSize
    header = bStream.readByteArray(44);
    var length = bStream.available() - 44;
    var offset = 44 + (begin / duration * length);
    var ratio = (end - begin) / duration;
    var segLength = (length / width) * ratio;
    //var segLength = (length / canvasWidth) * ratio;
    var chunkSize = length * chunkDuration / (1000 * duration);
    if ((chunkSize <= 0) || (chunkSize > segLength))
      chunkSize = segLength;

    // draw canvas segments
    for (var i = 0; i < width; i++) {
    //for (var i = 0; i < canvasWidth; i++) {
      // jump to the next segment
      iStream.seek(0, offset + i * segLength);
      // get min/max amplitude values
      let samples = bStream.readByteArray(chunkSize);
      var min = Math.min.apply(Math, samples) * height / 256;
      var max = Math.max.apply(Math, samples) * height / 256;
      // draw enveloppe segment
      context.beginPath();
      context.moveTo(i + 0.5, min);
      context.lineTo(i + 0.5, max);
      context.stroke();
    }

    // close the WAV file
    iStream.close();
    bStream.close();
  };
}

function pcmWaveformGraph(canvas, duration) {
  const self = this;
  const context = canvas.getContext("2d");
  const pcmCanvasColor = "#000";
  const oggCanvasColor = "#f00";

  this.begin = NaN; // visible area -- begin time
  this.end   = NaN; // visible area -- end time

  this.clear = function() {
    context.strokeStyle = pcmCanvasColor;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
    context.strokeRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 0.5;
    context.strokeRect(0, canvas.height / 4 - 0.5, canvas.width, canvas.height / 2 + 1);
  };

  // draw PCM/8 data (= 8-bit encoded WAV files)
  var wavFile;   // private pcmFile instance
  var localFile; // private nsILocalFile instance
  this.drawPCM = function(aLocalFile, chunkDuration) {
    redrawSegmentBlocks(0, duration);
    var t1 = Date.now();
    this.clear();
    context.lineWidth = 0.7;
    context.strokeStyle = pcmCanvasColor;
    if (aLocalFile) localFile = aLocalFile;
    wavFile = new pcmFile(localFile, duration, chunkDuration);
    wavFile.draw(context, 0, duration);
    var t2 = Date.now();
    this.begin = 0;
    this.end = duration;
    return (t2 - t1);
  };
  this.drawPartialPCM = function(begin, end) {
    if (!wavFile) return NaN;
    var t1 = Date.now();
    this.clear();
    context.lineWidth = 0.7;
    context.strokeStyle = pcmCanvasColor;
    wavFile.draw(context, begin, end);
    var t2 = Date.now();
    this.begin = begin;
    this.end   = end;
    return (t2 - t1);
  };

  // draw from media frameBuffer (audio API)
  this.drawFrameBuffer = function(event) {
    var time    = event.time;
    var samples = event.frameBuffer;
    //if (samples.length != event.target.mozFrameBufferLength)
      //console.log("unexpected fbLength: " + samples.length);

    // get min/max amplitude values
    var min = Math.min.apply(Math, samples);
    var max = Math.max.apply(Math, samples);
    var y1 = (min + 1) * (canvas.height / 2);
    var y2 = (max + 1) * (canvas.height / 2);
    var x = (time - self.begin) * canvas.width / (self.end - self.begin);

    // draw enveloppe segment
    context.strokeStyle = oggCanvasColor;
    context.beginPath();
    context.moveTo(x, y1);
    context.lineTo(x, y2);
    context.stroke();
  };

  // zoom|unzoom current image (e.g. before a 'real' redraw)
  this.zoomImage = function(offset, ratio) {
    var begin = gTimeCursor.begin;
    var end   = gTimeCursor.end;
    let image = new Image();
    image.src = canvas.toDataURL("image/png");
    image.onload = function() {
      redrawSegmentBlocks(begin, end);
      self.clear();
      gTimeCursor.clear();
      context.drawImage(image,
        (0 - offset) * ratio, 0,
        canvas.width * ratio, canvas.height
      );
      setTimeout(function() {
        var time = self.drawPartialPCM(begin, end);
        timeReport(time, "zoom");
        gTimeCursor.clear((begin + end) / 2);
        //gTimeCursor.clear();
        //gTimeCursor.center();
      }, gDialog.zoomDelay.value);
    };
  };
  this.unzoomImage = function() {
    var dur = self.end - self.begin;
    var begin = Math.max(self.begin - dur/2, 0);
    var end   = Math.min(self.end + dur/2, duration);
    //self.drawPartialPCM(begin, end);
    var ratio = dur / (end - begin);
    var offset = canvas.width * (self.begin - begin) / (end - begin);
    let image = new Image();
    image.src = canvas.toDataURL("image/png");
    image.onload = function() {
      redrawSegmentBlocks(begin, end);
      self.clear();
      gTimeCursor.clear();
      context.drawImage(image,
        offset, 0,
        canvas.width * ratio, canvas.height
      );
      setTimeout(function() {
        var time = self.drawPartialPCM(begin, end);
        timeReport(time, "unzoom");
        gTimeCursor.clear((begin + end) / 2);
        //gTimeCursor.clear();
        //gTimeCursor.center();
      }, gDialog.zoomDelay.value);
    };
  };

  // save as PNG image (untested)
  this.saveAsPNG = function(filePath) {
    // https://developer.mozilla.org/en/Code_snippets/Canvas
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

    // convert string filePath to an nsIFile
    var file = Components.classes["@mozilla.org/file/local;1"]
                         .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(filePath);

    // create a data url from the canvas and then create URIs of the source and targets
    var io = Components.classes["@mozilla.org/network/io-service;1"]
                       .getService(Components.interfaces.nsIIOService);
    var source = io.newURI(canvas.toDataURL("image/png", ""), "UTF8", null);
    var target = io.newFileURI(file)

    // prepare to save the canvas data
    var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                            .createInstance(Components.interfaces.nsIWebBrowserPersist);

    persist.persistFlags  = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    persist.persistFlags |= Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

    /* displays a download dialog (remove these 3 lines for silent download)
    var xfer = Components.classes["@mozilla.org/transfer;1"]
                         .createInstance(Components.interfaces.nsITransfer);
    xfer.init(source, target, "", null, null, null, persist);
    persist.progressListener = xfer;
    */

    // save the canvas data to the file
    persist.saveURI(source, null, null, null, null, file);
  };
}

//
// UI tests
//

function drawWaveform(aWaveformFile) {
  var chunkDuration = parseInt(gDialog.chunkDuration.value);
  var time = gWaveform.drawPCM(aWaveformFile, chunkDuration);
  timeReport(time);
  //gDialog.timeSegments.style.MozTransform = "";
}

function timeReport(time, msg) {
  var str = (time / 1000) + "s";
  if (msg && msg.length)
    str = msg + ": " + str;
  //document.getElementById("time").innerHTML = str;
  gDialog.elapsedTime.value = str;
}

//
// Media Player (useless atm)
//

function togglePlayPause() {
  if (gMediaPlayer.paused)
    gMediaPlayer.play();
  else
    gMediaPlayer.pause();
}

function getMetaData(event) {
  var mediaPlayer = event.target;
  var channels = mediaPlayer.mozChannels;
  var fbLength = mediaPlayer.mozFrameBufferLength;
  var rate     = mediaPlayer.mozSampleRate;
  var duration = mediaPlayer.duration;
  console.log("channels: " + channels);
  console.log("frame buffer length: " + fbLength);
  console.log("rate: " + rate + " Hz");
  mediaPlayer.currentTime = 0;
}

