/* Copyright (c) 2010-2011 Fabien Cazenave, INRIA <http://wam.inrialpes.fr/>
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
 * version     : 0.5.0
 * last change : 2011-05-05
 *
 * TODO:
 *  - factorize the onbegin/onend code
 *       in smilTimeItem and smilTimeContainer_generic
 *  - support complex event-values (event + time offset)
 *  - add a decent onDOMReady() for IE<9
 *  - fix the repeatCount/repeatDur stuff
 *  - fix the 'begin' behaviour in 'seq' containers
 *  - redesign EVENTS to make it compatible with bean.js
 *  - propose timesheets.js as jQuery / YUI modules
 */

/*****************************************************************************\
|                                                                             |
|  Browser Abstraction Layer:                                                 |
|    required to cope with Internet Explorer 6/7/8 (see the 'OLDIE' tag)      |
|                                                                             |
\*****************************************************************************/

// ===========================================================================
// EVENTS.[*]: event handler
// ===========================================================================

(function(){
  /***************************************************************************\
  |                                                                           |
  |  Basic Event Management Abstraction Layer                                 |
  |    completely useless... except to support Internet Explorer 6/7/8 :-/    |
  |      * fixes the 'this' reference issue in callbacks on IE<9              |
  |      * handles custom (= non W3C-standard) events on IE<9                 |
  |    exposed as window.EVENTS                                               |
  |                                                                           |
  |---------------------------------------------------------------------------|
  |                                                                           |
  |  Generic events:                                                          |
  |    EVENTS.bind(node, type, callback)                                      |
  |      equivalent to 'node.addEventListener(type, callback, false)'         |
  |    EVENTS.unbind(node, type, callback)                                    |
  |      equivalent to 'node.removeEventListener(type, callback, false)'      |
  |    EVENTS.trigger(node, type)                                             |
  |      equivalent to 'node.dispatchEvent()'                                 |
  |    EVENTS.preventDefault(event)                                           |
  |      equivalent to 'event.preventDefault()'                               |
  |                                                                           |
  |  Specific events:                                                         |
  |    EVENTS.onHashChange(callback)                                          |
  |      triggers 'callback()' when the URL hash is changed                   |
  |    EVENTS.onDOMReady(callback)                                            |
  |      triggers 'callback()' when the DOM content is loaded                 |
  |    EVENTS.onSMILReady(callback)                                           |
  |      triggers 'callback()' when the SMIL content is parsed                |
  |                                                                           |
  \***************************************************************************/

  var EVENTS = {
    bind    : function(node, type, callback) {},
    unbind  : function(node, type, callback) {},
    trigger : function(node, type) {}
  };

  // ==========================================================================
  // Generic Events
  // ==========================================================================
  // addEventListener should work fine everywhere except with IE<9
  if (window.addEventListener) { // modern browsers
    EVENTS.bind = function(node, type, callback) {
      if (!node) return;
      node.addEventListener(type, callback, false);
    };
    EVENTS.unbind = function(node, type, callback) {
      if (!node) return;
      node.removeEventListener(type, callback, false);
    };
    EVENTS.trigger = function(node, type) {
      if (!node) return;
      //console.log(node.innerHTML + " : " + type);
      if (!EVENTS.eventList)
        EVENTS.eventList = [];
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
    };
  }
  else if (window.attachEvent) { // Internet Explorer 6/7/8
    // This also fixes the 'this' reference issue in all callbacks
    // -- both for standard and custom events.
    // http://www.quirksmode.org/blog/archives/2005/10/_and_the_winner_1.html
    // However, this solution isn't perfect. We probably should think of a jQuery
    // dependency for OLDIE.
    EVENTS.bind = function(node, type, callback) {
      if (!node) return;
      var ref = type + callback;
      type = "on" + type;
      if (type in node) { // standard DOM event
        if (!node["e"+ref]) {
          node["e"+ref] = callback;
          node[ref] = function() { // try {
            node["e"+ref](window.event);
          };
          node.attachEvent(type, node[ref]);
        }
      }
      else { // custom event
        if (!node.eventList)
          node.eventList = [];
        if (!node.eventList[type])
          node.eventList[type] = [];
        node.eventList[type].push(callback);
      }
    };
    EVENTS.unbind = function(node, type, callback) {
      if (!node) return;
      var ref = type + callback;
      type = "on" + type;
      if (type in node) { // standard DOM event
        if (node["e"+ref]) {
          node.detachEvent(type, node[ref]);
          try {
            delete(node[ref]);
            delete(node["e"+ref]);
          } catch(e) { // IE6 doesn't support 'delete()' above
            node[ref]     = null;
            node["e"+ref] = null;
          }
        }
      }
      else { // custom event
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
      }
    };
    EVENTS.trigger = function(node, type) {
      if (!node) return;
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
    };
  }

  // ==========================================================================
  // Specific Events
  // ==========================================================================
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
      // a few browsers support addEventListener without DOMContentLoaded:
      // namely, Firefox 1.0, Opera <8 and Safari <2 (according to this link).
      // As these browsers aren't supported any more, we can safely ignore them.
      window.addEventListener("DOMContentLoaded", callback, false);
    else { // Internet Explorer 6/7/8
      // there are plenty other ways to do this without delaying the execution
      // but we haven't taken the time to test the properly yet (FIXME)
      // http://javascript.nwbox.com/IEContentLoaded/
      // http://tanny.ica.com/ICA/TKO/tkoblog.nsf/dx/domcontentloaded-for-browsers-part-v
      // http://www.javascriptfr.com/codes/DOMCONTENTLOADED-DOCUMENT-READY_49923.aspx
      // https://github.com/ded/domready
      // http://www.dustindiaz.com/smallest-domready-ever/
      //function r(f) {
        ///in/.test(document.readyState) ? setTimeout('r('+f+')', 40) : f();
      //}
      //r(callback);
      EVENTS.bind(window, "load", callback);
    }
  };
  // 'MediaContentLoaded' is fired when all media elements have been parsed
  EVENTS.onMediaReady = function(callback) {
    EVENTS.bind(window, "MediaContentLoaded", callback);
  };
  // 'SMILContentLoaded' is fired when all time containers have been parsed
  EVENTS.onSMILReady = function(callback) {
    EVENTS.bind(window, "SMILContentLoaded", callback);
  };

  // ==========================================================================
  // Expose as window.EVENTS
  // ==========================================================================
  window.EVENTS = EVENTS;
})();

// ============================================================================
// QWERY.[*]: CSS selector (requires qwery|sizzle|jQuery|YUI)
// ============================================================================

