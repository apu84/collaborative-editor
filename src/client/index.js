import config from "../client/config";
import ReconnectingWebSocket from "reconnecting-websocket";
import { types, Connection } from "sharedb/lib/client";
import { type } from "../common/custom-type";
import Quill from "quill";
types.register(type);

// Open WebSocket connection to ShareDB server
var socket = new ReconnectingWebSocket(config.remoteHostWs);
var connection = new Connection(socket);

// For testing reconnection
window.disconnect = function () {
  connection.close();
};
window.connect = function () {
  var socket = new ReconnectingWebSocket(config.remoteHostWs);
  connection.bindToSocket(socket);
};

const editorIdPrefix = "editor";
let editorCount = 0;
const editors = {};
const operations = [insertOperation(), removeOperation(), updateOperation()];

const editorContainer = document.querySelector(".editors .first");

// Create local Doc instance mapped to 'examples' collection document with id in hash
getDocument().then((docId) => {
  const doc = connection.get("examples", docId);

  doc.subscribe(async (err) => {
    if (err) throw err;
    if (!window.location.hash) {
      window.location.hash = docId;
    }
    const _isEmpty = (obj) =>
      Object.keys(obj).length === 0 && obj.constructor === Object;
    if (_isEmpty(doc.data.ops[0])) {
      // add an empty editor
      appendEditor(editorContainer, doc);
    } else {
      initDoc(doc);
    }
  });

  doc.on("op", (ops, source) => {
    if (source) return;
    applyOperation(ops.ops, doc);
  });
});

async function initDoc(doc) {
  const insertOp = insertOperation();
  const updateOp = updateOperation();
  const removeOp = removeOperation();

  for (let [key, value] of Object.entries(doc.data.ops[0])) {
    const inserts = value.ops.filter((op) => insertOp.supports([op]));
    await Promise.all(
      inserts.map(async (insert) => await insertOp.execute([insert], doc))
    );
  }

  for (let [key, value] of Object.entries(doc.data.ops[0])) {
    const removes = value.ops.filter((op) => removeOp.supports([op]));
    await Promise.all(
      removes.map(async (remove) => await removeOp.execute([remove], doc))
    );
    if (removes.length > 0) {
      doc.data.ops[0][key] = { ops: [] };
    }
  }

  for (let [key, value] of Object.entries(doc.data.ops[0])) {
    const updates = value.ops.filter(
      (op) => !insertOp.supports([op]) && !removeOp.supports([op])
    );

    if (updates.length > 0) {
      await updateOp.execute(updates, doc);
    }
  }
}

function applyOperation(ops, doc) {
  operations
    .filter((operation) => operation.supports(ops))
    .forEach((operation) => operation.execute(ops, doc));
}

