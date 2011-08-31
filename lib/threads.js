/*

 ----------------------------------------------------------------------------
 | threads: Node.js multi-thread manager, to allow safe sync coding         |
 |                                                                          |
 | Copyright (c) 2011 M/Gateway Developments Ltd,                           |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 | This program is free software: you can redistribute it and/or modify     |
 | it under the terms of the GNU Affero General Public License as           |
 | published by the Free Software Foundation, either version 3 of the       |
 | License, or (at your option) any later version.                          |
 |                                                                          |
 | This program is distributed in the hope that it will be useful,          |
 | but WITHOUT ANY WARRANTY; without even the implied warranty of           |
 | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the            |
 | GNU Affero General Public License for more details.                      |
 |                                                                          |
 | You should have received a copy of the GNU Affero General Public License |
 | along with this program.  If not, see <http://www.gnu.org/licenses/>.    |
 ----------------------------------------------------------------------------


 ************************************************************
 *
 * Running the threads module:
 *
 *   var threads = require('./threads');
 *   var params = {poolSize: 10};
 *   threads.start(params, function() {
 *     console.log("threads started!!!");
 *     // away you go!
 *   });
 *
 *
 * Startup parameters
 *
 *  The parameters below can be edited as required
 *    poolSize = the number of Node child processes to fire up (deafult = 5)
 *    childProcessPath = the filepath of the Node child process Javascript file
 *                       (default = __dirname + '/threadsChildProcess.js')
 *    monitorInterval = no of milliseconds delay between displaying process usage
 *                      in console (default = 30000)
 *
 *   trace = true if you want to get a detailed activity trace to the Node.js console
 *   silentStart = true if you don't want any message to the console when threads starts
 *                 (default = false)
 *
 *
 *   Add an action to the queue using:
 *
 *      var requestObj = {action: {x:1,y:2}, response: response, otherStuff: 'etc...'};
 *      // Just the action property is sent to the child process
 *      // Any other properties are retained for the master process response handler
 *
 *      threads.addToQueue(requestObj, responseHandler);
 *
 *
 *   The responseHandler allows you to define a method that the master Node process
 *   will run when the child process returns its response, eg to send a web page response
 *   back to a browser.
 *
 *   Example response handler:
 *
 *    var responseHandler = function(requestObj, results) {
 *      // results contains whatever your child process returns to the master process
 *      var response = requestObj.response;
 *      var html = "<html>";
 *      html = html + "<head><title>Threads action response</title></head>";
 *      html = html + "<body>";
 *      html = html + "<p>Action was processed !</p><p>Results: " + results + "</p>";
 *      html = html + "</body>";
 *      html = html + "</html>";
 *      response.writeHead(200, {"Content-Type": "text/html"});  
 *      response.write(html);  
 *      response.end();  
 *    };

 ************************************************************

  Get required modules:

*/

var cp = require('child_process');
var events = require("events");

/*
  Define the threads object
*/