(function(){
  /***************************************************************************\
  |                                                                           |
  |  CSS Query Selector Abstraction Layer                                     |
  |    completely useless... except to support Internet Explorer 6/7 :-/      |
  |    exposed as window.qwerySelector[All]                                   |
  |                                                                           |
  |  No specific code is included, one of these libraries is required:        |
  |    qwery.js      http://dustindiaz.com/qwery                              |
  |    sizzle.js     http://sizzlejs.com/                                     |
  |    jQuery        http://jquery.com/                                       |
  |    YUI           http://developer.yahoo.com/yui/                          |
  |                                                                           |
  |---------------------------------------------------------------------------|
  |                                                                           |
  |  Generic methods:                                                         |
  |    QWERY.select(cssQuery [, context])                                     |
  |      equivalent to 'document.querySelector(cssQuery)'                     |
  |                 or  'context.querySelector(cssQuery)'                     |
  |    QWERY.selectAll(cssQuery [, context])                                  |
  |      equivalent to 'document.querySelectorAll(cssQuery)'                  |
  |                 or  'context.querySelectorAll(cssQuery)'                  |
  |                                                                           |
  |  Specific methods:                                                        |
  |    QWERY.selectTimeContainers()                                           |
  |      returns all inline time containers                                   |
  |    QWERY.selectExtTimesheets()                                            |
  |      returns all <link> nodes pointing to external timesheets             |
  |                                                                           |
  |  Properties: (read-only)                                                  |
  |    QWERY.supported                                                        |
  |      true if a CSS selector engine is usable, false if not                |
  |    QWERY.native                                                           |
  |      true if no supported CSS selector library is used                    |
  |                                                                           |
  \***************************************************************************/

  var gSupported = true;  // 'false' when no CSS selector can be used
  var gNative    = false; // 'true' when using native *.querySelector[All]
  function qwerySelector    (cssQuery, context) {}
  function qwerySelectorAll (cssQuery, context) {}

  // ==========================================================================
  // querySelectorAll() is required by 'select' attributes in timesheets
  // ==========================================================================

  if (window.qwery) {          // http://www.dustindiaz.com/qwery
    qwerySelectorAll = qwery;
  }
  else if (window.Sizzle) {    // http://sizzlejs.com/
    qwerySelectorAll = Sizzle;
  }
  /* these libs do not return elements in the right DOM order. Blocker!
   * That's surprising for Dojo, since Sizzle.js is a Dojo Foundation project.
  else if (window.cssQuery) {  // http://dean.edwards.name/my/cssQuery/
    qwerySelectorAll = cssQuery;
  }
  else if (window.dojo) {      // http://dojotoolkit.org/
    qwerySelectorAll = dojo.query;
  } */
  else if (window.jQuery) {    // http://jquery.com/
    qwerySelectorAll = function(cssQuery, context) {
      return $(cssQuery, context);
    };
  }
  else if (window.YAHOO        // http://developer.yahoo.com/yui/
        && window.YAHOO.util
        && window.YAHOO.util.Selector) {
    qwerySelectorAll = YAHOO.util.Selector.query;
  }
  /* these frameworks are untested
   * (read: could't get them to work on my development box :-/)
  else if (window.Ext) {       // http://www.sencha.com/products/js/
    qwerySelectorAll = Ext.select;
  }
  else if (window.$$) {        // http://prototypejs.org/ http://mootools.net/
    qwerySelectorAll = function(cssQuery, context) {
      return $$(cssQuery, context);
    };
  } */
  else if (document.querySelectorAll) { // IE8 and modern browsers
    gNative = true;
    qwerySelectorAll = function(cssQuery, context) {
      context = context || document;
      return context.querySelectorAll(cssQuery);
    };
  }
  else { // OLDIE (IE6, IE7) and no CSS Selector library
    gSupported = false;
    // Crap. We'll just test anchors and tag names then.
    // XXX this will never work for 'select' attributes (timesheets)
    qwerySelectorAll = function(cssQuery, context) {
      context = context || document;
      var results = [];
      if (/^#[^\s]+$/.test(cssQuery)) {      // anchor?
        var target = document.getElementById(cssQuery.substring(1));
        if (target)
          results.push(target);
      }
      else if (/^[a-z]+$/i.test(cssQuery)) { // tag name?
        results = context.getElementsByTagName(cssQuery);
      }
      return results;
    }
  };

  // ==========================================================================
  // querySelector() is required to support the 'mediaSync' attribute
  // ==========================================================================

  if (document.querySelector) { // IE8 and modern browsers
    qwerySelector = function(cssQuery, context) {
      context = context || document;
      return context.querySelector(cssQuery);
    };
  }
  else { // OLDIE (IE6, IE7) and no CSS Selector library
    // fallback to qwerySelectorAll()
    qwerySelector = function(cssQuery, context) {
      var results = qwerySelectorAll(cssQuery, context);
      if (results && results.length)
        return results[0];
      else
        return null;
    };
  }

  // ==========================================================================
  // Timesheets-specific parsing helpers
  // ==========================================================================

  function qweryTimeContainers() { // inline time containers
    if (gSupported) return qwerySelectorAll(
      "*[data-timecontainer], *[smil-timecontainer], *[timeContainer]");
    // OLDIE (IE6, IE7) and no CSS Selector library
    var results = [];
    var tmp = document.getElementsByTagName("*");
    var re = /^(par|seq|excl)$/i;
    for (var i = 0; i < tmp.length; i++) {
      if (re.test(tmp[i].nodeName)
          || tmp[i].getAttribute("data-timecontainer")
          || tmp[i].getAttribute("smil-timecontainer")
          || tmp[i].getAttribute("timeContainer")) {
        results.push(tmp[i]);
      }
    }
    return results;
  }
  function qweryExtTimesheets() { // external timesheets
    if (gSupported) return qwerySelectorAll("link[rel=timesheet]");
    // OLDIE (IE6, IE7) and no CSS Selector library
    var results = [];
    var links = document.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++) {
      if (links[i].rel.toLowerCase() == "timesheet") {
        results.push(links[i]);
      }
    }
    return results;
  }

  // ==========================================================================
  // Expose
  // ==========================================================================

  window.QWERY = {
    select               : qwerySelector,
    selectAll            : qwerySelectorAll,
    selectTimeContainers : qweryTimeContainers,
    selectExtTimesheets  : qweryExtTimesheets,
    supported            : gSupported,
    nativeSelector       : gNative
  };
})();

// ============================================================================
// Array.indexOf(), Date.now()
// ============================================================================

if (!Array.indexOf) Array.prototype.indexOf = function(obj) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] == obj) {
      return i;
    }
  }
  return -1;
};
if (!Date.now) Date.now = function() {
  var timestamp = new Date();
  return timestamp.getTime();
};


