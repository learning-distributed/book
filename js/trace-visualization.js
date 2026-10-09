// TODO: turn this into a module somehow? It's leaking lots of stuff into the global scope.

class Node {
  constructor({ id, label = null } = {}) {
    this.id = id;
    this.label = label;
  }
}

const EventType = Object.freeze({
  MESSAGE: "message",
});

const WITH_PREVIOUS = "with-previous";

class Event {
  constructor({
    id = null,
    type = EventType.MESSAGE,
    from,
    to,
    label = null,
    startTime = null,
    endTime = null,
  } = {}) {
    this.id = id;
    this.type = type;
    this.from = from;
    this.to = to;
    this.label = label;
    this.startTime = startTime;
    this.endTime = endTime;
  }
}

class AnimationStep {
  constructor({ id = null, lastVisibleEvent = null } = {}) {
    this.id = id;
    // Either a number (an index into the 1-indexed events array), a string (the event ID), or null
    // (no events visible).
    this.lastVisibleEvent = lastVisibleEvent;
  }
}

class TraceConfig {
  constructor({
    animate = false,
    verticalSpacing = 4, // pixels per time unit
  } = {}) {
    this.animate = animate;
    this.verticalSpacing = verticalSpacing;
  }
}

class TraceData {
  constructor({ nodes = [], events = [], steps = [], config = {} } = {}) {
    this.nodes = [];
    for (const n of nodes) {
      this.nodes.push(new Node(n));
    }
    this.events = [];
    for (const e of events) {
      this.events.push(new Event(e));
    }
    this.config = new TraceConfig(config);
    this.steps = [];
  }
}

// Defines the "scale" of the visualization. Should be adjusted to make the font, stroke size look
// good.
const TRACE_VISUALIZER_OUTPUT_WIDTH = 450;
const TRACE_VISUALIZER_HEADER_HEIGHT = 50;
const TRACE_VISUALIZER_MESSAGE_TIME = 10;
const TRACE_VISUALIZER_EVENT_SPACING_TIME = 3;
const TRACE_VISUALIZER_BEFORE_PADDING_TIME = 25;
const TRACE_VISUALIZER_AFTER_PADDING_TIME = 25;

function createSVGElement(tag, attributes = {}) {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) =>
    elem.setAttribute(key, value),
  );
  return elem;
}

function createForeignTextObject(text, style = {}) {
  const fo = createSVGElement("foreignObject");
  const div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
  div.style.display = "inline-block";
  div.style.whiteSpace = "nowrap";
  div.style.width = "max-content";
  div.style.height = "max-content";
  div.style.padding = "0";
  div.style.margin = "0";
  div.style.lineHeight = "normal";
  Object.entries(style).forEach(([key, value]) =>
    div.style.setAttribute(key, value),
  );
  div.innerHTML = text;
  fo.appendChild(div);
  const rectPromise = MathJax.typesetPromise([div]).then(() => {
    const s = getComputedStyle(div);
    const width = parseInt(s.width, 10);
    const height = parseInt(s.height, 10);
    fo.setAttribute("width", width);
    fo.setAttribute("height", height);
    return {
      width: width,
      height: height,
    };
  });
  return [fo, rectPromise];
}

class TraceVisualizer {
  constructor(container, traceData) {
    container.classList.add("trace-visualization");
    this.container = container;

    if (traceData instanceof TraceData) {
      this.data = traceData;
    } else {
      this.data = new TraceData(traceData);
    }

    this.currentStep = 0;

    this.assignEventTimes();
    this.buildAnimationSteps();
    this.initSVG();

    // If there's more than one animation step, add controls.
    if (this.data.steps.length > 1) {
      let controls = document.createElement("div");
      controls.classList.add("controls");

      // XXX: Should something else make this style decision (i.e., what icon to show)?
      //      I think the best thing would be to provide some sort of initializer method which takes
      //      callbacks to create buttons.
      let backwardButton = document.createElement("i");
      backwardButton.classList.add("fa-solid");
      backwardButton.classList.add("fa-backward");
      backwardButton.classList.add("backward");
      backwardButton.style.cursor = "pointer";
      controls.appendChild(backwardButton);
      backwardButton.addEventListener("click", () => {
        this.stepBackward();
      });

      let forwardButton = document.createElement("i");
      forwardButton.classList.add("fa-solid");
      forwardButton.classList.add("fa-forward");
      forwardButton.classList.add("forward");
      forwardButton.style.cursor = "pointer";
      controls.appendChild(forwardButton);
      forwardButton.addEventListener("click", () => {
        this.stepForward();
      });

      this.svg.insertAdjacentElement("afterend", controls);
    }

    let descriptionBox;
    if ((descriptionBox = this.container.querySelector(".descriptions"))) {
      descriptionBox.style.display = "grid";
      for (const d of this.container.querySelectorAll(".descriptions > *")) {
        d.style.gridArea = "1 / 1";
      }
    }
  }

