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
 * version     : 0.4pre
 * last change : 2010-11-09
 */

/*****************************************************************************\
|                                                                             |
|  Basic Event Management Abstraction Layer                                   |
|    completely useless... except to support Internet Explorer 6/7/8 :-/      |
|      * fixes the 'this' reference issue in callbacks on IE<9                |
|      * handles custom (= non W3C-standard) events on IE<9                   |
|    exposed as window.EVENTS                                                 |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|  Generic events:                                                            |
|    EVENTS.bind(node, type, callback)                                        |
|             equivalent to 'node.addEventListener(type, callback, false)'    |
|    EVENTS.unbind(node, type, callback)                                      |
|             equivalent to 'node.removeEventListener(type, callback, false)' |
|    EVENTS.trigger(node, type)                                               |
|             equivalent to 'node.dispatchEvent()'                            |
|    EVENTS.preventDefault(event)                                             |
|             equivalent to 'event.preventDefault()'                          |
|                                                                             |
|  Specific events:                                                           |
|    EVENTS.onHashChange(callback)                                            |
|             triggers 'callback()' when the URL hash is changed              |
|    EVENTS.onDOMReady(callback)                                              |
|             triggers 'callback()' when the DOM content is loaded            |
|    EVENTS.onSMILReady(callback)                                             |
|             triggers 'callback()' when the SMIL content is parsed           |
|                                                                             |
\*****************************************************************************/

window.EVENTS = {
  bind    : function(node, type, callback) {},
  unbind  : function(node, type, callback) {},
  trigger : function(node, type) {}
};

// ===========================================================================
// Generic Events
// ===========================================================================
// addEventListener should work fine everywhere except with IE<9
if (window.addEventListener) { // modern browsers
  EVENTS.bind = function(node, type, callback) {
    node.addEventListener(type, callback, false);
  };
  EVENTS.unbind = function(node, type, callback) {
    node.removeEventListener(type, callback, false);
  };
  EVENTS.trigger = function(node, type) {
    //console.log(node.innerHTML + " : " + type);
    if (!EVENTS.eventList)
      EVENTS.eventList = new Array();
    var evtObject = EVENTS.eventList[type];
    if (!evtObject) {
      evtObject = document.createEvent("Event");
      evtObject.initEvent(type, false, false);
      EVENTS.eventList[type] = evtObject;
    }
    node.dispatchEvent(evtObject);
  };
  EVENTS.preventDefault = function(e) {
    e.preventDefault();
  }
}
else if (window.attachEvent) { // Internet Explorer 6/7/8
  // This also fixes the 'this' reference issue in all callbacks
  // -- both for standard and custom events.
  // http://www.quirksmode.org/blog/archives/2005/10/_and_the_winner_1.html
  EVENTS.bind = function(node, type, callback) {
    var ref = type + callback;
    type = "on" + type;
    if (type in node) try { // standard DOM event?
      node["e"+ref] = callback;
      node[ref] = function() { node["e"+ref](window.event); };
      node.attachEvent(type, node[ref]);
      return;
    } catch(e) {}
    // custom event
    if (!node.eventList)
      node.eventList = new Array();
    if (!node.eventList[type])
      node.eventList[type] = new Array();
    node.eventList[type].push(callback);
  };
  EVENTS.unbind = function(node, type, callback) {
    var ref = type + callback;
    type = "on" + type;
    if (type in node) try { // standard DOM event?
      node.detachEvent(type, node[ref]);
      node[ref] = null;
      node["e"+ref] = null;
      return;
    } catch(e) {}
    // custom event
    if (!node || !node.eventList || !node.eventList[type])
      return;
    var callbacks = node.eventList[type];
    var cbLength = callbacks.length;
    for (var i = 0; i < cbLength; i++) {
      if (callbacks[i] == callback) {
        callbacks.slice(i, 1);
        return;
      }
    }
  };
  EVENTS.trigger = function(node, type) {
    type = "on" + type;
    if (type in node) try { // standard DOM event?
      node.fireEvent(type);
      return;
    } catch(e) {}
    // custom event: pass an event-like structure to the callback
    // + use call() to set the 'this' reference within the callback
    var evtObject = {};
    evtObject.target = node;
    evtObject.srcElement = node;
    if (!node || !node.eventList || !node.eventList[type])
      return;
    var callbacks = node.eventList[type];
    var cbLength = callbacks.length;
    for (var i = 0; i < cbLength; i++)
      callbacks[i].call(node, evtObject);
  };
  EVENTS.preventDefault = function(e) {
    e.returnValue = false;
  }
}

// ===========================================================================
// Specific Events
// ===========================================================================
// 'hashchange' works on most recent browsers
EVENTS.onHashChange = function(callback) {
  if ("onhashchange" in window) // IE8 and modern browsers
    EVENTS.bind(window, "hashchange", callback);
  else { // use a setInterval loop for older browsers
    var hash = "";
    window.setInterval(function() {
      if (hash != window.location.hash) {
        hash = window.location.hash;
        callback();
      }
    }, 250); // 250ms timerate by default
  }
};
// 'DOMContentLoaded' should work fine everywhere except with IE<9
EVENTS.onDOMReady = function(callback) {
  if (window.addEventListener) // modern browsers
    // http://perfectionlabstips.wordpress.com/2008/12/01/which-browsers-support-native-domcontentloaded-event/
    // a few browsers support addEventListener without DOMContentLoaded: namely,
    //   Firefox 1.0, Opera <8 and Safari <2 (according to the above link).
    // As these browsers aren't supported any more, we can safely ignore them.
    window.addEventListener("DOMContentLoaded", callback, false);
  else { // Internet Explorer 6/7/8
    // there are plenty other ways to do this without delaying the execution
    // but we haven't taken the time to test the properly yet (FIXME)
    // http://javascript.nwbox.com/IEContentLoaded/
    // http://tanny.ica.com/ICA/TKO/tkoblog.nsf/dx/domcontentloaded-for-browsers-part-v
    // http://www.javascriptfr.com/codes/DOMCONTENTLOADED-DOCUMENT-READY_49923.aspx
    EVENTS.bind(window, "load", callback);
  }
};
// 'SMILContentLoaded' is fired when all time containers have been parsed
EVENTS.onSMILReady = function(callback) {
  EVENTS.bind(window, "SMILContentLoaded", callback);
};


/*****************************************************************************\
|                                                                             |
|  SMIL/Timing and SMIL/Timesheet implementation                              |
|    not exposed -- the JavaScript API is a work in progress                  |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|  (function(){                                                               |
|-----------------------------------------------------------------------------|
|  Utilities:                                                                 |
|                                                                             |
|    checkHash(), parseAllTimeContainers()                                    |
|                                         startup sequence                    |
|    smil[In|Ex]ternalTimer                                                   |
|                                         timers                              |
|-----------------------------------------------------------------------------|
|  SMIL Objects:                                                              |
|                                                                             |
|    smilTimeItem                                                             |
|                                         base class for SMIL items           |
|    smilTimeContainer_generic                                                |
|                                         abstract class for SMIL containers  |
|                                         inherits smilTimeItem               |
|    smilTimeContainer_[par|seq|excl]                                         |
|                                         base class for SMIL containers      |
|                                         inherits smilTimeContainer_generic  |
|    smilTimeElement                                                          |
|                                 constructor for all SMIL elements           |
|                                 always inherits smilTimeItem                |
|                                 inherits smilTimeContainer_* when necessary |
|-----------------------------------------------------------------------------|
|  })();                                                                      |
|                                                                             |
\*****************************************************************************/