/*****************************************************************************\
|                                                                             |
|  SMIL/Timing and SMIL/Timesheet implementation                              |
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
|                                                                             |
|  Public API:                                                                |
|                                                                             |
|    document.createTimeContainer(domNode, parentNode, targetNode, timerate)  |
|    document.getTimeNodesByTarget(node)                                      |
|    document.getTimeContainersByTarget(node)                                 |
|    document.getTimeContainersByTagName(tagName)                             |
|                                                                             |
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
function consoleWarn(message) {
  if (typeof(console) == "object")
    console.warn(message);
}

// default timeContainer refresh rate = 40ms (25fps)
var TIMERATE = 40;
if (window.mejs) // http://mediaelementjs.com/
  mejs.MediaElementDefaults.timerRate = TIMERATE;

// array to store all time containers
var TIMECONTAINERS = [];

// Detect Internet Explorer 6/7/8
// these browsers don't support XHTML, <audio|video>, addEventListener...
var OLDIE = (window.addEventListener) ? false : true;
// var IE6 = (window.XMLHttpRequest) ? false : true;


// ===========================================================================
// Activate a time node if a hash is found in the URL
// ===========================================================================
function checkHash() {
  var targetElement = null; // target DOM node
  var targetTiming  = null; // target time node
  var container     = null; // ???
  var i, tmp;

  // get the URI target element
  var hash = document.location.hash;
  if (hash.length) {
    consoleLog("new hash: " + hash);
    var targetID = hash.substr(1).replace(/\&.*$/, "");
    // the hash may contain a leading char (e.g. "_") to prevent scrolling
    targetElement = document.getElementById(targetID)
                 || document.getElementById(targetID.substr(1));
  }
  if (!targetElement) return;
  consoleLog(targetElement);

  // get the target time node (if any)
  tmp = document.getTimeNodesByTarget(targetElement);
  if (tmp.length) {
    targetTiming = tmp[0];
    container = tmp[0].parentNode;
  }

  // the hash might contain some temporal MediaFragment information
  var time = NaN;
  if (targetTiming && targetTiming.timeContainer) {
    tmp = hash.split("&");
    for (i = 0; i < tmp.length; i++) {
      if (/^t=.*/i.test(tmp[i])) { // drop end time (if any)
        time = targetTiming.parseTime(tmp[i].substr(2).replace(/,.*$/, ""));
        break;
      }
    }
  }

  // activate the time container on the target element:
  // http://www.w3.org/TR/SMIL3/smil-timing.html#Timing-HyperlinkImplicationsOnSeqExcl
  // we're extending this to all time containers, including <par>
  // -- but we still haven't checked wether '.selectIndex()' works properly with <par>
  var containers = [];
  var indexes    = [];
  var timeNodes  = [];
  var element = targetElement;
  while (container) {
    for (var index = 0; index < container.timeNodes.length; index++) {
      if (container.timeNodes[index].target == element) {
        consoleLog("target found: " + element.nodeName + "#" + element.id);
        if (!container.timeNodes[index].isActive()) {
          containers.push(container);
          indexes.push(index);
          timeNodes.push(container.timeNodes[index]);
        }
        break;
      }
    }
    // loop on the parent container
    element   = container.getNode();
    container = container.parentNode;
  }
  for (i = containers.length - 1; i >= 0; i--) {
    consoleLog(containers[i].nodeName + " - index=" + indexes[i]);
    containers[i].selectIndex(indexes[i]);
    //containers[i].selectItem(timeNodes[i]);
    //containers[i].show();
    //timeNodes[i].show();
  }

  // set the target time container to a specific time if requested (MediaFragment)
  if (targetTiming && !isNaN(time)) {
    targetTiming.setCurrentTime(time);
    consoleLog(targetElement.nodeName + " time: " + time);
  }

  // ensure the target element is visible
  //targetElement.focus(); // not working if targetElement has no tabIndex
  if (targetElement["scrollIntoViewIfNeeded"] != undefined)
    targetElement.scrollIntoViewIfNeeded(); // WebKit browsers only
  else try {
    //targetElement.scrollIntoView();
    var tabIndex = targetElement.tabIndex;
    targetElement.tabIndex = 0;
    targetElement.focus();
    targetElement.blur();
    if (tabIndex >= 0)
      targetElement.tabIndex = tabIndex;
    else
      targetElement.removeAttribute("tabIndex");
  } catch(e) {}
}
EVENTS.onSMILReady(function() {
  consoleLog("SMIL data parsed, starting 'hashchange' event listener.");
  checkHash(); // force to check once at startup
  EVENTS.onHashChange(checkHash);
});

// ===========================================================================
// Find all <audio|video> elements in the current document
// ===========================================================================
function parseMediaElement(node) {
  // use MediaElement.js when available: http://mediaelementjs.com/
  if (window.MediaElement) {
    var m = new MediaElement(node, {
      success: function(mediaAPI, element) {
        // note: element == node here
        consoleLog("MediaElement with " + mediaAPI.pluginType + " player");
        if ((/^(flash|silverlight)$/i).test(mediaAPI.pluginType)) {
          // we're using a Flash/Silverlight <object|embed> fallback
          // now find the related <object|embed> element -- by default, it
          // should be the previous sibling of the <audio|video> element.
          var pluginElement = element.previousSibling;
          // XXX this is precisely what I dislike about MediaElement.js:
          //  * there's no proper way to get the <object> node ref
          //  * the <object> node can be included in a <div> container
          //  * the <object> node is not a child of the <audio|video> element
          //    IE: pluginElement = <object id="me_[flash|Silverlight]_##" ... </object>
          // other: pluginElement = <div class="me-plugin"><object ... </object></div>
          if (element.firstChild &&
              (/^(object|embed)$/i).test(element.firstChild.nodeName)) {
            // Good news! We're using mediaelement4oldie.js:
            // the <object> fallback is a child of the <audio|video> element
            pluginElement = element.firstChild;
            consoleLog("  (childNode)");
          } else if (pluginElement && (
              (/^me_flash/).test(pluginElement.id)       || // IE<9 + Flash
              (/^me_silverlight/).test(pluginElement.id) || // IE<9 + Silverlight
              (pluginElement.className == "me-plugin")
          )) {
            // Bad news: MediaElement.js has inserted the <object|embed>
            // fallback outside of the <audio|video> element.
            // XXX ugly hack to avoid a "display: none" on the <object> container
            pluginElement.setAttribute("timeAction", "none");
            consoleLog("  (previousSibling)");
          }
          // store a pointer to the <object|embed> element, just in case
          element.pluginElement = pluginElement;
          element.mediaAPI      = mediaAPI;
        }
        EVENTS.trigger(document, "MediaElementLoaded");
      },
      error: function() {
        //throw("MediaElement error");
        alert("MediaElement error");
      }
    });
  }
  else { // native HTML5 media element
    //node.pause(); // disable autoplay
    node.setCurrentTime = function(time) {
      node.currentTime = time;
    };
    // TODO: add other MediaElement setters
    EVENTS.trigger(document, "MediaElementLoaded");
  }
}
function parseAllMediaElements() {
  var allAudioElements = document.getElementsByTagName("audio");
  var allVideoElements = document.getElementsByTagName("video");
  var meLength = allAudioElements.length + allVideoElements.length;
  if (meLength === 0) {
    // early way out: no <audio|video> element in the current document
    EVENTS.trigger(window, "MediaContentLoaded");
    return;
  }
  else if (OLDIE && !window.MediaElement) {
    // http://mediaelementjs.com/ required
    // disabled at the moment
    if (0) throw "MediaElement.js is required on IE<9";
  }

  // callback to count all parsed media elements
  var meParsed = 0;
  function CountMediaElements() {
    meParsed++;
    if (meParsed >= meLength) {
      EVENTS.unbind(document, "MediaElementLoaded", CountMediaElements);
      EVENTS.trigger(window, "MediaContentLoaded");
    }
  }
  EVENTS.bind(document, "MediaElementLoaded", CountMediaElements);

  // initialize all media elements
  for (var i = 0; i < allAudioElements.length; i++)
    parseMediaElement(allAudioElements[i]);
  for (i = 0; i < allVideoElements.length; i++)
    parseMediaElement(allVideoElements[i]);
}

