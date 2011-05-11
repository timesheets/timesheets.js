We have worked with [INA](http://www.ina.fr/), the French national archive of
audiovisual, to publish on the web archived radio programs enhanced with
associated material.

At first glance, the time structure could look similar to the captioned video
example, but the goal here is not only to synchronize pictures or text
with the audio content. The objective is really to create an
application where the user receives help for moving in the audio
record and is free to choose the associated information s/he wants, which
could be multimedia too, with other audio recordings.

<http://wam.inrialpes.fr/timesheets/public/webRadio/>

__Troubleshooting__

This demo relies on an external timesheet (fontaine.smil), which is loaded with
XMLHttpRequest. Depending on your configuration, accessing a local file
(file:/// URL) might not be allowed by your browser security policy: you’ll have
to use a local web server (http://localhost/ URL) to see this demo.

As Internet Explorer 6 to 8 does not support native &lt;audio&gt; tags, the
Flash fallback will be used. Again, a local web server is required to make it
work.

