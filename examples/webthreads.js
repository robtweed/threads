var http = require('http');
var url = require("url");
var queryString = require("querystring");
var path = require("path"); 
var fs = require("fs");

var threads = require('./threads');

threads.start('', function() {
  console.log("threads started!!!");
  var trace = true;

  // define your handler that the master process will use for processing the results returned from
  // a child process.
  // Note this is also given access to the original action object

  var handler = function(requestObj, results) {
    //console.log("This is the response handler: ");
    //console.log("** action: " + JSON.stringify(requestObj.action));
    //console.log("results = " + JSON.stringify(results));

    var response = requestObj.response;
    var html = "<html>";
    html = html + "<head><title>threads action response</title></head>";
    html = html + "<body>";
    html = html + "<p>Action was processed !</p><p>Results: " + results + "</p>";
    html = html + "</body>";
    html = html + "</html>";

    response.writeHead(200, {"Content-Type": "text/html"});  
    response.write(html);  
    response.end();  

  };

  var display404 = function(response) {
    response.writeHead(404, {"Content-Type" : "text/plain" });  
    response.write("404 Not Found \n");  
    response.end();  
  };

  var webserver = http.createServer(function(request, response) {
    request.content = '';
    request.on("data", function(chunk) {
      request.content += chunk;
    });
    request.on("end", function(){
      var contentType;
      var urlObj = url.parse(request.url, true); 
      var uri = urlObj.pathname;
      if (uri === '/favicon.ico') {
        display404(response);
        return;
      }
      if (trace) console.log(uri);

      // *********Example use of threaded action ********

      if (uri.indexOf('/test/') !== -1) {
        var action = {query: urlObj.query};
        var requestObj = {action: action, request: request, response: response, urlObj: urlObj};
        threads.addToQueue(requestObj, handler);
      }

      // **************************************************

      else {
        console.log("uri = " + uri);
        var fileName = "/var/www/" + uri;
        path.exists(fileName, function(exists) {  
          if(!exists) {  
            display404(response);  
            return;  
          }
          fs.readFile(fileName, "binary", function(err, file) {  
            if(err) {  
              response.writeHead(500, {"Content-Type": "text/plain"});  
              response.write(err + "\n");  
              response.end();  
              return;  
            }
            contentType = "text/plain";
            if (fileName.indexOf(".html") !== -1) contentType = "text/html";
            if (fileName.indexOf(".js") !== -1) contentType = "application/javascript";
            if (fileName.indexOf(".css") !== -1) contentType = "text/css";
            if (fileName.indexOf(".jpg") !== -1) contentType = "image/jpeg";
            response.writeHead(200, {"Content-Type": contentType});  
            response.write(file, "binary");  
            response.end();  
          });  
        }); 
      }
    });
  });

  webserver.listen(8080);

});