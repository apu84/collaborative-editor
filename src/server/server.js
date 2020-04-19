var http = require("http");
var express = require("express");
var ShareDB = require("sharedb");
var customType = require("../common/custom-type");
var WebSocket = require("ws");
var WebSocketJSONStream = require("@teamwork/websocket-json-stream");
var cors = require('cors');

ShareDB.types.register(customType.type);
const backend = new ShareDB();

startServer();

// Create initial document then fire callback
function createDoc(documentId) {
  return new Promise((resolve, reject) => {
    const connection = backend.connect();
    const doc = connection.get("examples", documentId);
    doc.fetch(function (err) {
      if (err) reject(err);
      if (doc.type === null) {
        doc.create([], "rich-text", () => {});
        resolve(doc);
      }
      resolve(doc);
    });
  });
}

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  var app = express();
  app.use(cors());
  // If server decides to serve the client js and html, uncomment following lines
  // app.use(express.static('dist/client'));
  // app.use(express.static('node_modules/quill/dist'));

  app.post("/", (req, res) => {
    const docId = generateDocumentId();
    createDoc(docId)
      .then((doc) => {
        res.status(201).send({
          docId: docId,
        });
      })
      .catch((error) => {
        res.status(500).send({ error: "Document generation failed" });
      });
  });

  var server = http.createServer(app);

  // Connect any incoming WebSocket connection to ShareDB
  var wss = new WebSocket.Server({ server: server });
  wss.on("connection", function (ws) {
    var stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  server.listen(8080);
  console.log("Listening on http://localhost:8080");
}

function generateDocumentId() {
  return Math.random().toString(36).substring(7);
}