/* Paul's tip, FTR:
(function(foobar, container) {
  container[foobar] = function() {
    // code to expose
  }
}) ("API name", window)
*/
(function(){

// note: all lines containing "consoleLog" will be deleted by the minifier
var DEBUG = true;                             // consoleLog
function consoleLog(message) {                // consoleLog
  if (DEBUG && (typeof(console) == "object")) // consoleLog
    console.log(message);                     // consoleLog
}                                             // consoleLog
// predefined CSS selectors to parse time containers and external timesheets
var CSSQUERY = {
  timeContainer: "*[data-timecontainer], *[timeContainer], par, seq, excl",
  extTimesheets: "link[rel=timesheet]",
  parTimeNodes: "" // TODO
}
// default timeContainer refresh rate = 40ms (25fps)
var TIMERATE = 40;

// ===========================================================================
// Detect Internet Explorer 6/7/8
// ===========================================================================
// these browsers don't support XHTML, <audio|video>, addEventListener...
// var IE6 = (window.XMLHttpRequest) ? false : true;
var OLDIE = (window.addEventListener) ? false : true;
if (OLDIE) {
  // define 'Date.now()', 'indexOf()' and CSS selectors for IE<9
  /* if (!Node) var Node = {
    ELEMENT_NODE                 :  1,
    ATTRIBUTE_NODE               :  2,
    TEXT_NODE                    :  3,
    CDATA_SECTION_NODE           :  4,
    ENTITY_REFERENCE_NODE        :  5,
    ENTITY_NODE                  :  6,
    PROCESSING_INSTRUCTION_NODE  :  7,
    COMMENT_NODE                 :  8,
    DOCUMENT_NODE                :  9,
    DOCUMENT_TYPE_NODE           : 10,
    DOCUMENT_FRAGMENT_NODE       : 11,
    NOTATION_NODE                : 12
  }; */
  if (!Array.indexOf) Array.prototype.indexOf = function(obj) {
    for (var i = 0; i < this.length; i++)
      if (this[i] == obj)
        return i;
    return -1;
  };
  if (!Date.now) Date.now = function() {
    var timestamp = new Date();
    return timestamp.getTime();
  };
  // querySelectorAll() / querySelector()
  // detect Sizzle, jQuery, Dojo, Prototype, Mootools, ExtJS, YUI...
  if (window.Sizzle) {      // http://sizzlejs.com/
    document.querySelectorAll = function(cssQuery) {
      return Sizzle(cssQuery);
    };
  }
  else if (window.jQuery) { // http://jquery.com/
    document.querySelectorAll = function(cssQuery) {
      return $(cssQuery);
    };
  }
  else if (window.$$) {     // http://prototypejs.org/ http://mootools.net/
    document.querySelectorAll = function(cssQuery) {
      return $$(cssQuery);
    };
  }
  else if (window.dojo) {   // http://dojotoolkit.org/
    document.querySelectorAll = function(cssQuery) {
      return dojo.query(cssQuery);
    };
  }
  else if (window.Ext) {   // http://www.sencha.com/products/js/
    document.querySelectorAll = function(cssQuery) {
      return Ext.select(cssQuery);
    };
  }
  else if (window.YAHOO) {  // http://developer.yahoo.com/yui/
    document.querySelectorAll = function(cssQuery) {
      return YAHOO.util.Selector.query(cssQuery);
    };
  }
  else if (!document.querySelectorAll) { // IE6 / IE7
    // Crap. We'll just test anchors, tag names and predefined queries then.
    // XXX this will never work for 'select' attributes (timesheets)
    document.querySelectorAll = function(cssQuery) {
      var results = new Array();
      // anchor?
      if (/^#[^\s]+$/.test(cssQuery)) {
        var target = document.getElementById(cssQuery.substring(1));
        if (target)
          results.push(target);
      }
      // tag name?
      else if (/^[a-z]+$/i.test(cssQuery)) {
        results = document.getElementsByTagName(cssQuery);
      }
      // external timesheets?
      else if (cssQuery == CSSQUERY.extTimesheets) {
        var links = document.getElementsByTagName("link");
        for (var i = 0; i < links.length; i++)
          if (links[i].rel.toLowerCase() == "timesheet")
            results.push(links[i]);
      }
      // time containers?
      else if (cssQuery == CSSQUERY.timeContainer) {
        var tmp = document.getElementsByTagName("*");
        var re = /^(par|seq|excl)$/i;
        for (var i = 0; i < tmp.length; i++) {
          if (re.test(tmp[i].nodeName)
                || tmp[i].getAttribute("data-timecontainer")
                || tmp[i].getAttribute("timeContainer"))
            results.push(tmp[i]);
        }
      }
      return results;
    };
  }
  document.querySelector = function(cssQuery) { // see mediaSync
    var results = document.querySelectorAll(cssQuery);
    if (results && results.length)
      return results[0];
    else
      return null;
  };
}

// ===========================================================================
// Activate a time node if a hash is found in the URL
// ===========================================================================
function checkHash() {
  var container       = null;
  var targetElement   = null;
  var targetContainer = null;
  var time = NaN;
  var hash = document.location.hash;

  // get the URI target and its time container, if any
  if (hash.length) {
    consoleLog("new hash: " + hash);
    var targetID = hash.substr(1).replace(/\&.*$/, "");
    consoleLog("targetID: " + targetID);
    targetElement = document.getElementById(targetID);
    // the hash may contain a leading char (e.g. "_") to prevent scrolling
    if (!targetElement)
      targetElement = document.getElementById(targetID.substr(1));
    if (targetElement && targetElement.parentNode)
      container = targetElement.parentNode.timing;
    // the hash might contain a temporal MediaFragment information
    if (targetElement.timing && targetElement.timing.timeContainer) {
      targetContainer = targetElement.timing;
      var tmp = hash.split("&");
      for (var i = 0; i < tmp.length; i++) {
        if (/^t=.*/i.test(tmp[i])) { // drop end time (if any)
          time = targetContainer.parseTime(tmp[i].substr(2).replace(/,.*$/, ""));
          break;
        }
      }
    }
  }

  // wrong ID, exit
  if (!targetElement)
    return;

  // activate the time container on the target element
  // http://www.w3.org/TR/SMIL3/smil-timing.html#Timing-HyperlinkImplicationsOnSeqExcl
  // we're extending this to all time containers, including <par>
  // -- but we still haven't checked wether '.selectIndex()' works properly with <par>
  var containers = new Array();
  var indexes    = new Array();
  var element = targetElement;
  while (container) {
    var index = container.timeNodes.indexOf(element);
    for (var index = 0; index < container.timeNodes.length; index++) {
      //if (container.timeNodes[index].targets.indexOf(element) >= 0) {
      if (container.timeNodes[index].target == element) {
        consoleLog("target found: " + element.nodeName + "#" + element.id);
        if (!container.timeNodes[index].isActive()) {
          containers.push(container);
          indexes.push(index);
        }
        break;
      }
    }
    // loop on the parent container
    element   = container.getNode();
    container = container.parentNode;
  }
  for (var i = containers.length - 1; i >= 0; i--)
    containers[i].selectIndex(indexes[i]);

  // set the target container to a specific time if requested
  if (targetContainer && !isNaN(time)) {
    targetContainer.setTime(time);
    consoleLog(targetContainer.getNode().nodeName + " time: " + time);
  }
  
  // ensure the target element is visible
  //targetElement.focus(); // not working if targetElement has no tabIndex
  if (targetElement["scrollIntoViewIfNeeded"] != undefined)
    targetElement.scrollIntoViewIfNeeded(); // WebKit browsers only
  else {
    //targetElement.scrollIntoView();
    var tabIndex = targetElement.tabIndex;
    targetElement.tabIndex = 0;
    targetElement.focus();
    targetElement.blur();
    targetElement.tabIndex = tabIndex;
  }
}
EVENTS.onSMILReady(function() {
  consoleLog("SMIL data parsed, starting 'hashchange' event listener.");
  checkHash(); // force to check once at startup
  EVENTS.onHashChange(checkHash);
});

// ===========================================================================
// Find all time Containers in the current document
// ===========================================================================
function parseTimeContainerNode(node) {
  if (!node) return;
  // Don't create a new smilTimeElement if this node already has a
  // parent time container.
  if (!node.timing) {
    consoleLog("Main time container found: " + node.nodeName);
    consoleLog(node);
    // the "time" property isn't set: this node hasn't been parsed yet.
    var smilPlayer = new smilTimeElement(node);
    smilPlayer.show();
  } else
    consoleLog("Child time container found: " + node.nodeName);
}
function parseTimesheetNode(timesheetNode) {
  var containers = timesheetNode.childNodes;
  for (var i = 0; i < containers.length; i++)
    if (containers[i].nodeType == 1) // Node.ELEMENT_NODE
      parseTimeContainerNode(containers[i]);
}
function parseAllTimeContainers() {
  // Inline Time Containers (HTML namespace)
  var allTimeContainers = document.querySelectorAll(CSSQUERY.timeContainer);
  for (var i = 0; i < allTimeContainers.length; i++)
    parseTimeContainerNode(allTimeContainers[i]);

  // External Timesheets: callback to count all parsed timesheets
  var timesheets = document.querySelectorAll(CSSQUERY.extTimesheets);
  var tsLength = timesheets.length;
  var tsParsed = 0;
  function CountTimesheets() {
    if (++tsParsed > tsLength) {
      EVENTS.unbind(document, "SMILTimesheetLoaded", CountTimesheets);
      EVENTS.trigger(window, "SMILContentLoaded");
    }
  }
  EVENTS.bind(document, "SMILTimesheetLoaded", CountTimesheets);

  // External Timesheets: parsing
  for (i = 0; i < tsLength; i++) { 
    // IE6 doesn't support XMLHttpRequest natively
    // IE6/7/8 don't support overrideMimeType with native XMLHttpRequest
    // IE6/7/8/9 don't allow loading any local file with native XMLHttpRequest
    // so we use ActiveX for XHR on IE, period.
    if (window.ActiveXObject) {
      var xhr = new ActiveXObject("Microsoft.XMLHTTP");
      xhr.open("GET", timesheets[i].href, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          // overrideMimeType("text/xml") doesn't work on IE6
          var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
          xmlDoc.loadXML(xhr.responseText);
          var tsNodes = xmlDoc.getElementsByTagName("timesheet");
          if (tsNodes && tsNodes.length)
            parseTimesheetNode(tsNodes[0]);
          EVENTS.trigger(document, "SMILTimesheetLoaded");
        }
      };
      xhr.send(null);
    }
    else if (window.XMLHttpRequest) {
      // note that Chrome won't allow loading any local timesheet with XHR
      var xhr = new XMLHttpRequest();
      xhr.open("GET", timesheets[i].href, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          xhr.overrideMimeType("text/xml");
          var tsNodes = xhr.responseXML.getElementsByTagName("timesheet");
          if (tsNodes && tsNodes.length)
            parseTimesheetNode(tsNodes[0]);
          EVENTS.trigger(document, "SMILTimesheetLoaded");
        }
      };
      xhr.send(null);
    }
    else // can't load the timesheet but still dispatch the related event
      EVENTS.trigger(document, "SMILTimesheetLoaded");
  }

  // Internet Explorer 6/7/8 don't support XHTML sent as application/xhtml+xml
  // => these browsers won't support internal timesheets nor smil:* attributes
  // => don't use internal timesheets nor smil:* attributes for web content!
  if (!OLDIE) {
    var docElt = document.documentElement;
    function nsResolver(prefix) {
      var ns = {
        "xhtml" : docElt.getAttribute("xmlns"),     // "http://www.w3.org/1999/xhtml"
        "smil"  : docElt.getAttribute("xmlns:smil") // "http://www.w3.org/ns/SMIL"
      };
      return ns[prefix] || null;
    }

    // Internal Timesheets (application/xhtml+xml)
    var TimesheetNS = nsResolver("smil");
    timesheets = document.getElementsByTagNameNS(TimesheetNS, "timesheet");
    for (i = 0; i < timesheets.length; i++)
      parseTimesheetNode(timesheets[i]);

    // Inline Time Containers (SMIL namespace) -- we have to use XPath because
    // document.querySelectorAll("[smil|timeContainer]") raises an exception.
    if (docElt.getAttribute("xmlns") && docElt.getAttribute("xmlns:smil")) {
      consoleLog("document has SMIL extensions: " + nsResolver("smil"));
      var containers = document.evaluate("//*[@smil:timeContainer]", document,
                  nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                  //nsResolver, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
      var thisContainer = containers.iterateNext();
      try {
        while (thisContainer) {
          parseTimeContainerNode(thisContainer);
          thisContainer = containers.iterateNext();
        }
      } catch(e) { // Safari tends to raise exceptions here, dunno why
        consoleLog(e.toString());
      }
    }
  }

  // for our counter, all internal timing data is considered as one timesheet
  EVENTS.trigger(document, "SMILTimesheetLoaded");
}
EVENTS.onDOMReady(function() {
  consoleLog("SMIL/HTML Timing: startup");
  parseAllTimeContainers();
});


/*****************************************************************************\
|                                                                             |
|  smilInternalTimer (                                                        |
|    timerate          : update time in milliseconds (default = 40ms)         |
|  )                                                                          |
|  smilExternalTimer (                                                        |
|    mediaPlayerNode   : <audio|video> node used as time base                 |
|  )                                                                          |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|    .onTimeUpdate     callback function to be triggered on each time update  |
|                                                                             |
|    .isPaused()       returns 'true' when paused                             |
|    .getTime()        returns the current elapsed time, in seconds           |
|                                                                             |
|    .Play()           starts playing (and triggering the callback function)  |
|    .Pause()          stops playing (and suspend the callback function)      |
|    .Stop()           stops playing (and resets the time to zero)            |
|                                                                             |
\*****************************************************************************/

// These two timers implement the same API. Each time container will choose
// the appropriate timer -- internal by default, external when an <audio|video>
// element is in charge of the timing (see the 'syncMaster' SMIL attribute).

// I'm not sure these timers really need Play/Pause/Stop methods: they've been
// implemented mostly for backward compatibility with the LimSee3 project, but
// it's not clear whether this project is still maintained or not.

function smilInternalTimer(timerate) {
  if (!timerate)
    timerate = TIMERATE; // default = 40 milliseconds timerate (25 fps)

  var self = this;
  this.onTimeUpdate = null;

  // read-only properties: isPaused(), getTime()
  var timerID   = null;
  var timeStart = 0;    // milliseconds since 1970/01/01 00:00
  var timePause = 0;    // milliseconds since last Play()
  var paused    = true;
  this.isPaused = function() { return paused; };
  this.getTime  = function() {
    var ms = timePause;
    if (!paused)
      ms += Date.now() - timeStart;
    return (ms / 1000); // returns elapsed time in seconds (float)
  };
  this.setTime  = function(time) {
    timeStart -= (time - self.getTime()) * 1000;
  };

  // public methods: Play(), Pause(), Stop()
  this.Play = function() {
    if (!paused) return;
    timeStart = Date.now();
    timerID = setInterval(function() { self.onTimeUpdate(); }, timerate);
    paused = false;
    consoleLog("started: " + timerID);
  };
  this.Pause = function() {
    if (paused) return;
    clearInterval(timerID);
    timerID = null;
    timePause = 1000 * self.getTime();
    paused = true;
    self.onTimeUpdate();
    consoleLog("paused: " + timerID);
  };
  this.Stop = function() {
    if (!timerID) return;
    clearInterval(timerID);
    timerID = null;
    timePause = 0;
    paused = true;
    self.onTimeUpdate();
    consoleLog("stopped: " + timerID);
  };
}

function smilExternalTimer(mediaPlayerNode) {
  var self = this;
  this.onTimeUpdate = null;

  // read-only properties: isPaused(), getTime()
  this.isPaused = function() { return mediaPlayerNode.paused; };
  this.getTime  = function() { return mediaPlayerNode.currentTime; };
  this.setTime  = function(time) {
    try {
      mediaPlayerNode.currentTime = time;
    } catch(e) {
      consoleLog("seeking to time=" + time + "...");
      consoleLog("  readyState = " + mediaPlayerNode.readyState);
      function setThisTime() {
        mediaPlayerNode.currentTime = time;
        mediaPlayerNode.removeEventListener("canplay", setThisTime, false);
        consoleLog("  readyState = " + mediaPlayerNode.readyState);
      }
      mediaPlayerNode.addEventListener("canplay", setThisTime, false);
    }
  };

  // public methods: Play(), Pause(), Stop()
  this.Play  = function() {
    if (!OLDIE)
      mediaPlayerNode.addEventListener("timeupdate", self.onTimeUpdate, false);
    // TODO: handle <object> fallbacks for OLDIE
  };
  this.Pause = function() {
    if (!OLDIE)
      mediaPlayerNode.pause(); // XXX useless? confusing?
  };
  this.Stop  = function() {
    if (!OLDIE)
      mediaPlayerNode.removeEventListener("timeupdate", self.onTimeUpdate, false);
    //mediaPlayerNode.currentTime = 0;
  };
}

/*****************************************************************************\
|                                                                             |
|  smilTimeItem (                                                             |
|    domNode   : node of the SMIL element (in the HTML or Timesheet document) |
|    timeAction: default "timeAction" value (if not specified in domNode)     |
|  )                                                                          |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|    .getNode()                                DOM node of the SMIL element   |
|    .parseAttribute(attrName, dValue)         query SMIL attribute           |
|                                                                             |
|    .target                                   target nodes                   |
|    .setTargetState(state)                    set SMIL target state          |
|       state = "idle"   : hasn't run yet                                     |
|       state = "active" : running                                            |
|       state = "done"   : finished running                                   |
|                                                                             |
|    .parentNode                               standard DOM properties        |
|    .previousSibling                                                         |
|    .nextSibling                                                             |
|                                                                             |
|    .timeContainer                            standard SMIL attributes       |
|    .timeAction                                                              |
|    .begin                                                                   |
|    .dur                                                                     |
|    .end                                                                     |
|                                                                             |
\*****************************************************************************/

// Reference to the DOM node describing the SMIL/Timing element
smilTimeItem.prototype.getNode = function() {};

// Attribute parsing: parseTime(), parseEvents(), parseAttribute()
smilTimeItem.prototype.parseTime = function(timeStr) {
  if (!timeStr || !timeStr.length)      return undefined;
  else if (timeStr == "indefinite")     return Infinity;
  else if (   /ms[\s]*$/.test(timeStr)) return parseFloat(timeStr) / 1000;
  else if (    /s[\s]*$/.test(timeStr)) return parseFloat(timeStr);
  else if (  /min[\s]*$/.test(timeStr)) return parseFloat(timeStr) * 60;
  else if (    /h[\s]*$/.test(timeStr)) return parseFloat(timeStr) * 3600;
  else if (/^[0-9:\.]*$/.test(timeStr)) { // expecting [hh:mm:ss] format
    var seconds = 0;
    var tmp = timeStr.split(":");
    for (var i = 0; i < tmp.length; i++)
      seconds = (seconds * 60) + parseFloat(tmp[i]);
    return seconds;
  } else return timeStr; // unsupported time format -- maybe a DOM event?
                         // note that isNaN("string") returns true
};
smilTimeItem.prototype.parseEvent = function(eventStr, callback) { // XXX to be removed
  if (!eventStr || !eventStr.length) return;
  // TODO: look for "+" in eventStr and handle the time offset
  var tmp = eventStr.split(".");
  if (tmp.length >= 2) {
    var target = document.getElementById(tmp[0]);
    var evt    = tmp[1];
  } else {
    var target = this.getNode();
    var evt    = eventStr;
  }
  if (target)
    //EVENTS.bind(target, evt, function() { callback(); });
    EVENTS.bind(target, evt, callback);
  return target;
};
smilTimeItem.prototype.parseEvents = function(eventStr, callback) {
  var events = new Array();
  if (!eventStr || !eventStr.length || !isNaN(eventStr))
    return events;

  // TODO: look for "+" in eventStr and handle the time offset
  var tmp = eventStr.split(".");
  if (tmp.length >= 2) {
    var target = document.getElementById(tmp[0]);
    var evt    = tmp[1];
  } else {
    var target = this.getNode();
    var evt    = eventStr;
  }
  events.push({
    target: target,
    event:  evt
  });
  return events;
};
smilTimeItem.prototype.parseAttribute = function(attrName, dValue) {
  var node = this.getNode();
  var nodeName = node.nodeName.replace(/^smil:/, "");
  var value = "";

  // get raw attribute value
  if ((attrName == "timeContainer") && (/^(seq|par|excl)$/i).test(nodeName))
    value = nodeName;
  else if (node.getAttribute(attrName))
    value = node.getAttribute(attrName);
  else if (node.getAttribute("smil:" + attrName))
    value = node.getAttribute("smil:" + attrName);
  else
    value = node.getAttribute("data-" + attrName.toLowerCase());

  if (!value || !value.length)
    return dValue; // default value or undefined

  // now cast the attribute value into the proper type
  switch (attrName) {
    case "timeContainer":
    case "timeAction":
      return value.toLowerCase();
    // float
    case "repeatCount":
      return (value == "indefinite") ? Infinity : parseFloat(value);
    // event
    case "onbegin":
    case "onend":
      return function() { eval(value); };
    // time (float or DOM event)
    case "beginInc":
    case "begin":
    case "dur":
    case "end":
    case "repeatDur":
      return this.parseTime(value);
    // string or unsupported
    default:
      return value;
  }
};

// Target handler:
// show/hide target nodes according to the 'timeAction' attribute
smilTimeItem.prototype.newTargetHandler = function(timeAction, target) {
  if (!target)
    return function(state) {};

  // show/hide target nodes according to the 'timeAction' attribute
  var setTargetState_intrinsic  = function(state) {
    target.setAttribute("smil", state);
  };
  var setTargetState_display    = function(state) {
    target.style.display = (state == "active") ? "block" : "none";
  };
  var setTargetState_visibility = function(state) {
    target.style.visibility = (state == "active") ? "visible" : "hidden";
  };
  var setTargetState_style      = function(state) {
    var active = (state == "active");
    if (!target._smilstyle) // not initialized yet
      target._smilstyle = target.style.cssText;
    target.style.cssText = active ? target._smilstyle : "";
  };
  var setTargetState_class      = function(state) {
    var active = (state == "active");
    if (!target._smilclass_active)  { // not initialized yet
      var activeCN = target.className + (target.className.length ? " " : "")
                   + timeAction.replace(/class:[\s]*/, "");
      target._smilclass_active = activeCN;
      target._smilclass_idle = target.className;
    }
    target.className = active ? target._smilclass_active
                              : target._smilclass_idle;
  };

  // return the appropriate target handler
  switch (timeAction) {
    case "display":
      return setTargetState_display;
      break;
    case "visibility":
      return setTargetState_visibility;
      break;
    case "style":
      return setTargetState_style;
      break;
    default:
      if (/^class:/.test(timeAction))
        return setTargetState_class;
      else if (OLDIE) // (!window.XMLHttpRequest)
        // IE6 doesn't support attribute selectors in CSS
        // IE7/8 do support them but the responsiveness is terrible
        // so we default to timeAction="visibility" for these old browsers
        return setTargetState_visibility;
      else
        return setTargetState_intrinsic;
      break;
  }
};

// Event handlers
smilTimeItem.prototype.addEventListener = function(events, callback) {
  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    if (evt.target)
      EVENTS.bind(evt.target, evt.event, callback);
    //consoleLog("event listener on '" + evt.target.nodeName + "' added");
  }
};
smilTimeItem.prototype.removeEventListener = function(events, callback) {
  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    if (evt.target)
      EVENTS.unbind(evt.target, evt.event, callback);
    //consoleLog("event listener on '" + evt.target.nodeName + "' removed");
  }
};
smilTimeItem.prototype.dispatchEvent = function(eventType) {
  var func = this["on" + eventType];
  EVENTS.trigger(this.target, eventType);
  if (func)
    func.call(this.target);
};