  // Assign exact values to implicit event start and end times.
  assignEventTimes() {
    let largest = -TRACE_VISUALIZER_EVENT_SPACING_TIME;
    let previousStart = null;
    for (const event of this.data.events) {
      if (event.startTime === null) {
        event.startTime = largest + TRACE_VISUALIZER_EVENT_SPACING_TIME;
      } else if (event.startTime === WITH_PREVIOUS) {
        if (previousStart === null) {
          console.error("Cannot use WITH_PREVIOUS on first event");
        }
        event.startTime = previousStart;
      }
      previousStart = event.startTime;
      if (event.endTime === null) {
        event.endTime = event.startTime + TRACE_VISUALIZER_MESSAGE_TIME;
      }
      largest = Math.max(largest, event.startTime, event.endTime);
    }
  }

  buildAnimationSteps() {
    // If the user defined animation steps, use those.
    if (this.data.steps.length > 0) {
      return;
    }

    // If this visualization isn't animated, add a single stage showing everything.
    if (!this.data.config.animate) {
      this.data.steps.push(
        new AnimationStep({ lastVisibleEvent: this.data.events.length }),
      );
      return;
    }

    // Otherwise, add a stage for each event, grouping together events that start together.
    for (let i = 0; i < this.data.events.length; i++) {
      const event = this.data.events[i];
      if (i + 1 < this.data.events.length) {
        const nextEvent = this.data.events[i + 1];
        if (event.startTime === nextEvent.startTime) {
          continue;
        }
      }
      this.data.steps.push(new AnimationStep({ lastVisibleEvent: i + 1 }));
    }
  }

  initSVG() {
    this.svg = createSVGElement("svg");
    this.svg.setAttribute(
      "viewBox",
      `0 0 ${TRACE_VISUALIZER_OUTPUT_WIDTH} ${this.totalHeight()}`,
    );

    this.svg.appendChild(this.createDefs());
    this.svg.appendChild(this.renderHeaders());
    this.svg.appendChild(this.renderEvents());
    this.animate();
    this.container.prepend(this.svg);
  }

  // Convert node to X coordinate.
  nodeToX(id) {
    // XXX: memoize this lookup.
    const index = this.data.nodes.findIndex((node) => node.id === id);
    return (
      (TRACE_VISUALIZER_OUTPUT_WIDTH / this.data.nodes.length) * (index + 0.5)
    );
  }

  // Convert time to Y coordinate.
  timeToY(time) {
    return (
      this.headerHeight() +
      TRACE_VISUALIZER_BEFORE_PADDING_TIME +
      time * this.data.config.verticalSpacing
    );
  }

  headerHeight() {
    // XXX: memoize this.
    for (const node of this.data.nodes) {
      if (node.label !== null) {
        return TRACE_VISUALIZER_HEADER_HEIGHT;
      }
    }
    return 0;
  }

  maxTime() {
    // XXX: memoize this.
    return Math.max(
      ...this.data.events.map((t) => Math.max(t.startTime, t.endTime)),
    );
  }

  totalHeight() {
    return (
      this.headerHeight() +
      this.maxTime() * this.data.config.verticalSpacing +
      TRACE_VISUALIZER_BEFORE_PADDING_TIME +
      TRACE_VISUALIZER_AFTER_PADDING_TIME
    );
  }

  /**
   * Returns an SVG `defs` object defining common objects (e.g., arrow heads).
   */
  createDefs() {
    const defs = createSVGElement("defs");
    this.svg.appendChild(defs);

    // An arrowhead for use in events.
    {
      const marker = createSVGElement("marker", {
        id: "arrow",
        viewBox: "0 0 10 10",
        refX: "10",
        refY: "5",
        markerWidth: "6",
        markerHeight: "6",
        orient: "auto-start-reverse",
      });
      defs.appendChild(marker);

      const path = createSVGElement("path");
      marker.appendChild(path);
      path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      path.setAttribute("fill", "context-stroke");
    }

    return defs;
  }

