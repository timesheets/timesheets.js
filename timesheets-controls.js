/* Copyright (c) 2010 Fabien Cazenave, INRIA <http://wam.inrialpes.fr/>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/*
 * author      : Fabien Cazenave (:kaze)
 * contact     : fabien.cazenave@inria.fr, kaze@kompozer.net
 * license     : MIT
 * version     : 0.4.1
 * last change : 2011-03-30
 */

(function(){

/*****************************************************************************\
|                                                                             |
| This library adds 'timeController' support to timesheets.js:                |
|   * new 'controls' attribute for time containers                            |
|       refers to a timeController element in the HTML document (CSS query)   |
|   * the 'timeController' element follows a specific microformat             |
|       all timeController features are described by a 'smil-*' class         |
|                                                                             |
| As this is *NOT* part of the SMIL/Timing recommendation:                    |
|   * the microformat syntax is likely to change in upcoming versions         |
|   * this can be rather easily extended to support additional features       |
|                                                                             |
\*****************************************************************************/

// supported/planned timeController properties
var kProperties = [
  // Control buttons
  "controlBar",                    // main bar
  "play",                          // play|pause button
  "first", "prev", "next", "last", // first|prev|next|last buttons

  // Table of Contents
  "toc",                           // ToC container
  "tocList",                       // ToC nested link list
  "tocTitles",                     // ToC header list (unsupported)
  "tocDisplay",                    // ToC display button

  // Timeline
  "timeline",                      // timeline container (relative positioning)
  "timeCursor",                    // timeline cursor (position in %)
  "timeSlider",                    // timeline slider (width in %)
  "timeSegments",                  // timeline links/segments (width in %)

  // Elapsed time
  "currentTime",                   // current time (text)
  "duration",                      // total duration (text) (unsupported)

  // Slide index (unsupported)
  "currentIndex",                  // current slide index (seq|excl containers)
  "length"                         // number of time nodes in the time container
];


// ===========================================================================
// Control Buttons
// ===========================================================================

// Play|Pause button
smilTimeController.prototype.playButtonHandler = function() {
  var controlElement = this.controlElement;
  var mediaAPI = this.timeContainer.mediaSyncAPI;
  if (!mediaAPI || !this.play) return; // XXX

  // helpers
  var re = (/(^|\s+)(playing|paused|seeking)(\s+|$)/i);
  if (!re.test(controlElement.className))
    controlElement.className += " seeking";
  function updatePlayState() {
    var className = controlElement.className;
    //if (mediaAPI.seeking || (mediaAPI.readyState <= 2)) // || !mediaAPI.duration)
    if (mediaAPI.seeking)
      controlElement.className = className.replace(re, " seeking");
    else if (mediaAPI.paused)
      controlElement.className = className.replace(re, " paused");
    else
      controlElement.className = className.replace(re, " playing");
  }
  function togglePlayPause() {
    /* enable these two lines to ignore clicks when the media isn't ready
    if ((/(^|\s+)seeking(\s+|$)/i).test(controlElement.className))
      return;
    */
    if (mediaAPI.paused) {
      controlElement.className = controlElement.className.replace(re, " seeking");
      mediaAPI.play();
    } else
      mediaAPI.pause();
    //updatePlayState(); // useless?
  }

  // event listeners
  EVENTS.bind(this.play, "click", togglePlayPause);
  mediaAPI.addEventListener("play",     updatePlayState, false);
  mediaAPI.addEventListener("playing",  updatePlayState, false);
  mediaAPI.addEventListener("pause",    updatePlayState, false);
  mediaAPI.addEventListener("seeked",         updatePlayState, false);
  mediaAPI.addEventListener("canplay",        updatePlayState, false);
  mediaAPI.addEventListener("progress",       updatePlayState, false);
  mediaAPI.addEventListener("loadeddata",     updatePlayState, false);
  mediaAPI.addEventListener("loadedmetadata", updatePlayState, false);
  mediaAPI.addEventListener("ended", function() {
    mediaAPI.pause();
    //updatePlayState();
  }, false);
  updatePlayState();
};

// first|prev|next|last buttons
smilTimeController.prototype.navButtonHandler = function() {
  var timeContainer = this.timeContainer;
  if (this.first) EVENTS.bind(this.first, "click", function() {
    timeContainer.selectIndex(0);
  });
  if (this.prev) EVENTS.bind(this.prev, "click", function() {
    timeContainer.selectIndex(timeContainer.currentIndex - 1);
  });
  if (this.next) EVENTS.bind(this.next, "click", function() {
    timeContainer.selectIndex(timeContainer.currentIndex + 1);
  });
  if (this.last) EVENTS.bind(this.last, "click", function() {
    timeContainer.selectIndex(timeContainer.timeNodes.length - 1);
  });
};


// ===========================================================================
// Timeline
// ===========================================================================

// experimental: auto-resize timeline
if (!window.getComputedStyle) getComputedStyle = function(element, zilch) {
  return element.currentStyle; // OLDIE
};
function parseRound(string) {
  var value = parseFloat(string);
  return (isNaN(value)) ? 0 : Math.ceil(value);
}
smilTimeController.prototype._setTimelineWidth = function() {
  if (!this.timeline) return;

  // get the inner width of the timeline parent
  var siblings = this.timeline.parentNode.childNodes;
  var style = getComputedStyle(this.timeline.parentNode, null);
  var width = parseFloat(style.width);
  if (isNaN(width)) return;

  // get the available width for the timeline itself
  var timelineWidth = 0;
  for (var i = 0; i < siblings.length; i++) {
    if (siblings[i].nodeType == 1) { // element node
      style = getComputedStyle(siblings[i], null);
      if (siblings[i] == this.timeline)
        timelineWidth = parseRound(style.width);
      else
        width -= parseRound(style.width);
      width -= parseRound(style.marginLeft);
      width -= parseRound(style.marginRight);
      width -= parseRound(style.paddingLeft);
      width -= parseRound(style.paddingRight);
      width -= parseRound(style.borderLeftWidth);
      width -= parseRound(style.borderRightWidth);
    }
  }

  // apply width if necessary and possible
  if ((timelineWidth < 50) && (width > 0))
    this.timeline.style.width = width + "px";
  //alert(width);
};
smilTimeController.prototype.setTimelineWidth = function(forceRedraw) {
  if (!this.timeline) return;

  // get the inner width of the timeline parent
  var siblings  = this.timeline.parentNode.childNodes;
  var boundRect = this.timeline.parentNode.getBoundingClientRect();
  var width = boundRect.right - boundRect.left;

  // get the available width for the timeline itself
  var timelineWidth = 0;
  for (var i = 0; i < siblings.length; i++) {
    if (siblings[i].nodeType == 1) { // element node
      boundRect = siblings[i].getBoundingClientRect();
      var sibWidth = boundRect.right - boundRect.left;
      if (siblings[i] == this.timeline)
        timelineWidth = sibWidth;
      else
        width -= parseRound(sibWidth);
      var style = getComputedStyle(siblings[i], null);
      width -= parseRound(style.marginLeft);
      width -= parseRound(style.marginRight);
      width -= parseRound(style.paddingLeft);
      width -= parseRound(style.paddingRight);
      width -= parseRound(style.borderLeftWidth);
      width -= parseRound(style.borderRightWidth);
    }
  }

  // apply width if necessary (= not set by CSS) and possible
  if (!window.XMLHttpRequest) // OLDIE: IE6
    width -= 20; // XXX ugly hack, FIXME!
  if (forceRedraw || ((timelineWidth < 50) && (width > 0)))
    this.timeline.style.width = width + "px";
  else
    width = timelineWidth;
  // store the result
  this.timelineWidth = width;
};

// 'timeupdate' event handler
smilTimeController.prototype.timeUpdateHandler = function() {
  var duration = this.timeContainer.dur;
  var mediaAPI = this.timeContainer.mediaSyncAPI;
  if (!mediaAPI) return;

  // convert seconds (integer) to a time string (0:00 or 0:00:00)
  function toTimeStr(seconds) {
    seconds = Math.floor(seconds);
    var sec = seconds % 60;
    var str = sec;
    if (sec < 10)
      str = "0" + str;
    var minutes = Math.floor(seconds / 60);
    min = minutes % 60;
    str = min + ":" + str;
    if (duration < 3600) return str;
    if (min < 10)
      str = "0" + str;
    var h = Math.floor(minutes / 60);
    str = h + ":" + str;
    return str;
  }

  // update time cursor (text value and cursor position)
  var currentTime = this.currentTime;
  var timeCursor  = this.timeCursor;
  var timeSlider  = this.timeSlider;
  var self = this;
  if (currentTime || timeCursor || timeSlider) {
    mediaAPI.addEventListener("timeupdate", function() {
      if (self.timelineDragging) return;
      var time = mediaAPI.currentTime;
      var pos = (100 * time / duration) + "%";
      if (currentTime) currentTime.innerHTML = toTimeStr(time);
      if (timeCursor)  timeCursor.style.left  = pos;
      if (timeSlider)  timeSlider.style.width = pos;
    }, false);
  }
};

// timeline drag'n'drop
function getBoundingBox(element) {
  // supported by IE5+, Firefox 3+, Google Chrome, Opera 9.5+, Safari 4+
  var rect = element.getBoundingClientRect();
  element.rect = {
    top    : rect.top,
    right  : rect.right,
    bottom : rect.bottom,
    left   : rect.left,
    // 'width' and 'height' are only supported by
    // Firefox 3.5+, Google Chrome, Safari 4+
    height : rect.bottom - rect.top,
    width  : rect.right - rect.left
  };
}
smilTimeController.prototype.setCurrentTime = function(event) {
  if (!event) event = window.event; // OLDIE
  var duration = this.timeContainer.dur;
  var bRect    = this.timeline.rect;
  var pageX    = event.pageX;
  if (!pageX) // OLDIE, see http://javascript.about.com/library/blmousepos.htm
    pageX = event.clientX + (document.documentElement.scrollLeft ?
                             document.documentElement.scrollLeft :
                             document.body.scrollLeft);
  var pos = (pageX - bRect.left) / bRect.width;
  if (pos < 0)
    pos = 0;
  else if (pos > 0.99)
    pos = 0.99;

  // convert seconds (integer) to a time string (0:00 or 0:00:00)
  function toTimeStr(seconds) {
    seconds = Math.floor(seconds);
    var sec = seconds % 60;
    var str = sec;
    if (sec < 10)
      str = "0" + str;
    var minutes = Math.floor(seconds / 60);
    min = minutes % 60;
    str = min + ":" + str;
    if (duration < 3600) return str;
    if (min < 10)
      str = "0" + str;
    var h = Math.floor(minutes / 60);
    str = h + ":" + str;
    return str;
  }

  // update the timeline and the timeContainer itself
  var time = duration * pos;
  pos = (100 * pos) + "%";
  if (this.currentTime) this.currentTime.innerHTML = toTimeStr(time);
  if (this.timeCursor)  this.timeCursor.style.left  = pos;
  if (this.timeSlider)  this.timeSlider.style.width = pos;
  this.timeContainer.setCurrentTime(time);
};
smilTimeController.prototype.timeDragHandler = function() {
  if (!this.timeline) return;
  var container = this.controlBar || this.timeline;
  var self = this;

  // toggle the 'dragging' class
  var re = new RegExp("(^|\\s)dragging(\\s|$)");
  function startDragging() {
    self.timelineDragging = true;
    getBoundingBox(self.timeline);
    container.className += " dragging";
    container.onmousemove = function(e) {
      self.setCurrentTime(e);
    };
  }
  function stopDragging() {
    container.onmousemove = null;
    container.className = container.className.replace(re, " ");
    self.timelineDragging = false;
  }

  // add event listeners to "mousedown" / "mousemove"
  //if (this.timeCursor) this.timeline.onmousedown = function(e) {
  if (this.timeCursor) this.timeCursor.onmousedown = function(e) {
    startDragging();
  };
  else if (this.timeSlider) this.timeline.onmousedown = function(e) {
    startDragging();
    self.setCurrentTime(e);
  };

  // remove event listener from "mousemove" when necessary
  if (this.timeCursor || this.timeSlider) {
    container.onmouseup = stopDragging;
    container.onmouseout = function(e) {
      var relatedTarget = e ? e.relatedTarget : window.event.toElement; // OLDIE
      while (relatedTarget && relatedTarget != container && relatedTarget != document.body)
        relatedTarget = relatedTarget.parentNode;
      if (relatedTarget != container)
        stopDragging();
    };
  }
};


// ===========================================================================
// Table of Contents
// ===========================================================================

// 'tocDisplay' event handler
smilTimeController.prototype.tocDisplayHandler = function(className) {
  var tocBlock  = this.toc;
  var tocButton = this.tocDisplay;
  var re = new RegExp("(^|\\s)" + className + "(\\s|$)");
  function hideToC() {
    tocBlock.className = tocBlock.className.replace(re, " ");
  }
  function toggleToC() {
    if (re.test(tocBlock.className))
      hideToC();
    else
      tocBlock.className += " " + className;
  }
  EVENTS.bind(tocBlock,  "click", hideToC);
  EVENTS.bind(tocButton, "click", toggleToC);
};

// timeline anchors are computed from first-level ToC items
smilTimeController.prototype.fillTimelineAnchors = function(timeAction) {
  var tocList  = this.tocList;
  var timeline = this.timeSegments;
  var duration = this.timeContainer.dur;
  if (!tocList || !timeline || !duration) return;
  var tocLinks = [];

  // get all first-level links
  var li = tocList.childNodes;
  for (var i = 0; i < li.length; i++) {
    if ((li[i].nodeType == 1) && (li[i].nodeName.toLowerCase() == "li")) {
      var links = li[i].getElementsByTagName("a");
      if (links && links.length) {
        var href = links[0].href.replace(/^.*#/, "");
        var target    = document.getElementById(href)
                     || document.getElementById(href.substr(1));
        var timeNodes = document.getTimeNodesByTarget(target);
        if (timeNodes.length) {
          tocLinks.push({
            link: links[0],
            begin: timeNodes[0].time_in
          });
        }
      }
    }
  }

  // append links to the container element (timeline):
  //   <a href="#..." style="width: ...%"><span>...</span></a>
  if (timeAction) {
    var mediaSync = this.timeContainer.parseAttribute("mediaSync");
    timeline.setAttribute("timeContainer", "excl");
    timeline.setAttribute("timeAction", timeAction);
    timeline.setAttribute("mediaSync", mediaSync);
  }
  var lastIndex = tocLinks.length - 1;
  var end = duration;
  for (i = lastIndex; i >= 0; i--) {
    var link  = tocLinks[i].link;
    var begin = tocLinks[i].begin;
    var dur = 100 * (end - begin) / duration;
    var seg  = document.createElement("a");
    var span = document.createElement("span");
    span.appendChild(link.firstChild.cloneNode(true));
    span.style.width = this.timelineWidth + "px"; // OLDIE / IE6
    seg.appendChild(span);
    seg.href = link.href;
    seg.style.width = dur + "%";
    timeline.insertBefore(seg, timeline.firstChild);
    end = begin;
    if (timeAction)
      seg.setAttribute("begin", begin);
  }

  // create a time container and start it
  if (timeAction) {
    var toc = document.createTimeContainer(timeline);
    toc.show();
  }
};

// keep the ToC in sync with the time container
smilTimeController.prototype.syncTableOfContents = function(timeAction) {
  var mediaSync = this.timeContainer.parseAttribute("mediaSync");
  var tocList   = this.tocList;
  if (!tocList) return;

  // main <ul> element is an <excl> container
  tocList.setAttribute("timeContainer", "excl");
  tocList.setAttribute("timeAction", timeAction);
  tocList.setAttribute("mediaSync", mediaSync);

  // all <ul> children are <excl> containers too
  var ul = tocList.getElementsByTagName("ul");
  for (var i = 0; i < ul.length; i++) {
    ul[i].setAttribute("timeContainer", "excl");
    ul[i].setAttribute("timeAction", timeAction);
    ul[i].setAttribute("mediaSync", mediaSync);
    ul[i].parentNode.setAttribute("timeContainer", "par");
  }

  // set "begin" attributes for all <li> elements
  var li = tocList.getElementsByTagName("li");
  for (i = 0; i < li.length; i++) {
    var link = li[i].getElementsByTagName("a").item(0);
    var href = link.href.replace(/^.*#/, "");
    var target    = document.getElementById(href);
    var timeNodes = document.getTimeNodesByTarget(target);
    if (timeNodes.length) {
      li[i].setAttribute("begin", timeNodes[0].time_in + "s");
    }
  }

  // create a time container and start it
  var toc = document.createTimeContainer(tocList);
  toc.show();
};


// ===========================================================================
// Constructor
// ===========================================================================

function smilTimeController(timeContainer, controlElement) {
  this.timeContainer  = timeContainer;
  this.controlElement = controlElement;
  this.timelineDragging = false;

  // if controlElement is empty, fill it with a basic media controller
  if (!controlElement.getElementsByTagName("*").length) {
    controlElement.innerHTML = '<!-- auto-filled by timecontroller.js -->'
      + '\n  <div class="smil-left">'
      + '\n    <button class="smil-play"><span>▶||</span></button>'
      + '\n  </div>'
      + '\n  <div class="smil-timeline">'
      + '\n    <div class="smil-timeSlider"></div>'
      + '\n  </div>'
      + '\n  <div class="smil-right">'
      + '\n    <span class="smil-currentTime">0:00</span>'
      + '\n  </div>';
    if (!(/(^|\\s)smil-controlBar(\\s|$)/).test(controlElement.className))
      controlElement.className += "smil-controlBar";
  }

  // get all child nodes by class name
  function classSelector(className) {
    var pattern = new RegExp("(^|\\s)" + className + "(\\s|$)");
    if (pattern.test(controlElement.className))
      return controlElement;
    // with some luck, there's a decent implementation we can use
    if (controlElement.querySelector)
      return controlElement.querySelector("." + className);
    // IE6-7: gotta parse all child nodes
    // see: http://ejohn.org/blog/getelementsbyclassname-speed-comparison/
    var els = controlElement.getElementsByTagName("*");
    var elsLen = els.length;
    for (var i = 0; i < elsLen; i++) {
      if (pattern.test(els[i].className)) {
        return els[i];
      }
    }
    // nothing found
    return null;
  }
  for (var i = 0; i < kProperties.length; i++) {
    var prop = kProperties[i];
    this[prop] = classSelector("smil-" + prop);
  }

  // activate the timeline and all control buttons
  this.setTimelineWidth();  // auto-size
  this.navButtonHandler();  // first|prev|next|last button handler
  this.playButtonHandler(); // play|pause button handler
  this.timeUpdateHandler(); // 'timeupdate' event handler (timeline)
  this.timeDragHandler();   // drag'n'drop timeline event handler

  // table of contents
  if (this.toc && this.tocDisplay)
    this.tocDisplayHandler("active");
  if (this.toc && this.tocList) {
    this.syncTableOfContents("class:current");
    this.fillTimelineAnchors("class:current");
  }
}


/*****************************************************************************\
|                                                                             |
| startup: parse all time containers and create a timeController object       |
|          when a 'controls' attribute is found.                              |
|                                                                             |
\*****************************************************************************/

function parseAllTimeControllers() {
  // activate all time controllers
  var containers = document.getTimeContainersByTagName("*");
  for (var i = 0; i < containers.length; i++) {
    var timeContainer = containers[i];
    // parse the "controls" attribute and get the target element
    // (works with "controls", "data-controls", "smil:controls" or timesheets)
    var controls = timeContainer.parseAttribute("controls");
    var controlElement = document.querySelector(controls);
    if (controlElement) { // we have a target element, create a time controller
      timeContainer.controls = new smilTimeController(timeContainer, controlElement);
    }
  }
}

if (1) EVENTS.onSMILReady(function() { // XXX
  // for some reason, iOS and IE need a timeout
  setTimeout(parseAllTimeControllers, 500);
}); else
  parseAllTimeControllers();

document.redrawTimelines = function() {
  var containers = document.getTimeContainersByTagName("*");
  for (var i = 0; i < containers.length; i++) {
    var timeController = containers[i].controls;
    if (timeController) {
      timeController.setTimelineWidth(true);
      //if (timeController.toc && timeController.tocList) {
        //timeController.fillTimelineAnchors();
      //}
    }
  }
};

})();