var threads = {

  buildNo: 1,
  buildDate: "30 August 2011",
  version: function() {
    return 'threads build ' + this.buildNo + ', ' + this.buildDate;
  },

  addToQueue: function(requestObj, responseHandler) {
    // puts a request onto the queue and triggers the queue to be processed
    var action = requestObj.action;
    var queuedRequest = {
      action: action,
      requestObj: requestObj,
      handler: responseHandler
    };
    threads.queue.push(queuedRequest);
    threads.totalRequests++;
    var qLength = threads.queue.length;
    if (qLength > threads.maxQueueLength) threads.maxQueueLength = qLength;
    if (threads.trace) console.log("action added to Queue: queue length = " + qLength + "; requestNo = " + threads.totalRequests + "; after " + threads.elapsedTime() + " sec");
    // trigger the processing of the queue
    threads.queueEvent.emit("processQueue");
  },

  getChildProcess: function() {
    var pid;
    // try to find a free child process, otherwise return false
    for (pid in threads.process) {
      if (threads.process[pid].isAvailable) {
        threads.process[pid].isAvailable = false;
        return pid;
      }
    }
    return false;
  },

  startChildProcesses: function(callback) {
    var process;
    var pid;
    var noStarted = 0;
    for (var i = 0; i < this.poolSize; i++) {
      process = cp.fork(threads.childProcessPath);
      pid = process.pid
      threads.process[pid] = process;
      threads.process[pid].isAvailable = false;
      threads.process[pid].started = false;
      threads.requestsByProcess[pid] = 0;

     // define how responses from child processes are handled
     // *****************************************************

      threads.process[pid].on('message', function(response) {
        if (threads.trace) console.log("child process returned response " + JSON.stringify(response));
        if (response.ok) {
          // release the child process back to the available pool
          threads.process[response.ok].isAvailable = true;
          if (threads.trace) console.log("Child process " + response.ok + " added to available pool");
          if (!threads.process[response.ok].started) {
            noStarted++;
            threads.process[response.ok].started = true;
            if (noStarted === threads.poolSize) {
              threads.started = true;
              if (threads.trace) console.log("threads is ready!");
              threads.queueEvent.emit("processQueue");
              callback();
            }
          }
          else {
            // now that it's available again, trigger the queue to be processed
            threads.queueEvent.emit("processQueue");
            // do whatever the master process needs to do with the child 
            // process's response by invoking the handler

            var process = threads.process[response.ok];
            var handler = process.handler;
            var requestObj = process.queuedRequest;
            if (typeof handler !== 'undefined') {
              if (threads.trace) console.log("running handler");
              handler(requestObj, response.response);
            }
          }
        }
      });

      // *******************************************************

    }
  },
  
  processQueue: function() {
    // tries to allocate queued actions to available child processes
    if (threads.queue.length > 0)  {
      threads.queueEvents++;
      if (threads.trace) console.log("processing queue: " + threads.queueEvents + "; queue length " + threads.queue.length + "; after " + threads.elapsedTime() + " seconds");
      var queuedRequest;
      var pid = true;
      var process;
      while (pid) {
        queuedRequest = threads.queue.shift();
        pid = threads.getChildProcess();
        if (!pid) {
          threads.queue.unshift(queuedRequest);
        }
        else {
          // A free child process was found, so
          // dispatch action to it
          if (threads.trace) console.log("dispatching action to " + pid);
          process = threads.process[pid];

          process.queuedRequest = queuedRequest.requestObj;
          process.handler = queuedRequest.handler;

          // ***** pass request to child process ****

          process.send(queuedRequest.action);

          // ****************************************

          // increment usage stats
          threads.connectionUpdate = true;
          threads.requestsByProcess[pid]++;
        }
        if (threads.queue.length === 0) {
          pid = false;
          if (threads.trace) console.log("queue exhausted");
        }
      }
      if (threads.queue.length > 0) {
        if (threads.trace) console.log("queue processing aborted: no free child proceses available");
      }
    }
  },

  startTime: new Date().getTime(),

  elapsedTime: function() {
    var now = new Date().getTime();
    return (now - this.startTime)/1000;
  },

  maxQueueLength: 0,
  process: {},
  queue: [],
  queueEvent: new events.EventEmitter(),
  queueEvents: 0,
  requestsByProcess: {},

  started: false,
  totalRequests: 0

};


module.exports = {
  start: function(params, callback) {

    // define parameters / set defaults

    threads.poolSize = 5;
    if (typeof params.poolSize !== 'undefined') threads.poolSize = params.poolSize;
    threads.trace = true;
    if (typeof params.trace !== 'undefined') threads.trace = params.trace;
    threads.childProcessPath = __dirname + '/threadsChildProcess.js'
    if (typeof params.childProcessPath !== 'undefined') threads.childProcessPath = params.childProcessPath;
    threads.silentStart = false;
    if (typeof params.silentStart !== 'undefined') threads.silentStart = params.silentStart;
    threads.monitorInterval = 30000;
    if (typeof params.monitorInterval !== 'undefined') threads.monitorInterval = params.monitorInterval;

    // now start it all up

    // start up message queue

    threads.queueEvent.on("processQueue", threads.processQueue);

    setInterval(function() {
      threads.queueEvent.emit("processQueue");
      // report connection stats if they've changed
      var pid;
      if (threads.trace) {
        if (threads.connectionUpdate) {
          console.log("Child Process utilitisation:");
          for (pid in threads.requestsByProcess) {
            console.log(pid + ": " + threads.requestsByProcess[pid]);
          }
          console.log("Max queue length: " + threads.maxQueueLength);
          threads.connectionUpdate = false;
          threads.maxQueueLength = 0;
        }
      }
    },threads.monitorInterval);


    if (!threads.silentStart) {
      console.log("********************************************");
      console.log("*** threads Build " + threads.buildNo + " (" + threads.buildDate + ") ***");
      console.log("********************************************");
      console.log(threads.poolSize + " child Node processes running");
      if (threads.trace) {
        console.log("Trace mode is on");
      }
      else {
        console.log("Trace mode is off");
      }
    }

    // start up child Node processes

    threads.startChildProcesses(callback);

  },

  addToQueue: threads.addToQueue,

  childProcess: {
    handler: function(actionMethod) {
      process.on('message', function(action) {
        //console.log("Child process received message: " + JSON.stringify(action));
        var response = '';
        if (typeof actionMethod !== 'undefined') response = actionMethod(action);
        process.send({ok: process.pid, response: response});
      });

      //console.log("Child process " + process.pid + " has started");

      process.send({ok: process.pid});
    }
  }

};