  renderHeaders() {
    const headers = createSVGElement("g");
    headers.classList.add("headers");

    // Create a axis label that shows the flow of time.
    const timeLine = createSVGElement("line", {
      x1: 10,
      x2: 10,
      y1: this.headerHeight(),
      y2: "100%",
      stroke: "#CCC",
      "marker-end": "url(#arrow)",
    });
    headers.appendChild(timeLine);
    const midY = this.timeToY(this.maxTime() / 2);
    const timeLineLabel = createSVGElement("text", {
      x: 13,
      y: midY,
      "text-anchor": "middle",
      transform: `rotate(90, 12, ${midY})`,
      fill: "#CCC",
    });
    timeLineLabel.textContent = "time";
    headers.appendChild(timeLineLabel);

    this.data.nodes.forEach((node) => {
      const x = this.nodeToX(node.id);

      // XXX: This shouldn't be a "header".
      const line = createSVGElement("line", {
        x1: x,
        y1: this.headerHeight(),
        x2: x,
        y2: "100%",
        stroke: "#aaa",
        "stroke-dasharray": "4 4",
      });
      headers.appendChild(line);

      // Node labels
      if (node.label === null) {
        return;
      }

      const [label, rectPromise] = createForeignTextObject(node.label);
      headers.appendChild(label);
      rectPromise.then((rect) => {
        label.setAttribute("x", x - rect.width / 2);
        label.setAttribute("y", this.headerHeight() - 15 - rect.height);
      });
    });

    return headers;
  }

  renderEvents() {
    const events = createSVGElement("g");
    events.classList.add("events");
    this.data.events.forEach((event, index) => {
      const g = createSVGElement("g");
      g.setAttribute("class", "trace-event");
      events.appendChild(g);

      if (event.type === EventType.MESSAGE) {
        const fromX = this.nodeToX(event.from);
        const startY = this.timeToY(event.startTime);
        const toX = this.nodeToX(event.to);
        const endY = this.timeToY(event.endTime);

        // Arrow line
        g.appendChild(
          createSVGElement("line", {
            x1: fromX,
            y1: startY,
            x2: toX,
            y2: endY,
            stroke: "black",
            "stroke-width": "1.5",
            "marker-end": "url(#arrow)",
          }),
        );

        if (event.label === null) {
          return;
        }

        const midX = (fromX + toX) / 2;
        const midY = (startY + endY) / 2;
        let angle = Math.atan2(endY - startY, toX - fromX) * (180 / Math.PI);
        if (angle > 90 || angle < -90) {
          angle += 180;
        }
        // Label
        const [label, rectPromise] = createForeignTextObject(event.label);
        g.appendChild(label);
        rectPromise.then((rect) => {
          label.setAttribute("x", midX - rect.width / 2);
          label.setAttribute("y", midY - rect.height);
        });
        label.setAttribute("transform", `rotate(${angle}, ${midX}, ${midY})`);
        label.setAttribute("font-size", "11px");
      } else {
        console.error("Unknown event type " + event.type);
      }
    });
    return events;
  }

  /**
   * Adjusts the rendered visualization to reflect `this.currentStep`.
   */
  animate() {
    const step = this.data.steps[this.currentStep];
    let lastVisibleIndex = -1;
    if (typeof step.lastVisibleEvent === "number") {
      lastVisibleIndex = step.lastVisibleEvent - 1; // lastVisibleEvent is 1-indexed.
    } else if (typeof step.lastVisibleEvent === "string") {
      lastVisibleIndex = this.data.events.findIndex((event) => event.id === id);
    }
    for (const [index, event] of this.svg
      .querySelectorAll(".trace-event")
      .entries()) {
      if (index <= lastVisibleIndex) {
        event.removeAttribute("visibility");
      } else {
        event.setAttribute("visibility", "hidden");
      }
    }

    // Adjust the visibility of the descriptions so that only the one for the current step is
    // visible.
    for (const d of this.container.querySelectorAll(".descriptions > *")) {
      d.style.visibility = "hidden";
    }
    for (const d of this.container.querySelectorAll(
      `.descriptions > [data-step-number="${this.currentStep + 1}"]`,
    )) {
      d.style.visibility = "visible";
    }
    if (step.id) {
      for (const d of this.container.querySelectorAll(
        `.descriptions > [data-step-id="${step.id}"]`,
      )) {
        d.style.visibility = "visible";
      }
    }
  }

  stepForward() {
    if (this.currentStep + 1 < this.data.steps.length) {
      this.currentStep++;
      this.animate();
    }
  }

  stepBackward() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.animate();
    }
  }
}