// Constructor: should not be called directly (see smilTimeElement)
// unless you just want to check SMIL attributes.
function smilTimeItem(domNode, parentNode, targetNode) {
  var self = this;
  this.parseTime      = smilTimeItem.prototype.parseTime;
  this.parseEvent     = smilTimeItem.prototype.parseEvent;
  this.parseEvents    = smilTimeItem.prototype.parseEvents;
  this.parseAttribute = smilTimeItem.prototype.parseAttribute;

  this.parentNode      = parentNode;
  this.previousSibling = null;
  this.nextSibling     = null;
  this.timeNodes       = null; // new Array()

  this.getNode = function() { return domNode; };
  this.target  = targetNode || domNode;
  // XXX bunch of crap for OLDIE -- FIXME!
  //if (!this.target)
    //alert(domNode.nodeName);
  if (/^(par|seq|excl)$/i.test(this.target.nodeName))
    this.target = null;

  // http://www.w3.org/TR/SMIL3/smil-timing.html#Timing-IntegrationAttributes
  var timeAction = parentNode ? parentNode.timeAction : "intrinsic";
  this.timeAction    = this.parseAttribute("timeAction", timeAction);
  this.timeContainer = this.parseAttribute("timeContainer", null);

  // http://www.w3.org/TR/SMIL/smil-timing.html#Timing-BasicTiming
  this.begin = this.parseAttribute("begin");
  this.dur   = this.parseAttribute("dur");
  this.end   = this.parseAttribute("end");

  // http://www.w3.org/TR/SMIL3/smil-timing.html#Timing-fillAttribute
  var fillDefault = parentNode ? parentNode.fillDefault : "remove";
  this.fill = this.parseAttribute("fill", fillDefault);

  // show/hide target nodes according to the 'timeAction' attribute
  // 'setTargetState' should be considered as a protected method
  //this.newTargetHandler = smilTimeItem.prototype.newTargetHandler;
  //this.setTargetState = this.newTargetHandler(this.timeAction, this.target);
  this.setTargetState = smilTimeItem.prototype.newTargetHandler
                                    .call(this, this.timeAction, this.target);

  // event handlers
  this.addEventListener    = smilTimeItem.prototype.addEventListener;
  this.removeEventListener = smilTimeItem.prototype.removeEventListener;
  this.dispatchEvent       = smilTimeItem.prototype.dispatchEvent;
  this.onbegin    = this.parseAttribute("onbegin");
  this.onend      = this.parseAttribute("onend");
  var beginEvents = this.parseEvents(this.begin);
  var endEvents   = this.parseEvents(this.end);
  var onbeginListener = function() {
    consoleLog("onbeginListener");
    self.time_in = self.parentNode.getTime();
    self.time_out = isNaN(self.end) ? Infinity : self.end;
    //self.parentNode.onTimeUpdate();
    //self.show();
    self.parentNode.selectItem(self);
  };
  var onendListener = function() {
    consoleLog("onendListener");
    self.time_in = isNaN(self.begin) ? Infinity : self.begin;
    self.time_out = self.parentNode.getTime();
    //self.parentNode.onTimeUpdate();
    self.parentNode.currentIndex = -1;
    self.hide();
  };

  // main public methods, exposed to DOM via the 'timing' property
  var state = "";
  this.isActive = function() { return (state == "active"); };
  this.show  = function() {
    if (state == "active") return;
    state = "active";
    self.setTargetState(state);
    self.dispatchEvent("begin");
    self.addEventListener(endEvents, onendListener);
    self.removeEventListener(beginEvents, onbeginListener);
    //if (self.parentNode.timeContainer == "excl") consoleLog("show");
  };
  this.hide  = function() {
    if (state == "done") return;
    state = "done";
    if (self.fill != "hold")
      self.setTargetState(state);
    self.dispatchEvent("end");
    self.addEventListener(beginEvents, onbeginListener);
    self.removeEventListener(endEvents, onendListener);
    //consoleLog("time node: " + self.getNode().nodeName + "/" + self.timeAction + " -- " + state);
  };
  this.reset = function() {
    if (state == "idle") return;
    state = "idle";
    self.setTargetState(state);
    self.addEventListener(beginEvents, onbeginListener);
    self.removeEventListener(endEvents, onendListener);
    //consoleLog("time node: " + self.getNode().nodeName + "/" + self.timeAction + " -- " + state);
    //if (self.parentNode.timeContainer == "excl") consoleLog("reset");
  };
  try { // this raises a bug with external timesheets on OLDIE
    domNode.timing = this;
  } catch(e) {
    // MSXML doesn't allow to attach an object to an XML document
    // but it does allow to attach it as an attribute... :-/
    // *.timing still won't work, though. FIXME.
    domNode.setAttribute("timing", this);
  }
}


