function assert(b, msg) {
  if (!b) {
    console.error(msg);
  }
}
function topCenter(o) {
  return {
    x: o.bbox().cx,
    y: o.bbox().y
  }
}
function bottomCenter(o) {
  return {
    x: o.bbox().cx,
    y: o.bbox().y2
  }
}
function bottomRight(o) {
  return {
    x: o.bbox().x2,
    y: o.bbox().y2
  }
}
function topLeft(o) {
  return {
    x: o.bbox().x,
    y: o.bbox().y
  }
}
function bottomLeft(o) {
  return {
    x: o.bbox().x,
    y: o.bbox().y2
  }
}
function right(o) {
  return {
    x: o.bbox().x2,
    y: o.bbox().cy
  }
}
function left(o) {
  return {
    x: o.bbox().x,
    y: o.bbox().cy
  }
}
function vec2scale(alpha, v) {
  return {
    x: alpha * v.x,
    y: alpha * v.y,
  }
}
function vec2add(v1, v2) {
  return {
    x: v1.x + v2.x,
    y: v1.y + v2.y,
  }
}
function vec2avg(v1, v2) {
  return vec2scale(0.5, vec2add(v1, v2));
}
function boxPad(box, padding) {
  return {
    x: box.x - padding,
    y: box.y - padding,
    w: box.w + 2 * padding,
    width: box.width + 2 * padding,
    h: box.h + 2 * padding,
    height: box.height + 2 * padding,
    x2: box.x2 + padding,
    y2: box.y2 + padding,
    cx: box.cx,
    cy: box.cy,
  }
}

SVG.extend(SVG.Svg, {
  arrowhead: function(extend) {
    return this.marker(10, 10, function(add) {
      let poly = add.polygon('5 3 5 7 10 5')
      this.orient("auto")
      if (extend) {
        extend(this, add, poly)
      } else {
        poly.fill({color: "#000"})
      }
    });
  },
  labelTop: function(elt, lab) {
    let t = this.text(lab).cx(elt.bbox().cx);
    t.y(elt.bbox().y - t.bbox().h);
    return t;
  },
  labelBottom: function(elt, lab) {
    let t = this.text(lab).cx(elt.bbox().cx);
    t.y(elt.bbox().y2);
    return t;
  },
  lineBetween: function(src, dst, startBuffer, endBuffer, label) {
    startBuffer = startBuffer !== undefined ? startBuffer : 0.05;
    endBuffer = endBuffer !== undefined ? endBuffer : 0.95;
    function alongLine(src, dst, along) {
      let vec = {x: dst.x - src.x, y: dst.y - src.y}
      return {x: along * vec.x + src.x, y: along * vec.y + src.y}
    }
    let start = alongLine(src, dst, startBuffer)
    let end = alongLine(src, dst, endBuffer)
    let line = this.line(
      start.x, start.y,
      end.x, end.y
    ).stroke({ width: 2, color: "#000" })

    if (label) {
      label(alongLine(src, dst, .5));
    }
    return line;
  },
  lineBetweenAbs: function(src, dst, startBuffer, endBuffer, label) {
    startBuffer = startBuffer !== undefined ? startBuffer : 0;
    endBuffer = endBuffer !== undefined ? endBuffer : 0;
    function alongLine(src, dst, along) {
      let vec = {x: dst.x - src.x, y: dst.y - src.y}
      return {x: along * vec.x + src.x, y: along * vec.y + src.y}
    }
    let len = Math.sqrt((dst.x - src.x) ** 2 + (dst.y - src.y) ** 2);
    let unitvec = {x: (dst.x - src.x) / len, y: (dst.y - src.y) / len}

    let start = vec2add(src, vec2scale(startBuffer, unitvec));
    let end = vec2add(dst, vec2scale(-endBuffer, unitvec));
    let line = this.line(
      start.x, start.y,
      end.x, end.y
    ).stroke({ width: 2, color: "#000" })

    if (label) {
      label(alongLine(src, dst, .5));
    }
    return line;
  },
  box: function(b) {
    console.log(b)
    return this.rect(b.w, b.h).move(b.x, b.y);
  }
});

let jrw_components = [];

function makeComponent(selector, render, options) {
  if (!options) { options = {}; }
  let stash = document.querySelector(selector + ">svg");
  if (!stash) return;
  stash.style.display = "none";

  function internalRender() {
    $(stash).parent().find(".temp").remove();
    let mysvg = stash.cloneNode();
    stash.parentNode.appendChild(mysvg);
    mysvg.style.display = "";
    mysvg.classList.add("temp")

    let draw = SVG(mysvg)
    render(draw, internalRender)

    if (options.makeRerenderButton && options.makeRerenderButton()) {
      let renderButton = draw.group();
      let renderButtonRect = renderButton.rect(25, 25)
          .radius(5)
          .fill("#fff")
          .stroke({width: 1, color: "#000"});
      let reloadContainer = renderButton.group();
      reloadContainer.use("reload");
      reloadContainer.move(2.5, 2.5)

      renderButton.node.addEventListener(
        'mousedown',
        (e) => {
          console.log('render', stash.parentNode.id)
          e.preventDefault();
          internalRender();
        },
        false
      );

      renderButton.transform({tx: draw.viewbox().x + 5, ty: draw.viewbox().y2 - 30}, true)
    }

    if (options.makeAnimationButton) {
      let backButton = draw.group();
      backButton.polygon('15 10 15 30 40 30 40 10').fill({color: "#fff"})
      backButton.polygon('20 12 20 28 40 20').fill({color: "#000"})
      backButton.node.addEventListener(
        'mousedown',
        (e) => {
          e.preventDefault();
          if (!options.minimal()) {
            options.decrement();
            internalRender();
          }
        },
        false
      );
      backButton.move(0, 35).flip('x');

      let fwdButton = draw.group();
      fwdButton.polygon('15 10 15 30 40 30 40 10').fill({color: "#fff"})
      fwdButton.polygon('20 12 20 28 40 20').fill({color: "#000"})
      fwdButton.node.addEventListener(
        'mousedown',
        (e) => {
          e.preventDefault();
          if (!options.maximal()) {
            options.increment();
            internalRender();
          }
        },
        false
      );
      fwdButton.move(25, 35);

      draw.text("Animate").attr({"font-size": "small"}).cx(25).y(15)
    }
  }

  if (document.readyState === 'complete') {
    internalRender();
  } else {
    document.addEventListener('readystatechange', function(event) {
      if (event.target.readyState !== "complete") return;
      internalRender();
    });
  }

  jrw_components.push({stash: stash, render: internalRender});
}

function rerenderAll() {
  for (let c of jrw_components) {
    c.render();
  }
}

var jrw_debug = false;
function jrw_toggleDebug() {
  jrw_debug = !jrw_debug;
  rerenderAll();
}
