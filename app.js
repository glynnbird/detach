
// look for Cloudant URL
if (!process.env.COUCH_URL) {
  throw("Please define environment variable COUCH_URL");
}
var cloudant = require('cloudant')(process.env.COUCH_URL);

// extract environment variable that defines the database name
if (!process.env.COUCH_DATABASE) {
  throw("Please define environment variable COUCH_DATABASE");
}
console.log("Using Cloudant database", process.env.COUCH_DATABASE);
var db = cloudant.db.use(process.env.COUCH_DATABASE);

// external libraries
var fs = require('fs'),
  mkdirp = require('mkdirp'),
  _ = require('underscore'),
  async = require('async');


// detatch a CouchDB attachment and save it to local storage
var copyFileToObjectStorage = function(id, filename, attachment, callback) {
  
  var path = "objectstorage/" + id.substr(0,4).split("").join("/");
    
  // make the directory on the file system
  mkdirp(path, function (err) {
    if (err) {
      console.error(err);
      return callback(true, null);
    }
    
    // copy the file from CouchDB to object storage
    path += "/" + filename;
    console.log("Copying attachment", filename, "to object store", path);
    db.attachment.get(id, filename, function(err, buffer) {
      fs.writeFile("./" + path, buffer, function(err) {
        attachment.objectpath = path;
        var retval = {};
        delete attachment.revpos;
        delete attachment.digest;
        delete attachment.stub;
        retval[filename] = attachment;
        callback(null, retval);
      });
    });
  });
}

// run a queue with a parallelism of five
var q = async.queue(function(payload, callback) {
  var tasks = [];
  console.log("Processing", JSON.stringify(payload));
  
  // for each attachment in the document
  for (var i in payload._attachments) {
    
    // add an entry to our 'tasks' array to copy the file to object storage
    (function(f, a ) {
      tasks.push(function(cb) {
        
        copyFileToObjectStorage(payload._id, f, a, cb);
      });
    })(i, payload._attachments[i])
  }
  
  // perform all the tasks
  async.series(tasks, function(err, results) {
    
    // get coherent object of results
    var attachments = payload.attachments || {};
    for (var i in results) {
      attachments = _.extend(attachments, results[0]);
    }
    
    // replace the CouchDB attachments with our list of URLs
    delete payload._attachments;
    payload.attachments = attachments;
    
    // write back to database
    db.insert(payload, callback);
  });

},1);


// listen for changes from "now"
var feed = db.follow({since: "0",include_docs:true});
feed.on('change', function (change) {
  console.log("change", change.seq);
  if (typeof change.deleted == "undefined" && change.doc && change.doc._attachments) {
    q.push(change.doc);
  }
});
feed.follow();