/*****************************************************************************\
|                                                                             |
|  smilTimeContainer_generic (                                                |
|    domNode   : node of the SMIL element (in the HTML or Timesheet document) |
|    parentNode: parent time container                                        |
|    timerate  : default timerate for the internal timer (if appliable)       |
|  )                                                                          |
|  extends smilTimeItem (kind of)                                             |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|    .timeNodes                array of all child timesheet nodes             |
|    .parseTimeNodes()         find all time nodes                            |
|    .computeTimeNodes()       initialize all time nodes                      |
|    .getMediaSync()           returns the 'syncMaster' time node, if any     |
|                                                                             |
|    .isPaused()               timer methods -- see smil[In|Ex]ternalTimer()  |
|    .getTime()                                                               |
|    .setTime()                                                               |
|    .Play()                                                                  |
|    .Pause()                                                                 |
|    .Stop()                                                                  |
|                                                                             |
|    .repeatCount              standard SMIL attributes                       |
|    .repeatDur                                                               |
|                                                                             |
\*****************************************************************************/

// Time Sync
smilTimeContainer_generic.prototype.getTime = function() {};
smilTimeContainer_generic.prototype.setTime = function() {};
smilTimeContainer_generic.prototype.onTimeUpdate = function() {};

// This method will return an array of all timeNodes that have a non-null
// timeAction (i.e. where *.timeAction != "none").
smilTimeContainer_generic.prototype.parseTimeNodes = function() {
  var timeNodes = new Array();
  var syncMasterNode = null;

  // find all time nodes
  var children = this.getNode().childNodes;
  for (var i = 0; i < children.length; i++) {
    var segment = children[i];
    var targets = new Array();
    if (segment.nodeType == 1) { // Node.ELEMENT_NODE
      if (segment.timing || segment.getAttribute("timing")) { // OLDIE
        // XXX already initialized: should never happen
        consoleLog("!! " + segment.nodeName + " is already initialized !!");
        alert("!! " + segment.nodeName + " is already initialized !!");
        //var segment = segment.timing;
      }
      //else if (segment.nodeName.toLowerCase == "smil:item") { // timesheet item
      else if (/item$/i.test(segment.nodeName)) { // timesheet item
        // TODO: create several time nodes
        var select = segment.getAttribute("select")
                  || segment.getAttribute("smil:select");
        targets = document.querySelectorAll(select);
      }
      else {
        targets.push(segment);
      }
      // push all time nodes
      for (var j = 0; j < targets.length; j++) {
        var target = targets[j];
        var node = null;
        if (segment != target) { // timesheet item
          node = new smilTimeItem(segment, this, target);
          var beginInc = node.parseAttribute("beginInc");
          if (isNaN(node.begin) && !isNaN(beginInc))
            node.begin = j * beginInc;
        }
        else
          node = new smilTimeElement(segment, this);
        // set syncMasterNode if found
        if (node.parseAttribute("syncMaster"))
          syncMasterNode = target;
        // ignore this node if it has a null 'timeAction' attribute
        if (node.timeAction != "none")
          timeNodes.push(node);
        else
          delete(node);
      }
    }
  }

  // add parentNode, previousSibling, nextSibling -- just in case
  for (i = 0; i < timeNodes.length; i++) {
    var segment = timeNodes[i];
    if (i > 0)
      segment.previousSibling = timeNodes[i-1];
    if (i < timeNodes.length - 1)
      segment.nextSibling = timeNodes[i+1];
    segment.parentNode = this;
  }

  // compute container's maximum duration
  if (this.dur == undefined) {
    if (!isNaN(this.end - this.begin))
      this.dur = this.end - this.begin;
    else
      this.dur = Infinity;
  }

  // compute .time_in and .time_out for each time node whenever possible
  //this.timeNodes = timeNodes;
  //this.computeTimeNodes();
  return {
    timeNodes      : timeNodes,
    syncMasterNode : syncMasterNode
  };
};

