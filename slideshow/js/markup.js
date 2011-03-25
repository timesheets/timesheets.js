function fillPreNodes(href) {
  var nodes = document.getElementsByTagName("pre");

  // OLDIE: Internet Explorer 6/7/8
  // couldn't find a proper way to use an XML document with that crap
  // so here's an *ugly* text-based hack :-/
  if (window.ActiveXObject) {
    xhr = new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open("GET", href, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var innerHTML = xhr.responseText; // .replace(/[\r\n]*/, "\r\n");
        for (var i = 0; i < nodes.length; i++) {
          var id = nodes[i].id;
          if (id) {
            var index  = innerHTML.indexOf('<pre id="' + id + '"');
            var markup = innerHTML.substr(index);
            if (1) {
              markup = markup.replace(/<pre.*>/, "");
              index  = markup.indexOf("</pre>");
              markup = markup.substring(0, index);
              markup = markup.replace(/ /g, "&nbsp;");
              markup = markup.replace(/&nbsp;class/g, " class");
              markup = markup.split("\n").join("<br />");
              nodes[i].innerHTML = markup;
            } else {
              index  = markup.indexOf("</pre>") + 6;
              markup = markup.substring(0, index);
              nodes[i].outerHTML = markup;
            }
          }
        }
      }
    };
    xhr.send(null);
  }

  // modern browsers
  // note that Chrome won't allow loading any local file with XHR
  else if (window.XMLHttpRequest) {
    xhr = new XMLHttpRequest();
    xhr.overrideMimeType("text/xml");
    xhr.open("GET", href, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var xmlDoc = xhr.responseXML;
        for (var i = 0; i < nodes.length; i++) {
          var id = nodes[i].id;
          if (id) {
            var markup = xmlDoc.getElementById(id).innerHTML;
            //if (/\<small\>/.test(markup)) {
              //alert(markup);
              markup = markup.replace(/^    /g, "");
              markup = markup.replace(/\s*$/, "");
            //}
            nodes[i].innerHTML = markup;
          }
        }
      }
    };
    xhr.send(null);
  }
}

// startup: fill <pre> nodes + experimental ToC generation
EVENTS.onSMILReady(function() {
  var slideshow   = document.getElementById("slideshow");
  if (!slideshow || !slideshow.timing) return;

  // fill <pre> nodes
  fillPreNodes("markup.xhtml");

  // Table of Contents (XXX should be in timesheets-controls.js)
  var tocButton = document.getElementById("toc");
  var tocList   = document.getElementsByTagName("nav").item(0)
                          .getElementsByTagName("ol").item(0);
  var index = 0;
  var count = slideshow.timing.timeNodes.length;
  for (var i = 0; i < slideshow.childNodes.length; i++) {
    var slide = slideshow.childNodes[i];
    if ((slide.nodeType == 1) && slide.id) {
      index ++;
      slide.index = index;
      EVENTS.bind(slide, "begin", function() {
        try {
          tocButton.innerHTML = (this.index + "/" + count);
          document.getElementById("active").removeAttribute("id");
        } catch(e) {}
        this.tocItem.setAttribute("id", "active");
      });
      // XXX won't work with IE<8
      var titleNode = document.querySelector("#" + slide.id + " h2");
      var title = titleNode ? titleNode.firstChild.nodeValue : "(untitled)";
      var li = document.createElement("li");
      var a  = document.createElement("a");
      var tn = document.createTextNode(title);
      // hide ToC entry if untitled
      if (!titleNode) {
        li.style.height = 0;
        li.style.visibility = "hidden";
      }
      a.setAttribute("href", "#" + slide.id);
      a.appendChild(tn);
      li.appendChild(a);
      tocList.appendChild(li);
      slide.tocItem = li;
    }
  }
});

