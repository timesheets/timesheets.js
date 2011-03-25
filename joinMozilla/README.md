SMIL/Timing and Timesheets are an easy and efficient way to sync an HTML
slideshow with an audio track.

This slideshow is an HTML version of [this
presentation](http://commonspace.wordpress.com/2011/01/12/joinmozilla/) of the
[Join Mozilla](http://www.mozilla.org/join) program by Mark Surman. Mark has
published his slides as a video, we’re taking it a bit further by keeping the
content in HTML (accessibility, indexability…) and sync’ing it with his audio
track.

There are two versions of this demo:

* index.html: plain HTML5 page + external timesheet (timesheet.smil)
* inline.html: HTML5 page with inline SMIL-Timing markup (data-\* syntax)

Note: external timesheets are loaded with XHR. Depending on your browser
cross-domain security policy, you might need a web server (e.g.
http://localhost/…/) to use the first version.