// Every time node will get two specific attributes: time_in / time_out.
// These attributes will be initialized wherever possible.
smilTimeContainer_generic.prototype.computeTimeNodes = function() {};

// Looks for a child node with a non-false "syncMaster" attribute:
// returns this node if found, null otherwise.
smilTimeContainer_generic.prototype.getMediaSync = function(syncMasterNode) {
  // Check the (non-standard) 'mediaSync' attribute:
  // this timeContainer attribute directly points to the master clock,
  // which should be either an <audio> or a <video> element.
  var mediaSyncSelector = this.parseAttribute("mediaSync");
  var mediaSyncNode = document.querySelector(mediaSyncSelector);
  return mediaSyncNode || syncMasterNode;
};

// <seq|excl> time containers can only show one item at a time,
// so we can use a 'currentIndex' property for these two containers.
smilTimeContainer_generic.prototype.currentIndex = -1;
smilTimeContainer_generic.prototype.checkIndex = function(index) {
  // update the state of first|prev|next|last targets
  // XXX should be in the onTimeUpdate prototypes, too
  // XXX should be applied the same timeAction as for regular time nodes
  // XXX will raise problems with OLDIE

  var state = (this.currentIndex > 0) ? "active" : "idle";
  if (this.first && !this.first.timing)
    this.first.setAttribute("smil", state);
  if (this.prev && !this.prev.timing)
    this.prev.setAttribute("smil", state);
  state = (this.currentIndex < this.timeNodes.length - 1) ? "active" : "idle";

  if (this.next && !this.next.timing)
    this.next.setAttribute("smil", state);
  if (this.last && !this.last.timing)
    this.last.setAttribute("smil", state);
};
smilTimeContainer_generic.prototype.selectIndex = function(index) {
  if ((index >= 0) && (index < this.timeNodes.length)
                   && (index != this.currentIndex)) {
    consoleLog("current index: " + this.currentIndex);

    // set the time container's time if possible
    var time = this.timeNodes[index].time_in;
    if (!isNaN(time) && (time < Infinity)) {
      consoleLog("hashchange: set time to " + time);
      if (this.mediaSyncNode) { // continuous media
        this.setTime(time + 0.1); // XXX hack
        this.onTimeUpdate();
        return;
      } else
        this.setTime(time);
    }

    // update the target state of all time nodes
    this.currentIndex = index;
    this.timeNodes[index].show();
    // XXX hide() and reset() are reversed here, can't understand why
    for (var i = 0; i < index; i++)
      this.timeNodes[i].hide();
    for (i = index + 1; i < this.timeNodes.length; i++)
      this.timeNodes[i].reset();
    consoleLog("new index: " + this.currentIndex);

    // update the target state of first|prev|next|last
    this.checkIndex();
  }
};
smilTimeContainer_generic.prototype.selectItem = function(item) {
  var index = this.timeNodes.indexOf(item);
  this.selectIndex(index);
};

