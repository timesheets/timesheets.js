These lightweight libraries can be required to make the demos work with Internet
Explorer 6/7/8, see: <http://wam.inrialpes.fr/timesheets/docs/oldie.html>

* [MediaElement.js](http://mediaelementjs.com/)

> Required to use \<audio|video\> media elements with IE6, IE7, IE8.
> Can also be used to avoid double-encoding media files, i.e. to use a Flash or
> Silverlight fallback when the media type isn’t supported by the browser.

* [sizzle.js](http://sizzlejs.com/) (4KB, gzipped)

> IE6 and IE7 don’t support querySelector() / querySelectorAll(), which are
> required by SMIL-Timesheets attributes like "select" (or the "mediaSync" and
> "controls" ones that are proposed as extensions). For documents using these
> attributes you should include a library such as Sizzle before loading
> timesheets.js.
>
> Our Timesheet Scheduler will use Sizzle if it’s available, then default to
> IE8’s querySelector, then use getElementById() / getElementsByTagName() for
> IE6 and IE7 if Sizzle isn’t loaded. Note that besides Sizzle, the jQuery,
> Prototype, Dojo, MooTools, ExtJS and YUI frameworks are also supported:
> Sizzle isn’t required if one of these frameworks is already loaded.

* [html5shiv](http://code.google.com/p/html5shiv/) (1.5KB, gzipped)

> We recommend using an HTML5 doctype. However, IE\<9 can’t apply style rules on
> “unknown” elements such as \<header\>, \<footer\>, \<article\>, <section>, etc.
> — html5shiv is a perfect workaround for that.

These JavaScript libraries are available under MIT license.

