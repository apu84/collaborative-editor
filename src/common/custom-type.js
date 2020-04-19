const Delta = require("quill-delta");
const richText = require("rich-text");

module.exports = {
  Delta: Delta,
  type: {
    name: "rich-text",
    uri: "http://sharejs.org/types/rich-text/v1",

    create: function (initial) {
      return new Delta([{}]);
    },

    apply: function (snapshot, delta) {
      const editor = (op) => op.attributes && op.attributes.editorId;
      const editorId = editor(delta.ops[0]);
      if (!editorId) {
        throw new Error("Empty editorId");
      }

      if (snapshot.ops.length === 0) {
        snapshot.ops.push({});
      }
      let ops = snapshot.ops[0];
      let editorSnapshot = ops[editorId] || new Delta([]);
      editorSnapshot = new Delta(editorSnapshot);
      delta = new Delta(delta);
      const compose = editorSnapshot.compose(delta);
      ops[editorId] = compose;
      return snapshot;
    },

    compose: function (delta1, delta2) {
      return richText.type.compose(delta1, delta2);
    },

    diff: function (delta1, delta2) {
      return richText.type.diff(delta1, delta2);
    },

    transform: function (delta1, delta2, side) {
      return richText.type.transform(delta1, delta2, side);
    },

    transformCursor: function (cursor, delta, isOwnOp) {
      return richText.type.transformCursor(cursor, delta, isOwnOp);
    },

    normalize: function (delta) {
      return richText.type.normalize(delta);
    },

    serialize: function (delta) {
      return richText.type.serialize(delta);
    },

    deserialize: function (ops) {
      return richText.type.deserialize(ops);
    },

    transformPresence: function (range, op, isOwnOp) {
      return richText.type.transformPresence(range.op.isOwnOp);
    },
  },
};
