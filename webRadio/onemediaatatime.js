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
 * version     : 0.4
 * last change : 2011-01-23
 */

(function(){

var gMediaElements;

function pauseAllMediasButMe(event) {
  // we need a timeout for the Flash fallbacks :-(
  setTimeout(function() {
    for (var i = 0; i < gMediaElements.length; i++) {
      if (gMediaElements[i] != event.target)
        gMediaElements[i].pause();
    }
  }, 250);
}

function parseAllMediaElements() {
  gMediaElements = new Array();
  var containers = document.getTimeContainersByTagName("*");
  for (var i = 0; i < containers.length; i++) {
    if (containers[i].mediaSyncAPI)
      gMediaElements.push(containers[i].mediaSyncAPI);
  }
  for (i = 0; i < gMediaElements.length; i++) {
    gMediaElements[i].addEventListener("playing", pauseAllMediasButMe, false);
  }
}

EVENTS.onSMILReady(function() {
  if (window.addEventListener) // modern browsers
    parseAllMediaElements();
  else // IE needs a timeout, probably because of MediaElement.js
    setTimeout(parseAllMediaElements, 1000);
});

})();