// Constructor: *CANNOT* be called directly, use smilTimeElement instead.
function smilTimeContainer_generic(timeContainerNode, parentNode, timerate) {
  // We should inherit from smilTimeItem explicitely in this constructor,
  // but since we'll never use this constructor directly (see 'smilTimeElement'
  // below), this line is disabled.
  //smilTimeItem.call(this, timeContainerNode);
  this.parseTimeNodes = smilTimeContainer_generic.prototype.parseTimeNodes;
  this.getMediaSync   = smilTimeContainer_generic.prototype.getMediaSync;
  var self = this;

  // http://www.w3.org/TR/SMIL/smil-timing.html#Timing-repeatSyntax
  this.repeatCount = this.parseAttribute("repeatCount", 1);
  this.repeatDur   = this.parseAttribute("repeatDur", NaN);

  // parse child nodes and compute start/stop times whenever possible
  consoleLog("  initializing: " + this.timeContainer + " (" + this.getNode().nodeName + ")");
  var result = this.parseTimeNodes();
  //var syncMasterNode = result.syncMasterNode;
  this.timeNodes = result.timeNodes;
  this.computeTimeNodes();
  if (true) { // consoleLog
    consoleLog("  time container: " + this.timeContainer + " (" + this.getNode().nodeName + ")");
    for (var i = 0; i < this.timeNodes.length; i++) // consoleLog
      consoleLog("    timeNodes[" + i + "]: " + this.timeNodes[i].time_in + " => " + this.timeNodes[i].time_out);
  } // consoleLog

  // timer
  this.mediaSyncNode = this.getMediaSync(result.syncMasterNode);
  var timer = (this.mediaSyncNode) ? new smilExternalTimer(this.mediaSyncNode)
                                   : new smilInternalTimer(timerate);
  // XXX it would be simpler (?) to inherit from the timer
  this.isPaused = timer.isPaused;
  this.getTime  = timer.getTime;
  this.setTime  = timer.setTime;
  this.Play     = timer.Play;
  this.Pause    = timer.Pause;
  this.Stop     = timer.Stop;
  timer.onTimeUpdate = function() { self.onTimeUpdate(); };
  
  // Public methods to show/hide/reset time container
  var state = "";
  this.isActive = function() { return (state == "active"); };
  this.show  = function() {
    if (state == "active") return;
    state = "active";
    self.Play();
    self.setTargetState(state);
    //consoleLog("timeContainer: " + self.timeContainer + " / " + self.timeAction + " -- " + state);
    this.currentIndex = -1;
  };
  this.hide  = function() {
    if (state == "done") return;
    state = "done";
    self.Stop();
    self.setTargetState(state);
    for (var i = 0; i < self.timeNodes.length; i++) {
      self.timeNodes[i].hide();
      if (self.timeNodes[i].fill == "hold")
        self.timeNodes[i].setTargetState("done");
    }
    //consoleLog("timeContainer: " + self.timeContainer + " / " + self.timeAction + " -- " + state);
    // do not reset currentIndex in this case
  };
  this.reset = function() {
    if (state == "idle") return;
    state = "idle";
    self.Stop();
    self.setTargetState(state);
    for (var i = 0; i < self.timeNodes.length; i++)
      self.timeNodes[i].reset();
    //consoleLog("timeContainer: " + self.timeContainer + " / " + self.timeAction + " -- " + state);
    this.currentIndex = -1;
  };

  // experimental: attach this timeContainer to the HTML node
  //this.getNode().timing = this; // moved to smilTimeItem()
}


