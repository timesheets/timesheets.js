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
 * version     : 0.3
 * last change : 2010-12-14
 */

var gMediaPlayer = null;
var gStartButton = null;

function toTimeStr(seconds) {
  seconds = Math.floor(seconds);
  var sec = seconds % 60;
  var str = sec;
  if (sec < 10)
    str = "0" + str;
  var min = Math.floor(seconds / 60);
  str = min + ":" + str;
  return str;
}

function updateStartButton() {
  if (gMediaPlayer.paused)
    gStartButton.className = "play";
  else
    gStartButton.className = "pause";
}

function togglePlayPause() {
  if (gMediaPlayer.paused)
    gMediaPlayer.play();
  else
    gMediaPlayer.pause();
  updateStartButton();
}

function startup() {
  var timeContainer = document.getElementById("media").timing;
  var timeCursor    = document.getElementById("timeCursor");
  var timeValue     = document.getElementById("timeValue")
                              .getElementsByTagName("span").item(0);

  // get the HTMLMediaElement interface
  gMediaPlayer = timeContainer.mediaSyncNode;
  if (gMediaPlayer.mediaAPI)
    gMediaPlayer = gMediaPlayer.mediaAPI;

  // update time cursor (text value and cursor position)
  gMediaPlayer.addEventListener("timeupdate", function() {
    var time = gMediaPlayer.currentTime;
    timeValue.innerHTML = toTimeStr(time);
    timeCursor.style.left = Math.floor(40 + 2.43*time) + "px";
  }, false);
  /*
  // SMIL-based alternative
  timeContainer.onTimeUpdate = function() {
    var time = this.getTime();
    console.log(time);
    timeValue.innerHTML = toTimeStr(time);
    timeCursor.style.left = Math.floor(40 + 2.43*time) + "px";
  };
   */

  // update play/pause state
  gStartButton = document.getElementById("mediaStart");
  EVENTS.bind(gStartButton, "click", togglePlayPause);
  gMediaPlayer.addEventListener("play",  updateStartButton, false);
  gMediaPlayer.addEventListener("pause", updateStartButton, false);
  gMediaPlayer.addEventListener("ended", updateStartButton, false);
  updateStartButton();
}

EVENTS.onSMILReady(function() {
  // IE needs a timeout because of the autoplay + Flash fallback
  setTimeout(startup, 1000);
});