// ===========================================================================
// Find all time containers in the current document
// ===========================================================================
function parseTimeContainerNode(node) {
  if (!node) return;
  // Don't create a new smilTimeElement if this node already has a
  // parent time container.
  if (!node.timing) {
    consoleLog("Main time container found: " + node.nodeName);
    consoleLog(node);
    // the "timing" property isn't set: this node hasn't been parsed yet.
    var smilPlayer = new smilTimeElement(node);
    smilPlayer.show();
  } else {
    consoleLog("Child time container found: " + node.nodeName);
  }
}
function parseTimesheetNode(timesheetNode) {
  var containers = timesheetNode.childNodes;
  for (var i = 0; i < containers.length; i++) {
    if (containers[i].nodeType == 1) { // Node.ELEMENT_NODE
      parseTimeContainerNode(containers[i]);
    }
  }
}
function parseAllTimeContainers() {
  TIMECONTAINERS = [];

  // Inline Time Containers (HTML namespace)
  var allTimeContainers = QWERY.selectTimeContainers();
  for (var i = 0; i < allTimeContainers.length; i++)
    parseTimeContainerNode(allTimeContainers[i]);

  // External Timesheets: callback to count all parsed timesheets
  var timesheets = QWERY.selectExtTimesheets();
  var tsLength = timesheets.length;
  var tsParsed = 0;
  function CountTimesheets() {
    tsParsed++;
    if (tsParsed > tsLength) {
      EVENTS.unbind(document, "SMILTimesheetLoaded", CountTimesheets);
      EVENTS.trigger(window, "SMILContentLoaded");
    }
  }
  EVENTS.bind(document, "SMILTimesheetLoaded", CountTimesheets);

  // External Timesheets: parsing
  var xhr;
  for (i = 0; i < tsLength; i++) {
    // IE6 doesn't support XMLHttpRequest natively
    // IE6/7/8 don't support overrideMimeType with native XMLHttpRequest
    // IE6/7/8/9 don't allow loading any local file with native XMLHttpRequest
    // so we use ActiveX for XHR on IE, period.
    if (window.ActiveXObject) {
      xhr = new ActiveXObject("Microsoft.XMLHTTP");
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
      xhr = new XMLHttpRequest();
      xhr.overrideMimeType("text/xml");
      xhr.open("GET", timesheets[i].href, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
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
    var ns = {
      "xhtml" : "http://www.w3.org/1999/xhtml", 
      "svg"   : "http://www.w3.org/2000/svg",
      "smil"  : docElt.getAttribute("xmlns:smil") || "http://www.w3.org/ns/SMIL"
    };
    function nsResolver(prefix) { return ns[prefix] || null; }

    // Internal Timesheets
    var TimesheetNS = nsResolver("smil");
    timesheets = document.getElementsByTagNameNS(TimesheetNS, "timesheet");
    if (!timesheets.length) // polyglot markup (not working with OLDIE)
      timesheets = document.getElementsByTagName("timesheet");
    for (i = 0; i < timesheets.length; i++)
      parseTimesheetNode(timesheets[i]);

    // Inline Time Containers (SMIL namespace) -- we have to use XPath because
    // document.querySelectorAll("[smil|timeContainer]") raises an exception.
    //if (docElt.getAttribute("xmlns") && docElt.getAttribute("xmlns:smil")) {
    if (docElt.getAttribute("xmlns")) {
      // the document might have SMIL extensions
      var containers = document.evaluate("//*[@smil:timeContainer]", document,
                  nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      var thisContainer = containers.iterateNext();
      try {
        while (thisContainer) {
          parseTimeContainerNode(thisContainer);
          thisContainer = containers.iterateNext();
        }
      } catch(e) { // Safari tends to raise exceptions here, dunno why
        //consoleLog(e.toString());
      }
    }
  }

  // for our counter, all internal timing data is considered as one timesheet
  EVENTS.trigger(document, "SMILTimesheetLoaded");
}

// ===========================================================================
// Startup: get all media elements first, then all time containers
// ===========================================================================
EVENTS.onDOMReady(function() {
  consoleLog("SMIL/HTML Timing: startup");
  EVENTS.onMediaReady(parseAllTimeContainers);
  parseAllMediaElements();
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
    //consoleLog("started: " + timerID);
  };
  this.Pause = function() {
    if (paused) return;
    clearInterval(timerID);
    timerID = null;
    timePause = 1000 * self.getTime();
    paused = true;
    self.onTimeUpdate();
    //consoleLog("paused: " + timerID);
  };
  this.Stop = function() {
    if (!timerID) return;
    clearInterval(timerID);
    timerID = null;
    timePause = 0;
    paused = true;
    self.onTimeUpdate();
    //consoleLog("stopped: " + timerID);
  };
}
/*
function _smilExternalTimer(mediaPlayerNode) {
  var self = this;
  this.onTimeUpdate = null;

  // autoplay? (HTML5 boolean attribute)
  //var autoplay = mediaPlayerNode.getAttribute("autoplay");
  //this.autoplay = (autoplay != null) && (autoplay.toLowerCase() != "false");
  //consoleLog("autoplay: " + this.autoplay);
  // XXX with MediaElement.js v.2.0.0pre, 'autoplay' is handled as a string attribute.
  //     To handle 'autoplay' as a boolean attribute, here's a quick fix (replace line #559):
  //autoplay = (typeof autoplay == 'undefined' || autoplay === null || autoplay === 'false') ? '' : autoplay;
  //autoplay = (autoplay != null) && (autoplay.toLowerCase() != "false"); // kaze

  // use MediaElement.js when available: http://mediaelementjs.com/
  var mediaPlayerAPI = mediaPlayerNode;
  if (mediaPlayerNode.mediaAPI) {
    // XXX looks like MediaElement.js makes this useless. Sweet!
    //     ...but IE6 somehow needs it. Ugh.
    mediaPlayerAPI = mediaPlayerNode.mediaAPI;
    consoleLog("MediaElement interface found.");
  }

  // read-only properties: isPaused(), getTime()
  this.isPaused = function() { return mediaPlayerAPI.paused; };
  this.getTime  = function() { return mediaPlayerAPI.currentTime; };
  this.setTime  = function(time) {
    try {
      mediaPlayerAPI.setCurrentTime(time);
      consoleLog("setting media time to " + time);
    } catch(e) {
      // XXX this is highly suspected to cause a bug with Firefox 4
      //if (OLDIE) return;
      consoleLog(e);
      consoleLog("seeking to time=" + time + "...");
      consoleLog("  readyState = " + mediaPlayerAPI.readyState);
      function setThisTime() {
        mediaPlayerAPI.setCurrentTime(time);
        mediaPlayerAPI.removeEventListener("canplay", setThisTime, false);
        //mediaPlayerAPI.removeEventListener("seeked", setThisTime, false);
        consoleLog("  readyState = " + mediaPlayerAPI.readyState);
      }
      mediaPlayerAPI.addEventListener("canplay", setThisTime, false);
      //mediaPlayerAPI.addEventListener("seeked", setThisTime, false);
    }
  };

  // public methods: Play(), Pause(), Stop()
  // TODO: implement the HTML5 MediaElement API instead
  this.Play  = function() {
    consoleLog("starting continuous timeContainer");
    mediaPlayerAPI.addEventListener("timeupdate", self.onTimeUpdate, false);
  };
  this.Pause = function() {
    mediaPlayerAPI.pause(); // XXX useless? confusing?
  };
  this.Stop  = function() {
    if (mediaPlayerAPI.removeEventListener) // !OLDIE
      mediaPlayerAPI.removeEventListener("timeupdate", self.onTimeUpdate, false);
    //mediaPlayerNode.currentTime = 0;
  };
}
*/
function smilExternalTimer(mediaPlayerNode) {
  var self = this;
  var currentTime = NaN;
  this.onTimeUpdate = null;

  // use MediaElement.js when available: http://mediaelementjs.com/
  var mediaPlayerAPI = mediaPlayerNode;
  if (mediaPlayerNode.mediaAPI) {
    // XXX looks like MediaElement.js makes this useless. Sweet!
    //     ...but IE6 somehow needs it. Ugh.
    mediaPlayerAPI = mediaPlayerNode.mediaAPI;
    consoleLog("MediaElement interface found.");
  }

  // read-only properties: isPaused(), getTime()
  this.isPaused = function() { return mediaPlayerAPI.paused; };
  this.getTime  = function() {
    return isNaN(currentTime) ? mediaPlayerAPI.currentTime : currentTime;
  };
  this.setTime  = function(time) {
    consoleLog("setting media time to " + time);
    if (mediaPlayerAPI.seeking) {
      consoleWarn("seeking");
      function setThisTime() {
        mediaPlayerAPI.setCurrentTime(time);
        mediaPlayerAPI.removeEventListener("seeked", setThisTime, false);
        consoleLog("  readyState = " + mediaPlayerAPI.readyState);
      }
      mediaPlayerAPI.removeEventListener("seeked", setThisTime, false);
      mediaPlayerAPI.addEventListener("seeked", setThisTime, false);
    }
    else try {
      mediaPlayerAPI.setCurrentTime(time);
    } catch(e) {
      //if (OLDIE) return;
      consoleWarn(e);
      consoleLog("seeking to time=" + time + "...");
      consoleLog("  readyState = " + mediaPlayerAPI.readyState);
      function setThisTimeErr() {
        mediaPlayerAPI.setCurrentTime(time);
        mediaPlayerAPI.removeEventListener("canplay", setThisTimeErr, false);
        consoleLog("  readyState = " + mediaPlayerAPI.readyState);
      }
      mediaPlayerAPI.addEventListener("canplay", setThisTimeErr, false);
    }
  };

  // public methods: Play(), Pause(), Stop()
  // TODO: implement the HTML5 MediaElement API instead
  this.Play  = function() {
    consoleLog("starting continuous timeContainer");
    if (mediaPlayerAPI.addEventListener) // !OLDIE
      mediaPlayerAPI.addEventListener("timeupdate", self.onTimeUpdate, false);
  };
  this.Pause = function() {
    if (mediaPlayerAPI.pause) // !OLDIE
      mediaPlayerAPI.pause(); // XXX useless? confusing?
  };
  this.Stop  = function() {
    if (mediaPlayerAPI.removeEventListener) // !OLDIE
      mediaPlayerAPI.removeEventListener("timeupdate", self.onTimeUpdate, false);
    //consoleLog("pause!");
    //mediaPlayerAPI.pause();
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
|    .target                                   target node                    |
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
/*
smilTimeItem.prototype.parseEvent = function(eventStr, callback) { // XXX to be removed
  if (!eventStr || !eventStr.length) return null;

  // TODO: look for "+" in eventStr and handle the time offset
  var tmp = eventStr.split(".");
  var target, evt;
  if (tmp.length >= 2) {
    target = document.getElementById(tmp[0]);
    evt    = tmp[1];
  } else {
    //target = this.getNode();
    target = this.parentTarget;
    evt    = eventStr;
  }
  if (target)
    //EVENTS.bind(target, evt, function() { callback(); });
    EVENTS.bind(target, evt, callback);
  return target;
};
*/
smilTimeItem.prototype.parseEvents = function(eventStr, callback) {
  var events = [];
  if (!eventStr || !eventStr.length || !isNaN(eventStr))
    return events;

  // TODO: look for "+" in eventStr and handle the time offset
  var eventStrArray = eventStr.split(/;\s*/);
  for (var i = 0; i < eventStrArray.length; i++) {
    var tmp = eventStrArray[i].split(".");
    var target, evt;
    if (tmp.length >= 2) {
      target = document.getElementById(tmp[0]);
      evt    = tmp[1];
    } else {
      //target = this.target;
      target = this.parentTarget;
      evt    = eventStr;
    }
    events.push({
      target : target,
      event  : evt
    });
    if (callback)
      EVENTS.bind(target, evt, callback);
  }
  return events;
};
smilTimeItem.prototype.parseAttribute = function(attrName, dValue) {
  var node = this.getNode();
  var nodeName = node.nodeName.replace(/^smil:/, "");
  var value = "";

  // get raw attribute value
  if ((attrName == "timeContainer") && (/^(seq|par|excl)$/i).test(nodeName))
    value = nodeName;
  else
    value = node.getAttribute(attrName)
         || node.getAttribute("data-" + attrName.toLowerCase())
         || node.getAttribute("smil-" + attrName.toLowerCase())
         || node.getAttribute("smil:" + attrName);

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
  if (!target) {
    return function(state) {};
  }

  // show/hide target nodes according to the 'timeAction' attribute
  var setTargetState_intrinsic  = function(state) {
    target.setAttribute("smil", state);
  };
  var setTargetState_display    = function(state) {
    target.setAttribute("smil", state);
    target.style.display = (state == "active") ? "block" : "none";
    /* closer to the spec but raises a bunch of issues. Disabled.
    if (!target._smildisplay) { // not initialized yet
      if (window.getComputedStyle)
        target._smildisplay = getComputedStyle(target, null).display;
      else // OLDIE
        target._smildisplay = target.currentStyle.display;
      consoleLog(target.style.display);
    }
    target.style.display = (state == "active") ? target._smildisplay : "none";
    */
  };
  var setTargetState_visibility = function(state) {
    target.setAttribute("smil", state);
    target.style.visibility = (state == "active") ? "visible" : "hidden";
  };
  var setTargetState_style      = function(state) {
    target.setAttribute("smil", state);
    var active = (state == "active");
    if (!target._smilstyle) // not initialized yet
      target._smilstyle = target.style.cssText;
    target.style.cssText = active ? target._smilstyle : "";
  };
  var setTargetState_class      = function(state) {
    target.setAttribute("smil", state);
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
  // alert(timeAction);
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
    case "intrinsic":
      if (OLDIE) // (!window.XMLHttpRequest)
        // IE6 doesn't support attribute selectors in CSS
        // IE7/8 do support them but the responsiveness is terrible
        // so we default to timeAction="display" for these old browsers
        return setTargetState_display;
      else
        return setTargetState_intrinsic;
    default:
      if (/^class:/.test(timeAction))
        return setTargetState_class;
      /* enable this to set timeAction="intrinsic" as the default behaviour
      else if (OLDIE) // (!window.XMLHttpRequest)
        // IE6 doesn't support attribute selectors in CSS
        // IE7/8 do support them but the responsiveness is terrible
        // so we default to timeAction="visibility" for these old browsers
        return setTargetState_visibility;
      else
        return setTargetState_intrinsic;
      */
      else // timeAction="display" is a less confusing default behaviour
        return setTargetState_display;
      break;
  }
  return null; // to make jslint happy
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
  //EVENTS.trigger(this.target, eventType);
  EVENTS.trigger(this.parentTarget, eventType);
  if (func)
    //func.call(this.target);
    func.call(this.parentTarget);
};

// Constructor: should not be called directly (see smilTimeElement)
// unless you just want to check SMIL attributes.
function smilTimeItem(domNode, parentNode, targetNode) {
  var self = this;
  this.parseTime      = smilTimeItem.prototype.parseTime;
  //this.parseEvent     = smilTimeItem.prototype.parseEvent;
  this.parseEvents    = smilTimeItem.prototype.parseEvents;
  this.parseAttribute = smilTimeItem.prototype.parseAttribute;

  this.parentNode      = parentNode;
  this.previousSibling = null;
  this.nextSibling     = null;
  this.timeNodes       = null; // new Array()

  /** SMIL Targets:
    * .getNode()    = DOM or SMIL node
    *                 used internally, should not be exposed
    * .target       = DOM target carrying the 'smil' attribute
    *                 can be different from domNode for <item> elements
    * .parentTarget = DOM target used by event handlers
    *                 can be different from .target for time containers
    */
  this.getNode = function() { return domNode; };
  this.target  = targetNode || domNode;
  // XXX dirty hack: no 'smil' attribute for time container targets
  //     I can't remember what lead to this (OLDIE?) but it's required...
  if (/^(smil:){0,1}(par|seq|excl)$/i.test(this.target.nodeName))
    this.target = null;
  this.parentTarget = this.target;
  var node = this.parentNode;
  while (!this.parentTarget && node) {
    this.parentTarget = node.target;
    node = node.parentNode;
  }

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
  this.fill        = this.parseAttribute("fill", fillDefault);
  this.fillDefault = this.parseAttribute("fillDefault", null);

  // show/hide target nodes according to the 'timeAction' attribute
  // 'setTargetState' should be considered as a protected method
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
  function onbeginListener() {
    consoleLog("onbeginListener");
    self.time_in = self.parentNode.getCurrentTime();
    self.time_out = isNaN(self.end) ? Infinity : self.end;
    //self.parentNode.onTimeUpdate();
    //self.show();
    self.parentNode.selectItem(self);
  }
  function onendListener() {
    consoleLog("onendListener");
    self.time_in = isNaN(self.begin) ? Infinity : self.begin;
    self.time_out = self.parentNode.getCurrentTime();
    //self.parentNode.onTimeUpdate();
    // XXX dirty hack for <seq> nodes
    if (self.parentNode.timeContainer == "seq")
      self.parentNode.selectIndex(self.parentNode.currentIndex + 1);
    else
      self.parentNode.currentIndex = -1;
    self.hide();
  }

  // main public methods, exposed to DOM via the 'timing' property
  var state = "";
  this.isActive = function() { return (state == "active"); };
  this.show  = function() {
    if (state == "active") return;
    state = "active";
    if (0) try {
      consoleLog(domNode.nodeName + "#" + domNode.id + " -- show()");
    } catch(e) {}
    self.setTargetState(state);
    self.dispatchEvent("begin");
    self.addEventListener(endEvents, onendListener);
    self.removeEventListener(beginEvents, onbeginListener);
    //if (self.parentNode.timeContainer == "excl") consoleLog("show");
  };
  this.hide  = function() {
    if (state == "done") return;
    state = "done";
    if (0) try {
      consoleLog(domNode.nodeName + "#" + domNode.id + " -- hide()");
    } catch(e) {}
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
    if (0) try {
      consoleLog(domNode.nodeName + "#" + domNode.id + " -- reset()");
    } catch(e) {}
    self.setTargetState(state);
    self.addEventListener(beginEvents, onbeginListener);
    self.removeEventListener(endEvents, onendListener);
    //consoleLog("time node: " + self.getNode().nodeName + "/" + self.timeAction + " -- " + state);
    //if (self.parentNode.timeContainer == "excl") consoleLog("reset");
  };

  // attach this object to the target element
  if (targetNode && (targetNode != domNode)) { // timesheet item
    // store the timesheet item reference in the 'extTiming' property
    if (!targetNode.extTiming)
      targetNode.extTiming = [];
    targetNode.extTiming.push(this);
    consoleLog("extTiming: " + targetNode.nodeName);
  } else if (this.target) { // inline timing
    // store the object reference in the 'timing' property
    domNode.timing = this;
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
|    .getCurrentTime()                                                        |
|    .setCurrentTime()                                                        |
|    .Play()                                                                  |
|    .Pause()                                                                 |
|    .Stop()                                                                  |
|                                                                             |
|    .repeatCount              standard SMIL attributes                       |
|    .repeatDur                                                               |
|                                                                             |
\*****************************************************************************/

// Time Sync
smilTimeContainer_generic.prototype.getCurrentTime = function() {};
smilTimeContainer_generic.prototype.setCurrentTime = function() {};
smilTimeContainer_generic.prototype.onTimeUpdate   = function() {};

// This method will return an array of all timeNodes that have a non-null
// timeAction (i.e. where *.timeAction != "none").
smilTimeContainer_generic.prototype.parseTimeNodes = function() {
  var timeNodes = [];
  var syncMasterNode = null;
  var segment;

  // find all time nodes
  var children = this.getNode().childNodes;
  for (var i = 0; i < children.length; i++) {
    segment = children[i];
    var targets = [];
    if (segment.nodeType == 1) { // Node.ELEMENT_NODE
      if (segment.timing || segment.getAttribute("timing")) { // OLDIE
        // XXX already initialized: should never happen
        consoleWarn("!! " + segment.nodeName + " is already initialized !!");
        //alert("!! " + segment.nodeName + " is already initialized !!");
        //segment = segment.timing;
      }
      else if (/^(smil:){0,1}item$/i.test(segment.nodeName)) { // timesheet item
        var select = segment.getAttribute("select")
                  || segment.getAttribute("smil:select");
        targets = QWERY.selectAll(select, this.parentTarget);
        // an <item> with child nodes is considered as a <par> container
        if (segment.childNodes.length)
          segment.setAttribute("timeContainer", "par");
      }
      else {
        targets.push(segment);
      }
      // push all time nodes
      for (var j = 0; j < targets.length; j++) {
        var target = targets[j];
        var node = null;
        if (segment != target) { // timesheet item
          node = new smilTimeElement(segment, this, target);
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
    segment = timeNodes[i];
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
  return QWERY.select(mediaSyncSelector) || syncMasterNode;
};

// <seq|excl> time containers can only show one item at a time,
// so we can use a 'currentIndex' property for these two containers.
smilTimeContainer_generic.prototype.currentIndex = -1;
/*
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
*/
smilTimeContainer_generic.prototype.selectIndex = function(index) {
  // FIXME handle integer values of repeatCount
  if (this.repeatCount == Infinity)
    index = index % this.timeNodes.length;
  if ((index >= 0) && (index < this.timeNodes.length)
                   && (index != this.currentIndex)) {
    consoleLog("current index: " + this.currentIndex);

    // set the time container's time if possible
    var time = this.timeNodes[index].time_in;
    if (!isNaN(time) && (time < Infinity)) {
      consoleLog("hashchange: set time to " + time);
      if (this.mediaSyncNode) { // continuous media
        this.setCurrentTime(time + 0.1); // XXX hack
        this.onTimeUpdate();
        return;
      } else
        this.setCurrentTime(time);
    }

    // update the target state of all time nodes
    this.currentIndex = index;
    this.timeNodes[index].show();
    // XXX hide() and reset() are reversed here, can't understand why
    for (var i = 0; i < index; i++)
      this.timeNodes[i].hide();
    for (i = index + 1; i < this.timeNodes.length; i++)
      this.timeNodes[i].reset();

    // fire event
    //EVENTS.trigger(this.parentTarget, "change");
    this.dispatchEvent("change");
    consoleLog("new index: " + this.currentIndex);

    // update the target state of first|prev|next|last
    //this.checkIndex();
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
  //var timer = (this.mediaSyncNode) ? new smilExternalTimer(this.mediaSyncNode)
                                   //: new smilInternalTimer(timerate);
  var timer = null;
  this.mediaSyncAPI = this.mediaSyncNode;
  if (this.mediaSyncNode) {
    timer = new smilExternalTimer(this.mediaSyncNode);
    if (this.mediaSyncNode.mediaAPI)
      this.mediaSyncAPI = this.mediaSyncNode.mediaAPI;
  } else {
    timer = new smilInternalTimer(timerate);
  }

  // XXX it would be simpler (?) to inherit from the timer
  this.isPaused       = timer.isPaused;
  this.getCurrentTime = timer.getTime;
  this.setCurrentTime = timer.setTime;
  this.Play           = timer.Play;
  this.Pause          = timer.Pause;
  this.Stop           = timer.Stop;
  timer.onTimeUpdate = function() { self.onTimeUpdate(); };

  // event handlers (copied from smilTimeItem)
  this.addEventListener    = smilTimeItem.prototype.addEventListener;
  this.removeEventListener = smilTimeItem.prototype.removeEventListener;
  this.dispatchEvent       = smilTimeItem.prototype.dispatchEvent;
  this.onbegin    = this.parseAttribute("onbegin");
  this.onend      = this.parseAttribute("onend");
  var beginEvents = this.parseEvents(this.begin);
  var endEvents   = this.parseEvents(this.end);
  function onbeginListener() {
    consoleLog("onbeginListener");
    self.time_in = self.parentNode.getCurrentTime();
    self.time_out = isNaN(self.end) ? Infinity : self.end;
    //self.parentNode.onTimeUpdate();
    //self.show();
    self.parentNode.selectItem(self);
  }
  function onendListener() {
    consoleLog("onendListener");
    self.time_in = isNaN(self.begin) ? Infinity : self.begin;
    self.time_out = self.parentNode.getCurrentTime();
    //self.parentNode.onTimeUpdate();
    self.parentNode.currentIndex = -1;
    // XXX dirty hack for <seq> nodes
    if (self.parentNode) {
      if (self.parentNode.timeContainer == "seq")
        self.parentNode.selectIndex(self.parentNode.currentIndex + 1);
      else
        self.parentNode.currentIndex = -1;
      self.hide();
    }
  }

  // Public methods to show/hide/reset time container
  var state = "";
  this.isActive = function() { return (state == "active"); };
  this.show  = function() {
    if (state == "active") return;
    state = "active";
    self.Play();
    self.setTargetState(state);
    //consoleLog("timeContainer: " + self.timeContainer + " / " + self.timeAction + " -- " + state);
    self.dispatchEvent("begin");
    self.addEventListener(endEvents, onendListener);
    self.removeEventListener(beginEvents, onbeginListener);
    this.currentIndex = -1;
  };
  this.hide  = function() {
    if (state == "done") return;
    state = "done";
    self.Stop();
    self.setTargetState(state);
    for (var i = 0; i < self.timeNodes.length; i++) {
      self.timeNodes[i].hide();
      if (self.timeNodes[i].fill != "hold")
        self.timeNodes[i].setTargetState("done");
    }
    //consoleLog("timeContainer: " + self.timeContainer + " / " + self.timeAction + " -- " + state);
    self.dispatchEvent("end");
    self.addEventListener(beginEvents, onbeginListener);
    self.removeEventListener(endEvents, onendListener);
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
    self.addEventListener(beginEvents, onbeginListener);
    self.removeEventListener(endEvents, onendListener);
    this.currentIndex = -1;
  };

  // keep a reference of this timeContainer
  TIMECONTAINERS.push(this);
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
  var time = this.getCurrentTime();
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
  //this.checkIndex  = function(index){};
  this.selectIndex = function(index) {};
  this.selectItem  = function(item) {
    if (!isNaN(item.time_in))
      this.setCurrentTime(item.time_in);
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
  var time = this.getCurrentTime();
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
    //this.checkIndex();
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
  //this.checkIndex  = smilTimeContainer_generic.prototype.checkIndex;
  this.selectIndex = smilTimeContainer_generic.prototype.selectIndex;
  this.selectItem  = smilTimeContainer_generic.prototype.selectItem;

  // lazy user interaction
  this.parseEvents(this.parseAttribute("first"), function() {
    self.selectIndex(0);
  });
  this.parseEvents(this.parseAttribute("prev"),  function() {
    self.selectIndex(self.currentIndex - 1);
  });
  this.parseEvents(this.parseAttribute("next"),  function() {
    self.selectIndex(self.currentIndex + 1);
  });
  this.parseEvents(this.parseAttribute("last"),  function() {
    self.selectIndex(self.timeNodes.length - 1);
  });
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
  var time = this.getCurrentTime();
  var withinBounds, outOfBounds, segment;
  // FIXME handle integer values of repeatCount
  if (this.repeatCount >= Infinity)
    time = time % this.dur;

  // are we still in the same time node?
  if (this.currentIndex >= 0) {
    //var time_in  = this.timeNodes[this.currentIndex].time_in;
    //var time_out = this.timeNodes[this.currentIndex].time_out;
    segment = this.timeNodes[this.currentIndex];
    // note: 'outOfBounds' is false if time_in and time_out are both 'NaN'
    outOfBounds  = (time < segment.time_in) || (time >= segment.time_out);
    withinBounds = (time >= segment.time_in) && (time < segment.time_out);
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
    outOfBounds = (time < time_in) || (time >= time_out);
    if ((time_in >= Infinity) || !outOfBounds) {
      this.currentIndex++;
      this.timeNodes[this.currentIndex].show();
      //this.checkIndex();
      return;
    }
  }

  // Rats, now we have to search through all time nodes.
  var index = -1;
  var active = false;
  for (var i = 0; i < this.timeNodes.length; i++) {
    segment = this.timeNodes[i];
    withinBounds = (time >= segment.time_in) && (time < segment.time_out);
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
    //this.checkIndex();
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
  //this.checkIndex  = smilTimeContainer_generic.prototype.checkIndex;
  this.selectIndex = smilTimeContainer_generic.prototype.selectIndex;
  this.selectItem  = smilTimeContainer_generic.prototype.selectItem;

  // lazy user interaction (should be specific to <excl> but heck...)
  this.parseEvents(this.parseAttribute("first"), function() {
    self.selectIndex(0);
  });
  this.parseEvents(this.parseAttribute("prev"),  function() {
    self.selectIndex(self.currentIndex - 1);
  });
  this.parseEvents(this.parseAttribute("next"),  function() {
    self.selectIndex(self.currentIndex + 1);
  });
  this.parseEvents(this.parseAttribute("last"),  function() {
    self.selectIndex(self.timeNodes.length - 1);
  });
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

function smilTimeElement(domNode, parentNode, targetNode, timerate) {
  //targetNode = targetNode || parentNode.target;
  //if (domNode.timing) consoleLog(domNode.nodeName + " is already intialized.");
  smilTimeItem.call(this, domNode, parentNode, targetNode || domNode);
  //this.target = targetNode || parentNode.target;
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
      this.timeNodes = [];
      break;
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

/*****************************************************************************\
|                                                                             |
|  Public API                                                                 |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|  document.createTimeContainer(domNode, parentNode, targetNode, timerate)    |
|                                                                             |
|  document.getTimeNodesByTarget(node)                                        |
|  document.getTimeContainersByTarget(node)                                   |
|  document.getTimeContainersByTagName(tagName)                               |
|                                                                             |
\*****************************************************************************/

document.createTimeContainer = function(domNode, parentNode, targetNode, timerate) {
  return new smilTimeElement(domNode, parentNode, targetNode, timerate);
};

document.getTimeNodesByTarget = function(node) {
  var timeNodes = [];
  if (!node) return timeNodes;
  if (node.timing)    // inline SMIL Timing
    timeNodes.push(node.timing);
  if (node.extTiming) { // SMIL Timesheet
    for (var i = 0; i < node.extTiming.length; i++)
      timeNodes.push(node.extTiming[i]);
  }
  timeNodes.item = function(index) { return timeNodes[index]; };
  return timeNodes;
};

document.getTimeContainersByTarget = function(node) {
  var contNodes = [];
  var timeNodes = document.getTimeNodesByTarget(node);
  for (var i = 0; i < timeNodes.length; i++) {
    if (timeNodes[i].timeContainer)
      contNodes.push(timeNodes[i]);
  }
  contNodes.item = function(index) { return contNodes[index]; };
  return contNodes;
};

document.getTimeContainersByTagName = function(tagName) {
  var contNodes = [];
  tagName = tagName.toLowerCase();
  if ((/^(par|seq|excl)$/).test(tagName)) {
    for (var i = 0; i < TIMECONTAINERS.length; i++) {
      if (TIMECONTAINERS[i].timeContainer.toLowerCase() == tagName)
        contNodes.push(TIMECONTAINERS[i]);
    }
  } else if (tagName == "*") {
    contNodes = TIMECONTAINERS;
  }
  contNodes.item = function(index) { return contNodes[index]; };
  return contNodes;
};

})();
