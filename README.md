# threads
 
Simple multi-thread manager for Node.js

Rob Tweed <rtweed@mgateway.com>  
25 August 2011, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: @rtweed

## Installing threads

       npm install threads

Note: *threads* requires Node.js version 0.5.x or later, as it makes use of its child Node process
capability
	   
##  What is threads?

*threads* is a simple module for enabling and managing a scalable but high-performance multi-threaded 
environment in Node.js.  The primary incentive for writing it was to create a hybrid environment where 
the many benefits of synchronous coding could be acheived without the risk of blocking the main server thread.

It consists of four components:

- a master Node server process that is 100% asynchronous and non-blocking
- a pool of child Node processes that **only ever handle a single action/request at a time**
- a queue of pending actions/requests
- a queue processor that attempts to allocate requests/actions on the queue to available child Node processes

The child processes persist throughout the lifetime of the master Node server process, so there is no setup/teardown 
overhead or delay when handling requests/actions: the child processes that are flagged as being in the 
*available process pool* are instantaneously available for use by the master process.

It's the fact that the Child Node Processes only ever handle a single request at a time that makes it 
possible for them to support synchronous coding, since they don't need to worry about blocking anyone else.

Note: *threads* is completely event-driven with no polling overheads.

You have complete control over the behaviour and configuration of *threads*.  You can:

- determine the number of child Node processes that constitute the worker pool
- write the child process logic that you require for handling your actions/requests
- define a handler that runs on the master server to process the completed responses sent back from the child processes, eg 
  to return the response as a web page to the originating client.

Clearly, the larger the pool of Node.js threads, the less likely it is that the request/action queue will build up.  On the 
other hand, each child Node process uses about 10Mb memory according to the Node.js documentation.  Additionally, the quicker 
your child process can handle a request, the sooner it will become available again to the pool to handle a queued request/action.
  
##  Using threads

Node.js 0.5.x must be installed

The /examples directory contains a simple worked example of a master server process and a child process to handle web requests.

The following is a simple example of how to use the *threads* module:

      var threads = require('threads');
	  
      threads.start('', function() {
        console.log("threads started!!!");
		// start processing!
      });

An action is defined as a standard Javascript object.  Its structure and content is up to you, but note that the object that 
is passed to a child Node process cannot contain functions.  

You simply add your action to thread's queue and let it do the rest, eg:

       var requestObj = {action: {x:1,y:2}, response: response, otherStuff: 'etc...'};
       threads.addToQueue(requestObj, responseHandler);

      
The only part of the requestObj object that is sent to and handled by your child process is the *action* property.  
You can add any other properties to the requestObj object: these are retained within the master Node process 
for use by *responseHandler*: the master Node process response handler that you must also define (see later).

So, in the example above, if we're using the scheduler with Node's HTTP server module, we're adding the response object to the 
requestObj object so that the master Node process has the correct handle to allow it to ultimately return the response to the correct client.

##  Startup parameters

The parameters that you can specify for the *threads* *start()* function are as follows:

- poolSize = the number of Node child processes to fire up (deafult = 5)
- childProcessPath = the filepath of the Node child process Javascript file (default = __dirname + '/threadsChildProcess.js')
- monitorInterval = no of milliseconds delay between displaying process usage in console (default = 30000)
- trace = true if you want to get a detailed activity trace to the Node.js console (default = true)
- silentStart = true if you don't want any message to the console when *threads* starts (default = false)

##  Defining a child Node process

The child process should be designed to handle any instance of your action/requests that get sent to it by the master
Node process.  Note that a child Node process will only handle one single action/request at a time, so you are at liberty to 
use as much synchronous coding as you like, since there will be no other users to block.

Here's a simple example:

       var childProcess = require('threads').childProcess;
       
	   var actionMethod = function(action) {
         console.log("Action method: Process " + process.pid + ": action = " + JSON.stringify(action));
         var result = "method completed for " + process.pid + " at " + new Date().toLocaleTimeString();
         return result;
       };

       childProcess.handler(actionMethod);

So you first define your *actionMethod* which will process the contents of the action object that you originally placed 
on the queue.  This method can do anything you like, and must return a value or object.  This returnValue will be automatically sent back to 
the master Node process which will look after what is done with it, eg sending it back to a user as a web page.

Then just add the last line exactly as shown above.  That's it!  *threads* will do the rest.

## Defining the master Node Results Handler method

You define this in the master Node process.  Here's an example that will package up the resonses from the child Processes
as web pages:

      var responseHandler = function(requestObj, results) {
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

- requestObj will be picked up automatically by *threads* and is the original requestObj you placed on the queue
- results is the returnValue you returned from your childProcesses.

You add a reference to this handler whenever you add a request/action to the *threads* queue, eg:

       threads.addToQueue(requestObj, responseHandler);

## That's it!

You now have the best of all worlds: a non-blocked scalable Node server process, with a pool of child Node processes in which you 
can use synchronous logic without any concern about blocking other users.  You can also make use of your multi-core processor into 
the bargain!

See the simple worked example in the /examples directory of this repository
	  
Enjoy!
	   
## License

Feel free to download, use and redistribute without restriction.  All I really ask for is acknowledgement of your use or 
modification of this module, and respect for its copyright.

Copyright (c) 2011 M/Gateway Developments Ltd,
Reigate, Surrey UK.
All rights reserved.

http://www.mgateway.com
Email: rtweed@mgateway.com

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.

