# Detatch

Detatch is a demo to show how CouchDB attachments can be used to store attached images on a mobile device, sync them to a Cloud-hosted replica where they are detached and stored in Object storage.

First of all let's introduce the problem.

## The mobile app

We have a mobile app that uses either:

* [CouchDB](http://couchdb.apache.org/) - for storage on a client-side PC or laptop
* [PouchDB](http://pouchdb.com/) - for a client-side, in-browser database
* [Cloudant Sync](https://cloudant.com/product/cloudant-features/sync/) - for [iOS](https://github.com/cloudant/CDTDatastore) or [Android](https://github.com/cloudant/sync-android) native applications

The app records JSON documents in database called `profiles` and optionally adds attachments to the documents. The attachments could represent profile photos, PDF files or any other computer file we want to store against this database entry. As the database is local to the mobile device, the app can behave in an *Offline-First* way, reading and writing data locally and syncing to the cloud when there is a data connection. This gives excellent performance for the user and ensures that the application remains useful when the network is unavailable.

Let's assume our documents look like this:

```
{
  "_id": "myid",
  "_rev": "2-db47c115f9d0960d49a308584db86606",
  "a": 1,
  "b": 2,
  "_attachments": {
    "picture.png": {
      "content_type": "image/png",
      "revpos": 2,
      "digest": "md5-2lIQFtyQX+/1juhM7NObiw==",
      "length": 2518,
      "stub": true
    }
  }
}
```

You can see we have a couple of key value pairs (`a` and `b`) and a single attachment which is a PNG image. CouchDB, and by extension PouchDB and Cloudant Sync, allows a number of attachments to be stored against a document. The attachment's meta data is stored in the `_attachments` object and includes the Mime type, a hash of its content and the an indication of its size.

The attachment itself can be served out from CouchDB/Cloudant using the following path

```
    /profiles/myid/picture.png
    /<database name>/<document id>/<attachment name>
```

Accessing this URL will serve out the attachment with its original Mime type. 

CouchDB's replication protocol allows us to sync our JSON data and any attachments to another CouchDB or IBM Cloudant instance with a single API call; we merely have to specify URL of the remote database.


## The CDN

We may not want to serve out our attached content directly from our our remote Cloudant database. We *can* do that, but it is better practice to put binary attachments in Object Storage and put the URLs of the files back in the document database. Object Storage is designed to store large binary files and is often backed with Content Delivery Network (CDN) functionality, which distributes the files around the globe giving your users access to the content with fewer network hops.

 Whether you choose IBM Object Storage, Amazon S3 or something else, the principle is the same:

* extract the attachments from our documents
* store in Object storage or on a CDN
* put the URLs of the attachments back in the object.

Our document becomes this:

```
{
  "_id": "myid",
  "_rev": "3-8954b31b260955a4dc77424d84b394c7",
  "a": 1,
  "b": 2,
  "attachments": {
    "picture.png": {
      "content_type": "image/png",
      "length": 2518,
      "objectpath": "https://my.objectstore.com/m/y/i/d/picture.png"
    }
  }
}
```

Notice how the key of the array is now `attachments`, not `_attachments`, so we are no longer relying on CouchDB's attachment. We have detached the files from the database and left behind a subset of the meta data, adding the URL of the file in the Object Store of our choice.

## Running this app

Install this app by cloning this repository and then running `npm install` to download its dependencies.

This demo expects the following environment variables to be provided:

* COUCH_URL - the URL of the CouchDB or Cloudant instance to use 
* COUCH_DATABASE - the name of the database containing the documents with the attachments 

e.g.

```sh

export COUCH_URL=https://myusername:mypassword@mydomain.cloudant.com
export COUCH_DATABASE=profiles

or

export COUCH_URL=http://127.0.0.1:5984
export COUCH_DATABASE=profiles
```

When the app runs, it listens to changes happening on the `COUCH_DATABASE`. If a document that changes contains an attachment, it is extracted, saved to disk and the attachment is replaced with a smaller object containing the URL of attachment.

Run the app with:

```sh
node app.js
```

## To do

### Actually use Object Storage

At the moment, this app simply saves the attachments to an 'objectstorage' folder on the local disk. This function (copyFileToObjectStorage) could be switched out for a function that writes data to IBM Object Storage or Amazon S3.

### Storing state

The application always gets new changes i.e we ask changes from the database from "now" (since=now). It is possible to provide a value of `since` that indicates where we are up to in the changes feed. This would requiring storing the id the change that we last processed (the value of `seq`) somewhere.

## Links
Node.js tutorial (object storage):

* Node.js tutorial - http://www.ibm.com/developerworks/cloud/library/cl-cloud-storage-app/index.html
* Recipe using - https://developer.ibm.com/recipes/tutorials/using-the-ibm-object-storage-for-bluemix-with-node-js-applications/
