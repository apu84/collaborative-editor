module.exports = {
  src: {
    client: {
      js: "./src/client/index.js",
      html: "./src/client/index.html",
      quillCss: './node_modules/quill/dist/quill.snow.css'
    },
    server: {
      js: "./src/server/server.js",
    },
  },
  dest: {
    client: "bundle.js",
    server: "server.js"
  },
  dist: {
    client: "dist/client",
    server: "dist"
  }
};
