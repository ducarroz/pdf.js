/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals NotImplementedException, MissingDataException, PDFJS, Stream,
           PDFDocument, extend, ChunkedStream, ChunkedStreamManager */

'use strict';

var BasePdfManager = (function BasePdfManagerClosure() {
  function BasePdfManager() {
    throw new Error('Cannot initialize BaseManagerManager');
  }

  BasePdfManager.prototype = {
    onLoadedStream: function BasePdfManager_onLoadedStream() {
      throw new NotImplementedException();
    },

    ensureModel: function BasePdfManager_ensureModel(prop) {
      var args = [].slice.call(arguments);
      args.unshift(this.pdfModel);
      return this.ensure.apply(this, args);
    },

    ensureXref: function BasePdfManager_ensureXref(prop) {
      var args = [].slice.call(arguments);
      args.unshift(this.pdfModel.xref);
      return this.ensure.apply(this, args);
    },

    ensureCatalog: function BasePdfManager_ensureCatalog(prop) {
      var args = [].slice.call(arguments);
      args.unshift(this.pdfModel.catalog);
      return this.ensure.apply(this, args);
    },

    ensurePage: function BasePdfManager_ensurePage(pageIndex, prop) {
      var promise = new PDFJS.Promise(pageIndex);
      var args = [].slice.call(arguments, 1);
      this.pdfModel.getPage(pageIndex).then(
        function(pdfPage) {
          args.unshift(pdfPage);
          this.ensure.apply(this, args).then(
            promise.resolve.bind(promise),
            promise.reject.bind(promise)
          );
        }.bind(this),
        promise.reject.bind(promise)
      );
      return promise;
    },

    ensure: function BasePdfManager_ensure(obj, prop) {
      return new NotImplementedException();
    },

    requestAllChunks: function BasePdfManager_requestAllChunks() {}
  };

  return BasePdfManager;
})();

var LocalPdfManager = (function LocalPdfManagerClosure() {
  function LocalPdfManager(data, password) {
    var stream = new Stream(data);
    this.pdfModel = new PDFDocument(stream, password);
    this.loadedStream = new PDFJS.Promise();
    this.loadedStream.resolve(stream);
  }

  LocalPdfManager.prototype = Object.create(BasePdfManager.prototype);
  extend(LocalPdfManager.prototype, {

    onLoadedStream: function LocalPdfManager_getLoadedStream() {
      return this.loadedStream;
    },

    ensure: function LocalPdfManager_ensure(obj, prop) {
      var promise = new PDFJS.Promise();
      var result;
      var value = obj[prop];
      try {
        if (typeof(value) === 'function') {
          var args = [].slice.call(arguments, 2);
          result = value.apply(obj, args);
        } else {
          result = value;
        }
        promise.resolve(result);
      } catch (e) {
        console.log(e.stack);
        promise.reject(e);
      }
      return promise;
    }
  });

  return LocalPdfManager;
})();

var NetworkPdfManager = (function NetworkPdfManagerClosure() {

  var CHUNK_SIZE = 64000;

  function NetworkPdfManager(args, msgHandler) {

    this.chunkSize = CHUNK_SIZE;
    this.pdfUrl = args.url;
    this.pdfLength = args.totalLength;
    this.stream = new ChunkedStream(this.pdfLength, this.chunkSize);
    this.pdfModel = new PDFDocument(this.stream, args.password);
    this.msgHandler = msgHandler;

    var params = {
      msgHandler: msgHandler,
      httpHeaders: args.httpHeaders,
      chunkedViewerLoading: args.chunkedViewerLoading
    };
    this.streamManager = new ChunkedStreamManager(
        this.stream, this.pdfUrl, params);
  }

  NetworkPdfManager.prototype = Object.create(BasePdfManager.prototype);
  extend(NetworkPdfManager.prototype, {

    onLoadedStream: function NetworkPdfManager_getLoadedStream() {
      return this.streamManager.onLoadedStream();
    },

    ensure: function NetworkPdfManager_ensure(obj, prop) {
      var promise = new PDFJS.Promise();
      var args = [].slice.call(arguments);
      args.unshift(promise);
      this.ensureHelper.apply(this, args);
      return promise;
    },

    ensureHelper: function NetworkPdfManager_ensureHelper(promise, obj, prop) {
      try {
        var result;
        var value = obj[prop];
        if (typeof(value) === 'function') {
          var args = [].slice.call(arguments, 3);
          result = value.apply(obj, args);
        } else {
          result = value;
        }
        promise.resolve(result);
      } catch(e) {
        if (!(e instanceof MissingDataException)) {
          console.log(e.stack);
          promise.reject(e);
          return;
        }

        var allArgs = [].slice.call(arguments);
        this.loadPdf(e.begin, e.end).then(function() {
          this.ensureHelper.apply(this, allArgs);
        }.bind(this));
      }
    },

    loadPdf: function NetworkPdfManager_loadPdf(begin, end) {
      var promise = new PDFJS.Promise();
      this.streamManager.requestRange(begin, end, function loadMorePdf() {
        this.msgHandler.send('DocProgress', {
          // TODO(mack): consider sending these params through args from
          // StreamManager
          loaded: this.stream.numChunksLoaded * this.chunkSize,
          // FIXME(mack): look into where lengthComputable is set
          // e.g. code used to be: lengthComputable ? evt.total : void(0)
          total: this.pdfLength
        });

        promise.resolve();
      }.bind(this));

      return promise;
    },

    requestAllChunks: function NetworkPdfManager_requestAllChunks() {
      this.streamManager.requestAllChunks();
    }
  });

  return NetworkPdfManager;

  //function networkPdfError(evt) {
  //  if (evt.target.status == 404) {
  //    var exception = new MissingPDFException(
  //        'Missing PDF "' + this.pdfUrl + '".');
  //    this.msgHandler.send('MissingPDF', {
  //      exception: exception
  //    });
  //  } else {
  //    this.msgHandler.send('DocError', 'Unexpected server response (' +
  //        evt.target.status + ') while retrieving PDF "' +
  //        this.pdfUrl + '".');
  //  }
  //}
})();

