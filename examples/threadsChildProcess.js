var childProcess = require('./threads').childProcess;

// Define your method that will process each incoming action
// Go wild with synchronous code to your heart's content!

var actionMethod = function(action) {
  //console.log("Action method: Process " + process.pid + ": action = " + JSON.stringify(action));
  var result = "method completed for " + process.pid + " at " + new Date().toLocaleTimeString();
  return result;
};

childProcess.handler(actionMethod);