/*****************************************************************************\
|                                                                             |
|  smilTimeContainer_par                                                      |
|  extends smilTimeContainer_generic                                          |
|                                                                             |
\*****************************************************************************/

// Time Sync
smilTimeContainer_par.prototype.computeTimeNodes = function() {
  //var self = this;
  for (var i = 0; i < this.timeNodes.length; i++) {
    var segment = this.timeNodes[i];
    segment.reset();

    // time_in
    if (segment.begin != undefined)
      //segment.time_in = segment.begin;
      segment.time_in = isNaN(segment.begin) ? Infinity : segment.begin;
    else
      segment.time_in = 0;

    // time_out
    if (segment.dur != undefined)
      segment.time_out = segment.time_in + segment.dur;
    else if (segment.end != undefined)
      //segment.time_out = segment.end;
      segment.time_out = isNaN(segment.end) ? Infinity : segment.end;
    else
      segment.time_out = this.dur;
  }
};
smilTimeContainer_par.prototype.onTimeUpdate = function() {
  var time = this.getTime();
  // FIXME handle integer values of repeatCount
  if (this.repeatCount >= Infinity)
    time = time % this.dur;

  // update the state for all time nodes
  for (var i = 0; i < this.timeNodes.length; i++) {
    if (time < this.timeNodes[i].time_in)
      this.timeNodes[i].reset();
    else if (time >= this.timeNodes[i].time_out)
      this.timeNodes[i].hide();
    else
      this.timeNodes[i].show();
  }
};

// Constructor (should not be called directly, see smilTimeElement)
function smilTimeContainer_par(domNode, parentNode, timerate) {
  this.computeTimeNodes = smilTimeContainer_par.prototype.computeTimeNodes;
  this.onTimeUpdate     = smilTimeContainer_par.prototype.onTimeUpdate;
  smilTimeContainer_generic.call(this, domNode, timerate);

  // index management is not available on <par> containers
  this.currentIndex = -1;
  this.checkIndex  = function(index){};
  this.selectIndex = function(index){};
  this.selectItem  = function(item){
    if (!isNaN(item.time_in))
      this.setTime(item.time_in);
    item.show();
  };
}


/*****************************************************************************\
|                                                                             |
|  smilTimeContainer_excl                                                     |
|  extends smilTimeContainer_generic                                          |
|                                                                             |
\*****************************************************************************/

// Time Sync
smilTimeContainer_excl.prototype.computeTimeNodes = function() {
  var segment = null;
  for (i = 0; i < this.timeNodes.length; i++) {
    segment = this.timeNodes[i];
    segment.reset();

    // time_in
    if (segment.begin != undefined)
      //segment.time_in = segment.begin;
      segment.time_in = isNaN(segment.begin) ? Infinity : segment.begin;
    else
      //segment.time_in = NaN; // XXX should be Infinity
      segment.time_in = Infinity;

    // time_out
    if (segment.end != undefined)
      //segment.time_out = segment.end;
      segment.time_out = isNaN(segment.end) ? Infinity : segment.end;
    else if ((i < this.timeNodes.length-1) && !isNaN(this.timeNodes[i+1].begin))
      segment.time_out = this.timeNodes[i+1].begin;
    else if (!isNaN(segment.dur))
      segment.time_out = segment.time_in + segment.dur;
    else
      segment.time_out = this.dur;
  }
  if (!segment) // no time node found
    return;

  // activate the first time node if required implicitely
  if (!this.timeNodes[0].time_in) // null, NaN or undefined
    this.timeNodes[0].show();

  // set the Time Container's "dur/end" attributes if undefined
  if (this.dur == undefined)
    this.dur = segment.time_out - this.timeNodes[0].time_in;
  //if (this.end == undefined)
    //this.end = segment.time_out;
};
smilTimeContainer_excl.prototype.onTimeUpdate = function() {
  var time = this.getTime();
  // FIXME handle integer values of repeatCount
  if (this.repeatCount >= Infinity)
    time = time % this.dur;

  // are we still in the same time node?
  if (this.currentIndex >= 0) {
    var time_in  = this.timeNodes[this.currentIndex].time_in;
    var time_out = this.timeNodes[this.currentIndex].time_out;
    // note: 'outOfBounds' is false if time_in and time_out are both 'NaN'
    var outOfBounds = (time < time_in) || (time >= time_out);
    if (!outOfBounds)
      return;
    //else
      //this.timeNodes[this.currentIndex].hide();
  }

  // Now we're sure we're not in the same time node.
  // For <excl|seq> nodes, only one element can be active at a time,
  // let's try to find out which.
  var index = -1;
  var active = false;
  for (var i = 0; i < this.timeNodes.length; i++) {
    var segment = this.timeNodes[i];
    var withinBounds = (time >= segment.time_in) && (time < segment.time_out);
    if (time < segment.time_in)
      segment.reset();
    else if (time >= segment.time_out)
      segment.hide();
    else if (withinBounds) {
      //return (this.selectIndex(i));
      if (active) {
        // there's already an active time node
        segment.reset();
      } else {
        active = true;
        segment.show();
        index = i;
      }
    }
  }

  // show the next active item
  if (index >= 0) {
    this.currentIndex = index;
    this.checkIndex();
    //consoleLog("timeSync_seq, new index: " + index);
  }
  else if ((this.currentIndex < this.timeNodes.length - 1)
      && isNaN(this.timeNodes[this.currentIndex + 1].time_in)) {
    //this.next();
    consoleLog("excl index = " + this.currentIndex);
    this.selectIndex(this.currentIndex + 1);
  }
};

