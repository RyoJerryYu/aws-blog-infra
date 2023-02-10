"use strict";

const path = require("path");
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const domain = "test.ryo-okami.xyz";
  // Redirect trailing slashes
  if (request.uri !== "/" && request.uri.slice(-1) === "/") {
    return {
      status: "301",
      statusDescription: "Moved permanently",
      headers: {
        location: [
          {
            key: "Location",
            value: `https://${domain}${request.uri.slice(0, -1)}`,
          },
        ],
      },
    };
  }
  // Rewrite clean URLs (adding index.html)
  if (!path.extname(request.uri)) {
    request.uri = request.uri.replace(/\/?$/, "/index.html");
  }
  return request;
};