function getDocument() {
  // first check if current location has any
  // hash, which denotes current documentId.
  // If not present post request to backend.
  return new Promise((resolve, reject) => {
    const currentDocId = window.location.hash;
    if (currentDocId) {
      resolve(currentDocId.substr(1));
    } else {
      fetch(config.remoteHost, {
        method: "POST",
      })
        .then((response) => {
          response.json().then((json) => {
            resolve(json.docId);
          });
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
}

function setUpEditor(editorId, doc, insertAfter, fromRemote) {
  const quill = new Quill("#" + editorId, { theme: "snow" });
  // quill.setContents(doc.data);

  quill.on("text-change", function (delta, oldDelta, source) {
    if (source !== "user") return;
    const editorIdObj = {
      editorId,
    };
    const ops = delta.ops.map((op) => {
      op.attributes = { ...(op.attributes || {}), ...editorIdObj };
      return op;
    });

    doc.submitOp({ ops }, { source: quill });
  });

  // if its local change, transmit this
  if (!fromRemote) {
    const addOp = {
      attributes: {
        insert: true,
        insertAfter,
        editorId,
      },
    };
    doc.submitOp({ ops: [addOp] }, { source: quill });
  }
  return quill;
}

async function appendEditor(targetElement, doc, fromRemote = false) {
  editorCount++;
  const editorId = editorIdPrefix + editorCount;
  const editorContainerElement = await insertAfter(
    getElementToAppendAfter(targetElement),
    buildEditorContainer(editorId)
  );
  editors[editorId] = setUpEditor(
    editorId,
    doc,
    getElementIdToAppendAfter(targetElement),
    fromRemote
  );
  await insertAfter(
    editorContainerElement,
    buildButton("-", "remove", () =>
      removeEditor(editorContainerElement, editorId, doc)
    )
  );
  return insertAfter(
    editorContainerElement,
    buildButton("+", "add", () => appendEditor(editorContainerElement, doc))
  );
}

function removeEditor(
  editorContainerElement,
  editorId,
  doc,
  fromRemote = false
) {
  removeElement(editorContainerElement.nextSibling.nextSibling);
  removeElement(editorContainerElement.nextSibling);
  removeElement(editorContainerElement);
  delete editors[editorId];
  // if its local change, transmit this
  if (!fromRemote) {
    const removeOp = {
      attributes: {
        delete: true,
        editorId,
      },
    };
    doc.submitOp({ ops: [removeOp] }, { source: {} });
  }
}

function removeElement(element) {
  element.parentNode.removeChild(element);
}

function insertAfter(targetElement, newElement) {
  return new Promise((resolve) => {
    targetElement.parentNode.insertBefore(
      newElement,
      targetElement.nextSibling
    );
    resolve(newElement);
  });
}

function buildButton(content, className, callback) {
  return elementBuilder()
    .of("button")
    .innerHTML(content)
    .setAttribute("class", className)
    .addEventListener("click", () => callback())
    .build();
}

function getElementToAppendAfter(targetElement) {
  return targetElement.nextSibling && targetElement.nextSibling.nextSibling
    ? targetElement.nextSibling.nextSibling
    : targetElement;
}

function getElementIdToAppendAfter(targetElement) {
  return targetElement.childNodes.length > 1
    ? targetElement.childNodes[1].getAttribute("id")
    : "0";
}

function buildEditorContainer(id) {
  return elementBuilder()
    .of("div")
    .setAttribute("class", "editor-container")
    .appendChild(elementBuilder().of("div").setAttribute("id", id).build())
    .build();
}

function insertOperation() {
  return {
    supports: (ops) => {
      return (
        ops[0].attributes &&
        ops[0].attributes.insert &&
        ops[0].attributes.editorId &&
        ops[0].attributes.insertAfter
      );
    },
    execute: (ops, doc) => {
      return appendEditor(
        ops[0].attributes.insertAfter === "0"
          ? editorContainer
          : document.getElementById(ops[0].attributes.insertAfter).parentNode,
        doc,
        true
      );
    },
  };
}

function removeOperation() {
  return {
    supports: (ops) => {
      return (
        ops[0].attributes &&
        ops[0].attributes.delete &&
        ops[0].attributes.editorId &&
        document.getElementById(ops[0].attributes.editorId) != null &&
        document.getElementById(ops[0].attributes.editorId).parentNode != null
      );
    },
    execute: (ops, doc) => {
      return Promise.resolve(
        removeEditor(
          document.getElementById(ops[0].attributes.editorId).parentNode,
          ops[0].attributes.editorId,
          doc,
          true
        )
      );
    },
  };
}

function updateOperation() {
  return {
    supports: (ops) => {
      return (
        ops[0].attributes &&
        !ops[0].attributes.insert &&
        !ops[0].attributes.delete &&
        ops[0].attributes.editorId &&
        editors[ops[0].attributes.editorId]
      );
    },
    execute: (ops) => {
      return Promise.resolve(
        editors[ops[0].attributes.editorId].updateContents(ops)
      );
    },
  };
}

function elementBuilder() {
  return {
    of: function (type) {
      const attributes = {};
      const eventListeners = {};
      const children = [];
      let innerHtml;
      return {
        setAttribute: function (name, value) {
          attributes[name] = value;
          return this;
        },
        addEventListener: function (eventType, callback) {
          eventListeners[eventType] = callback;
          return this;
        },
        appendChild: function (child) {
          children.push(child);
          return this;
        },
        innerHTML: function (html) {
          innerHtml = html;
          return this;
        },
        build: function () {
          const _isEmpty = (obj) =>
            Object.keys(obj).length === 0 && obj.constructor === Object;

          const _setProperty = (obj, property, map) => {
            for (let [key, value] of Object.entries(map)) {
              obj[property].call(obj, key, value);
            }
          };

          const element = document.createElement(type);
          if (!_isEmpty(attributes)) {
            _setProperty(element, "setAttribute", attributes);
          }

          if (!_isEmpty(eventListeners)) {
            _setProperty(element, "addEventListener", eventListeners);
          }

          children.forEach((child) => {
            element.appendChild(child);
          });

          if (innerHtml) {
            element.innerHTML = innerHtml;
          }
          return element;
        },
      };
    },
  };
}