// Constructor (should not be called directly, see smilTimeElement)
function smilTimeContainer_excl(domNode, parentNode, timerate) {
  this.computeTimeNodes = smilTimeContainer_excl.prototype.computeTimeNodes;
  this.onTimeUpdate     = smilTimeContainer_excl.prototype.onTimeUpdate;
  smilTimeContainer_generic.call(this, domNode, parentNode, timerate);
  var self = this;

  // index management
  this.currentIndex = -1;
  if (this.timeNodes.length && (this.timeNodes[0].time_in <= 0))
    this.currentIndex = 0; // XXX hack for the 'audio.xhtml' demo with Firefox
  this.checkIndex  = smilTimeContainer_generic.prototype.checkIndex;
  this.selectIndex = smilTimeContainer_generic.prototype.selectIndex;
  this.selectItem  = smilTimeContainer_generic.prototype.selectItem;

  // lazy user interaction
  this.first = this.parseEvent(this.parseAttribute("first"), function() {
    self.selectIndex(0);
  });
  this.prev  = this.parseEvent(this.parseAttribute("prev"),  function() {
    self.selectIndex(self.currentIndex - 1);
  });
  this.next  = this.parseEvent(this.parseAttribute("next"),  function() {
    self.selectIndex(self.currentIndex + 1);
  });
  this.last  = this.parseEvent(this.parseAttribute("last"),  function() {
    self.selectIndex(self.timeNodes.length - 1);
  });
  this.checkIndex();
}


/*****************************************************************************\
|                                                                             |
|  smilTimeContainer_seq                                                      |
|  extends smilTimeContainer_generic                                          |
|                                                                             |
\*****************************************************************************/

// Time Sync
smilTimeContainer_seq.prototype.computeTimeNodes = function() {
  var segment = null;
  for (var i = 0; i < this.timeNodes.length; i++) {
    segment = this.timeNodes[i];
    segment.reset();

    // time_in
    // FIXME: this won't work if the time nodes aren't stored in
    //        chronological order.
    if (segment.begin != undefined)
      segment.time_in = segment.begin;
    //else if (i)
    else if ((i > 0) && (this.timeNodes[i-1].time_out < Infinity))
      segment.time_in = this.timeNodes[i-1].time_out;
    else
      segment.time_in = 0;

    // time_out
    if (!isNaN(segment.dur))
      segment.time_out = segment.time_in + segment.dur;
    else if (i == this.timeNodes.length -1)
      segment.time_out = this.dur;
    else
      segment.time_out = Infinity;
  }

  // set the Time Container's "dur/end" attributes if undefined
  if (!segment) // no time node found
    return;
  if ((this.dur == undefined) || (this.dur >= Infinity))
    this.dur = segment.time_out;
  if (this.end == undefined)
    this.end = segment.time_out + this.begin;
};
smilTimeContainer_seq.prototype.onTimeUpdate = function() {
  var time = this.getTime();
  // FIXME handle integer values of repeatCount
  if (this.repeatCount >= Infinity)
    time = time % this.dur;

  // are we still in the same time node?
  if (this.currentIndex >= 0) {
    //var time_in  = this.timeNodes[this.currentIndex].time_in;
    //var time_out = this.timeNodes[this.currentIndex].time_out;
    var segment = this.timeNodes[this.currentIndex];
    // note: 'outOfBounds' is false if time_in and time_out are both 'NaN'
    var outOfBounds  = (time < segment.time_in) || (time >= segment.time_out);
    var withinBounds = (time >= segment.time_in) && (time < segment.time_out);
    if (withinBounds)
      return;
    else
      this.timeNodes[this.currentIndex].hide();
  }

  // Now we're sure we're not in the same time node.
  // For <excl|seq> nodes, only one element can be active at a time,
  // let's try to find out which.

  // There are good chances that the next time node is selected.
  if (this.currentIndex < this.timeNodes.length - 1) {
    var time_in  = this.timeNodes[this.currentIndex + 1].time_in;
    var time_out = this.timeNodes[this.currentIndex + 1].time_out;
    // note: 'outOfBounds' is false if time_in and time_out are both 'NaN'
    var outOfBounds = (time < time_in) || (time >= time_out);
    if ((time_in >= Infinity) || !outOfBounds) {
      this.currentIndex++;
      this.timeNodes[this.currentIndex].show();
      this.checkIndex();
      return;
    }
  }

  // Rats, now we have to search through all time nodes.
  var index = -1;
  var active = false;
  for (var i = 0; i < this.timeNodes.length; i++) {
    var segment = this.timeNodes[i];
    var withinBounds = (time >= segment.time_in) && (time < segment.time_out);
    if (time < segment.time_in)
      segment.reset();
    else if (time >= segment.time_out)
      segment.hide();
    else if (withinBounds) {
      //return (this.selectIndex(i));
      if (active) {
        // there's already an active time node
        segment.reset();
      } else {
        active = true;
        segment.show();
        index = i;
      }
    }
  }

  // show the next active item
  if (index >= 0) {
    this.currentIndex = index;
    this.checkIndex();
    //consoleLog("timeSync_seq, new index: " + index);
  }
  else if ((this.currentIndex < this.timeNodes.length - 1)
      && isNaN(this.timeNodes[this.currentIndex + 1].time_in))
    this.next();
};

// Constructor (should not be called directly, see smilTimeElement)
function smilTimeContainer_seq(domNode, parentNode, timerate) {
  this.computeTimeNodes = smilTimeContainer_seq.prototype.computeTimeNodes;
  this.onTimeUpdate     = smilTimeContainer_seq.prototype.onTimeUpdate;
  smilTimeContainer_generic.call(this, domNode, parentNode, timerate);
  var self = this;

  // index management
  this.currentIndex = -1;
  if (this.timeNodes.length && (this.timeNodes[0].time_in <= 0))
    this.currentIndex = 0; // XXX hack for the 'audio.xhtml' demo with Firefox
  this.checkIndex  = smilTimeContainer_generic.prototype.checkIndex;
  this.selectIndex = smilTimeContainer_generic.prototype.selectIndex;
  this.selectItem  = smilTimeContainer_generic.prototype.selectItem;

  // lazy user interaction (should be specific to <excl> but heck...)
  this.first = this.parseEvent(this.parseAttribute("first"), function() {
    self.selectIndex(0);
  });
  this.prev  = this.parseEvent(this.parseAttribute("prev"),  function() {
    self.selectIndex(self.currentIndex - 1);
  });
  this.next  = this.parseEvent(this.parseAttribute("next"),  function() {
    self.selectIndex(self.currentIndex + 1);
  });
  this.last  = this.parseEvent(this.parseAttribute("last"),  function() {
    self.selectIndex(self.timeNodes.length - 1);
  });
  this.checkIndex();
}


/*****************************************************************************\
|                                                                             |
|  smilTimeElement (                                                          |
|    domNode   : node of the SMIL element (in the HTML or Timesheet document) |
|    parentNode: parent time container                                        |
|    timerate  : default timerate for the internal timer (if appliable)       |
|  )                                                                          |
|  extends smilTimeItem                                                       |
|  extends smilTimeContainer_generic when necessary (= for time containers)   |
|                                                                             |
\*****************************************************************************/

function smilTimeElement(domNode, parentNode, timerate) {
  //if (domNode.timing) consoleLog(domNode.nodeName + " is already intialized.");
  smilTimeItem.call(this, domNode, parentNode);
  switch (this.timeContainer) {
    case "par":
      smilTimeContainer_par.call(this, domNode, parentNode, timerate);
      break;
    case "seq":
      smilTimeContainer_seq.call(this, domNode, parentNode, timerate);
      break;
    case "excl":
      smilTimeContainer_excl.call(this, domNode, parentNode, timerate);
      break;
    default: // time item
      this.timeContainer = null;
      this.timeNodes = new Array();
  }

  // experimental: attach this timeContainer to the HTML node
  if (this.timeContainer) { // consoleLog
    //domNode.timing = this;  // consoleLog
    consoleLog("  " + this.timeContainer + " (" + domNode.nodeName + ") properly initialized.");
  }                         // consoleLog
    //this.getNode().timing = this;
  // define show/hide/reset here rather than in
  // smilTimeItem/smilTimeContainer_generic?
}

})();
